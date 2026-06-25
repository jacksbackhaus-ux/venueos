import { showAIFeatures } from "@/lib/launchFlags";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type SuggestedShift = {
  staff_name: string;
  staff_id?: string;
  start_time: string;
  end_time: string;
  position: string | null;
  _key?: string;
  _accepted?: boolean;
};
type SuggestedDay = { day: string; date: string; shifts: SuggestedShift[] };

interface Props {
  siteId: string;
  organisationId: string;
  weekStart: string; // YYYY-MM-DD Monday
}

export function AIRotaSuggestButton({ siteId, organisationId, weekStart }: Props) {
  if (!showAIFeatures) return null;
  const { isSupervisorPlus } = useRole();
  const { isActive } = useModuleAccess();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState<SuggestedDay[]>([]);
  const [accepting, setAccepting] = useState(false);

  if (!isSupervisorPlus || !isActive("ai_insights")) return null;

  const generate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-rota", {
        body: { site_id: siteId, week_start: weekStart },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const suggestions = ((data as any).suggestions ?? []) as SuggestedDay[];
      // assign keys
      suggestions.forEach((d) =>
        d.shifts?.forEach((s, i) => (s._key = `${d.date}-${i}-${s.staff_name}`)),
      );
      setDays(suggestions);
      setOpen(true);
    } catch (e: any) {
  if (!showAIFeatures) return null;
      console.error(e);
      toast.error(e?.message || "Failed to generate suggestions");
    } finally {
      setLoading(false);
    }
  };

  const insertShift = async (date: string, s: SuggestedShift): Promise<boolean> => {
    let userId = s.staff_id;
    if (!userId) {
      // resolve by name within the org
      const { data: u } = await supabase
        .from("users")
        .select("id")
        .eq("organisation_id", organisationId)
        .ilike("display_name", s.staff_name)
        .maybeSingle();
      userId = u?.id;
    }
    if (!userId) {
      toast.error(`Could not find staff member "${s.staff_name}"`);
      return false;
    }
    const { error } = await supabase.from("rota_assignments").insert({
      site_id: siteId,
      organisation_id: organisationId,
      user_id: userId,
      shift_date: date,
      start_time: s.start_time,
      end_time: s.end_time,
      position: s.position ?? null,
    });
    if (error) {
      toast.error(error.message);
      return false;
    }
    return true;
  };

  const acceptOne = async (dayIdx: number, shiftIdx: number) => {
    const day = days[dayIdx];
    const shift = day.shifts[shiftIdx];
    const ok = await insertShift(day.date, shift);
    if (ok) {
      setDays((prev) => {
        const copy = prev.map((d) => ({ ...d, shifts: [...d.shifts] }));
        copy[dayIdx].shifts[shiftIdx] = { ...shift, _accepted: true };
        return copy;
      });
      qc.invalidateQueries({ queryKey: ["rota-assignments"] });
      toast.success("Shift added");
    }
  };

  const rejectOne = (dayIdx: number, shiftKey: string) => {
    setDays((prev) => {
      const copy = prev.map((d, i) =>
        i === dayIdx ? { ...d, shifts: d.shifts.filter((s) => s._key !== shiftKey) } : d,
      );
      return copy;
    });
  };

  const acceptAll = async () => {
    setAccepting(true);
    let count = 0;
    for (let i = 0; i < days.length; i++) {
      for (let j = 0; j < days[i].shifts.length; j++) {
        const s = days[i].shifts[j];
        if (s._accepted) continue;
        const ok = await insertShift(days[i].date, s);
        if (ok) {
          count++;
          s._accepted = true;
        }
      }
    }
    setAccepting(false);
    qc.invalidateQueries({ queryKey: ["rota-assignments"] });
    toast.success(`${count} shifts added to rota`);
    setOpen(false);
  };

  const rejectAll = () => setDays([]);

  return (
    <>
      <Button size="sm" variant="outline" onClick={generate} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Generating suggestions...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-1" /> AI Suggest
          </>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> AI Rota Suggestions
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-3">
            <div className="space-y-3">
              <AnimatePresence>
                {days.map((day, dIdx) => (
                  <motion.div
                    key={day.date}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-sm font-semibold mb-2">
                          {day.day} —{" "}
                          <span className="text-muted-foreground font-normal">{day.date}</span>
                        </div>
                        {day.shifts.length === 0 ? (
                          <div className="text-xs text-muted-foreground">No shifts suggested</div>
                        ) : (
                          <div className="space-y-2">
                            <AnimatePresence>
                              {day.shifts.map((s, sIdx) => (
                                <motion.div
                                  key={s._key}
                                  layout
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: s._accepted ? 0.5 : 1 }}
                                  exit={{ opacity: 0, x: 20 }}
                                  className="flex items-center justify-between gap-2 rounded-md border p-2"
                                >
                                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                                    <span className="font-medium text-sm truncate">
                                      {s.staff_name}
                                    </span>
                                    <Badge variant="secondary" className="text-xs">
                                      {s.start_time}–{s.end_time}
                                    </Badge>
                                    {s.position && (
                                      <span className="text-xs text-muted-foreground">
                                        {s.position}
                                      </span>
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
                                          onClick={() => acceptOne(dIdx, sIdx)}
                                        >
                                          <Check className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-7 w-7 text-red-600 hover:bg-red-50"
                                          onClick={() => rejectOne(dIdx, s._key!)}
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </motion.div>
                              ))}
                            </AnimatePresence>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
              {days.length === 0 && (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  No suggestions remaining.
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={rejectAll} disabled={accepting}>
              Reject All
            </Button>
            <Button onClick={acceptAll} disabled={accepting || days.length === 0}>
              {accepting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Accept All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
