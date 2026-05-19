// Channel-aware pricing math for DTC vs Wholesale.
// Reuses ingredient_cost_per_unit from the True Margin Engine.

export type Channel = "dtc" | "wholesale";

export interface ChannelProfile {
  channel: Channel;
  payment_fees_percent: number;
  platform_fees_percent: number;
  packaging_cost_per_unit: number;
  shipping_cost_per_unit: number;
  wholesale_discount_percent: number;
  wholesale_commission_percent: number;
  default_target_gp_percent: number;
}

export const DEFAULT_PROFILES: Record<Channel, ChannelProfile> = {
  dtc: {
    channel: "dtc",
    payment_fees_percent: 0,
    platform_fees_percent: 0,
    packaging_cost_per_unit: 0,
    shipping_cost_per_unit: 0,
    wholesale_discount_percent: 0,
    wholesale_commission_percent: 0,
    default_target_gp_percent: 60,
  },
  wholesale: {
    channel: "wholesale",
    payment_fees_percent: 0,
    platform_fees_percent: 0,
    packaging_cost_per_unit: 0,
    shipping_cost_per_unit: 0,
    wholesale_discount_percent: 0,
    wholesale_commission_percent: 0,
    default_target_gp_percent: 50,
  },
};

/** Net revenue per unit for DTC (price after card/platform fees, less packaging & shipping). */
export function dtcNetRevenue(price: number, p: ChannelProfile): number {
  const feePct = (p.payment_fees_percent || 0) + (p.platform_fees_percent || 0);
  const fees = price * (feePct / 100);
  return price - fees - (p.packaging_cost_per_unit || 0) - (p.shipping_cost_per_unit || 0);
}

/** Net revenue per unit for Wholesale.
 *  Wholesale list price = wholesalePrice if provided, else dtcPrice * (1 - discount%).
 */
export function wholesaleNetRevenue(
  wholesalePrice: number | null,
  dtcPrice: number | null,
  p: ChannelProfile
): { listPrice: number; net: number } {
  const list =
    wholesalePrice != null && wholesalePrice > 0
      ? wholesalePrice
      : (dtcPrice || 0) * (1 - (p.wholesale_discount_percent || 0) / 100);
  const commission = list * ((p.wholesale_commission_percent || 0) / 100);
  const net = list - commission - (p.packaging_cost_per_unit || 0);
  return { listPrice: list, net };
}

export interface ChannelBreakdown {
  listPrice: number;
  netRevenue: number;
  ingredientCost: number;
  overheadPerUnit: number;
  contributionBeforeOverhead: number;
  contributionAfterOverhead: number;
  gpPercent: number | null;
}

export function computeChannelBreakdown(args: {
  channel: Channel;
  dtcPrice: number | null;
  wholesalePrice: number | null;
  ingredientCost: number;
  overheadPerUnit: number;
  profile: ChannelProfile;
}): ChannelBreakdown {
  const { channel, dtcPrice, wholesalePrice, ingredientCost, overheadPerUnit, profile } = args;
  let listPrice = 0;
  let netRevenue = 0;
  if (channel === "dtc") {
    listPrice = dtcPrice || 0;
    netRevenue = dtcNetRevenue(listPrice, profile);
  } else {
    const r = wholesaleNetRevenue(wholesalePrice, dtcPrice, profile);
    listPrice = r.listPrice;
    netRevenue = r.net;
  }
  const cb = netRevenue - ingredientCost;
  const ca = cb - overheadPerUnit;
  const gp = netRevenue > 0 ? (ca / netRevenue) * 100 : null;
  return {
    listPrice,
    netRevenue,
    ingredientCost,
    overheadPerUnit,
    contributionBeforeOverhead: cb,
    contributionAfterOverhead: ca,
    gpPercent: gp,
  };
}

/** Numeric solve for DTC price hitting targetGp%, starting from current. */
export function recommendDtcPrice(args: {
  current: number;
  ingredientCost: number;
  overheadPerUnit: number;
  profile: ChannelProfile;
  targetGpPct: number;
  maxMultiplier?: number;
}): number {
  const { ingredientCost, overheadPerUnit, profile, targetGpPct } = args;
  const start = Math.max(args.current || 0.01, 0.01);
  const step = Math.max(start * 0.01, 0.01);
  const maxPrice = start * (args.maxMultiplier ?? 1.5);
  for (let p = start; p <= maxPrice; p += step) {
    const net = dtcNetRevenue(p, profile);
    if (net <= 0) continue;
    const gp = ((net - ingredientCost - overheadPerUnit) / net) * 100;
    if (gp >= targetGpPct) return Math.round(p * 100) / 100;
  }
  return Math.round(maxPrice * 100) / 100;
}

export function recommendWholesalePrice(args: {
  ingredientCost: number;
  overheadPerUnit: number;
  profile: ChannelProfile;
  targetGpPct: number;
}): number {
  const { ingredientCost, overheadPerUnit, profile, targetGpPct } = args;
  // net = list*(1 - commission%) - packaging
  // gp = (net - ingredient - overhead) / net
  // => net*(1-gp) = ingredient + overhead => net = (ingredient+overhead)/(1-gp)
  const gp = Math.min(Math.max(targetGpPct, 0), 99) / 100;
  const denom = 1 - gp;
  if (denom <= 0) return 0;
  const requiredNet = (ingredientCost + overheadPerUnit) / denom;
  const commissionFactor = 1 - (profile.wholesale_commission_percent || 0) / 100;
  if (commissionFactor <= 0) return 0;
  const list = (requiredNet + (profile.packaging_cost_per_unit || 0)) / commissionFactor;
  return Math.round(list * 100) / 100;
}

/** Allocate monthly overhead total to a per-unit number. */
export function overheadPerUnit(
  monthlyOverheadTotal: number,
  totalUnitsForPeriod: number,
  fallbackUnitsPerProduct = 30
): number {
  const units = totalUnitsForPeriod > 0 ? totalUnitsForPeriod : fallbackUnitsPerProduct;
  if (units <= 0) return 0;
  return monthlyOverheadTotal / units;
}

export function sumOverheads(row: Partial<Record<string, number>> | null | undefined): number {
  if (!row) return 0;
  const keys = [
    "rent",
    "utilities",
    "insurance",
    "software_subscriptions",
    "equipment_lease",
    "repairs_maintenance",
    "marketing",
    "other",
  ];
  return keys.reduce((s, k) => s + (Number(row[k]) || 0), 0);
}
