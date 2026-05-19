import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = ["equipment","tax","owner_draw","repairs","other"] as const;

export default function CashflowAdjustments({ siteId, orgId }: { siteId: string | null; orgId: string | null }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);

  const q = useQuery({
    queryKey: ["cashflow-adjustments", siteId],
    enabled: !!siteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cashflow_adjustments")
        .select("*")
        .eq("site_id", siteId!)
        .order("event_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const remove = async (id: string) => {
    const { error } = await supabase.from("cashflow_adjustments").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["cashflow-adjustments", siteId] });
    qc.invalidateQueries({ queryKey: ["cashflow"] });
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-base">Cashflow adjustments</CardTitle>
          <CardDescription>Manual cash events (equipment, tax, owner draws, repairs).</CardDescription>
        </div>
        <Button size="sm" onClick={() => setAdding((s) => !s)}>
          <Plus className="h-4 w-4 mr-1" />Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {adding && (
          <AdjustmentForm
            siteId={siteId}
            orgId={orgId}
            onDone={() => {
              setAdding(false);
              qc.invalidateQueries({ queryKey: ["cashflow-adjustments", siteId] });
              qc.invalidateQueries({ queryKey: ["cashflow"] });
            }}
          />
        )}
        {(q.data || []).length === 0 && !adding && (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No adjustments yet. Add big one-off items like equipment purchases or tax payments.
          </p>
        )}
        <div className="space-y-1">
          {(q.data || []).map((a: any) => (
            <div key={a.id} className="flex items-center justify-between gap-3 py-2 px-3 rounded-md border bg-card">
              <div className="flex items-center gap-3 min-w-0">
                {a.direction === "in"
                  ? <ArrowDownCircle className="h-4 w-4 text-success shrink-0" />
                  : <ArrowUpCircle className="h-4 w-4 text-destructive shrink-0" />}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium tabular-nums">£{Number(a.amount).toFixed(2)}</span>
                    <Badge variant="secondary" className="text-[10px]">{a.category}</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {a.event_date}{a.notes ? ` · ${a.notes}` : ""}
                  </p>
                </div>
              </div>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => remove(a.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AdjustmentForm({ siteId, orgId, onDone }: { siteId: string | null; orgId: string | null; onDone: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [direction, setDirection] = useState<"in" | "out">("out");
  const [category, setCategory] = useState<typeof CATEGORIES[number]>("equipment");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!siteId || !orgId) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("Enter an amount"); return; }
    setSaving(true);
    const { error } = await supabase.from("cashflow_adjustments").insert({
      site_id: siteId, organisation_id: orgId,
      event_date: date, direction, category, amount: amt,
      notes: notes || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Adjustment saved");
    onDone();
  };

  return (
    <div className="rounded-md border p-3 space-y-3 bg-muted/20">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>
          <Label className="text-xs">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">In / Out</Label>
          <Select value={direction} onValueChange={(v) => setDirection(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="in">In</SelectItem>
              <SelectItem value="out">Out</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace("_"," ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Amount (£)</Label>
          <Input type="number" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
      </div>
      <div>
        <Label className="text-xs">Notes</Label>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onDone}>Cancel</Button>
        <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
      </div>
    </div>
  );
}
