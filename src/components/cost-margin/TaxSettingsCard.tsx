import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Receipt } from "lucide-react";

interface Props {
  siteId: string | null;
  orgId: string | null;
}

export default function TaxSettingsCard({ siteId, orgId }: Props) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["site-tax-settings", siteId],
    enabled: !!siteId,
    queryFn: async () => {
      const { data } = await supabase
        .from("site_tax_settings")
        .select("*")
        .eq("site_id", siteId!)
        .maybeSingle();
      return data;
    },
  });

  const [vatEnabled, setVatEnabled] = useState(false);
  const [vatRegistered, setVatRegistered] = useState(false);
  const [rate, setRate] = useState<string>("20");
  const [salesInc, setSalesInc] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const d: any = q.data;
    setVatEnabled(!!d?.vat_enabled);
    setVatRegistered(!!d?.vat_registered);
    setRate(d?.default_vat_rate != null ? String(d.default_vat_rate) : "20");
    setSalesInc(d?.sales_values_include_vat !== false);
  }, [q.data]);

  const save = async () => {
    if (!siteId || !orgId) return;
    setSaving(true);
    try {
      const payload = {
        organisation_id: orgId,
        site_id: siteId,
        vat_enabled: vatEnabled,
        vat_registered: vatEnabled ? vatRegistered : false,
        default_vat_rate: Number(rate) || 20,
        sales_values_include_vat: salesInc,
      };
      const { error } = await supabase
        .from("site_tax_settings")
        .upsert(payload, { onConflict: "site_id" });
      if (error) throw error;
      toast.success("Tax settings saved");
      qc.invalidateQueries({ queryKey: ["site-tax-settings", siteId] });
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" />
          Tax (VAT)
        </CardTitle>
        <CardDescription>
          Optional. When off, all VAT views are hidden and the dashboard works as gross-only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label className="text-sm">VAT enabled</Label>
            <p className="text-[11px] text-muted-foreground">Show VAT breakdowns across Cost & Margin.</p>
          </div>
          <Switch checked={vatEnabled} onCheckedChange={setVatEnabled} />
        </div>

        <div className={`flex items-center justify-between gap-3 ${!vatEnabled ? "opacity-50 pointer-events-none" : ""}`}>
          <div>
            <Label className="text-sm">VAT registered</Label>
            <p className="text-[11px] text-muted-foreground">
              If registered, input VAT is reclaimable and margin targets use net revenue.
            </p>
          </div>
          <Switch checked={vatRegistered} onCheckedChange={setVatRegistered} disabled={!vatEnabled} />
        </div>

        <div className={`grid sm:grid-cols-2 gap-3 ${!vatEnabled ? "opacity-50 pointer-events-none" : ""}`}>
          <div className="space-y-1">
            <Label className="text-xs">Default VAT rate (%)</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              disabled={!vatEnabled}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Imported sales values include VAT</Label>
            <div className="flex items-center gap-2 h-10">
              <Switch checked={salesInc} onCheckedChange={setSalesInc} disabled={!vatEnabled} />
              <span className="text-xs text-muted-foreground">
                {salesInc ? "Treated as gross" : "Treated as net"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              If your POS exports include VAT, leave on. If exports are net of VAT, turn off.
            </p>
          </div>
        </div>

        {!vatEnabled && (
          <p className="text-[11px] text-muted-foreground italic">VAT disabled</p>
        )}

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save tax settings"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
