// True Margin Engine — single source of truth for recipe costing.
// Handles: VAT-inclusive/exclusive pack pricing, density-based unit conversion,
// yield %, nested recipes (prep batches inside menu items), and labour cost
// derived from a blended timesheet rate or manual override.

import { supabase } from "@/integrations/supabase/client";

/* ──────────────── Types ──────────────── */

export type RecipeUnit = "g" | "ml" | "each";
export type PackUnit = "g" | "kg" | "ml" | "l" | "each";

export interface TMEIngredient {
  id: string;
  name: string;
  default_recipe_unit: string; // g | ml | each
  density_g_per_ml: number | null;
  vat_rate_percent: number; // pack VAT rate
  supplier_price_input_mode: string; // INC_VAT | EX_VAT
  yield_percent_default: number;
  pack_quantity: number | null;
  pack_unit: string | null;
  pack_price: number | null;
  cost_per_unit: number | null; // legacy fallback
  unit: string | null; // legacy unit (kg/l/each)
  supplier_item_id: string | null;
  allergens: string[];
}

export interface TMERecipeIngredient {
  id: string;
  recipe_id: string;
  line_type: "ingredient" | "nested_recipe";
  ingredient_id: string | null;
  nested_recipe_id: string | null;
  quantity: number | null; // preferred
  weight: number | null;   // legacy
  unit: string | null;
  cost_per_unit_override: number | null;
  yield_percent_override: number | null;
  ingredients?: TMEIngredient | null;
}

export interface TMERecipe {
  id: string;
  name: string;
  category: string;
  recipe_type: "menu_item" | "prep_batch";
  active: boolean;
  portions: number;
  // batch / yield
  // sale
  sale_price: number | null;
  sale_price_vat_rate_percent: number;
  target_gp_percent: number;
  // labour
  labor_estimate_mode: string; // BLENDED | MANUAL
  labour_minutes: number;
  // legacy cols still on table (used as defaults)
  packaging_cost: number;
  vat_rate?: string | null;
  monthly_volume?: number | null;
  recipe_ingredients?: TMERecipeIngredient[];
}

export interface TMECostSettings {
  organisation_id: string;
  business_vat_registered: boolean;
  costing_view_mode: "INC_VAT" | "EX_VAT";
  target_margin_pct: number;
  labour_hourly_rate: number;
  monthly_overhead: number;
  labor_rate_lookback_days: number;
  labor_rate_manual_override_enabled: boolean;
  labor_rate_manual_override_value: number | null;
}

export interface TMEContext {
  settings: TMECostSettings;
  blendedHourlyRate: number;     // derived from timesheets
  effectiveHourlyRate: number;   // override if enabled, else blended, else settings rate
  overheadPerUnit: number;
  recipesById: Map<string, TMERecipe>;
}

export interface TMEBreakdown {
  ingredientCostExVat: number;
  packagingCost: number;
  labourCost: number;
  overheadPerUnit: number;
  totalCostExVat: number;
  costPerPortionExVat: number;
  salePriceExVat: number | null;
  salePriceIncVat: number | null;
  grossProfitPerPortion: number | null;
  gpPercent: number | null;
  recommendedSellExVat: number;
  recommendedSellIncVat: number;
}

/* ──────────────── Unit conversion ──────────────── */

// Convert a quantity in a recipe-line unit into grams (mass) or ml (volume) or each.
// Uses density when crossing mass↔volume.
function toCanonical(
  qty: number,
  unit: string | null,
  density: number | null
): { value: number; kind: "mass_g" | "vol_ml" | "each" } | null {
  const u = (unit || "").toLowerCase();
  switch (u) {
    case "g":  return { value: qty, kind: "mass_g" };
    case "kg": return { value: qty * 1000, kind: "mass_g" };
    case "ml": return { value: qty, kind: "vol_ml" };
    case "l":  return { value: qty * 1000, kind: "vol_ml" };
    case "each": return { value: qty, kind: "each" };
    default: return null;
  }
}

function convert(qty: number, fromUnit: string, toUnit: string, density: number | null): number | null {
  const from = toCanonical(qty, fromUnit, density);
  const to = toCanonical(1, toUnit, density);
  if (!from || !to) return null;
  if (from.kind === to.kind) return from.value / to.value;
  // Cross mass<->volume requires density g/ml
  if (!density || density <= 0) return null;
  if (from.kind === "mass_g" && to.kind === "vol_ml") {
    const ml = from.value / density;
    return ml / to.value;
  }
  if (from.kind === "vol_ml" && to.kind === "mass_g") {
    const g = from.value * density;
    return g / to.value;
  }
  return null;
}

/* ──────────────── Pack price → cost per gram/ml/each (ex-VAT) ──────────────── */

export function packCostPerCanonicalUnit(
  ing: TMEIngredient
): { costPerCanonical: number; canonical: "mass_g" | "vol_ml" | "each" } | null {
  // Prefer pack_quantity/unit/price; fall back to legacy cost_per_unit + unit.
  let qty = ing.pack_quantity;
  let unit = ing.pack_unit;
  let price = ing.pack_price;

  if (qty == null || !unit || price == null) {
    if (ing.cost_per_unit == null || !ing.unit) return null;
    qty = 1;
    unit = ing.unit;
    price = ing.cost_per_unit;
  }

  const can = toCanonical(Number(qty) || 0, unit, ing.density_g_per_ml);
  if (!can || can.value <= 0) return null;

  // Strip VAT if pack price was entered inc-VAT
  const vatRate = (Number(ing.vat_rate_percent) || 0) / 100;
  const exVatPrice =
    ing.supplier_price_input_mode === "INC_VAT" && vatRate > 0
      ? Number(price) / (1 + vatRate)
      : Number(price);

  return { costPerCanonical: exVatPrice / can.value, canonical: can.kind };
}

/* ──────────────── Line cost (ex-VAT, after yield) ──────────────── */

export function tmeLineCost(line: TMERecipeIngredient, ctx: TMEContext): number {
  if (line.line_type === "nested_recipe") {
    if (!line.nested_recipe_id) return 0;
    const nested = ctx.recipesById.get(line.nested_recipe_id);
    if (!nested) return 0;
    const nestedBd = calcRecipeBreakdown(nested, ctx);
    const portions = Math.max(1, Number(nested.portions) || 1);
    const perPortion = nestedBd.totalCostExVat / portions;
    const qty = Number(line.quantity ?? line.weight ?? 0) || 0;
    return perPortion * qty;
  }

  const ing = line.ingredients;
  if (!ing) return 0;
  const qty = Number(line.quantity ?? line.weight ?? 0) || 0;
  if (qty <= 0) return 0;

  // Override: cost per recipe-unit (ex-VAT)
  if (line.cost_per_unit_override != null) {
    return Number(line.cost_per_unit_override) * qty;
  }

  const lineUnit = line.unit || ing.default_recipe_unit || "g";
  const pack = packCostPerCanonicalUnit(ing);
  if (!pack) return 0;

  // Convert qty in lineUnit → canonical units of pack
  const canonicalQty = convertToCanonical(qty, lineUnit, pack.canonical, ing.density_g_per_ml);
  if (canonicalQty == null) return 0;

  const yieldPct =
    line.yield_percent_override ?? ing.yield_percent_default ?? 100;
  const yieldFactor = yieldPct > 0 ? yieldPct / 100 : 1;

  // We need MORE raw to produce the recipe qty: divide by yield
  const rawCanonical = canonicalQty / yieldFactor;
  return rawCanonical * pack.costPerCanonical;
}

function convertToCanonical(
  qty: number,
  fromUnit: string,
  targetCanonical: "mass_g" | "vol_ml" | "each",
  density: number | null
): number | null {
  const targetUnit = targetCanonical === "mass_g" ? "g" : targetCanonical === "vol_ml" ? "ml" : "each";
  return convert(qty, fromUnit, targetUnit, density);
}

/* ──────────────── Recipe breakdown ──────────────── */

export function calcRecipeBreakdown(recipe: TMERecipe, ctx: TMEContext): TMEBreakdown {
  const lines = recipe.recipe_ingredients || [];
  const ingredientCostExVat = lines.reduce((s, l) => s + tmeLineCost(l, ctx), 0);
  const packagingCost = Number(recipe.packaging_cost) || 0;
  const labourCost = ((Number(recipe.labour_minutes) || 0) / 60) * ctx.effectiveHourlyRate;
  const overheadPerUnit = ctx.overheadPerUnit || 0;
  const totalCostExVat = ingredientCostExVat + packagingCost + labourCost + overheadPerUnit;

  const portions = Math.max(1, Number(recipe.portions) || 1);
  const costPerPortionExVat = totalCostExVat / portions;

  const salePriceIncVat = recipe.sale_price != null ? Number(recipe.sale_price) : null;
  const saleVat = (Number(recipe.sale_price_vat_rate_percent) || 0) / 100;
  const showInc = ctx.settings.costing_view_mode === "INC_VAT" && ctx.settings.business_vat_registered;
  // Sale price is stored in the customer-visible mode. If business is VAT-registered and
  // costing view is INC_VAT, treat sale_price as inc-VAT; otherwise as ex-VAT.
  const salePriceExVat =
    salePriceIncVat == null
      ? null
      : showInc && saleVat > 0
        ? salePriceIncVat / (1 + saleVat)
        : salePriceIncVat;

  const grossProfitPerPortion =
    salePriceExVat != null ? salePriceExVat - costPerPortionExVat : null;
  const gpPercent =
    salePriceExVat != null && salePriceExVat > 0
      ? (grossProfitPerPortion! / salePriceExVat) * 100
      : null;

  const targetGp = Number(recipe.target_gp_percent) || ctx.settings.target_margin_pct || 0;
  const recommendedSellExVat =
    targetGp < 100 && targetGp >= 0
      ? costPerPortionExVat / (1 - targetGp / 100)
      : 0;
  const recommendedSellIncVat = recommendedSellExVat * (1 + saleVat);

  return {
    ingredientCostExVat,
    packagingCost,
    labourCost,
    overheadPerUnit,
    totalCostExVat,
    costPerPortionExVat,
    salePriceExVat,
    salePriceIncVat: salePriceIncVat,
    grossProfitPerPortion,
    gpPercent,
    recommendedSellExVat,
    recommendedSellIncVat,
  };
}

/* ──────────────── Loaders ──────────────── */

export async function deriveBlendedHourlyRate(
  organisationId: string,
  lookbackDays: number
): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - lookbackDays);

  const { data: entries } = await supabase
    .from("timesheet_entries")
    .select("user_id, clock_in, clock_out, break_minutes")
    .eq("organisation_id", organisationId)
    .gte("clock_in", since.toISOString())
    .not("clock_out", "is", null);

  if (!entries || entries.length === 0) return 0;

  const userIds = Array.from(new Set(entries.map((e) => e.user_id).filter(Boolean)));
  if (userIds.length === 0) return 0;

  const { data: users } = await supabase
    .rpc("list_org_user_hourly_rates", { _org_id: organisationId });

  const rateById = new Map<string, number>();
  (users || [])
    .filter((u: any) => userIds.includes(u.user_id))
    .forEach((u: any) => rateById.set(u.user_id, Number(u.hourly_rate) || 0));

  let totalHours = 0;
  let totalWages = 0;
  for (const e of entries) {
    const ci = e.clock_in ? new Date(e.clock_in).getTime() : 0;
    const co = e.clock_out ? new Date(e.clock_out).getTime() : 0;
    if (!ci || !co || co <= ci) continue;
    const hrs = Math.max(0, (co - ci) / 3_600_000 - (Number(e.break_minutes) || 0) / 60);
    if (hrs <= 0) continue;
    const rate = rateById.get(e.user_id) || 0;
    totalHours += hrs;
    totalWages += hrs * rate;
  }
  if (totalHours <= 0) return 0;
  return totalWages / totalHours;
}

export async function loadTMEContext(
  siteId: string,
  organisationId: string
): Promise<{ ctx: TMEContext; recipes: TMERecipe[] }> {
  const [settingsRes, recipesRes] = await Promise.all([
    supabase
      .from("org_cost_settings")
      .select("*")
      .eq("organisation_id", organisationId)
      .maybeSingle(),
    supabase
      .from("recipes")
      .select(`
        id, name, category, active, recipe_type, portions,
        sale_price, sale_price_vat_rate_percent, target_gp_percent,
        labor_estimate_mode, labour_minutes, packaging_cost,
        vat_rate, monthly_volume,
        recipe_ingredients!recipe_ingredients_recipe_id_fkey(
          id, recipe_id, line_type, ingredient_id, nested_recipe_id,
          quantity, weight, unit, cost_per_unit_override, yield_percent_override,
          ingredients(
            id, name, default_recipe_unit, density_g_per_ml,
            vat_rate_percent, supplier_price_input_mode, yield_percent_default,
            pack_quantity, pack_unit, pack_price,
            cost_per_unit, unit, supplier_item_id, allergens
          )
        )
      `)
      .eq("site_id", siteId)
      .eq("active", true)
      .order("name"),
  ]);

  const s = settingsRes.data || {};
  const settings: TMECostSettings = {
    organisation_id: organisationId,
    business_vat_registered: (s as any).business_vat_registered ?? true,
    costing_view_mode: ((s as any).costing_view_mode ?? "EX_VAT") as "INC_VAT" | "EX_VAT",
    target_margin_pct: Number((s as any).target_margin_pct) || 60,
    labour_hourly_rate: Number((s as any).labour_hourly_rate) || 12,
    monthly_overhead: Number((s as any).monthly_overhead) || 0,
    labor_rate_lookback_days: Number((s as any).labor_rate_lookback_days) || 30,
    labor_rate_manual_override_enabled: (s as any).labor_rate_manual_override_enabled ?? false,
    labor_rate_manual_override_value: (s as any).labor_rate_manual_override_value ?? null,
  };

  const recipes = (recipesRes.data || []) as unknown as TMERecipe[];

  const blendedHourlyRate = await deriveBlendedHourlyRate(
    organisationId,
    settings.labor_rate_lookback_days
  );

  const effectiveHourlyRate = settings.labor_rate_manual_override_enabled
    ? Number(settings.labor_rate_manual_override_value) || 0
    : blendedHourlyRate || settings.labour_hourly_rate;

  // Overhead spread across total monthly volume of menu_items
  const totalMonthlyUnits = recipes
    .filter((r) => r.recipe_type !== "prep_batch")
    .reduce((sum, r) => sum + (Number(r.monthly_volume) || 0), 0);
  const overheadPerUnit =
    settings.monthly_overhead > 0 && totalMonthlyUnits > 0
      ? settings.monthly_overhead / totalMonthlyUnits
      : 0;

  const recipesById = new Map<string, TMERecipe>();
  recipes.forEach((r) => recipesById.set(r.id, r));

  const ctx: TMEContext = {
    settings,
    blendedHourlyRate,
    effectiveHourlyRate,
    overheadPerUnit,
    recipesById,
  };
  return { ctx, recipes };
}

/* ──────────────── Sales placeholder ──────────────── */

// Stub for future POS / manual sales-data integration. Returns empty array today.
export async function loadSalesUnits(_siteId: string, _from: Date, _to: Date) {
  return [] as { recipe_id: string; units_sold: number; revenue: number }[];
}
