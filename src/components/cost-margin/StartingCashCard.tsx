import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import { toast } from "sonner";

export default function StartingCashCard({ siteId, orgId }: { siteId: string | null; orgId: string | null }) {
  const qc = useQueryClient();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const q = useQuery({
    queryKey: ["site-cash-settings", siteId],
    enabled: !!siteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_cash_settings")
        .select("*")
        .eq("site_id", siteId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    setValue(q.data?.starting_cash != null ? String(q.data.starting_cash) : "");
  }, [q.data?.id]);

  const save = async () => {
    if (!siteId || !orgId) return;
    setSaving(true);
    const { error } = await supabase
      .from("site_cash_settings")
      .upsert(
        { site_id: siteId, organisation_id: orgId, starting_cash: Number(value) || 0 },
        { onConflict: "site_id" },
      );
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Starting cash saved");
    qc.invalidateQueries({ queryKey: ["site-cash-settings", siteId] });
    qc.invalidateQueries({ queryKey: ["cashflow"] });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />Starting cash
        </CardTitle>
        <CardDescription>
          Optional. Enables the cash balance trend line and runway estimate.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
          <div>
            <Label className="text-xs">Current bank / cash on hand (£)</Label>
            <Input type="number" step="0.01" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
