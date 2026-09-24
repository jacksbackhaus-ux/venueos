/**
 * Fitness to work — SFBB 48-hour rule, inside the Staff Training module.
 * Low-profile for single-user home bakers: available, never forced.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSite } from "@/contexts/SiteContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HeartPulse, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { toast } from "sonner";
import { useFitnessToWork } from "@/hooks/useSfbb";
import { suggestedReturnDate } from "@/lib/sfbb";

export function FitnessToWorkTab({ readOnly }: { readOnly?: boolean }) {
  const { records, isLoading, report, clear } = useFitnessToWork();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [personId, setPersonId] = useState<string>("");
  const OTHER = "__other__";
  const { currentSite } = useSite();
  const { data: siteStaff = [] } = useQuery({
    queryKey: ["ftw-site-staff", currentSite?.id],
    enabled: !!currentSite?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("memberships")
        .select("user_id, users!inner(id, display_name, status)")
        .eq("site_id", currentSite!.id)
        .eq("active", true)
        .eq("users.status", "active");
      const seen = new Map<string, string>();
      ((data as any[]) ?? []).forEach((m) => { if (m.users) seen.set(m.users.id, m.users.display_name); });
      return [...seen.entries()].map(([id, display_name]) => ({ id, display_name })).sort((a, b) => a.display_name.localeCompare(b.display_name));
    },
  });
  const [symptoms, setSymptoms] = useState("");
  const [symptomEnd, setSymptomEnd] = useState("");
  const [notes, setNotes] = useState("");

  const suggested = symptomEnd ? suggestedReturnDate(symptomEnd) : null;
  const excluded = records.filter((r) => r.status === "excluded");

  async function submit() {
    if (!name.trim()) return;
    try {
      await report.mutateAsync({
        staff_name: name,
        user_id: personId && personId !== OTHER ? personId : null,
        symptoms,
        cleared_to_return: suggested,
        notes,
      });
      toast.success("Illness recorded.");
      setOpen(false);
      setName(""); setPersonId(""); setSymptoms(""); setSymptomEnd(""); setNotes("");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save the record.");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-primary" /> Fitness to work
            </CardTitle>
            {excluded.length > 0 && (
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                {excluded.length} currently excluded
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <p className="text-sm text-muted-foreground">
            Anyone with vomiting or diarrhoea must not handle food, and must be symptom-free for
            48 hours before returning. Recording this shows an inspector you manage the rule.
          </p>
          {!readOnly && <Button size="sm" onClick={() => setOpen(true)}>Report illness</Button>}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
      ) : records.length === 0 ? (
        <EmptyState
          icon={<HeartPulse className="h-6 w-6" />}
          title="No illness records"
          description="Nothing to report is a good thing. Use this when someone is unwell so the 48-hour rule is documented."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {records.map((r) => (
                <li key={r.id} className="p-3 flex items-start gap-3">
                  {r.status === "cleared"
                    ? <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                    : <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-sm font-medium truncate">{r.staff_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Reported {r.reported_date}
                      {r.symptoms ? ` · ${r.symptoms}` : ""}
                      {r.cleared_to_return ? ` · earliest return ${r.cleared_to_return}` : ""}
                    </p>
                  </div>
                  {r.status === "excluded" && !readOnly && (
                    <Button
                      size="sm" variant="outline"
                      disabled={clear.isPending}
                      onClick={async () => {
                        await clear.mutateAsync({
                          id: r.id,
                          cleared_to_return: r.cleared_to_return ?? new Date().toISOString().slice(0, 10),
                        });
                        toast.success("Marked cleared to return.");
                      }}
                    >Mark cleared</Button>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Report illness</DialogTitle>
            <DialogDescription>The return date is suggested as symptom-end plus 48 hours.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Who is unwell?</Label>
              <Select
                value={personId}
                onValueChange={(v) => {
                  setPersonId(v);
                  if (v === OTHER) setName("");
                  else setName(siteStaff.find((p) => p.id === v)?.display_name ?? "");
                }}
              >
                <SelectTrigger><SelectValue placeholder="Choose a staff member" /></SelectTrigger>
                <SelectContent>
                  {siteStaff.map((p) => <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>)}
                  <SelectItem value={OTHER}>Someone not on the list</SelectItem>
                </SelectContent>
              </Select>
              {personId === OTHER && (
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Symptoms</Label>
              <Input value={symptoms} onChange={(e) => setSymptoms(e.target.value)} placeholder="e.g. vomiting" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Last day of symptoms (if known)</Label>
              <Input type="date" value={symptomEnd} onChange={(e) => setSymptomEnd(e.target.value)} />
              {suggested && (
                <p className="text-xs text-muted-foreground">Earliest return: {suggested}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes (optional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="text-sm" />
            </div>
            <Button className="w-full" disabled={!name.trim() || report.isPending} onClick={submit}>
              {report.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
