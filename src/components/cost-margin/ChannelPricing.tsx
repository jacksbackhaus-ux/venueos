import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  DEFAULT_PROFILES,
  type Channel,
  type ChannelProfile,
  computeChannelBreakdown,
  recommendDtcPrice,
  recommendWholesalePrice,
  sumOverheads,
  overheadPerUnit as ohPerUnit,
} from "@/lib/channelMath";

interface Props {
  recipeId: string;
  siteId: string | null;
  orgId: string | null;
  ingredientCostPerPortion: number;
  initialDtcPrice: number | null;
  initialWholesalePrice: number | null;
  initialTargetGp: number;
  defaultChannel?: Channel;
  onPriceUpdated?: () => void;
}

export default function ChannelPricing({
  recipeId, siteId, orgId, ingredientCostPerPortion,
  initialDtcPrice, initialWholesalePrice, initialTargetGp,
  defaultChannel = "dtc",
  onPriceUpdated,
}: Props) {
  const qc = useQueryClient();
  const [channel, setChannel] = useState<Channel>(defaultChannel);
  const [dtcPrice, setDtcPrice] = useState<string>(initialDtcPrice != null ? String(initialDtcPrice) : "");
  const [wsPrice, setWsPrice] = useState<string>(initialWholesalePrice != null ? String(initialWholesalePrice) : "");
  const [targetGp, setTargetGp] = useState<string>(String(initialTargetGp || 60));
  const [saving, setSaving] = useState(false);

  // Load channel profiles + overheads
  const profilesQ = useQuery({
    queryKey: ["site-channel-profiles", siteId],
    enabled: !!siteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_channel_profiles").select("*").eq("site_id", siteId!);
      if (error) throw error;
      return data || [];
    },
  });

  const overheadsQ = useQuery({
    queryKey: ["site-overheads-current", siteId],
    enabled: !!siteId,
    queryFn: async () => {
      const monthIso = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("site_overheads_monthly").select("*").eq("site_id", siteId!).eq("month", monthIso).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const profiles: Record<Channel, ChannelProfile> = useMemo(() => ({
    dtc: ((profilesQ.data?.find((p: any) => p.channel === "dtc")) as any) || DEFAULT_PROFILES.dtc,
    wholesale: ((profilesQ.data?.find((p: any) => p.channel === "wholesale")) as any) || DEFAULT_PROFILES.wholesale,
  }), [profilesQ.data]);

  const monthlyOverhead = sumOverheads(overheadsQ.data as any);
  // Per-unit allocation: total / (assumed 30 units * product count fallback).
  // Without sales context here, use a per-product estimate of 30 units/month.
  const overheadPerUnit = ohPerUnit(monthlyOverhead, 0, 30);

  const activeProfile = profiles[channel];
  const bd = computeChannelBreakdown({
    channel,
    dtcPrice: Number(dtcPrice) || null,
    wholesalePrice: Number(wsPrice) || null,
    ingredientCost: ingredientCostPerPortion,
    overheadPerUnit,
    profile: activeProfile,
  });

  const target = Number(targetGp) || 0;

  const recommendedDtc = recommendDtcPrice({
    current: Number(dtcPrice) || ingredientCostPerPortion + overheadPerUnit + 0.5,
    ingredientCost: ingredientCostPerPortion,
    overheadPerUnit,
    profile: profiles.dtc,
    targetGpPct: target,
  });
  const recommendedWs = recommendWholesalePrice({
    ingredientCost: ingredientCostPerPortion,
    overheadPerUnit,
    profile: profiles.wholesale,
    targetGpPct: target,
  });

  const applyPrice = async () => {
    if (!siteId || !orgId) return;
    const newPrice = channel === "dtc" ? recommendedDtc : recommendedWs;
    setSaving(true);
    try {
      const oldPrice = channel === "dtc" ? Number(dtcPrice) || null : Number(wsPrice) || null;
      const update: any = channel === "dtc"
        ? { dtc_price: newPrice, sale_price: newPrice }
        : { wholesale_price: newPrice };
      const { error } = await supabase.from("recipes").update(update).eq("id", recipeId);
      if (error) throw error;
      const { data: u } = await supabase.auth.getUser();
      await supabase.from("recipe_price_change_log").insert({
        organisation_id: orgId,
        site_id: siteId,
        recipe_id: recipeId,
        channel,
        old_price: oldPrice,
        new_price: newPrice,
        changed_by: u?.user?.id ?? null,
        reason: "Applied from What-if drawer",
      });
      if (channel === "dtc") setDtcPrice(String(newPrice));
      else setWsPrice(String(newPrice));
      toast.success(`${channel.toUpperCase()} price updated to £${newPrice.toFixed(2)}`);
      qc.invalidateQueries({ queryKey: ["tme-ctx"] });
      onPriceUpdated?.();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Your prices</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={channel} onValueChange={(v) => setChannel(v as Channel)}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="dtc">DTC</TabsTrigger>
            <TabsTrigger value="wholesale">Wholesale</TabsTrigger>
          </TabsList>

          <TabsContent value="dtc" className="space-y-3 mt-3">
            <PriceRow label="DTC price (£)" value={dtcPrice} onChange={setDtcPrice} />
            <TargetRow value={targetGp} onChange={setTargetGp} />
          </TabsContent>
          <TabsContent value="wholesale" className="space-y-3 mt-3">
            <PriceRow label="Wholesale price (£) — leave blank to use DTC × discount" value={wsPrice} onChange={setWsPrice} />
            <TargetRow value={targetGp} onChange={setTargetGp} />
          </TabsContent>
        </Tabs>

        <div className="rounded-md border bg-muted/30 p-3 space-y-1 text-sm">
          <Row label={channel === "dtc" ? "Price" : "List price"} value={`£${bd.listPrice.toFixed(2)}`} />
          <Row label="Money kept after fees / unit" value={`£${bd.netRevenue.toFixed(3)}`} />
          <Row label="Ingredient cost / unit" value={`£${bd.ingredientCost.toFixed(3)}`} />
          <Row label="Overhead / unit" value={`£${bd.overheadPerUnit.toFixed(3)}`} />
          <div className="border-t pt-1.5 mt-1.5">
            <Row
              label="Profit after costs"
              value={`£${bd.contributionAfterOverhead.toFixed(3)}`}
              bold
            />
            <Row
              label="GP %"
              value={bd.gpPercent != null ? `${bd.gpPercent.toFixed(1)}%` : "—"}
              className={
                bd.gpPercent != null && bd.gpPercent < target ? "text-warning" : "text-success"
              }
              bold
            />
          </div>
        </div>

        <div className="rounded-md border p-3 space-y-1.5">
          <p className="text-xs text-muted-foreground">Recommended to hit target GP</p>
          <div className="flex justify-between items-baseline">
            <span className="text-sm">DTC</span>
            <span className="font-bold tabular-nums">£{recommendedDtc.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-baseline">
            <span className="text-sm">Wholesale</span>
            <span className="font-bold tabular-nums">£{recommendedWs.toFixed(2)}</span>
          </div>
          {monthlyOverhead === 0 && (
            <p className="text-[11px] text-muted-foreground pt-1">
              Add overheads to refine the contribution estimate.
            </p>
          )}
        </div>

        <Button onClick={applyPrice} disabled={saving} className="w-full">
          {saving ? "Saving…" : `Apply ${channel.toUpperCase()} price update`}
        </Button>
      </CardContent>
    </Card>
  );
}

function PriceRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" step="0.01" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function TargetRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">Target GP %</Label>
      <Input type="number" step="0.1" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function Row({ label, value, bold, className }: { label: string; value: string; bold?: boolean; className?: string }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""} ${className || ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
