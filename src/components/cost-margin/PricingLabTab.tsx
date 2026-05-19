// Pricing Lab — scenario planning across products with live margin recalculation.
import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DEFAULT_PROFILES, type Channel, type ChannelProfile,
  computeChannelBreakdown, overheadPerUnit as ohPerUnit, sumOverheads,
} from "@/lib/channelMath";
import {
  loadTMEContext, calcRecipeBreakdown,
  type TMEContext, type TMERecipe,
} from "@/lib/trueMargin";
import { loadSiteTaxSettings, splitGross, vatActive as vatIsActive } from "@/lib/vat";
import { Beaker, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface Props {
  siteId: string | null;
  orgId: string | null;
}

export default function PricingLabTab({ siteId, orgId }: Props) {
  const qc = useQueryClient();
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [channel, setChannel] = useState<Channel>("dtc");
  const [newPrice, setNewPrice] = useState<string>("");
  const [showVat, setShowVat] = useState(true);


  const ctxQ = useQuery({
    queryKey: ["tme-ctx", siteId, orgId],
    enabled: !!siteId && !!orgId,
    queryFn: () => loadTMEContext(siteId!, orgId!),
  });

  const profilesQ = useQuery({
    queryKey: ["site-channel-profiles", siteId],
    enabled: !!siteId,
    queryFn: async () => {
      const { data } = await supabase.from("site_channel_profiles").select("*").eq("site_id", siteId!);
      return data || [];
    },
  });

  const overheadsQ = useQuery({
    queryKey: ["site-overheads-current", siteId],
    enabled: !!siteId,
    queryFn: async () => {
      const monthIso = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
      const { data } = await supabase.from("site_overheads_monthly").select("*").eq("site_id", siteId!).eq("month", monthIso).maybeSingle();
      return data;
    },
  });

  const taxQ = useQuery({
    queryKey: ["site-tax-settings", siteId],
    enabled: !!siteId,
    queryFn: () => loadSiteTaxSettings(siteId),
  });
  const vatOn = vatIsActive(taxQ.data);
  const vatRate = Number(taxQ.data?.default_vat_rate) || 20;

  // 30-day units sold for impact estimate
  const salesQ = useQuery({
    queryKey: ["pricing-lab-sales", siteId, recipeId, channel],
    enabled: !!siteId && !!recipeId,
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - 30);
      const sinceIso = since.toISOString().slice(0, 10);
      let qb = supabase
        .from("sales_line_items")
        .select("quantity, channel")
        .eq("site_id", siteId!)
        .eq("linked_product_id", recipeId!)
        .eq("ignored", false)
        .gte("sale_date", sinceIso);
      const { data } = await qb;
      const rows = (data || []) as any[];
      const filt = rows.filter((r) => !r.channel || r.channel === channel);
      const units = filt.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
      return { units, fromSales: rows.length > 0 };
    },
  });

  const recipes = (ctxQ.data?.recipes || []).filter((r) => r.recipe_type !== "prep_batch") as TMERecipe[];
  const ctx = ctxQ.data?.ctx as TMEContext | undefined;
  const recipe = recipes.find((r) => r.id === recipeId);

  // Initialize when recipe changes
  useEffect(() => {
    if (!recipe) return;
    const init = channel === "dtc"
      ? ((recipe as any).dtc_price ?? recipe.sale_price ?? 0)
      : ((recipe as any).wholesale_price ?? 0);
    setNewPrice(String(init || ""));
  }, [recipeId, channel]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!siteId) {
    return <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Select a site to use Pricing Lab.</CardContent></Card>;
  }

  const profiles: Record<Channel, ChannelProfile> = {
    dtc: ((profilesQ.data?.find((p: any) => p.channel === "dtc")) as any) || DEFAULT_PROFILES.dtc,
    wholesale: ((profilesQ.data?.find((p: any) => p.channel === "wholesale")) as any) || DEFAULT_PROFILES.wholesale,
  };

  const monthlyOverhead = sumOverheads(overheadsQ.data as any);
  const overheadPerUnit = ohPerUnit(monthlyOverhead, 0, 30);

  const ingredientCost = recipe && ctx ? calcRecipeBreakdown(recipe, ctx).costPerPortionExVat : 0;

  const currentPrice = recipe
    ? channel === "dtc"
      ? Number((recipe as any).dtc_price ?? recipe.sale_price ?? 0)
      : Number((recipe as any).wholesale_price ?? 0)
    : 0;

  const currentBd = computeChannelBreakdown({
    channel,
    dtcPrice: channel === "dtc" ? currentPrice : null,
    wholesalePrice: channel === "wholesale" ? currentPrice : null,
    ingredientCost, overheadPerUnit, profile: profiles[channel],
  });

  const previewPrice = Number(newPrice) || 0;
  const previewBd = computeChannelBreakdown({
    channel,
    dtcPrice: channel === "dtc" ? previewPrice : null,
    wholesalePrice: channel === "wholesale" ? previewPrice : null,
    ingredientCost, overheadPerUnit, profile: profiles[channel],
  });

  const unitsPerMonth = salesQ.data?.units || 30;
  const fromSales = !!salesQ.data?.fromSales;
  const monthlyImpact = (previewBd.contributionAfterOverhead - currentBd.contributionAfterOverhead) * unitsPerMonth;

  const applyPrice = async () => {
    if (!recipe || !orgId) return;
    const oldPrice = currentPrice || null;
    const update: any = channel === "dtc"
      ? { dtc_price: previewPrice, sale_price: previewPrice }
      : { wholesale_price: previewPrice };
    const { error } = await supabase.from("recipes").update(update).eq("id", recipe.id);
    if (error) { toast.error(error.message); return; }
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("recipe_price_change_log").insert({
      organisation_id: orgId, site_id: siteId, recipe_id: recipe.id,
      channel, old_price: oldPrice, new_price: previewPrice,
      changed_by: u?.user?.id ?? null,
      reason: "Applied from Pricing Lab",
    });
    toast.success(`${channel.toUpperCase()} price updated to £${previewPrice.toFixed(2)}`);
    qc.invalidateQueries({ queryKey: ["tme-ctx", siteId, orgId] });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Beaker className="h-4 w-4 text-primary" />Pricing Lab
          </CardTitle>
          <CardDescription>
            Simulate price changes and see margin impact instantly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Menu item</Label>
              <Select value={recipeId ?? ""} onValueChange={setRecipeId}>
                <SelectTrigger><SelectValue placeholder="Choose a product" /></SelectTrigger>
                <SelectContent>
                  {recipes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Channel</Label>
              <Tabs value={channel} onValueChange={(v) => setChannel(v as Channel)}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="dtc">DTC</TabsTrigger>
                  <TabsTrigger value="wholesale">Wholesale</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardContent>
      </Card>

      {recipe && (
        <>
          {vatOn && (
            <div className="flex items-center justify-end gap-2">
              <Label className="text-xs text-muted-foreground">Show VAT breakdown</Label>
              <Switch checked={showVat} onCheckedChange={setShowVat} />
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            <BdCard title="Current" bd={currentBd} price={currentPrice} vatOn={vatOn && showVat} vatRate={vatRate} />
            <BdCard title="What-if" bd={previewBd} price={previewPrice} tone="primary" vatOn={vatOn && showVat} vatRate={vatRate} />
          </div>


          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Adjust price</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Slider
                value={[previewPrice]}
                min={Math.max(0.1, ingredientCost)}
                max={Math.max(currentPrice * 2, ingredientCost * 5, 1)}
                step={0.1}
                onValueChange={(v) => setNewPrice(String(v[0].toFixed(2)))}
              />
              <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                <div>
                  <Label className="text-xs">New {channel.toUpperCase()} price (£)</Label>
                  <Input type="number" step="0.01" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
                </div>
                <Button onClick={applyPrice} disabled={!previewPrice || previewPrice === currentPrice}>
                  Apply price change
                </Button>
              </div>

              <div className="rounded-md border bg-muted/30 p-3 space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="font-medium">Estimated monthly impact</span>
                  {!fromSales && <Badge variant="outline" className="text-[10px]">est. 30 units/mo</Badge>}
                  {fromSales && <Badge variant="secondary" className="text-[10px]">based on last 30d sales</Badge>}
                </div>
                <p className={`text-2xl font-bold tabular-nums ${
                  monthlyImpact >= 0 ? "text-success" : "text-destructive"
                }`}>
                  {monthlyImpact >= 0 ? "+" : "−"}£{Math.abs(monthlyImpact).toFixed(2)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {unitsPerMonth} units/month × Δ contribution per unit.
                </p>
              </div>

              {monthlyOverhead === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Add overheads to refine the contribution figure.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!recipe && (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          Pick a menu item above to simulate pricing.
        </CardContent></Card>
      )}
    </div>
  );
}

function BdCard({ title, bd, price, tone, vatOn, vatRate }: { title: string; bd: any; price: number; tone?: "primary"; vatOn?: boolean; vatRate?: number }) {
  const split = vatOn && vatRate ? splitGross(price, vatRate) : null;
  const gpOnNet = split && split.net > 0
    ? ((split.net - bd.ingredientCost - bd.overheadPerUnit) / split.net) * 100
    : null;
  return (
    <Card className={tone === "primary" ? "border-primary/50" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <Row label={vatOn ? "Gross price" : "Price"} value={`£${price.toFixed(2)}`} bold />
        {split && (
          <>
            <Row label={`Net price (ex VAT ${vatRate}%)`} value={`£${split.net.toFixed(2)}`} />
            <Row label="VAT amount" value={`£${split.vat.toFixed(2)}`} />
          </>
        )}
        <Row label="Cost / unit" value={`£${bd.ingredientCost.toFixed(3)}`} />
        <Row label="Overhead / unit" value={`£${bd.overheadPerUnit.toFixed(3)}`} />
        <Row label={vatOn ? "GP % (on gross)" : "GP %"} value={bd.gpPercent != null ? `${bd.gpPercent.toFixed(1)}%` : "—"}
          className={bd.gpPercent != null && bd.gpPercent >= 50 ? "text-success" : bd.gpPercent != null && bd.gpPercent >= 30 ? "text-warning" : "text-destructive"} />
        {gpOnNet != null && (
          <Row label="GP % (on net revenue)" value={`${gpOnNet.toFixed(1)}%`} />
        )}
        <Row label="Contribution after overhead" value={`£${bd.contributionAfterOverhead.toFixed(3)}`} bold />
      </CardContent>
    </Card>
  );
}
function Row({ label, value, bold, className }: { label: string; value: string; bold?: boolean; className?: string }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""} ${className || ""}`}>
      <span>{label}</span><span className="tabular-nums">{value}</span>
    </div>
  );
}
