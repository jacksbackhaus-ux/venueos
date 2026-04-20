import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ClipboardList, CheckCircle2, Circle, Lock, AlertTriangle, Clock, ChevronDown, ChevronUp, ShieldCheck, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DateNavigator } from "@/components/DateNavigator";

const DaySheet = () => {
  const { currentSite, organisationId } = useSite();
  const { appUser, staffSession } = useAuth();
  const queryClient = useQueryClient();
  const siteId = currentSite?.id || staffSession?.site_id;
  const userName = appUser?.display_name || staffSession?.display_name || "Unknown";
  const todayStr = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const isToday = selectedDate === todayStr;
  const today = selectedDate; // all queries below are scoped to the selected date

  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [problemNotes, setProblemNotes] = useState("");
  const [managerNote, setManagerNote] = useState("");

  // Fetch sections with items
  const { data: sections = [], isLoading: sectionsLoading } = useQuery({
    queryKey: ["day_sheet_sections", siteId],
    queryFn: async () => {
      if (!siteId) return [];
      const { data, error } = await supabase.from("day_sheet_sections").select("*, day_sheet_items(*)").eq("site_id", siteId).eq("active", true).order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!siteId,
  });

  // Fetch or create today's day sheet
  const { data: daySheet } = useQuery({
    queryKey: ["day_sheet", siteId, today],
    queryFn: async () => {
      if (!siteId) return null;
      const { data, error } = await supabase.from("day_sheets").select("*").eq("site_id", siteId).eq("sheet_date", today).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!siteId,
  });

  // Fetch entries for today
  const { data: entries = [] } = useQuery({
    queryKey: ["day_sheet_entries", daySheet?.id],
    queryFn: async () => {
      if (!daySheet?.id) return [];
      const { data, error } = await supabase.from("day_sheet_entries").select("*").eq("day_sheet_id", daySheet.id);
      if (error) throw error;
      return data;
    },
    enabled: !!daySheet?.id,
  });

  const ensureDaySheet = async () => {
    if (daySheet) return daySheet.id;
    if (!isToday) throw new Error("Cannot edit a past day sheet");
    const { data, error } = await supabase.from("day_sheets").insert({
      site_id: siteId!, organisation_id: organisationId!, sheet_date: today,
    }).select("id").single();
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ["day_sheet", siteId, today] });
    return data.id;
  };

  const toggleItem = useMutation({
    mutationFn: async (itemId: string) => {
      const dsId = await ensureDaySheet();
      const existing = entries.find((e: any) => e.item_id === itemId);
      if (existing?.done) {
        const { error } = await supabase.from("day_sheet_entries").update({ done: false, completed_at: null, completed_by_user_id: null }).eq("id", existing.id);
        if (error) throw error;
      } else if (existing) {
        const { error } = await supabase.from("day_sheet_entries").update({ done: true, completed_at: new Date().toISOString(), completed_by_user_id: appUser?.id || null }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("day_sheet_entries").insert({
          day_sheet_id: dsId, item_id: itemId, done: true, completed_by_user_id: appUser?.id || null, completed_at: new Date().toISOString(),
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["day_sheet_entries"] });
      queryClient.invalidateQueries({ queryKey: ["day_sheet", siteId, today] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const lockSheet = useMutation({
    mutationFn: async () => {
      const dsId = await ensureDaySheet();
      const { error } = await supabase.from("day_sheets").update({
        locked: true, locked_at: new Date().toISOString(), locked_by_user_id: appUser?.id || null,
        manager_note: managerNote || null, problem_notes: problemNotes || null,
      }).eq("id", dsId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["day_sheet", siteId, today] });
      toast.success("Day sheet locked!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const isLockedSheet = daySheet?.locked || false;
  const locked = isLockedSheet || !isToday; // past days are read-only
  const doneItemIds = new Set(entries.filter((e: any) => e.done).map((e: any) => e.item_id));
  const allItems = sections.flatMap((s: any) => s.day_sheet_items || []);
  const totalItems = allItems.length;
  const doneItems = allItems.filter((i: any) => doneItemIds.has(i.id)).length;
  const pct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
  const allDone = doneItems === totalItems && totalItems > 0;

  useEffect(() => {
    if (sections.length > 0 && expandedSections.length === 0) {
      setExpandedSections([sections[0].id]);
    }
  }, [sections]);

  useEffect(() => {
    if (daySheet) {
      setProblemNotes(daySheet.problem_notes || "");
      setManagerNote(daySheet.manager_note || "");
    }
  }, [daySheet]);

  if (!siteId) return <div className="p-6 text-center text-muted-foreground">No site selected.</div>;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><ClipboardList className="h-5 w-5 text-primary" /></div>
            <div>
              <h1 className="text-xl font-heading font-bold text-foreground">Daily Day Sheet</h1>
              <p className="text-sm text-muted-foreground">
                {isToday
                  ? new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
                  : new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          </div>
          {isLockedSheet ? (
            <Badge className="bg-success text-success-foreground gap-1"><Lock className="h-3 w-3" /> Locked</Badge>
          ) : !isToday ? (
            <Badge variant="outline" className="gap-1 border-muted-foreground/30 text-muted-foreground">
              <Lock className="h-3 w-3" /> Read-only
            </Badge>
          ) : null}
        </div>
        <DateNavigator selectedDate={selectedDate} onChange={setSelectedDate} />
      </div>

      {sectionsLoading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

      {!sectionsLoading && sections.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No day sheet sections configured</p>
          <p className="text-sm mt-1">Add sections and check items in Settings to start using day sheets.</p>
        </CardContent></Card>
      )}

      {totalItems > 0 && (
        <Card><CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{doneItems}/{totalItems} checks complete</span>
            <span className={`text-sm font-bold ${pct === 100 ? "text-success" : pct >= 50 ? "text-warning" : "text-breach"}`}>{pct}%</span>
          </div>
          <Progress value={pct} className="h-2" />
        </CardContent></Card>
      )}

      {sections.map((section: any) => {
        const items = section.day_sheet_items || [];
        const sectionDone = items.filter((i: any) => doneItemIds.has(i.id)).length;
        const sectionComplete = sectionDone === items.length && items.length > 0;
        const isExpanded = expandedSections.includes(section.id);

        return (
          <motion.div key={section.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Collapsible open={isExpanded} onOpenChange={() => setExpandedSections((prev) => prev.includes(section.id) ? prev.filter((s) => s !== section.id) : [...prev, section.id])}>
              <Card className={sectionComplete ? "border-success/30" : ""}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ClipboardList className={`h-4 w-4 ${sectionComplete ? "text-success" : "text-primary"}`} />
                        <CardTitle className="text-sm font-heading">{section.title}</CardTitle>
                        <Badge variant="outline" className="text-[10px]">{sectionDone}/{items.length}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{section.default_time}</span>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="space-y-1">
                      {items.map((item: any) => {
                        const isDone = doneItemIds.has(item.id);
                        return (
                          <button key={item.id} onClick={() => !locked && toggleItem.mutate(item.id)} disabled={locked}
                            className={`w-full flex items-start gap-3 p-2.5 rounded-md text-left transition-colors ${locked ? "cursor-default" : "hover:bg-muted/50 cursor-pointer"} ${isDone ? "opacity-70" : ""}`}>
                            {isDone ? <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" /> : <Circle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />}
                            <span className={`text-sm ${isDone ? "line-through text-muted-foreground" : "font-medium"}`}>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </motion.div>
        );
      })}

      {sections.length > 0 && !locked && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-heading flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" /> Any problems or changes today?</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea placeholder="Describe any issues, near-misses, or changes made today..." value={problemNotes} onChange={(e) => setProblemNotes(e.target.value)} className="text-sm" />
            </CardContent>
          </Card>

          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-heading flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Manager Verification & Lock</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea placeholder="Manager notes (required if breaches occurred)..." value={managerNote} onChange={(e) => setManagerNote(e.target.value)} className="text-sm" />
              <Button className="w-full" disabled={!allDone && !managerNote} onClick={() => lockSheet.mutate()}>
                <Lock className="h-4 w-4 mr-2" /> {allDone ? "Lock Day Sheet" : "Lock with Exception Note"}
              </Button>
              {!allDone && !managerNote && <p className="text-xs text-muted-foreground text-center">All tasks must be complete, or add an exception note to lock</p>}
            </CardContent>
          </Card>
        </>
      )}

      {locked && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg bg-success/10 p-4 text-center">
          <Lock className="h-6 w-6 text-success mx-auto mb-2" />
          <p className="font-heading font-bold text-success">Day Sheet Locked</p>
          <p className="text-xs text-muted-foreground">
            Locked at {daySheet?.locked_at ? new Date(daySheet.locked_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—"}. Entries are now immutable.
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default DaySheet;
