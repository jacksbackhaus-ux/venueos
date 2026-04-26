import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Lock, FileSpreadsheet } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCompensationLogs, type CompensationLog } from "@/hooks/useShiftHive";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState as useS } from "react";

interface Props {}

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function ComplianceExport({}: Props) {
  const { unpaid, paid, unpaidTotal, loading, markPaid } = useCompensationLogs();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [userMap, setUserMap] = useS<Record<string, string>>({});

  useEffect(() => {
    const ids = Array.from(new Set([...unpaid, ...paid].map(l => l.user_id)));
    if (!ids.length) return;
    void supabase.from("users").select("id, display_name").in("id", ids).then(({ data }) => {
      const m: Record<string, string> = {};
      (data ?? []).forEach(u => { m[u.id] = u.display_name; });
      setUserMap(m);
    });
  }, [unpaid, paid]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const exportCsv = (rows: CompensationLog[]) => {
    const header = ["Date","Staff","Hours","Rate £","Notice (h)","%","Amount £","Reason","Paid"];
    const lines = [header.join(",")];
    rows.forEach(l => {
      lines.push([
        l.shift_date, userMap[l.user_id] ?? l.user_id,
        l.shift_hours, l.hourly_rate_used, l.notice_given_hours,
        l.pct_applied, l.compensation_amount,
        `"${(l.cancellation_reason ?? "").replace(/"/g, '""')}"`,
        l.is_paid ? "Yes" : "No",
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `compensation-export-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const markSelectedPaid = async () => {
    await markPaid(Array.from(selected));
    setSelected(new Set());
  };

  return (
    <div className="space-y-4">
      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total compensation owed</p>
            <p className="text-3xl font-heading font-bold">£{unpaidTotal.toFixed(2)}</p>
          </div>
          <FileSpreadsheet className="h-10 w-10 text-warning" />
        </CardContent>
      </Card>

      <Tabs defaultValue="unpaid">
        <TabsList>
          <TabsTrigger value="unpaid">Unpaid {unpaid.length > 0 && <Badge variant="secondary" className="ml-1">{unpaid.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="paid">Paid (locked)</TabsTrigger>
        </TabsList>

        <TabsContent value="unpaid" className="space-y-2 mt-3">
          {selected.size > 0 && (
            <div className="flex items-center gap-2 p-2 bg-primary/5 rounded">
              <span className="text-sm">{selected.size} selected</span>
              <Button size="sm" onClick={markSelectedPaid}>Mark paid</Button>
              <Button size="sm" variant="outline" onClick={() => exportCsv(unpaid.filter(l => selected.has(l.id)))}>
                <Download className="h-3.5 w-3.5 mr-1" /> Export
              </Button>
            </div>
          )}
          <Button size="sm" variant="outline" onClick={() => exportCsv(unpaid)}>
            <Download className="h-3.5 w-3.5 mr-1" /> Export all unpaid
          </Button>
          {loading ? <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
          : unpaid.length === 0 ? <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">No outstanding compensation</CardContent></Card>
          : unpaid.map(l => (
            <Card key={l.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggle(l.id)} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{userMap[l.user_id] ?? "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(l.shift_date)} · {l.shift_hours}h · {l.notice_given_hours}h notice · {l.pct_applied}%
                  </p>
                  {l.cancellation_reason && <p className="text-xs italic mt-1">{l.cancellation_reason}</p>}
                </div>
                <p className="font-heading font-semibold">£{Number(l.compensation_amount).toFixed(2)}</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="paid" className="space-y-2 mt-3">
          <Button size="sm" variant="outline" onClick={() => exportCsv(paid)}>
            <Download className="h-3.5 w-3.5 mr-1" /> Export paid history
          </Button>
          {paid.length === 0 ? <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">No paid records yet</CardContent></Card>
          : paid.map(l => (
            <Card key={l.id} className="opacity-75">
              <CardContent className="p-3 flex items-center gap-3">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{userMap[l.user_id] ?? "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(l.shift_date)} · paid {l.paid_at ? new Date(l.paid_at).toLocaleDateString("en-GB") : ""}
                    {l.payroll_export_ref && ` · ref ${l.payroll_export_ref}`}
                  </p>
                </div>
                <p className="font-heading font-semibold">£{Number(l.compensation_amount).toFixed(2)}</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
