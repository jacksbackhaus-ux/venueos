import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { sumOverheads } from "@/lib/channelMath";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

const FIELDS: { key: string; label: string }[] = [
  { key: "rent", label: "Rent" },
  { key: "utilities", label: "Utilities" },
  { key: "insurance", label: "Insurance" },
  { key: "software_subscriptions", label: "Software subscriptions" },
  { key: "equipment_lease", label: "Equipment lease" },
  { key: "repairs_maintenance", label: "Repairs & maintenance" },
  { key: "marketing", label: "Marketing" },
  { key: "other", label: "Other" },
];

function firstOfMonth(d = new Date()): string {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function shiftMonth(iso: string, delta: number): string {
  const [y, m] = iso.split("-").map(Number);
  return new Date(y, m - 1 + delta, 1).toISOString().slice(0, 10);
}
function daysInMonth(iso: string): number {
  const [y, m] = iso.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}
function fmtMonth(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export default function OverheadsTab({
  siteId,
  orgId,
}: {
  siteId: string | null;
  orgId: string | null;
}) {
  const qc = useQueryClient();
  const [month, setMonth] = useState(firstOfMonth());
  const lastMonth = useMemo(() => shiftMonth(month, -1), [month]);

  const overheadsQuery = useQuery({
    queryKey: ["site-overheads", siteId, month],
    enabled: !!siteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_overheads_monthly")
        .select("*")
        .eq("site_id", siteId!)
        .in("month", [month, lastMonth]);
      if (error) throw error;
      return data || [];
    },
  });

  const current = overheadsQuery.data?.find((r: any) => r.month === month) || null;
  const prior = overheadsQuery.data?.find((r: any) => r.month === lastMonth) || null;

  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Hydrate when query updates
  useMemo(() => {
    const next: Record<string, string> = {};
    for (const f of FIELDS) next[f.key] = current?.[f.key] != null ? String(current[f.key]) : "";
    setValues(next);
    setNotes(current?.notes ?? "");
  }, [current?.id, month]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalCurrent = FIELDS.reduce((s, f) => s + (Number(values[f.key]) || 0), 0);
  const totalPrior = sumOverheads(prior as any);
  const delta = totalPrior > 0 ? ((totalCurrent - totalPrior) / totalPrior) * 100 : null;
  const perDay = totalCurrent / daysInMonth(month);

  const save = async () => {
    if (!siteId || !orgId) return;
    setSaving(true);
    try {
      const payload: any = {
        organisation_id: orgId,
        site_id: siteId,
        month,
        notes: notes || null,
      };
      for (const f of FIELDS) payload[f.key] = Number(values[f.key]) || 0;
      const { error } = await supabase
        .from("site_overheads_monthly")
        .upsert(payload, { onConflict: "site_id,month" });
      if (error) throw error;
      toast.success("Overheads saved");
      qc.invalidateQueries({ queryKey: ["site-overheads", siteId] });
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-base">Monthly overheads</CardTitle>
              <CardDescription>
                Allocated to products to estimate contribution after fixed costs.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setMonth(shiftMonth(month, -1))}>
                ‹
              </Button>
              <div className="text-sm font-medium min-w-[10rem] text-center">{fmtMonth(month)}</div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMonth(shiftMonth(month, 1))}
                disabled={month >= firstOfMonth()}
              >
                ›
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-md border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">Total this month</p>
              <p className="text-2xl font-bold tabular-nums">£{totalCurrent.toFixed(2)}</p>
            </div>
            <div className="rounded-md border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">vs last month</p>
              <p className="text-2xl font-bold tabular-nums flex items-center gap-1">
                {delta == null ? (
                  <span className="text-muted-foreground text-base">—</span>
                ) : delta === 0 ? (
                  <><Minus className="h-4 w-4" />0%</>
                ) : delta > 0 ? (
                  <span className="text-warning flex items-center gap-1"><ArrowUp className="h-4 w-4" />{delta.toFixed(1)}%</span>
                ) : (
                  <span className="text-success flex items-center gap-1"><ArrowDown className="h-4 w-4" />{Math.abs(delta).toFixed(1)}%</span>
                )}
              </p>
            </div>
            <div className="rounded-md border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">Per day</p>
              <p className="text-2xl font-bold tabular-nums">£{perDay.toFixed(2)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <Input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save overheads"}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
