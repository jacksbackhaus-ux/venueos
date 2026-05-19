// True Margin Engine — Cost & Margin redesign.
// Replaces the old single-list view with a typed Recipes tab (menu items vs prep
// batches), an Ingredients setup tab, a Settings tab (VAT mode, derived labour
// rate, overhead) and a Sales placeholder. All numbers run through the shared
// trueMargin.ts engine, so Batches, Reports and this page agree.

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Calculator, Settings as SettingsIcon, ChefHat, Boxes, BarChart3, Plus, Trash2, Receipt, Layers } from "lucide-react";
import { toast } from "sonner";
import {
  loadTMEContext, calcRecipeBreakdown, tmeLineCost,
  type TMEContext, type TMERecipe, type TMERecipeIngredient, type TMEIngredient,
} from "@/lib/trueMargin";
import { MarginWatchdogCard } from "@/components/cost-margin/MarginWatchdogCard";
import OverheadsTab from "@/components/cost-margin/OverheadsTab";
import ChannelsSettings from "@/components/cost-margin/ChannelsSettings";
import ChannelPricing from "@/components/cost-margin/ChannelPricing";

const PACK_UNITS = ["g", "kg", "ml", "l", "each"] as const;
const RECIPE_UNITS = ["g", "ml", "each"] as const;

export default function CostMargin() {
  const { appUser, orgRole } = useAuth();
  const { currentSite } = useSite();
  const qc = useQueryClient();
  const orgId = appUser?.organisation_id || null;
  const siteId = currentSite?.id || null;

  const isManager =
    orgRole?.org_role === "org_owner" || orgRole?.org_role === "hq_admin";

  const tmeQuery = useQuery({
    queryKey: ["tme-ctx", siteId, orgId],
    enabled: !!siteId && !!orgId,
    queryFn: async () => loadTMEContext(siteId!, orgId!),
  });

  const ingredientsQuery = useQuery({
    queryKey: ["tme-ingredients", siteId],
    enabled: !!siteId,
    queryFn: async (): Promise<TMEIngredient[]> => {
      const { data, error } = await supabase
        .from("ingredients")
        .select(
          "id, name, default_recipe_unit, density_g_per_ml, vat_rate_percent, supplier_price_input_mode, yield_percent_default, pack_quantity, pack_unit, pack_price, cost_per_unit, unit, supplier_item_id, allergens"
        )
        .eq("site_id", siteId!)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as TMEIngredient[];
    },
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["tme-ctx", siteId, orgId] });
    qc.invalidateQueries({ queryKey: ["tme-ingredients", siteId] });
  };

  if (!isManager) return <Navigate to="/" replace />;

  const ctx = tmeQuery.data?.ctx;
  const allRecipes = tmeQuery.data?.recipes || [];
  const ingredients = ingredientsQuery.data || [];
  const menuItems = allRecipes.filter((r) => r.recipe_type !== "prep_batch");
  const prepBatches = allRecipes.filter((r) => r.recipe_type === "prep_batch");

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-heading font-bold text-2xl flex items-center gap-2">
          <Calculator className="h-6 w-6 text-primary" />
          True Margin Engine
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Recipe costing with VAT, yield, nested prep and derived labour.
        </p>
      </div>

      <MarginWatchdogCard siteId={siteId} ctx={ctx} recipes={allRecipes} />

      <Tabs defaultValue="menu" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="menu"><ChefHat className="h-4 w-4 mr-2" />Menu items</TabsTrigger>
          <TabsTrigger value="prep"><Boxes className="h-4 w-4 mr-2" />Prep batches</TabsTrigger>
          <TabsTrigger value="ingredients">Ingredients</TabsTrigger>
          <TabsTrigger value="overheads"><Receipt className="h-4 w-4 mr-2" />Overheads</TabsTrigger>
          <TabsTrigger value="channels"><Layers className="h-4 w-4 mr-2" />Channels</TabsTrigger>
          <TabsTrigger value="sales"><BarChart3 className="h-4 w-4 mr-2" />Sales</TabsTrigger>
          <TabsTrigger value="settings"><SettingsIcon className="h-4 w-4 mr-2" />Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="menu">
          <RecipesPanel
            kind="menu_item"
            recipes={menuItems}
            ctx={ctx}
            ingredients={ingredients}
            allRecipes={allRecipes}
            onChange={refreshAll}
            siteId={siteId}
            orgId={orgId}
          />
        </TabsContent>

        <TabsContent value="prep">
          <RecipesPanel
            kind="prep_batch"
            recipes={prepBatches}
            ctx={ctx}
            ingredients={ingredients}
            allRecipes={allRecipes}
            onChange={refreshAll}
            siteId={siteId}
            orgId={orgId}
          />
        </TabsContent>

        <TabsContent value="ingredients">
          <IngredientsTab ingredients={ingredients} onChange={refreshAll} />
        </TabsContent>

        <TabsContent value="overheads">
          <OverheadsTab siteId={siteId} orgId={orgId} />
        </TabsContent>

        <TabsContent value="channels">
          <ChannelsSettings siteId={siteId} orgId={orgId} />
        </TabsContent>

        <TabsContent value="sales">
          <SalesStub />
        </TabsContent>

        <TabsContent value="settings">
          <SettingsTab ctx={ctx} orgId={orgId} onSaved={refreshAll} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─────────────── Recipes list panel ─────────────── */

function RecipesPanel({
  kind, recipes, ctx, ingredients, allRecipes, onChange, siteId, orgId,
}: {
  kind: "menu_item" | "prep_batch";
  recipes: TMERecipe[];
  ctx: TMEContext | undefined;
  ingredients: TMEIngredient[];
  allRecipes: TMERecipe[];
  onChange: () => void;
  siteId: string | null;
  orgId: string | null;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (!ctx) {
    return (
      <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
        Loading…
      </CardContent></Card>
    );
  }

  const create = async (name: string) => {
    if (!siteId || !orgId || !name.trim()) return;
    const { data, error } = await supabase
      .from("recipes")
      .insert({
        site_id: siteId,
        organisation_id: orgId,
        name: name.trim(),
        recipe_type: kind,
        portions: kind === "prep_batch" ? 1 : 1,
        target_gp_percent: ctx.settings.target_margin_pct,
      })
      .select("id")
      .single();
    if (error) { toast.error(error.message); return; }
    onChange();
    setOpenId(data!.id);
    setCreating(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {kind === "menu_item"
            ? "Items you sell. Sale price drives GP %."
            : "Prep / sub-recipes used as ingredients in menu items."}
        </p>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1" /> New {kind === "menu_item" ? "menu item" : "prep batch"}
        </Button>
      </div>

      {recipes.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nothing here yet. Click "New" to start.
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Cost / portion</TableHead>
                  {kind === "menu_item" && <>
                    <TableHead className="text-right">Sale price</TableHead>
                    <TableHead className="text-right">GP %</TableHead>
                  </>}
                  {kind === "prep_batch" && <TableHead className="text-right">Portions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipes.map((r) => {
                  const bd = calcRecipeBreakdown(r, ctx);
                  const target = Number(r.target_gp_percent) || ctx.settings.target_margin_pct;
                  const gpClass = bd.gpPercent == null
                    ? "text-muted-foreground"
                    : bd.gpPercent < target ? "text-warning" : "text-success";
                  return (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpenId(r.id)}>
                      <TableCell>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-[11px] text-muted-foreground">{r.category}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        £{bd.costPerPortionExVat.toFixed(3)}
                      </TableCell>
                      {kind === "menu_item" && <>
                        <TableCell className="text-right tabular-nums">
                          {bd.salePriceIncVat != null ? `£${bd.salePriceIncVat.toFixed(2)}` : "—"}
                        </TableCell>
                        <TableCell className={`text-right tabular-nums font-semibold ${gpClass}`}>
                          {bd.gpPercent != null ? `${bd.gpPercent.toFixed(1)}%` : "—"}
                        </TableCell>
                      </>}
                      {kind === "prep_batch" && (
                        <TableCell className="text-right tabular-nums">{r.portions}</TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {openId && (
        <RecipeDrawer
          recipeId={openId}
          ctx={ctx}
          ingredients={ingredients}
          allRecipes={allRecipes}
          onClose={() => setOpenId(null)}
          onChange={onChange}
        />
      )}

      {creating && <CreateRecipeDialog onCancel={() => setCreating(false)} onCreate={create} kind={kind} />}
    </div>
  );
}

function CreateRecipeDialog({
  kind, onCancel, onCreate,
}: {
  kind: "menu_item" | "prep_batch";
  onCancel: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");
  return (
    <Sheet open onOpenChange={(o) => !o && onCancel()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New {kind === "menu_item" ? "menu item" : "prep batch"}</SheetTitle>
          <SheetDescription>Give it a name to start.</SheetDescription>
        </SheetHeader>
        <div className="space-y-3 mt-4">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button onClick={() => onCreate(name)} disabled={!name.trim()}>Create</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ─────────────── Recipe drawer ─────────────── */

function RecipeDrawer({
  recipeId, ctx, ingredients, allRecipes, onClose, onChange,
}: {
  recipeId: string;
  ctx: TMEContext;
  ingredients: TMEIngredient[];
  allRecipes: TMERecipe[];
  onClose: () => void;
  onChange: () => void;
}) {
  const recipe = allRecipes.find((r) => r.id === recipeId);
  const isMenu = recipe?.recipe_type !== "prep_batch";

  const [portions, setPortions] = useState(String(recipe?.portions ?? 1));
  const [labourMins, setLabourMins] = useState(String(recipe?.labour_minutes ?? 0));
  const [packaging, setPackaging] = useState(String(recipe?.packaging_cost ?? 0));
  const [salePrice, setSalePrice] = useState(recipe?.sale_price != null ? String(recipe.sale_price) : "");
  const [saleVat, setSaleVat] = useState(String(recipe?.sale_price_vat_rate_percent ?? 20));
  const [targetGp, setTargetGp] = useState(String(recipe?.target_gp_percent ?? ctx.settings.target_margin_pct));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!recipe) return;
    setPortions(String(recipe.portions ?? 1));
    setLabourMins(String(recipe.labour_minutes ?? 0));
    setPackaging(String(recipe.packaging_cost ?? 0));
    setSalePrice(recipe.sale_price != null ? String(recipe.sale_price) : "");
    setSaleVat(String(recipe.sale_price_vat_rate_percent ?? 20));
    setTargetGp(String(recipe.target_gp_percent ?? ctx.settings.target_margin_pct));
  }, [recipeId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!recipe) {
    return (
      <Sheet open onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-full sm:max-w-2xl">
          <p className="p-6 text-sm text-muted-foreground">Recipe not found.</p>
        </SheetContent>
      </Sheet>
    );
  }

  const bd = calcRecipeBreakdown(recipe, ctx);

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("recipes")
        .update({
          portions: Number(portions) || 1,
          labour_minutes: Number(labourMins) || 0,
          packaging_cost: Number(packaging) || 0,
          sale_price: salePrice === "" ? null : Number(salePrice),
          sale_price_vat_rate_percent: Number(saleVat) || 0,
          target_gp_percent: Number(targetGp) || 0,
        })
        .eq("id", recipe.id);
      if (error) throw error;
      toast.success("Saved");
      onChange();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{recipe.name}</SheetTitle>
          <SheetDescription>
            {isMenu ? "Menu item" : "Prep batch"} · {recipe.category}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-4">
          {/* Lines */}
          <RecipeLines
            recipe={recipe}
            ctx={ctx}
            ingredients={ingredients}
            allRecipes={allRecipes}
            onChange={onChange}
          />

          {/* Inputs */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>{isMenu ? "Portions / yields" : "Batch portions"}</Label>
              <Input type="number" step="1" value={portions} onChange={(e) => setPortions(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">
                Cost per portion = total ÷ this number.
              </p>
            </div>
            <div className="space-y-1">
              <Label>Labour minutes</Label>
              <Input type="number" step="0.5" value={labourMins} onChange={(e) => setLabourMins(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">
                @ £{ctx.effectiveHourlyRate.toFixed(2)}/hr ({ctx.settings.labor_rate_manual_override_enabled ? "manual" : "blended from timesheets"})
              </p>
            </div>
            <div className="space-y-1">
              <Label>Packaging cost (£)</Label>
              <Input type="number" step="0.01" value={packaging} onChange={(e) => setPackaging(e.target.value)} />
            </div>
            {isMenu && (
              <>
                <div className="space-y-1">
                  <Label>Sale price ({ctx.settings.costing_view_mode === "INC_VAT" ? "inc-VAT" : "ex-VAT"}) £</Label>
                  <Input type="number" step="0.01" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Sale VAT %</Label>
                  <Input type="number" step="0.5" value={saleVat} onChange={(e) => setSaleVat(e.target.value)} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Target GP %</Label>
                  <Input type="number" step="0.1" value={targetGp} onChange={(e) => setTargetGp(e.target.value)} />
                </div>
              </>
            )}
          </div>

          {/* Breakdown */}
          <div className="rounded-md border bg-muted/30 p-4 space-y-1.5 text-sm">
            <Row label="Ingredients (ex-VAT, after yield)" value={`£${bd.ingredientCostExVat.toFixed(3)}`} />
            <Row label="Packaging" value={`£${bd.packagingCost.toFixed(3)}`} />
            <Row label="Labour" value={`£${bd.labourCost.toFixed(3)}`} />
            <Row label="Overhead" value={`£${bd.overheadPerUnit.toFixed(3)}`} />
            <div className="border-t pt-1.5 mt-1.5">
              <Row label="Total cost (batch)" value={`£${bd.totalCostExVat.toFixed(3)}`} bold />
              <Row label="Cost per portion" value={`£${bd.costPerPortionExVat.toFixed(3)}`} bold />
            </div>
          </div>

          {/* Pricing */}
          {isMenu && (
            <div className="grid sm:grid-cols-2 gap-3">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Recommended price</CardTitle></CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-2xl font-bold tabular-nums">£{bd.recommendedSellExVat.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">ex-VAT @ {Number(targetGp).toFixed(1)}% GP</p>
                  <p className="text-xs text-muted-foreground">£{bd.recommendedSellIncVat.toFixed(2)} inc-VAT</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Actual GP</CardTitle></CardHeader>
                <CardContent className="space-y-1">
                  <p className={`text-2xl font-bold tabular-nums ${
                    bd.gpPercent != null && bd.gpPercent < Number(targetGp) ? "text-warning" : "text-success"
                  }`}>
                    {bd.gpPercent != null ? `${bd.gpPercent.toFixed(1)}%` : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {bd.grossProfitPerPortion != null
                      ? `£${bd.grossProfitPerPortion.toFixed(3)} / portion`
                      : "Set sale price"}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {isMenu && (
            <ChannelPricing
              recipeId={recipe.id}
              siteId={(recipe as any).site_id ?? null}
              orgId={(recipe as any).organisation_id ?? null}
              ingredientCostPerPortion={bd.costPerPortionExVat}
              initialDtcPrice={(recipe as any).dtc_price ?? recipe.sale_price ?? null}
              initialWholesalePrice={(recipe as any).wholesale_price ?? null}
              initialTargetGp={Number(targetGp) || 60}
              defaultChannel={((recipe as any).default_channel as any) || "dtc"}
              onPriceUpdated={onChange}
            />
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
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

/* ─────────────── Recipe lines (ingredients + nested) ─────────────── */

function RecipeLines({
  recipe, ctx, ingredients, allRecipes, onChange,
}: {
  recipe: TMERecipe;
  ctx: TMEContext;
  ingredients: TMEIngredient[];
  allRecipes: TMERecipe[];
  onChange: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const lines = recipe.recipe_ingredients || [];

  const addLine = async (
    line_type: "ingredient" | "nested_recipe",
    targetId: string,
    qty: number,
    unit: string
  ) => {
    const payload: any = {
      recipe_id: recipe.id,
      line_type,
      quantity: qty,
      weight: qty, // legacy mirror
      unit,
    };
    if (line_type === "ingredient") payload.ingredient_id = targetId;
    else payload.nested_recipe_id = targetId;
    const { error } = await supabase.from("recipe_ingredients").insert(payload);
    if (error) { toast.error(error.message); return; }
    onChange();
    setAdding(false);
  };

  const removeLine = async (id: string) => {
    // Soft delete by setting quantity to 0 since DELETE may be restricted
    const { error } = await supabase.from("recipe_ingredients").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    onChange();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-semibold">Ingredients & prep</h3>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="h-3 w-3 mr-1" /> Add line
        </Button>
      </div>
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center border rounded-md">
          No lines yet.
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right w-32">Qty</TableHead>
                <TableHead className="text-right w-24">Yield %</TableHead>
                <TableHead className="text-right w-24">Cost</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l) => (
                <LineRow
                  key={l.id}
                  line={l}
                  ctx={ctx}
                  allRecipes={allRecipes}
                  onChange={onChange}
                  onDelete={() => removeLine(l.id)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {adding && (
        <AddLineDialog
          ingredients={ingredients}
          recipes={allRecipes.filter((r) => r.id !== recipe.id)}
          onCancel={() => setAdding(false)}
          onAdd={addLine}
        />
      )}
    </div>
  );
}

function LineRow({
  line, ctx, allRecipes, onChange, onDelete,
}: {
  line: TMERecipeIngredient;
  ctx: TMEContext;
  allRecipes: TMERecipe[];
  onChange: () => void;
  onDelete: () => void;
}) {
  const [qty, setQty] = useState(String(line.quantity ?? line.weight ?? 0));
  const [yieldPct, setYieldPct] = useState(line.yield_percent_override != null ? String(line.yield_percent_override) : "");
  const dirty =
    qty !== String(line.quantity ?? line.weight ?? 0) ||
    yieldPct !== (line.yield_percent_override != null ? String(line.yield_percent_override) : "");

  const isNested = line.line_type === "nested_recipe";
  const nested = isNested ? allRecipes.find((r) => r.id === line.nested_recipe_id) : null;
  const ing = !isNested ? line.ingredients : null;
  const lineUnit = line.unit || (isNested ? "portion" : ing?.default_recipe_unit || "g");

  const save = async () => {
    const { error } = await supabase
      .from("recipe_ingredients")
      .update({
        quantity: Number(qty) || 0,
        weight: Number(qty) || 0,
        yield_percent_override: yieldPct === "" ? null : Number(yieldPct),
      })
      .eq("id", line.id);
    if (error) { toast.error(error.message); return; }
    onChange();
  };

  // Use a temporary line shape for cost preview
  const previewLine: TMERecipeIngredient = {
    ...line,
    quantity: Number(qty) || 0,
    yield_percent_override: yieldPct === "" ? null : Number(yieldPct),
  };
  const cost = tmeLineCost(previewLine, ctx);

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{nested?.name || ing?.name || "—"}</div>
        <div className="text-[10px] text-muted-foreground">
          {isNested ? <Badge variant="secondary" className="text-[9px]">prep</Badge> : ing?.allergens?.length ? ing.allergens.join(", ") : ""}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Input
            type="number" step="0.01" value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="h-8 w-20 text-right tabular-nums"
          />
          <span className="text-xs text-muted-foreground">{lineUnit}</span>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <Input
          type="number" step="1" placeholder={isNested ? "—" : String(ing?.yield_percent_default ?? 100)}
          value={yieldPct} onChange={(e) => setYieldPct(e.target.value)}
          disabled={isNested}
          className="h-8 w-16 text-right tabular-nums"
        />
      </TableCell>
      <TableCell className="text-right tabular-nums">£{cost.toFixed(3)}</TableCell>
      <TableCell>
        <div className="flex gap-1 justify-end">
          {dirty && <Button size="sm" variant="outline" className="h-7 px-2" onClick={save}>Save</Button>}
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function AddLineDialog({
  ingredients, recipes, onCancel, onAdd,
}: {
  ingredients: TMEIngredient[];
  recipes: TMERecipe[];
  onCancel: () => void;
  onAdd: (type: "ingredient" | "nested_recipe", id: string, qty: number, unit: string) => void;
}) {
  const [tab, setTab] = useState<"ingredient" | "nested_recipe">("ingredient");
  const [id, setId] = useState<string>("");
  const [qty, setQty] = useState<string>("0");
  const [unit, setUnit] = useState<string>("g");

  useEffect(() => {
    if (tab === "ingredient") {
      const ing = ingredients.find((i) => i.id === id);
      if (ing) setUnit(ing.default_recipe_unit || "g");
    } else {
      setUnit("portion");
    }
  }, [id, tab, ingredients]);

  return (
    <Sheet open onOpenChange={(o) => !o && onCancel()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader><SheetTitle>Add line</SheetTitle></SheetHeader>
        <Tabs value={tab} onValueChange={(v) => { setTab(v as any); setId(""); }} className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="ingredient" className="flex-1">Ingredient</TabsTrigger>
            <TabsTrigger value="nested_recipe" className="flex-1">Prep batch</TabsTrigger>
          </TabsList>
          <TabsContent value="ingredient" className="space-y-3 mt-3">
            <Select value={id} onValueChange={setId}>
              <SelectTrigger><SelectValue placeholder="Pick an ingredient" /></SelectTrigger>
              <SelectContent>
                {ingredients.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </TabsContent>
          <TabsContent value="nested_recipe" className="space-y-3 mt-3">
            <Select value={id} onValueChange={setId}>
              <SelectTrigger><SelectValue placeholder="Pick a prep batch" /></SelectTrigger>
              <SelectContent>
                {recipes.filter((r) => r.recipe_type === "prep_batch").map((r) =>
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </TabsContent>
        </Tabs>

        <div className="grid grid-cols-2 gap-2 mt-3">
          <div>
            <Label className="text-xs">Quantity</Label>
            <Input type="number" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Unit</Label>
            {tab === "ingredient" ? (
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RECIPE_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  {PACK_UNITS.filter((u) => !RECIPE_UNITS.includes(u as any)).map((u) =>
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            ) : (
              <Input value="portion" readOnly />
            )}
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button disabled={!id || !Number(qty)} onClick={() => onAdd(tab, id, Number(qty), unit)}>
            Add
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ─────────────── Ingredients tab ─────────────── */

function IngredientsTab({
  ingredients, onChange,
}: {
  ingredients: TMEIngredient[];
  onChange: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ingredient library</CardTitle>
        <CardDescription>
          Set pack size, pack price (inc or ex VAT), default recipe unit, density and yield.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {ingredients.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No ingredients. Add some in Allergens &amp; Recipes first.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-24">Pack qty</TableHead>
                <TableHead className="w-20">Unit</TableHead>
                <TableHead className="w-24">Pack £</TableHead>
                <TableHead className="w-20">VAT %</TableHead>
                <TableHead className="w-20">Mode</TableHead>
                <TableHead className="w-20">Recipe unit</TableHead>
                <TableHead className="w-24">Density g/ml</TableHead>
                <TableHead className="w-20">Yield %</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {ingredients.map((ing) => <IngredientRow key={ing.id} ing={ing} onSaved={onChange} />)}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function IngredientRow({ ing, onSaved }: { ing: TMEIngredient; onSaved: () => void }) {
  const [packQty, setPackQty] = useState(ing.pack_quantity != null ? String(ing.pack_quantity) : "");
  const [packUnit, setPackUnit] = useState(ing.pack_unit || ing.unit || "kg");
  const [packPrice, setPackPrice] = useState(ing.pack_price != null ? String(ing.pack_price) : (ing.cost_per_unit != null ? String(ing.cost_per_unit) : ""));
  const [vat, setVat] = useState(String(ing.vat_rate_percent ?? 20));
  const [mode, setMode] = useState(ing.supplier_price_input_mode || "INC_VAT");
  const [recipeUnit, setRecipeUnit] = useState(ing.default_recipe_unit || "g");
  const [density, setDensity] = useState(ing.density_g_per_ml != null ? String(ing.density_g_per_ml) : "");
  const [yieldPct, setYieldPct] = useState(String(ing.yield_percent_default ?? 100));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("ingredients")
        .update({
          pack_quantity: packQty === "" ? null : Number(packQty),
          pack_unit: packUnit,
          pack_price: packPrice === "" ? null : Number(packPrice),
          vat_rate_percent: Number(vat) || 0,
          supplier_price_input_mode: mode,
          default_recipe_unit: recipeUnit,
          density_g_per_ml: density === "" ? null : Number(density),
          yield_percent_default: Number(yieldPct) || 100,
        })
        .eq("id", ing.id);
      if (error) throw error;
      toast.success("Saved");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{ing.name}</TableCell>
      <TableCell><Input className="h-8" type="number" step="0.01" value={packQty} onChange={(e) => setPackQty(e.target.value)} /></TableCell>
      <TableCell>
        <Select value={packUnit} onValueChange={setPackUnit}>
          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
          <SelectContent>{PACK_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
        </Select>
      </TableCell>
      <TableCell><Input className="h-8" type="number" step="0.01" value={packPrice} onChange={(e) => setPackPrice(e.target.value)} /></TableCell>
      <TableCell><Input className="h-8" type="number" step="0.5" value={vat} onChange={(e) => setVat(e.target.value)} /></TableCell>
      <TableCell>
        <Select value={mode} onValueChange={setMode}>
          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="INC_VAT">Inc</SelectItem>
            <SelectItem value="EX_VAT">Ex</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select value={recipeUnit} onValueChange={setRecipeUnit}>
          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
          <SelectContent>{RECIPE_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
        </Select>
      </TableCell>
      <TableCell><Input className="h-8" type="number" step="0.01" value={density} onChange={(e) => setDensity(e.target.value)} placeholder="—" /></TableCell>
      <TableCell><Input className="h-8" type="number" step="1" value={yieldPct} onChange={(e) => setYieldPct(e.target.value)} /></TableCell>
      <TableCell>
        <Button size="sm" className="h-8" onClick={save} disabled={saving}>
          {saving ? "…" : "Save"}
        </Button>
      </TableCell>
    </TableRow>
  );
}

/* ─────────────── Settings tab ─────────────── */

function SettingsTab({
  ctx, orgId, onSaved,
}: {
  ctx: TMEContext | undefined;
  orgId: string | null;
  onSaved: () => void;
}) {
  const [vatReg, setVatReg] = useState(ctx?.settings.business_vat_registered ?? true);
  const [viewMode, setViewMode] = useState<"INC_VAT" | "EX_VAT">(ctx?.settings.costing_view_mode ?? "EX_VAT");
  const [targetGp, setTargetGp] = useState(String(ctx?.settings.target_margin_pct ?? 60));
  const [overhead, setOverhead] = useState(String(ctx?.settings.monthly_overhead ?? 0));
  const [lookback, setLookback] = useState(String(ctx?.settings.labor_rate_lookback_days ?? 30));
  const [overrideOn, setOverrideOn] = useState(ctx?.settings.labor_rate_manual_override_enabled ?? false);
  const [overrideVal, setOverrideVal] = useState(String(ctx?.settings.labor_rate_manual_override_value ?? ""));
  const [fallback, setFallback] = useState(String(ctx?.settings.labour_hourly_rate ?? 12));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!ctx) return;
    setVatReg(ctx.settings.business_vat_registered);
    setViewMode(ctx.settings.costing_view_mode);
    setTargetGp(String(ctx.settings.target_margin_pct));
    setOverhead(String(ctx.settings.monthly_overhead));
    setLookback(String(ctx.settings.labor_rate_lookback_days));
    setOverrideOn(ctx.settings.labor_rate_manual_override_enabled);
    setOverrideVal(String(ctx.settings.labor_rate_manual_override_value ?? ""));
    setFallback(String(ctx.settings.labour_hourly_rate));
  }, [ctx]);

  if (!ctx || !orgId) {
    return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Loading…</CardContent></Card>;
  }

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("org_cost_settings")
        .upsert({
          organisation_id: orgId,
          business_vat_registered: vatReg,
          costing_view_mode: viewMode,
          target_margin_pct: Number(targetGp) || 0,
          monthly_overhead: Number(overhead) || 0,
          labor_rate_lookback_days: Number(lookback) || 30,
          labor_rate_manual_override_enabled: overrideOn,
          labor_rate_manual_override_value: overrideVal === "" ? null : Number(overrideVal),
          labour_hourly_rate: Number(fallback) || 0,
        }, { onConflict: "organisation_id" });
      if (error) throw error;
      toast.success("Saved");
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">VAT & defaults</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Business is VAT registered</Label>
              <p className="text-xs text-muted-foreground">Affects how sale prices are interpreted.</p>
            </div>
            <Switch checked={vatReg} onCheckedChange={setVatReg} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Costing view mode</Label>
              <Select value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EX_VAT">Ex-VAT (net)</SelectItem>
                  <SelectItem value="INC_VAT">Inc-VAT (gross)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Default target GP %</Label>
              <Input type="number" step="0.1" value={targetGp} onChange={(e) => setTargetGp(e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Monthly overhead (£)</Label>
              <Input type="number" step="0.01" value={overhead} onChange={(e) => setOverhead(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">
                Spread across total monthly volume of menu items.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Labour rate (derived from timesheets)</CardTitle>
          <CardDescription>
            Blended rate over the lookback period. Falls back to a manual figure if no data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-muted/30 border p-3 text-sm grid grid-cols-2 gap-2">
            <div>Blended rate (last {lookback} days)</div>
            <div className="text-right tabular-nums font-semibold">£{ctx.blendedHourlyRate.toFixed(2)}/hr</div>
            <div>Effective rate in use</div>
            <div className="text-right tabular-nums font-semibold text-primary">£{ctx.effectiveHourlyRate.toFixed(2)}/hr</div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Lookback (days)</Label>
              <Input type="number" step="1" value={lookback} onChange={(e) => setLookback(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Fallback rate (£/hr) when no timesheet data</Label>
              <Input type="number" step="0.01" value={fallback} onChange={(e) => setFallback(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between border-t pt-3">
            <div>
              <Label>Manual override</Label>
              <p className="text-xs text-muted-foreground">Use a fixed rate instead of the derived one.</p>
            </div>
            <Switch checked={overrideOn} onCheckedChange={setOverrideOn} />
          </div>
          {overrideOn && (
            <div className="space-y-1">
              <Label>Override rate (£/hr)</Label>
              <Input type="number" step="0.01" value={overrideVal} onChange={(e) => setOverrideVal(e.target.value)} />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>
      </div>
    </div>
  );
}

/* ─────────────── Sales stub ─────────────── */

function SalesStub() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sales-driven menu engineering</CardTitle>
        <CardDescription>
          Coming soon — when sales data flows in, this will show stars/dogs and AvT variance.
        </CardDescription>
      </CardHeader>
      <CardContent className="py-12 text-center text-sm text-muted-foreground">
        No sales source connected yet.
      </CardContent>
    </Card>
  );
}
