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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
      // open all day groups by default
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

  // Load on open
  useEffect(() => {
    if (open) {
      void fetchData(false);
      // fetch hourly_rates for cost calc
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
      toast.success(`Shift added for ${s.staff_name}`);
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
    toast.success(`${count} shifts added to rota`);
  };

  const rejectAll = () => setSuggestions([]);

  const postGapToShiftHive = async (gap: Gap) => {
    if (!shiftHiveActive) return;
    try {
      // 1) get current app user id
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: appUser } = await supabase
        .from("users")
        .select("id")
        .eq("auth_user_id", user!.id)
        .maybeSingle();
      if (!appUser?.id) throw new Error("Could not resolve user");
      // 2) create placeholder rota_assignment owned by manager
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
      // 3) create open cover request
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
  const acceptedCount = useMemo(
    () => suggestions.filter((s) => s._accepted).length,
    [suggestions],
  );

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

  const operatingDaysCovered = useMemo(() => {
    const dates = new Set<string>();
    suggestions.filter((s) => s._accepted).forEach((s) => dates.add(s.date));
    return dates.size;
  }, [suggestions]);
  const totalOperatingDays = useMemo(() => {
    const dates = new Set<string>();
    [...suggestions, ...gaps].forEach((s: any) => dates.add(s.date));
    return dates.size;
  }, [suggestions, gaps]);
  const coveragePct =
    totalOperatingDays > 0 ? Math.round((operatingDaysCovered / totalOperatingDays) * 100) : 0;

  const weekRangeLabel = useMemo(() => {
    const a = new Date(`${weekStart}T00:00:00`);
    const b = new Date(`${weekEnd}T00:00:00`);
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return `${fmt(a)} – ${fmt(b)}`;
  }, [weekStart, weekEnd]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Smart Rota
          </DialogTitle>
          <p className="text-sm text-muted-foreground">Week of {weekRangeLabel}</p>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="suggestions" className="flex-1 flex flex-col min-h-0">
            <TabsList className="mx-6 mt-4 self-start">
              <TabsTrigger value="suggestions">
                Suggestions
                {suggestions.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{suggestions.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="gaps">
                Gaps
                {gaps.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{gaps.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="warnings">
                Warnings
                {warnings.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{warnings.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="summary">Summary</TabsTrigger>
            </TabsList>

            {/* SUGGESTIONS */}
            <TabsContent value="suggestions" className="flex-1 min-h-0 mt-3 px-6 pb-3">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-muted-foreground">
                  {acceptedCount} of {suggestions.length} suggestions accepted
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={rejectAll}>
                    Reject All
                  </Button>
                  <Button size="sm" onClick={acceptAll} disabled={!suggestions.length}>
                    Accept All
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-[calc(90vh-280px)] pr-3">
                {grouped.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    No suggestions to review.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {grouped.map((g) => (
                      <Card key={g.date}>
                        <button
                          type="button"
                          className="w-full flex items-center justify-between p-3"
                          onClick={() =>
                            setOpenDays((p) => ({ ...p, [g.date]: !p[g.date] }))
                          }
                        >
                          <div className="flex items-center gap-2">
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 transition-transform",
                                !openDays[g.date] && "-rotate-90",
                              )}
                            />
                            <span className="font-semibold">{g.day}</span>
                            <span className="text-xs text-muted-foreground">{g.date}</span>
                          </div>
                          <Badge variant="secondary">{g.items.length}</Badge>
                        </button>
                        <AnimatePresence>
                          {openDays[g.date] && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="px-3 pb-3 space-y-2">
                                <AnimatePresence>
                                  {g.items.map((s) => (
                                    <motion.div
                                      key={s._key}
                                      layout
                                      initial={{ opacity: 0, y: 4 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, x: 20 }}
                                    >
                                      <Card
                                        className={cn(
                                          "p-3 transition-colors",
                                          s._accepted && "bg-green-50 border-green-200",
                                        )}
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className="font-medium">{s.staff_name}</span>
                                              <Badge variant="secondary" className="text-xs">
                                                {s.start_time}–{s.end_time}
                                              </Badge>
                                              {s.position && (
                                                <span className="text-xs text-muted-foreground">
                                                  {s.position}
                                                </span>
                                              )}
                                            </div>
                                            {s.reason && (
                                              <p className="text-xs text-muted-foreground italic mt-1">
                                                {s.reason}
                                              </p>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-1 shrink-0">
                                            {s._accepted ? (
                                              <Check className="h-4 w-4 text-green-600" />
                                            ) : (
                                              <>
                                                <Button
                                                  size="icon"
                                                  variant="ghost"
                                                  className="h-7 w-7 text-green-600 hover:bg-green-50"
                                                  onClick={() => acceptOne(s._key!)}
                                                >
                                                  <Check className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                  size="icon"
                                                  variant="ghost"
                                                  className="h-7 w-7 text-red-600 hover:bg-red-50"
                                                  onClick={() => rejectOne(s._key!)}
                                                >
                                                  <X className="h-4 w-4" />
                                                </Button>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </Card>
                                    </motion.div>
                                  ))}
                                </AnimatePresence>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* GAPS */}
            <TabsContent value="gaps" className="flex-1 min-h-0 mt-3 px-6 pb-3">
              <ScrollArea className="h-[calc(90vh-240px)] pr-3">
                {gaps.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    No gaps — every shift has a suggestion.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {gaps.map((g) => (
                      <Card key={g._key} className="border-warning/30 bg-warning/5 p-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{g.day}</span>
                          <span className="text-xs text-muted-foreground">{g.date}</span>
                          <Badge variant="secondary" className="text-xs">
                            {g.start_time}–{g.end_time}
                          </Badge>
                          {g.position && (
                            <span className="text-xs text-muted-foreground">{g.position}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">{g.reason}</p>
                        <div className="mt-3">
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
                              Enable Shift Hive to let staff volunteer for open shifts
                            </p>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* WARNINGS */}
            <TabsContent value="warnings" className="flex-1 min-h-0 mt-3 px-6 pb-3">
              <ScrollArea className="h-[calc(90vh-240px)] pr-3">
                {warnings.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    No warnings — looks good.
                  </div>
                ) : (
                  <div className="space-y-3">
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
                        <Card
                          key={i}
                          className={cn(
                            "p-3 flex items-start gap-3",
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
                                {w.type.replace("_", " ")}
                              </Badge>
                              {w.staff_name && (
                                <span className="text-xs font-medium">{w.staff_name}</span>
                              )}
                              {w.day && (
                                <span className="text-xs text-muted-foreground">{w.day}</span>
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
                        </Card>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* SUMMARY */}
            <TabsContent value="summary" className="flex-1 min-h-0 mt-3 px-6 pb-3">
              <ScrollArea className="h-[calc(90vh-240px)] pr-3">
                <Card className="p-4 mb-4">
                  <p className="text-sm">{summary || "No summary available."}</p>
                </Card>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <StatCard label="Suggested shifts" value={suggestions.length.toString()} />
                  <StatCard label="Gaps found" value={gaps.length.toString()} />
                  <StatCard label="Warnings" value={warnings.length.toString()} />
                  <StatCard
                    label="Est. labour cost"
                    value={`£${labourCost.toFixed(2)}`}
                    sub="from accepted"
                  />
                  <StatCard label="Coverage" value={`${coveragePct}%`} />
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}

        <div className="border-t px-6 py-3 flex items-center justify-between shrink-0">
          <span className="text-xs text-muted-foreground">
            {generatedAt
              ? `AI-generated ${new Date(generatedAt).toLocaleString("en-GB")}`
              : "Not yet generated"}
          </span>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}
