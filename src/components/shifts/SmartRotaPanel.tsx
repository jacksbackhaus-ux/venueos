import { showAIFeatures } from "@/lib/launchFlags";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Loader2,
  Check,
  X,
  AlertTriangle,
  Users,
  Clock,
  RotateCcw,
  ChevronDown,
  Megaphone,
  CalendarDays,
  PoundSterling,
  ShieldCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { aiShiftsTracker } from "@/lib/aiShiftsTracker";

type Suggestion = {
  day: string;
  date: string;
  staff_name: string;
  staff_id: string;
  start_time: string;
  end_time: string;
  position: string | null;
  reason: string;
  _key?: string;
  _accepted?: boolean;
};
type Gap = {
  day: string;
  date: string;
  start_time: string;
  end_time: string;
  position: string | null;
  reason: string;
  _key?: string;
  _posted?: boolean;
};
type Warning = {
  type: "overtime_risk" | "insufficient_rest" | "understaffed" | "unconfirmed_shift";
  message: string;
  staff_name: string | null;
  day: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  siteId: string;
  organisationId: string;
  weekStart: string;
  weekEnd: string;
  shiftHiveActive: boolean;
  messengerActive: boolean;
}

function hoursBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let h = eh + (em || 0) / 60 - (sh + (sm || 0) / 60);
  if (h <= 0) h += 24;
  return h;
}

function toTimeWithSeconds(t: string) {
  return /^\d{2}:\d{2}$/.test(t) ? `${t}:00` : t;
}

export function SmartRotaPanel({
  open,
  onOpenChange,
  siteId,
  organisationId,
  weekStart,
  weekEnd,
  shiftHiveActive,
  messengerActive,
}: Props) {
  if (!showAIFeatures) return null;
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [summary, setSummary] = useState("");
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
  const [staffRates, setStaffRates] = useState<Record<string, number | null>>({});
  const [gapsOpen, setGapsOpen] = useState(true);
  const [warningsOpen, setWarningsOpen] = useState(true);

  const fetchData = async (force = false) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-rota", {
        body: { site_id: siteId, week_start: weekStart, force },
      });
      if (error) throw error;
      const d = data as any;
      if (d?.error) throw new Error(d.error);
      const sugg: Suggestion[] = (d.suggestions ?? []).map((s: any, i: number) => ({
        ...s,
        _key: `${s.date}-${i}-${s.staff_id}`,
      }));
      const gp: Gap[] = (d.gaps ?? []).map((g: any, i: number) => ({
        ...g,
        _key: `gap-${g.date}-${i}`,
      }));
      setSuggestions(sugg);
      setGaps(gp);
      setWarnings(d.warnings ?? []);
      setSummary(d.summary ?? "");
      setGeneratedAt(d.generated_at ?? null);
      const days: Record<string, boolean> = {};
      sugg.forEach((s) => (days[s.date] = true));
      setOpenDays(days);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load suggestions");
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (open) {
      void fetchData(false);
      supabase
        .from("memberships")
        .select("user_id, users:user_id(hourly_rate)")
        .eq("site_id", siteId)
        .eq("active", true)
        .then(({ data }) => {
          const map: Record<string, number | null> = {};
          (data ?? []).forEach((m: any) => {
            map[m.user_id] = m.users?.hourly_rate ? Number(m.users.hourly_rate) : null;
          });
          setStaffRates(map);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, siteId, weekStart]);

  const regenerate = async () => {
    setGenerating(true);
    await fetchData(true);
  };

  const insertShift = async (s: Suggestion): Promise<string | null> => {
    const { data, error } = await supabase
      .from("rota_assignments")
      .insert({
        site_id: siteId,
        organisation_id: organisationId,
        user_id: s.staff_id,
        shift_date: s.date,
        start_time: toTimeWithSeconds(s.start_time),
        end_time: toTimeWithSeconds(s.end_time),
        position: s.position ?? null,
      })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return null;
    }
    return data?.id ?? null;
  };

  const acceptOne = async (key: string) => {
    const idx = suggestions.findIndex((s) => s._key === key);
    if (idx < 0) return;
    const s = suggestions[idx];
    const newId = await insertShift(s);
    if (newId) {
      aiShiftsTracker.add(newId);
      setSuggestions((prev) =>
        prev.map((x) => (x._key === key ? { ...x, _accepted: true } : x)),
      );
      qc.invalidateQueries({ queryKey: ["rota-assignments"] });
      qc.invalidateQueries({ queryKey: ["shifts"] });
      toast.success(`Added ${s.staff_name} to the rota`);
    }
  };

  const rejectOne = (key: string) => {
    setSuggestions((prev) => prev.filter((s) => s._key !== key));
  };

  const acceptAll = async () => {
    const remaining = suggestions.filter((s) => !s._accepted);
    if (!remaining.length) return;
    let count = 0;
    const newIds: string[] = [];
    for (const s of remaining) {
      const id = await insertShift(s);
      if (id) {
        newIds.push(id);
        count++;
      }
    }
    if (newIds.length) aiShiftsTracker.add(newIds);
    setSuggestions((prev) =>
      prev.map((s) => (newIds.length && !s._accepted ? { ...s, _accepted: true } : s)),
    );
    qc.invalidateQueries({ queryKey: ["rota-assignments"] });
    qc.invalidateQueries({ queryKey: ["shifts"] });
    toast.success(`${count} shifts added to the rota`);
  };

  const rejectAll = () => setSuggestions([]);

  const postGapToShiftHive = async (gap: Gap) => {
    if (!shiftHiveActive) return;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: appUser } = await supabase
        .from("users")
        .select("id")
        .eq("auth_user_id", user!.id)
        .maybeSingle();
      if (!appUser?.id) throw new Error("Could not resolve user");
      const { data: shift, error: e1 } = await supabase
        .from("rota_assignments")
        .insert({
          site_id: siteId,
          organisation_id: organisationId,
          user_id: appUser.id,
          shift_date: gap.date,
          start_time: toTimeWithSeconds(gap.start_time),
          end_time: toTimeWithSeconds(gap.end_time),
          position: gap.position ?? null,
        })
        .select("id")
        .single();
      if (e1 || !shift) throw e1 ?? new Error("Failed to create shift");
      const { error: e2 } = await supabase.from("shift_requests").insert({
        site_id: siteId,
        organisation_id: organisationId,
        original_shift_id: shift.id,
        request_type: "cover",
        requester_id: appUser.id,
        target_user_id: null,
        status: "pending_teammate",
        message: `Open shift — ${gap.day} ${gap.start_time}–${gap.end_time}${gap.position ? " (" + gap.position + ")" : ""}`,
      });
      if (e2) throw e2;
      setGaps((prev) => prev.map((g) => (g._key === gap._key ? { ...g, _posted: true } : g)));
      qc.invalidateQueries({ queryKey: ["rota-assignments"] });
      toast.success("Posted to Shift Hive");
    } catch (e: any) {
      toast.error(e?.message || "Failed to post gap");
    }
  };

  const sendReminder = async (w: Warning) => {
    if (!messengerActive) return;
    try {
      const { data: channel } = await supabase
        .from("messenger_channels")
        .select("id")
        .eq("site_id", siteId)
        .eq("name", "whole-site")
        .eq("is_system", true)
        .maybeSingle();
      if (!channel?.id) throw new Error("Messenger channel not found");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: appUser } = await supabase
        .from("users")
        .select("id, display_name")
        .eq("auth_user_id", user!.id)
        .maybeSingle();
      const content = `🔔 Reminder${w.staff_name ? ` for ${w.staff_name}` : ""}: ${w.message}`;
      const { error } = await supabase.from("messenger_messages").insert([{
        channel_id: channel.id,
        site_id: siteId,
        sender_id: appUser?.id ?? null,
        sender_name_snapshot: appUser?.display_name ?? "Manager",
        content,
        message_type: "user",
      }]);
      if (error) throw error;
      toast.success("Reminder sent");
    } catch (e: any) {
      toast.error(e?.message || "Failed to send reminder");
    }
  };

  // ---- Derived ----
  const pendingCount = useMemo(
    () => suggestions.filter((s) => !s._accepted).length,
    [suggestions],
  );
  const acceptedCount = suggestions.length - pendingCount;

  const grouped = useMemo(() => {
    const m = new Map<string, { day: string; date: string; items: Suggestion[] }>();
    suggestions.forEach((s) => {
      const k = s.date;
      if (!m.has(k)) m.set(k, { day: s.day, date: s.date, items: [] });
      m.get(k)!.items.push(s);
    });
    return [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [suggestions]);

  const labourCost = useMemo(() => {
    let total = 0;
    suggestions
      .filter((s) => s._accepted)
      .forEach((s) => {
        const rate = staffRates[s.staff_id] ?? 0;
        total += hoursBetween(s.start_time, s.end_time) * (rate ?? 0);
      });
    return total;
  }, [suggestions, staffRates]);

  const weekRangeLabel = useMemo(() => {
    const a = new Date(`${weekStart}T00:00:00`);
    const b = new Date(`${weekEnd}T00:00:00`);
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return `${fmt(a)} – ${fmt(b)}`;
  }, [weekStart, weekEnd]);

  const severeWarnings = warnings.filter(
    (w) => w.type === "overtime_risk" || w.type === "insufficient_rest",
  ).length;

  // Friendly one-liner headline
  const headline = useMemo(() => {
    if (loading) return "Building your week…";
    if (!suggestions.length && !gaps.length)
      return "Looks good — nothing to suggest for this week.";
    const parts: string[] = [];
    if (pendingCount > 0)
      parts.push(
        `${pendingCount} suggested shift${pendingCount === 1 ? "" : "s"} ready to review`,
      );
    if (gaps.length)
      parts.push(`${gaps.length} open gap${gaps.length === 1 ? "" : "s"}`);
    if (severeWarnings)
      parts.push(
        `${severeWarnings} compliance flag${severeWarnings === 1 ? "" : "s"}`,
      );
    return parts.join(" • ");
  }, [loading, suggestions.length, pendingCount, gaps.length, severeWarnings]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </span>
            <div className="flex flex-col items-start">
              <span className="font-heading">Smart Rota</span>
              <span className="text-xs font-normal text-muted-foreground flex items-center gap-1">
                <CalendarDays className="h-3 w-3" /> Week of {weekRangeLabel}
              </span>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Body */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Reading availability, rest rules and recent shifts…
            </p>
          </div>
        ) : (
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-6 py-5 space-y-5">
              {/* Hero summary */}
              <Card className="bg-muted/40 border-border">
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm font-medium">{headline}</p>
                  {summary && (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {summary}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Based on each person's availability, recent shifts and UK rest
                    rules.
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    <Stat
                      icon={<Sparkles className="h-3.5 w-3.5" />}
                      label="Suggested"
                      value={suggestions.length.toString()}
                    />
                    <Stat
                      icon={<Check className="h-3.5 w-3.5" />}
                      label="Accepted"
                      value={`${acceptedCount}/${suggestions.length || 0}`}
                    />
                    <Stat
                      icon={<AlertTriangle className="h-3.5 w-3.5" />}
                      label="Gaps"
                      value={gaps.length.toString()}
                      tone={gaps.length ? "warn" : undefined}
                    />
                    <Stat
                      icon={<PoundSterling className="h-3.5 w-3.5" />}
                      label="Accepted cost"
                      value={`£${labourCost.toFixed(0)}`}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Suggestions */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    Suggested shifts
                    {pendingCount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {pendingCount} to review
                      </Badge>
                    )}
                  </h3>
                  {suggestions.length > 0 && (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={rejectAll}>
                        Clear all
                      </Button>
                      <Button
                        size="sm"
                        onClick={acceptAll}
                        disabled={pendingCount === 0}
                      >
                        <Check className="h-4 w-4 mr-1" /> Accept all
                      </Button>
                    </div>
                  )}
                </div>

                {grouped.length === 0 ? (
                  <EmptyHint>
                    No shifts suggested. Try regenerating, or add shifts manually.
                  </EmptyHint>
                ) : (
                  <div className="space-y-3">
                    {grouped.map((g) => (
                      <div key={g.date} className="rounded-lg border bg-card">
                        <button
                          type="button"
                          className="w-full flex items-center justify-between px-4 py-3"
                          onClick={() =>
                            setOpenDays((p) => ({ ...p, [g.date]: !p[g.date] }))
                          }
                        >
                          <div className="flex items-center gap-2">
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 transition-transform text-muted-foreground",
                                !openDays[g.date] && "-rotate-90",
                              )}
                            />
                            <span className="font-semibold text-sm">{g.day}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(g.date + "T00:00:00").toLocaleDateString(
                                "en-GB",
                                { day: "numeric", month: "short" },
                              )}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {g.items.length} shift{g.items.length === 1 ? "" : "s"}
                          </Badge>
                        </button>
                        <AnimatePresence initial={false}>
                          {openDays[g.date] && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="px-3 pb-3 space-y-2 border-t pt-3">
                                <AnimatePresence>
                                  {g.items.map((s) => (
                                    <motion.div
                                      key={s._key}
                                      layout
                                      initial={{ opacity: 0, y: 4 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, x: 20 }}
                                    >
                                      <SuggestionRow
                                        s={s}
                                        onAccept={() => acceptOne(s._key!)}
                                        onReject={() => rejectOne(s._key!)}
                                      />
                                    </motion.div>
                                  ))}
                                </AnimatePresence>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Gaps */}
              {gaps.length > 0 && (
                <CollapsibleSection
                  title="Open gaps"
                  count={gaps.length}
                  tone="warn"
                  open={gapsOpen}
                  onToggle={() => setGapsOpen((v) => !v)}
                  description="Shifts the AI couldn't fill — post to Shift Hive so staff can volunteer."
                >
                  <div className="space-y-2">
                    {gaps.map((g) => (
                      <div
                        key={g._key}
                        className="rounded-md border border-warning/30 bg-warning/5 p-3"
                      >
                        <div className="flex items-center gap-2 flex-wrap text-sm">
                          <span className="font-medium">{g.day}</span>
                          <span className="text-xs text-muted-foreground">
                            {g.date}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {g.start_time}–{g.end_time}
                          </Badge>
                          {g.position && (
                            <span className="text-xs text-muted-foreground">
                              {g.position}
                            </span>
                          )}
                        </div>
                        {g.reason && (
                          <p className="text-xs text-muted-foreground mt-1.5">
                            {g.reason}
                          </p>
                        )}
                        <div className="mt-2.5">
                          {shiftHiveActive ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => postGapToShiftHive(g)}
                              disabled={g._posted}
                            >
                              <Megaphone className="h-4 w-4 mr-1" />
                              {g._posted ? "Posted" : "Post to Shift Hive"}
                            </Button>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">
                              Enable Shift Hive to let staff volunteer.
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* Warnings */}
              {warnings.length > 0 && (
                <CollapsibleSection
                  title="Things to check"
                  count={warnings.length}
                  tone={severeWarnings ? "danger" : "warn"}
                  open={warningsOpen}
                  onToggle={() => setWarningsOpen((v) => !v)}
                  description="Possible compliance or staffing issues to review before publishing."
                >
                  <div className="space-y-2">
                    {warnings.map((w, i) => {
                      const isSevere =
                        w.type === "overtime_risk" || w.type === "insufficient_rest";
                      const Icon =
                        w.type === "understaffed"
                          ? Users
                          : w.type === "unconfirmed_shift"
                            ? Clock
                            : AlertTriangle;
                      return (
                        <div
                          key={i}
                          className={cn(
                            "rounded-md border p-3 flex items-start gap-3",
                            isSevere
                              ? "border-red-300 bg-red-50"
                              : "border-warning/30 bg-warning/5",
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-5 w-5 shrink-0 mt-0.5",
                              isSevere ? "text-red-600" : "text-amber-600",
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-[10px] uppercase">
                                {w.type.replace(/_/g, " ")}
                              </Badge>
                              {w.staff_name && (
                                <span className="text-xs font-medium">
                                  {w.staff_name}
                                </span>
                              )}
                              {w.day && (
                                <span className="text-xs text-muted-foreground">
                                  {w.day}
                                </span>
                              )}
                            </div>
                            <p className="text-sm mt-1">{w.message}</p>
                            {w.type === "unconfirmed_shift" && messengerActive && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="mt-2"
                                onClick={() => sendReminder(w)}
                              >
                                Send reminder
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleSection>
              )}
            </div>
          </ScrollArea>
        )}

        {/* Sticky footer */}
        <div className="border-t bg-background px-6 py-3 flex items-center justify-between shrink-0 gap-3 flex-wrap">
          <span className="text-xs text-muted-foreground">
            {generatedAt
              ? `Generated ${new Date(generatedAt).toLocaleString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                  day: "numeric",
                  month: "short",
                })}`
              : "Not yet generated"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={regenerate}
              disabled={generating || loading}
            >
              {generating ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-1" />
              )}
              Regenerate
            </Button>
            <Button size="sm" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- helpers ----------

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "warn";
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-background px-3 py-2",
        tone === "warn" && "border-warning/40 bg-warning/5",
      )}
    >
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        {icon} {label}
      </div>
      <div className="text-base font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function CollapsibleSection({
  title,
  count,
  tone,
  open,
  onToggle,
  description,
  children,
}: {
  title: string;
  count: number;
  tone?: "warn" | "danger";
  open: boolean;
  onToggle: () => void;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between"
      >
        <h3 className="text-sm font-semibold flex items-center gap-2">
          {title}
          <Badge
            variant="secondary"
            className={cn(
              "text-xs",
              tone === "danger" && "bg-red-100 text-red-800",
              tone === "warn" && "bg-amber-100 text-amber-800",
            )}
          >
            {count}
          </Badge>
        </h3>
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform text-muted-foreground",
            !open && "-rotate-90",
          )}
        />
      </button>
      {description && open && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function SuggestionRow({
  s,
  onAccept,
  onReject,
}: {
  s: Suggestion;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 rounded-md border bg-background px-3 py-2.5 transition-colors",
        s._accepted && "bg-green-50 border-green-200",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-semibold text-sm truncate">{s.staff_name}</span>
          <span className="text-sm text-muted-foreground">
            {s.start_time}–{s.end_time}
          </span>
          {s.position && (
            <Badge variant="outline" className="text-[10px]">
              {s.position}
            </Badge>
          )}
        </div>
        {s.reason && (
          <p className="text-xs text-muted-foreground mt-1 leading-snug">
            {s.reason}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {s._accepted ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 px-2 py-1">
            <Check className="h-4 w-4" /> Added
          </span>
        ) : (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-muted-foreground hover:text-red-600 hover:bg-red-50"
              onClick={onReject}
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              className="h-8 px-3"
              onClick={onAccept}
            >
              <Check className="h-4 w-4 mr-1" /> Accept
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
