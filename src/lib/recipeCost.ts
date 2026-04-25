// Shared recipe-cost calculator used by Cost & Margin, Batches, and Reports.
// Single source of truth — recipes never get costed in two different ways.

import { supabase } from "@/integrations/supabase/client";

export interface RecipeIngredientCostInput {
  weight: number | null;
  unit: string | null;
  cost_per_unit_override: number | null;
  ingredients?: {
    unit: string | null;
    cost_per_unit: number | null;
  } | null;
}

export interface RecipeCostInput {
  packaging_cost?: number | null;
  labour_minutes?: number | null;
  sell_price_ex_vat?: number | null;
  vat_rate?: string | null;
  target_margin_override?: number | null;
  recipe_ingredients?: RecipeIngredientCostInput[];
}

export interface RecipeCostBreakdown {
  ingredientCost: number;
  packagingCost: number;
  labourCost: number;
  overheadPerUnit: number;
  totalCostPerUnit: number;
  sellPrice: number | null;
  marginValue: number | null;
  marginPct: number | null;
  recommendedSellExVat: number;
  targetMarginPct: number;
}

const VAT_RATES: Record<string, number> = { zero: 0, standard: 0.2, exempt: 0 };

export function vatMultiplier(rate: string | null | undefined): number {
  return 1 + (VAT_RATES[rate || "zero"] ?? 0);
}

// Convert a quantity from one unit to a base unit (kg, l, each).
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

export function ingredientLineCost(line: RecipeIngredientCostInput): number {
  const ing = line.ingredients;
  if (!ing) return 0;
  const cpu = line.cost_per_unit_override ?? ing.cost_per_unit;
  if (cpu == null) return 0;
  const lineUnit = line.unit || ing.unit || "";
  const ingUnit = ing.unit || "";
  const lineBase = toBase(Number(line.weight) || 0, lineUnit);
  const costBase = toBase(1, ingUnit);
  if (!lineBase || !costBase || lineBase.baseUnit !== costBase.baseUnit) return 0;
  const costPerBase = cpu / costBase.base;
  return lineBase.base * costPerBase;
}

export interface CostContext {
  labourHourlyRate: number;
  overheadPerUnit: number;
  defaultTargetMarginPct: number;
}

export function calcRecipeCost(recipe: RecipeCostInput, ctx: CostContext): RecipeCostBreakdown {
  const ingredientCost = (recipe.recipe_ingredients || []).reduce(
    (s, l) => s + ingredientLineCost(l),
    0
  );
  const packagingCost = Number(recipe.packaging_cost) || 0;
  const labourCost = ((Number(recipe.labour_minutes) || 0) / 60) * ctx.labourHourlyRate;
  const overheadPerUnit = ctx.overheadPerUnit || 0;
  const totalCostPerUnit = ingredientCost + packagingCost + labourCost + overheadPerUnit;

  const targetMarginPct =
    recipe.target_margin_override != null
      ? Number(recipe.target_margin_override)
      : ctx.defaultTargetMarginPct;

  const recommendedSellExVat =
    targetMarginPct < 100 && targetMarginPct >= 0
      ? totalCostPerUnit / (1 - targetMarginPct / 100)
      : 0;

  const sellPrice = recipe.sell_price_ex_vat != null ? Number(recipe.sell_price_ex_vat) : null;
  const marginValue = sellPrice != null ? sellPrice - totalCostPerUnit : null;
  const marginPct =
    sellPrice != null && sellPrice > 0 ? ((sellPrice - totalCostPerUnit) / sellPrice) * 100 : null;

  return {
    ingredientCost,
    packagingCost,
    labourCost,
    overheadPerUnit,
    totalCostPerUnit,
    sellPrice,
    marginValue,
    marginPct,
    recommendedSellExVat,
    targetMarginPct,
  };
}

// ----- Loaders ----------------------------------------------------------

export async function loadCostContextForOrg(
  siteId: string,
  orgId: string
): Promise<{ ctx: CostContext; recipes: RecipeWithCost[] }> {
  const [settingsRes, recipesRes] = await Promise.all([
    supabase
      .from("org_cost_settings")
      .select("target_margin_pct, labour_hourly_rate, monthly_overhead")
      .eq("organisation_id", orgId)
      .maybeSingle(),
    supabase
      .from("recipes")
      .select(`
        id, name, category, packaging_cost, labour_minutes,
        sell_price_ex_vat, vat_rate, monthly_volume, target_margin_override,
        recipe_ingredients(
          id, ingredient_id, weight, unit, cost_per_unit_override,
          ingredients(id, name, unit, cost_per_unit)
        )
      `)
      .eq("site_id", siteId)
      .eq("active", true)
      .order("name"),
  ]);

  const settings = settingsRes.data;
  const recipes = (recipesRes.data || []) as unknown as RawRecipe[];

  const totalMonthlyUnits = recipes.reduce((s, r) => s + (Number(r.monthly_volume) || 0), 0);
  const monthlyOverhead = Number(settings?.monthly_overhead) || 0;
  const overheadPerUnit = monthlyOverhead && totalMonthlyUnits ? monthlyOverhead / totalMonthlyUnits : 0;

  const ctx: CostContext = {
    labourHourlyRate: Number(settings?.labour_hourly_rate) || 0,
    overheadPerUnit,
    defaultTargetMarginPct: Number(settings?.target_margin_pct) || 0,
  };

  const withCost: RecipeWithCost[] = recipes.map((r) => ({
    ...r,
    breakdown: calcRecipeCost(r, ctx),
  }));

  return { ctx, recipes: withCost };
}

interface RawRecipe extends RecipeCostInput {
  id: string;
  name: string;
  category: string;
  monthly_volume: number;
}

export interface RecipeWithCost extends RawRecipe {
  breakdown: RecipeCostBreakdown;
}

// Compute total production cost for a batch of N units of a given recipe.
export async function calcBatchProductionCost(
  recipeId: string,
  quantity: number,
  orgId: string,
  siteId: string
): Promise<{ unitCost: number; totalCost: number } | null> {
  if (!recipeId || !quantity || quantity <= 0) return null;
  const { ctx, recipes } = await loadCostContextForOrg(siteId, orgId);
  const recipe = recipes.find((r) => r.id === recipeId);
  if (!recipe) return null;
  const unitCost = recipe.breakdown.totalCostPerUnit;
  return { unitCost, totalCost: unitCost * quantity };
}
