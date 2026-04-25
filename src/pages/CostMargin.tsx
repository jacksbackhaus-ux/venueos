import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Calculator, Settings as SettingsIcon, ChefHat, Lock } from "lucide-react";
import { Navigate } from "react-router-dom";

type Unit = "g" | "kg" | "ml" | "l" | "each";
const UNITS: Unit[] = ["g", "kg", "ml", "l", "each"];

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  cost_per_unit: number | null;
}

interface RecipeIng {
  id: string;
  ingredient_id: string;
  weight: number | null;
  unit: string | null;
  cost_per_unit_override: number | null;
  ingredients?: Ingredient | null;
}

interface Recipe {
  id: string;
  name: string;
  category: string;
  packaging_cost: number;
  labour_minutes: number;
  sell_price_ex_vat: number | null;
  vat_rate: string;
  monthly_volume: number;
  target_margin_override: number | null;
  recipe_ingredients?: RecipeIng[];
}

interface CostSettings {
  organisation_id: string;
  target_margin_pct: number;
  labour_hourly_rate: number;
  monthly_overhead: number;
}

const VAT_OPTIONS = [
  { value: "zero", label: "Zero rated (0%)", rate: 0 },
  { value: "standard", label: "Standard (20%)", rate: 0.2 },
  { value: "exempt", label: "Exempt", rate: 0 },
];

// Convert a quantity from one unit to a base unit (kg or l or each).
// Returns null if units aren't compatible.
function toBase(qty: number, unit: string): { base: number; baseUnit: "kg" | "l" | "each" } | null {
  switch (unit) {
    case "g": return { base: qty / 1000, baseUnit: "kg" };
    case "kg": return { base: qty, baseUnit: "kg" };
    case "ml": return { base: qty / 1000, baseUnit: "l" };
    case "l": return { base: qty, baseUnit: "l" };
    case "each": return { base: qty, baseUnit: "each" };
    default: return null;
  }
}

function ingredientLineCost(line: RecipeIng): number {
  const ing = line.ingredients;
  if (!ing) return 0;
  const cpu = line.cost_per_unit_override ?? ing.cost_per_unit;
  if (cpu == null) return 0;
  const lineUnit = line.unit || ing.unit;
  const ingUnit = ing.unit;
  const lineBase = toBase(Number(line.weight) || 0, lineUnit);
  // cost is in £ per ing.unit. Convert ingredient unit to base too.
  const costBase = toBase(1, ingUnit);
  if (!lineBase || !costBase || lineBase.baseUnit !== costBase.baseUnit) return 0;
  // cost per base unit = cpu / costBase.base
  const costPerBase = cpu / costBase.base;
  return lineBase.base * costPerBase;
}

export default function CostMargin() {
  const { appUser, orgRole } = useAuth();
  const { currentSite } = useSite();
  const qc = useQueryClient();
  const orgId = appUser?.organisation_id || null;
  const siteId = currentSite?.id || null;

  // Manager-only: org_owner or hq_admin
  const isManager = orgRole?.org_role === "org_owner" || orgRole?.org_role === "hq_admin";

  const { data: settings } = useQuery({
    queryKey: ["cost-settings", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<CostSettings | null> => {
      const { data, error } = await supabase
        .from("org_cost_settings")
        .select("*")
        .eq("organisation_id", orgId!)
        .maybeSingle();
      if (error) throw error;
      return data as CostSettings | null;
    },
  });

  const { data: recipes = [] } = useQuery({
    queryKey: ["cost-recipes", siteId],
    enabled: !!siteId,
    queryFn: async (): Promise<Recipe[]> => {
      const { data, error } = await supabase
        .from("recipes")
        .select(`
          id, name, category, packaging_cost, labour_minutes,
          sell_price_ex_vat, vat_rate, monthly_volume, target_margin_override,
          recipe_ingredients(
            id, ingredient_id, weight, unit, cost_per_unit_override,
            ingredients(id, name, unit, cost_per_unit)
          )
        `)
        .eq("site_id", siteId!)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as Recipe[];
    },
  });

  const { data: ingredients = [] } = useQuery({
    queryKey: ["cost-ingredients", siteId],
    enabled: !!siteId,
    queryFn: async (): Promise<Ingredient[]> => {
      const { data, error } = await supabase
        .from("ingredients")
        .select("id, name, unit, cost_per_unit")
        .eq("site_id", siteId!)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as Ingredient[];
    },
  });

  const totalMonthlyUnits = useMemo(
    () => recipes.reduce((s, r) => s + (Number(r.monthly_volume) || 0), 0),
    [recipes]
  );
  const overheadPerUnit = useMemo(() => {
    const overhead = Number(settings?.monthly_overhead) || 0;
    if (!overhead || !totalMonthlyUnits) return 0;
    return overhead / totalMonthlyUnits;
  }, [settings?.monthly_overhead, totalMonthlyUnits]);

  if (!isManager) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-heading font-bold text-2xl flex items-center gap-2">
          <Calculator className="h-6 w-6 text-primary" />
          Cost &amp; Margin
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Recipe costing, target margins and sell prices — pulls live from Allergens &amp; Recipes.
        </p>
      </div>

      <Tabs defaultValue="recipes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recipes"><ChefHat className="h-4 w-4 mr-2" />Recipes</TabsTrigger>
          <TabsTrigger value="ingredients">Ingredient costs</TabsTrigger>
          <TabsTrigger value="settings"><SettingsIcon className="h-4 w-4 mr-2" />Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="recipes">
          <RecipesTab
            recipes={recipes}
            settings={settings}
            overheadPerUnit={overheadPerUnit}
            onChange={() => qc.invalidateQueries({ queryKey: ["cost-recipes", siteId] })}
          />
        </TabsContent>

        <TabsContent value="ingredients">
          <IngredientsTab
            ingredients={ingredients}
            onChange={() => qc.invalidateQueries({ queryKey: ["cost-ingredients", siteId] })}
          />
        </TabsContent>

        <TabsContent value="settings">
          <SettingsTab
            settings={settings}
            orgId={orgId}
            recipes={recipes}
            totalMonthlyUnits={totalMonthlyUnits}
            overheadPerUnit={overheadPerUnit}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["cost-settings", orgId] });
              qc.invalidateQueries({ queryKey: ["cost-recipes", siteId] });
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------- Recipes Tab ------------------------------ */

function RecipesTab({
  recipes, settings, overheadPerUnit, onChange,
}: {
  recipes: Recipe[];
  settings: CostSettings | null | undefined;
  overheadPerUnit: number;
  onChange: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedId && recipes.length) setSelectedId(recipes[0].id);
  }, [recipes, selectedId]);

  const selected = recipes.find((r) => r.id === selectedId) || null;

  if (!recipes.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No recipes yet. Add recipes in Allergens &amp; Recipes first.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid md:grid-cols-[260px_1fr] gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recipes</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <div className="space-y-1 max-h-[60vh] overflow-y-auto">
            {recipes.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors ${
                  selectedId === r.id ? "bg-muted font-semibold" : ""
                }`}
              >
                <div className="truncate">{r.name}</div>
                <div className="text-[11px] text-muted-foreground">{r.category}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {selected && (
        <RecipeCosting
          key={selected.id}
          recipe={selected}
          settings={settings}
          overheadPerUnit={overheadPerUnit}
          onChange={onChange}
        />
      )}
    </div>
  );
}

function RecipeCosting({
  recipe, settings, overheadPerUnit, onChange,
}: {
  recipe: Recipe;
  settings: CostSettings | null | undefined;
  overheadPerUnit: number;
  onChange: () => void;
}) {
  const [packaging, setPackaging] = useState(String(recipe.packaging_cost ?? 0));
  const [labourMins, setLabourMins] = useState(String(recipe.labour_minutes ?? 0));
  const [sellPrice, setSellPrice] = useState(
    recipe.sell_price_ex_vat != null ? String(recipe.sell_price_ex_vat) : ""
  );
  const [vatRate, setVatRate] = useState(recipe.vat_rate || "zero");
  const [marginOverride, setMarginOverride] = useState(
    recipe.target_margin_override != null ? String(recipe.target_margin_override) : ""
  );
  const [saving, setSaving] = useState(false);

  const ingredientCost = useMemo(
    () => (recipe.recipe_ingredients || []).reduce((s, l) => s + ingredientLineCost(l), 0),
    [recipe.recipe_ingredients]
  );
  const labourRate = Number(settings?.labour_hourly_rate) || 0;
  const labourCost = (Number(labourMins) / 60) * labourRate;
  const packCost = Number(packaging) || 0;
  const totalCost = ingredientCost + packCost + labourCost + overheadPerUnit;

  const targetMarginPct = marginOverride
    ? Number(marginOverride)
    : Number(settings?.target_margin_pct) || 0;

  // recommended sell ex-VAT so that margin% = (sell - cost) / sell
  const recommendedSell =
    targetMarginPct < 100 && targetMarginPct >= 0
      ? totalCost / (1 - targetMarginPct / 100)
      : 0;

  const sellNum = Number(sellPrice) || 0;
  const marginValue = sellNum - totalCost;
  const marginPct = sellNum > 0 ? (marginValue / sellNum) * 100 : 0;
  const vatMultiplier = 1 + (VAT_OPTIONS.find((v) => v.value === vatRate)?.rate ?? 0);
  const sellIncVat = sellNum * vatMultiplier;
  const recommendedIncVat = recommendedSell * vatMultiplier;

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("recipes")
        .update({
          packaging_cost: Number(packaging) || 0,
          labour_minutes: Number(labourMins) || 0,
          sell_price_ex_vat: sellPrice === "" ? null : Number(sellPrice),
          vat_rate: vatRate,
          target_margin_override: marginOverride === "" ? null : Number(marginOverride),
        })
        .eq("id", recipe.id);
      if (error) throw error;
      toast.success("Costing saved");
      onChange();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{recipe.name}</CardTitle>
        <CardDescription>{recipe.category}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Ingredient breakdown */}
        <div>
          <h3 className="text-sm font-semibold mb-2">Ingredients</h3>
          {(recipe.recipe_ingredients || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No ingredients on this recipe.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingredient</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(recipe.recipe_ingredients || []).map((line) => {
                    const lineUnit = line.unit || line.ingredients?.unit || "—";
                    const cpu = line.cost_per_unit_override ?? line.ingredients?.cost_per_unit;
                    return (
                      <TableRow key={line.id}>
                        <TableCell>
                          <div className="font-medium">{line.ingredients?.name || "—"}</div>
                          {cpu == null && (
                            <Badge variant="outline" className="mt-1 text-[10px]">No cost set</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {Number(line.weight || 0)} {lineUnit}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          £{ingredientLineCost(line).toFixed(3)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Inputs */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Packaging cost (£ per unit)</Label>
            <Input type="number" step="0.01" value={packaging} onChange={(e) => setPackaging(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Labour time (minutes)</Label>
            <Input type="number" step="0.5" value={labourMins} onChange={(e) => setLabourMins(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">
              @ £{labourRate.toFixed(2)}/hr → £{labourCost.toFixed(3)}/unit
            </p>
          </div>
          <div className="space-y-1">
            <Label>Sell price ex-VAT (£)</Label>
            <Input type="number" step="0.01" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>VAT rate</Label>
            <Select value={vatRate} onValueChange={setVatRate}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {VAT_OPTIONS.map((v) => (
                  <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Target margin override % (optional)</Label>
            <Input
              type="number"
              step="0.1"
              placeholder={`Default: ${settings?.target_margin_pct ?? 60}%`}
              value={marginOverride}
              onChange={(e) => setMarginOverride(e.target.value)}
            />
          </div>
        </div>

        {/* Cost summary */}
        <div className="rounded-md border bg-muted/30 p-4 space-y-1.5 text-sm">
          <Row label="Ingredient cost" value={`£${ingredientCost.toFixed(3)}`} />
          <Row label="Packaging" value={`£${packCost.toFixed(3)}`} />
          <Row label="Labour" value={`£${labourCost.toFixed(3)}`} />
          <Row label="Overhead contribution" value={`£${overheadPerUnit.toFixed(3)}`} />
          <div className="border-t pt-1.5 mt-1.5">
            <Row label="Total cost / unit" value={`£${totalCost.toFixed(3)}`} bold />
          </div>
        </div>

        {/* Pricing & margin */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Recommended price</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              <p className="text-2xl font-bold tabular-nums">£{recommendedSell.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">ex-VAT · @ {targetMarginPct}% target</p>
              <p className="text-xs text-muted-foreground">£{recommendedIncVat.toFixed(2)} inc-VAT</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Actual margin</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              <p className={`text-2xl font-bold tabular-nums ${marginPct < targetMarginPct ? "text-warning" : "text-success"}`}>
                {sellNum > 0 ? `${marginPct.toFixed(1)}%` : "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                {sellNum > 0 ? `£${marginValue.toFixed(3)} per unit` : "Set sell price"}
              </p>
              <p className="text-xs text-muted-foreground">
                {sellNum > 0 ? `£${sellIncVat.toFixed(2)} inc-VAT` : ""}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save costing"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/* ----------------------------- Ingredients Tab ---------------------------- */

function IngredientsTab({ ingredients, onChange }: { ingredients: Ingredient[]; onChange: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ingredient default costs</CardTitle>
        <CardDescription>
          Set a unit and a cost per unit. Recipes can override per line if needed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {ingredients.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No ingredients yet. Add some in Allergens &amp; Recipes.
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingredient</TableHead>
                  <TableHead className="w-32">Unit</TableHead>
                  <TableHead className="w-40">Cost (£) per unit</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {ingredients.map((ing) => (
                  <IngredientRow key={ing.id} ing={ing} onSaved={onChange} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IngredientRow({ ing, onSaved }: { ing: Ingredient; onSaved: () => void }) {
  const [unit, setUnit] = useState<string>(ing.unit || "kg");
  const [cost, setCost] = useState<string>(ing.cost_per_unit != null ? String(ing.cost_per_unit) : "");
  const [saving, setSaving] = useState(false);
  const dirty = unit !== (ing.unit || "kg") || cost !== (ing.cost_per_unit != null ? String(ing.cost_per_unit) : "");

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("ingredients")
        .update({ unit, cost_per_unit: cost === "" ? null : Number(cost) })
        .eq("id", ing.id);
      if (error) throw error;
      toast.success("Saved");
      onSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{ing.name}</TableCell>
      <TableCell>
        <Select value={unit} onValueChange={setUnit}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} className="h-9" />
      </TableCell>
      <TableCell>
        <Button size="sm" onClick={save} disabled={!dirty || saving}>
          {saving ? "…" : "Save"}
        </Button>
      </TableCell>
    </TableRow>
  );
}

/* ------------------------------ Settings Tab ------------------------------ */

function SettingsTab({
  settings, orgId, recipes, totalMonthlyUnits, overheadPerUnit, onSaved,
}: {
  settings: CostSettings | null | undefined;
  orgId: string | null;
  recipes: Recipe[];
  totalMonthlyUnits: number;
  overheadPerUnit: number;
  onSaved: () => void;
}) {
  const [margin, setMargin] = useState(String(settings?.target_margin_pct ?? 60));
  const [labour, setLabour] = useState(String(settings?.labour_hourly_rate ?? 12));
  const [overhead, setOverhead] = useState(String(settings?.monthly_overhead ?? 0));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setMargin(String(settings.target_margin_pct));
      setLabour(String(settings.labour_hourly_rate));
      setOverhead(String(settings.monthly_overhead));
    }
  }, [settings]);

  const saveSettings = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      const payload = {
        organisation_id: orgId,
        target_margin_pct: Number(margin) || 0,
        labour_hourly_rate: Number(labour) || 0,
        monthly_overhead: Number(overhead) || 0,
      };
      const { error } = await supabase
        .from("org_cost_settings")
        .upsert(payload, { onConflict: "organisation_id" });
      if (error) throw error;
      toast.success("Settings saved");
      onSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Defaults</CardTitle>
          <CardDescription>Applied to all recipes unless overridden.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Target margin (%)</Label>
              <Input type="number" step="0.1" value={margin} onChange={(e) => setMargin(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Labour rate (£/hr)</Label>
              <Input type="number" step="0.01" value={labour} onChange={(e) => setLabour(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Monthly overhead (£)</Label>
              <Input type="number" step="0.01" value={overhead} onChange={(e) => setOverhead(e.target.value)} />
            </div>
          </div>
          <div className="rounded-md bg-muted/30 border p-3 text-sm space-y-1">
            <div className="flex justify-between"><span>Total estimated monthly units</span><span className="tabular-nums">{totalMonthlyUnits.toLocaleString()}</span></div>
            <div className="flex justify-between font-semibold"><span>Overhead per unit</span><span className="tabular-nums">£{overheadPerUnit.toFixed(3)}</span></div>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveSettings} disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estimated monthly volume per recipe</CardTitle>
          <CardDescription>Used to spread the overhead figure across each unit produced.</CardDescription>
        </CardHeader>
        <CardContent>
          {recipes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No recipes yet.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipe</TableHead>
                    <TableHead className="w-40">Units / month</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipes.map((r) => (
                    <VolumeRow key={r.id} recipe={r} onSaved={onSaved} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function VolumeRow({ recipe, onSaved }: { recipe: Recipe; onSaved: () => void }) {
  const [val, setVal] = useState(String(recipe.monthly_volume ?? 0));
  const [saving, setSaving] = useState(false);
  const dirty = val !== String(recipe.monthly_volume ?? 0);

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("recipes")
        .update({ monthly_volume: Number(val) || 0 })
        .eq("id", recipe.id);
      if (error) throw error;
      toast.success("Saved");
      onSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{recipe.name}</TableCell>
      <TableCell>
        <Input type="number" step="1" value={val} onChange={(e) => setVal(e.target.value)} className="h-9" />
      </TableCell>
      <TableCell>
        <Button size="sm" onClick={save} disabled={!dirty || saving}>{saving ? "…" : "Save"}</Button>
      </TableCell>
    </TableRow>
  );
}
