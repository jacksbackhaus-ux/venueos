// Pricing Calculator — a clean, premium SME pricing tool.
// Answers: cost per unit, recommended sell price, price inc VAT, and monthly GP.
import { useEffect, useMemo, useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  loadTMEContext, calcRecipeBreakdown,
  type TMEContext, type TMERecipe,
} from "@/lib/trueMargin";
import { loadSiteTaxSettings, vatActive as vatIsActive } from "@/lib/vat";
import { sumOverheads } from "@/lib/channelMath";
import { Calculator, Sparkles, TrendingUp, AlertTriangle, Link2 } from "lucide-react";
import { toast } from "sonner";

type Channel = "dtc" | "wholesale";

interface Props {
  siteId: string | null;
  orgId: string | null;
}

const num = (v: string | number | null | undefined, fallback = 0): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
};

export default function PricingLabTab({ siteId, orgId }: Props) {
  const qc = useQueryClient();
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [channel, setChannel] = useState<Channel>("dtc");

  // Cost inputs
  const [ingredientOverride, setIngredientOverride] = useState<string>("");
  const [packaging, setPackaging] = useState<string>("");
  const [labour, setLabour] = useState<string>("");
  const [otherVar, setOtherVar] = useState<string>("");
  const [overheadAlloc, setOverheadAlloc] = useState<string>("");

  // Volume
  const [unitsPerMonth, setUnitsPerMonth] = useState<string>("");

  // Pricing
  const [targetGp, setTargetGp] = useState<number>(70);
  const [priceOverride, setPriceOverride] = useState<string>(""); // editable display price
  const [wsPrice, setWsPrice] = useState<string>("");
  const [wsUseDiscount, setWsUseDiscount] = useState(false);
  const [wsDiscountPct, setWsDiscountPct] = useState<string>("30");

  // VAT
  const [vatEnabled, setVatEnabled] = useState(false);
  const [vatRate, setVatRate] = useState<string>("20");
  const [vatTouched, setVatTouched] = useState(false);

  const [saving, setSaving] = useState(false);

  /* ────────── Data ────────── */
  const ctxQ = useQuery({
    queryKey: ["tme-ctx", siteId, orgId],
    enabled: !!siteId && !!orgId,
    queryFn: () => loadTMEContext(siteId!, orgId!),
  });

  const overheadsQ = useQuery({
    queryKey: ["site-overheads-current", siteId],
    enabled: !!siteId,
    queryFn: async () => {
      const monthIso = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString().slice(0, 10);
      const { data } = await supabase
        .from("site_overheads_monthly").select("*")
        .eq("site_id", siteId!).eq("month", monthIso).maybeSingle();
      return data;
    },
  });

  const taxQ = useQuery({
    queryKey: ["site-tax-settings", siteId],
    enabled: !!siteId,
    queryFn: () => loadSiteTaxSettings(siteId),
  });

  const siteVatOn = vatIsActive(taxQ.data);
  useEffect(() => {
    if (vatTouched || !taxQ.data) return;
    setVatEnabled(siteVatOn);
    setVatRate(String(taxQ.data.default_vat_rate || 20));
  }, [taxQ.data, siteVatOn, vatTouched]);

  const recipes = (ctxQ.data?.recipes || []).filter((r) => r.recipe_type !== "prep_batch") as TMERecipe[];
  const ctx = ctxQ.data?.ctx as TMEContext | undefined;
  const recipe = recipes.find((r) => r.id === recipeId);

  // Derived ingredient cost / unit from recipe (the True Margin Engine)
  const recipeBd = recipe && ctx ? calcRecipeBreakdown(recipe, ctx) : null;
  const linkedIngredientCost = recipeBd?.ingredientCostExVat != null && recipe?.portions
    ? recipeBd.ingredientCostExVat / Math.max(recipe.portions, 1)
    : 0;

  const totalMonthlyOverhead = sumOverheads(overheadsQ.data as any);

  /* ────────── Hydrate on recipe change ────────── */
  useEffect(() => {
    if (!recipe) return;
    const portions = Math.max(num(recipe.portions, 1), 1);
    setIngredientOverride("");
    setPackaging(String(((num(recipe.packaging_cost) || 0) / portions).toFixed(2)));
    const labourPerUnit = ctx
      ? ((num(recipe.labour_minutes) / 60) * ctx.effectiveHourlyRate) / portions
      : 0;
    setLabour(labourPerUnit ? labourPerUnit.toFixed(2) : "");
    setOtherVar("");
    setUnitsPerMonth(recipe.monthly_volume ? String(recipe.monthly_volume) : "");
    const tgp = num(recipe.target_gp_percent, channel === "dtc" ? 70 : 55);
    setTargetGp(Math.min(85, Math.max(40, tgp)));
    const dtc = num((recipe as any).dtc_price ?? recipe.sale_price, 0);
    const ws = num((recipe as any).wholesale_price, 0);
    setPriceOverride(dtc ? String(dtc) : "");
    setWsPrice(ws ? String(ws) : "");
    // Allocate a fair-share overhead default
    const productCount = Math.max(recipes.length, 1);
    if (totalMonthlyOverhead > 0) {
      setOverheadAlloc((totalMonthlyOverhead / productCount).toFixed(2));
    } else {
      setOverheadAlloc("");
    }
  }, [recipeId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ────────── Calculations ────────── */
  const upm = num(unitsPerMonth);
  const ingredientPerUnit = ingredientOverride !== ""
    ? num(ingredientOverride)
    : linkedIngredientCost;
  const packPerUnit = num(packaging);
  const labourPerUnit = num(labour);
  const otherPerUnit = num(otherVar);
  const overheadPerUnit = upm > 0 ? num(overheadAlloc) / upm : 0;

  const trueCostPerUnit =
    ingredientPerUnit + packPerUnit + labourPerUnit + otherPerUnit + overheadPerUnit;

  const gpDecimal = Math.min(Math.max(targetGp, 0), 95) / 100;
  const requiredNet = gpDecimal < 1
    ? trueCostPerUnit / (1 - gpDecimal)
    : trueCostPerUnit;

  const vatMultiplier = vatEnabled ? 1 + num(vatRate) / 100 : 1;
  const recommendedIncVat = requiredNet * vatMultiplier;

  // Active price the user chose (may differ from recommendation)
  const activeIncVat = priceOverride !== "" ? num(priceOverride) : recommendedIncVat;
  const activeNet = vatEnabled ? activeIncVat / vatMultiplier : activeIncVat;
  const vatPerUnit = activeIncVat - activeNet;

  const gpPerUnit = activeNet - trueCostPerUnit;
  const gpPercent = activeNet > 0 ? (gpPerUnit / activeNet) * 100 : 0;
  const monthlyGp = upm > 0 ? gpPerUnit * upm : 0;

  const contribBeforeOverhead =
    activeNet - (ingredientPerUnit + packPerUnit + labourPerUnit + otherPerUnit);
  const contribAfterOverhead = contribBeforeOverhead - overheadPerUnit;

  // Wholesale specifics
  const wsListNet = wsUseDiscount
    ? activeNet * (1 - num(wsDiscountPct) / 100)
    : (num(wsPrice) || requiredNet * 0.7); // default suggestion
  const wsListGross = wsListNet * vatMultiplier;
  const wsGpPerUnit = wsListNet - trueCostPerUnit;
  const wsMonthlyGp = upm > 0 ? wsGpPerUnit * upm : 0;

  const marginState: "good" | "ok" | "weak" =
    gpPercent >= targetGp ? "good" : gpPercent >= targetGp - 10 ? "ok" : "weak";

  /* ────────── Actions ────────── */
  const setRecommended = () => setPriceOverride(recommendedIncVat.toFixed(2));
  const bumpPrice = (delta: number) =>
    setPriceOverride((Number(activeIncVat) + delta).toFixed(2));
  const roundTo = (cents: number) => {
    const whole = Math.floor(activeIncVat);
    setPriceOverride((whole + cents / 100).toFixed(2));
  };

  const persist = async (apply: "save" | "dtc" | "wholesale") => {
    if (!recipe || !orgId || !siteId) return;
    setSaving(true);
    try {
      const update: any = {
        target_gp_percent: targetGp,
        monthly_volume: upm || 0,
        packaging_cost: (packPerUnit || 0) * Math.max(num(recipe.portions, 1), 1),
      };
      if (apply === "dtc") {
        update.dtc_price = activeIncVat;
        update.sale_price = activeIncVat;
        update.sale_price_vat_rate_percent = vatEnabled ? num(vatRate) : 0;
      } else if (apply === "wholesale") {
        update.wholesale_price = wsListGross;
      }
      const { error } = await supabase.from("recipes").update(update).eq("id", recipe.id);
      if (error) throw error;
      if (apply !== "save") {
        const oldPrice = apply === "dtc"
          ? num((recipe as any).dtc_price ?? recipe.sale_price)
          : num((recipe as any).wholesale_price);
        const newPrice = apply === "dtc" ? activeIncVat : wsListGross;
        const { data: u } = await supabase.auth.getUser();
        await supabase.from("recipe_price_change_log").insert({
          organisation_id: orgId, site_id: siteId, recipe_id: recipe.id,
          channel: apply, old_price: oldPrice || null, new_price: newPrice,
          changed_by: u?.user?.id ?? null,
          reason: "Applied from Pricing Calculator",
        });
      }
      toast.success(apply === "save" ? "Assumptions saved" :
        `${apply.toUpperCase()} price updated`);
      qc.invalidateQueries({ queryKey: ["tme-ctx", siteId, orgId] });
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  /* ────────── UI ────────── */
  if (!siteId) {
    return (
      <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
        Select a site to use the Pricing Calculator.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card className="border-primary/10 bg-gradient-to-br from-primary/[0.04] to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Calculator className="h-4 w-4 text-primary" />
                Pricing Calculator
              </CardTitle>
              <CardDescription className="mt-1">
                Work out what to charge per unit to hit your gross profit target.
              </CardDescription>
            </div>
            <div className="flex gap-2 items-center">
              <Badge variant={channel === "dtc" ? "default" : "secondary"} className="uppercase tracking-wide">
                {channel === "dtc" ? "Direct to customer" : "Wholesale"}
              </Badge>
              {vatEnabled
                ? <Badge variant="outline" className="text-success border-success/40">VAT {vatRate}%</Badge>
                : <Badge variant="outline">VAT off</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Product">
              <Select value={recipeId ?? ""} onValueChange={setRecipeId}>
                <SelectTrigger><SelectValue placeholder="Choose a product" /></SelectTrigger>
                <SelectContent>
                  {recipes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Channel">
              <Tabs value={channel} onValueChange={(v) => setChannel(v as Channel)}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="dtc">Direct to customer</TabsTrigger>
                  <TabsTrigger value="wholesale">Wholesale</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
          </div>
        </CardContent>
      </Card>

      {!recipe ? (
        <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">
          Pick a product above to start pricing.
        </CardContent></Card>
      ) : (
        <div className="grid lg:grid-cols-[1fr_420px] gap-5">
          {/* Inputs column */}
          <div className="space-y-5">
            {/* Costs */}
            <Section title="Costs" description="Everything that goes into one unit.">
              {linkedIngredientCost > 0 ? (
                <p className="text-[11px] text-muted-foreground -mt-2 mb-3 flex items-center gap-1">
                  <Link2 className="h-3 w-3" /> Ingredient cost auto-derived from recipe.
                </p>
              ) : (
                <p className="text-[11px] text-warning -mt-2 mb-3 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Link a recipe for accurate ingredient costing & allergens.
                </p>
              )}
              <div className="grid sm:grid-cols-2 gap-3">
                <MoneyField
                  label="Ingredient cost / unit"
                  value={ingredientOverride !== "" ? ingredientOverride : linkedIngredientCost.toFixed(2)}
                  onChange={setIngredientOverride}
                  hint={linkedIngredientCost > 0 ? "Edit to override recipe value." : "Enter manual cost."}
                />
                <MoneyField label="Packaging / unit" value={packaging} onChange={setPackaging} />
                <MoneyField label="Labour / unit" value={labour} onChange={setLabour}
                  hint="Auto-suggested from recipe labour minutes & blended rate." />
                <MoneyField label="Other variable / unit" value={otherVar} onChange={setOtherVar} />
              </div>
              <Separator className="my-4" />
              <div className="grid sm:grid-cols-2 gap-3">
                <MoneyField
                  label="Monthly overhead allocation (this product)"
                  value={overheadAlloc}
                  onChange={setOverheadAlloc}
                  hint={totalMonthlyOverhead > 0
                    ? `Site overhead this month: £${totalMonthlyOverhead.toFixed(0)}.`
                    : "Blank assumes £0 — add site overheads to refine."}
                />
                <Field label="Units per month" hint="Used to spread overheads and estimate monthly GP.">
                  <Input
                    type="number" inputMode="numeric" min={0}
                    value={unitsPerMonth}
                    onChange={(e) => setUnitsPerMonth(e.target.value)}
                    placeholder="e.g. 120"
                  />
                </Field>
              </div>
              {upm === 0 && (
                <div className="mt-3 flex items-start gap-2 text-[12px] text-warning bg-warning/10 border border-warning/20 rounded-md p-2">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Enter units per month to calculate overhead per unit and monthly gross profit.
                </div>
              )}
            </Section>

            {/* Pricing */}
            <Section title="Target margin" description="The gross profit you want this product to earn.">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs text-muted-foreground">Target gross profit</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number" min={40} max={85} step={1}
                    value={targetGp}
                    onChange={(e) => setTargetGp(Math.min(85, Math.max(40, num(e.target.value, 40))))}
                    className="w-20 h-8 text-right tabular-nums"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <Slider
                value={[targetGp]} min={40} max={85} step={1}
                onValueChange={(v) => setTargetGp(v[0])}
              />
              <p className="text-[11px] text-muted-foreground mt-2">
                Default: {channel === "dtc" ? "70% for DTC" : "55% for wholesale"}.
              </p>
            </Section>

            {/* VAT */}
            <Section title="VAT" description="Toggle to add or hide VAT in the displayed price.">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">VAT enabled</Label>
                  <p className="text-[11px] text-muted-foreground">
                    {siteVatOn ? "Prefilled from your site VAT settings." : "Not set on site — toggle on if you charge VAT."}
                  </p>
                </div>
                <Switch checked={vatEnabled}
                  onCheckedChange={(v) => { setVatEnabled(v); setVatTouched(true); }} />
              </div>
              {vatEnabled && (
                <div className="mt-3 max-w-[160px]">
                  <Label className="text-xs">VAT rate %</Label>
                  <Input type="number" min={0} max={100} step={0.5}
                    value={vatRate} onChange={(e) => { setVatRate(e.target.value); setVatTouched(true); }} />
                </div>
              )}
            </Section>

            {/* Wholesale options */}
            {channel === "wholesale" && (
              <Section title="Wholesale options" description="Set your trade price, or discount off the DTC price.">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm">Use discount off DTC</Label>
                  <Switch checked={wsUseDiscount} onCheckedChange={setWsUseDiscount} />
                </div>
                {wsUseDiscount ? (
                  <Field label="Discount off DTC price (%)">
                    <Input type="number" min={0} max={90} step={1}
                      value={wsDiscountPct} onChange={(e) => setWsDiscountPct(e.target.value)} />
                  </Field>
                ) : (
                  <MoneyField
                    label={`Wholesale list price${vatEnabled ? " (inc VAT)" : ""}`}
                    value={wsPrice} onChange={setWsPrice}
                    hint="Leave blank to use a suggestion."
                  />
                )}
              </Section>
            )}
          </div>

          {/* Results column */}
          <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <Card className="overflow-hidden border-primary/20">
              <CardHeader className="bg-primary/5 pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> Results
                </CardTitle>
                <CardDescription>What this product costs, and what to charge.</CardDescription>
              </CardHeader>
              <CardContent className="pt-5 space-y-5">
                <Hero
                  label="True cost / unit"
                  value={`£${trueCostPerUnit.toFixed(2)}`}
                  sub="All ingredient + packaging + labour + overhead."
                />
                <Hero
                  label={`Recommended price${vatEnabled ? " (inc VAT)" : ""}`}
                  value={`£${recommendedIncVat.toFixed(2)}`}
                  sub={vatEnabled
                    ? `Net £${requiredNet.toFixed(2)} · VAT £${(recommendedIncVat - requiredNet).toFixed(2)}`
                    : `To hit ${targetGp}% gross profit.`}
                  emphasis
                />

                <Separator />

                {/* Editable display price */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Your price{vatEnabled ? " (inc VAT)" : ""}
                    </Label>
                    <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={setRecommended}>
                      Reset to recommended
                    </Button>
                  </div>
                  <Input
                    type="number" step="0.01" inputMode="decimal"
                    value={priceOverride}
                    onChange={(e) => setPriceOverride(e.target.value)}
                    placeholder={recommendedIncVat.toFixed(2)}
                    className="text-lg font-semibold tabular-nums h-11"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[0.25, 0.5, 1].map((d) => (
                      <Button key={d} size="sm" variant="outline" className="h-7 text-[11px]"
                        onClick={() => bumpPrice(d)}>+£{d.toFixed(2)}</Button>
                    ))}
                    <Button size="sm" variant="outline" className="h-7 text-[11px]"
                      onClick={() => roundTo(99)}>Round .99</Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px]"
                      onClick={() => roundTo(50)}>Round .50</Button>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-3">
                  <Stat label="GP / unit" value={`£${gpPerUnit.toFixed(2)}`} tone={marginState} />
                  <Stat label="GP %" value={`${gpPercent.toFixed(1)}%`} tone={marginState} />
                  <Stat label="Monthly GP"
                    value={upm > 0 ? `£${monthlyGp.toFixed(0)}` : "—"}
                    tone={marginState}
                    sub={upm > 0 ? `${upm} units/mo` : "Enter units/mo"} />
                  <Stat label="Net selling price" value={`£${activeNet.toFixed(2)}`} />
                </div>

                {channel === "wholesale" && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                        Wholesale
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <Stat label="WS net" value={`£${wsListNet.toFixed(2)}`} />
                        {vatEnabled && <Stat label="WS inc VAT" value={`£${wsListGross.toFixed(2)}`} />}
                        <Stat label="WS GP / unit" value={`£${wsGpPerUnit.toFixed(2)}`} />
                        <Stat label="WS monthly GP"
                          value={upm > 0 ? `£${wsMonthlyGp.toFixed(0)}` : "—"} />
                      </div>
                    </div>
                  </>
                )}

                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none hover:text-foreground">
                    Show breakdown
                  </summary>
                  <div className="mt-2 space-y-1">
                    <KV k="Overhead / unit" v={`£${overheadPerUnit.toFixed(2)}`} />
                    {vatEnabled && <KV k="VAT / unit" v={`£${vatPerUnit.toFixed(2)}`} />}
                    <KV k="Contribution before overhead" v={`£${contribBeforeOverhead.toFixed(2)}`} />
                    <KV k="Contribution after overhead" v={`£${contribAfterOverhead.toFixed(2)}`} />
                  </div>
                </details>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardContent className="pt-4 space-y-2">
                <Button className="w-full" disabled={saving}
                  onClick={() => persist(channel)}>
                  Apply {channel === "dtc" ? "DTC" : "wholesale"} price
                </Button>
                <Button variant="outline" className="w-full" disabled={saving}
                  onClick={() => persist("save")}>
                  Save assumptions only
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────── Tiny UI helpers ────────── */

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function MoneyField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">£</span>
        <Input
          type="number" step="0.01" inputMode="decimal" min={0}
          value={value} onChange={(e) => onChange(e.target.value)}
          className="pl-7 tabular-nums"
          placeholder="0.00"
        />
      </div>
    </Field>
  );
}

function Hero({ label, value, sub, emphasis }: { label: string; value: string; sub?: string; emphasis?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
      <p className={`tabular-nums font-bold leading-none mt-1 ${emphasis ? "text-4xl text-primary" : "text-3xl"}`}>
        {value}
      </p>
      {sub && <p className="text-[11px] text-muted-foreground mt-1.5">{sub}</p>}
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "ok" | "weak" }) {
  const toneCls = tone === "good" ? "text-success" : tone === "ok" ? "text-warning" : tone === "weak" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-md border bg-card/50 p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold tabular-nums mt-0.5 ${toneCls}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span>{k}</span><span className="tabular-nums">{v}</span>
    </div>
  );
}
