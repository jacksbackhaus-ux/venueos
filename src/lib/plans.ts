// MiseOS pricing — 2026 SME model.
// Four cumulative tiers: Essentials → Compliance → Profit → Intelligence.
// One Stripe product per tier, monthly & annual. All prices GBP per site.

export type BillingCycle = "month" | "year";
export type ModuleName =
  | "temperatures" | "day_sheet" | "cleaning" | "shifts" | "timesheets" | "messenger"
  | "waste_log" | "customer_feedback" | "batch_tracking"
  | "allergens" | "suppliers" | "pest_maintenance" | "incidents" | "staff_training" | "haccp" | "ppm_schedule" | "reports"
  | "cost_margin" | "tip_tracker"
  | "ai_insights";

/** Legacy plan id type — kept only because a few imports still reference it
 *  (e.g. the `primary` field on PlanState). New code should use TierId. */
export type PlanId = "base" | "compliance" | "business" | "bundle" | "ai";

export const MODULE_LABELS: Record<ModuleName, string> = {
  temperatures: "Temperatures",
  day_sheet: "Day Sheet",
  cleaning: "Cleaning",
  shifts: "Shifts",
  timesheets: "Timesheets",
  messenger: "Messenger",
  waste_log: "Waste Tracking",
  customer_feedback: "Customer Feedback",
  batch_tracking: "Batch Tracking",
  allergens: "Allergens & Labels",
  suppliers: "Suppliers & Deliveries",
  pest_maintenance: "Pest & Maintenance",
  incidents: "Incidents",
  staff_training: "Staff Training",
  haccp: "HACCP Plan",
  ppm_schedule: "PPM Schedule",
  reports: "Inspection Pack",
  cost_margin: "Profit & Pricing",
  tip_tracker: "Tip Tracker",
  ai_insights: "AI Insights",
};

export const MODULE_ROUTES: Record<ModuleName, string> = {
  temperatures: "/temperatures",
  day_sheet: "/day-sheet",
  cleaning: "/cleaning",
  shifts: "/shifts",
  timesheets: "/timesheets",
  messenger: "/messenger",
  waste_log: "/waste-log",
  customer_feedback: "/customer-feedback",
  batch_tracking: "/batches",
  allergens: "/allergens",
  suppliers: "/suppliers",
  pest_maintenance: "/pest-maintenance",
  incidents: "/incidents",
  staff_training: "/staff-training",
  haccp: "/haccp",
  ppm_schedule: "/ppm-schedule",
  reports: "/reports",
  cost_margin: "/cost-margin",
  tip_tracker: "/tip-tracker",
  ai_insights: "/dashboard",
};

// ── Module groupings — single source of truth (mirrored by sync_org_modules in DB) ──
export const BASE_MODULES: ModuleName[] = [
  "temperatures", "day_sheet", "cleaning", "shifts", "timesheets", "messenger",
  "waste_log", "customer_feedback", "batch_tracking",
];
export const COMPLIANCE_MODULES: ModuleName[] = [
  "allergens", "suppliers", "pest_maintenance", "incidents",
  "staff_training", "haccp", "ppm_schedule", "reports",
];
export const BUSINESS_MODULES: ModuleName[] = ["cost_margin", "tip_tracker"];
export const AI_MODULES: ModuleName[] = ["ai_insights"];
export const ALL_MODULES: ModuleName[] = [...BASE_MODULES, ...COMPLIANCE_MODULES, ...BUSINESS_MODULES, ...AI_MODULES];

// ── Tier definitions ──────────────────────────────────────────────────────────

export type TierId = "essentials" | "compliance" | "profit" | "intelligence";

export interface TierFlagSet {
  base: boolean;
  compliance: boolean;
  business: boolean;
  bundle: boolean;
  ai: boolean;
}

export interface TierDef {
  id: TierId;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  monthlyPriceId: string;
  yearlyPriceId: string;
  modules: ModuleName[];
  /** Flag combination written to the `subscriptions` table for this tier. */
  flagSet: TierFlagSet;
  tagline: string;
  /** Headline bullets for marketing cards. */
  highlights: string[];
  highlight?: boolean;
  ai?: boolean;
}

const COMPLIANCE_TIER_MODULES: ModuleName[] = [...BASE_MODULES, ...COMPLIANCE_MODULES];
const PROFIT_TIER_MODULES: ModuleName[] = [...COMPLIANCE_TIER_MODULES, ...BUSINESS_MODULES];

// 2026 SME pricing — per site, unlimited users. Annual ≈ 15% off.
export const TIERS: Record<TierId, TierDef> = {
  essentials: {
    id: "essentials",
    name: "Essentials",
    monthlyPrice: 6.99,
    yearlyPrice: 71,
    monthlyPriceId: "miseos_essentials_monthly",
    yearlyPriceId: "miseos_essentials_annual",
    modules: BASE_MODULES,
    flagSet: { base: true, compliance: false, business: false, bundle: false, ai: false },
    tagline: "Run the day without paper or spreadsheets.",
    highlights: [
      "Dashboard, Day Sheet, Shifts & Timesheets",
      "Temperatures, Cleaning, Waste & Batch Tracking",
      "Team Messenger",
    ],
  },
  compliance: {
    id: "compliance",
    name: "Compliance",
    monthlyPrice: 12.99,
    yearlyPrice: 132,
    monthlyPriceId: "miseos_compliance_monthly",
    yearlyPriceId: "miseos_compliance_annual",
    modules: COMPLIANCE_TIER_MODULES,
    flagSet: { base: true, compliance: true, business: false, bundle: false, ai: false },
    tagline: "Stay inspection-ready with digital food safety records.",
    highlights: [
      "Everything in Essentials",
      "HACCP, Allergens & PPDS labels",
      "Incidents, Suppliers, Pest, PPM, Staff Training & Inspection Pack",
    ],
    highlight: true,
  },
  profit: {
    id: "profit",
    name: "Profit",
    monthlyPrice: 19.99,
    yearlyPrice: 204,
    monthlyPriceId: "miseos_profit_monthly",
    yearlyPriceId: "miseos_profit_annual",
    modules: PROFIT_TIER_MODULES,
    flagSet: { base: true, compliance: true, business: true, bundle: true, ai: false },
    tagline: "Understand what your products really cost and what you should charge.",
    highlights: [
      "Everything in Compliance",
      "Profit & Pricing, Overheads, VAT",
      "DTC / Wholesale pricing & margin overview",
    ],
  },
  intelligence: {
    id: "intelligence",
    name: "Intelligence",
    monthlyPrice: 24.99,
    yearlyPrice: 255,
    monthlyPriceId: "miseos_intelligence_monthly",
    yearlyPriceId: "miseos_intelligence_annual",
    modules: ALL_MODULES,
    flagSet: { base: true, compliance: true, business: true, bundle: true, ai: true },
    tagline: "Get embedded smart assistance across operations, compliance, and margin.",
    highlights: [
      "Everything in Profit",
      "Margin Watchdog & waste insights",
      "Morning briefing, smart rota & compliance summary",
    ],
    ai: true,
  },
};

export const TIER_ORDER: TierId[] = ["essentials", "compliance", "profit", "intelligence"];

export function formatGBP(amount: number): string {
  return `£${amount.toFixed(2)}`;
}

export function tierPrice(tier: TierDef, cycle: BillingCycle): number {
  return cycle === "year" ? tier.yearlyPrice : tier.monthlyPrice;
}
export function tierPriceId(tier: TierDef, cycle: BillingCycle): string {
  return cycle === "year" ? tier.yearlyPriceId : tier.monthlyPriceId;
}

/** Annual savings vs paying monthly for 12 months. */
export function annualSavings(tier: TierDef): number {
  return Math.round((tier.monthlyPrice * 12 - tier.yearlyPrice) * 100) / 100;
}

export const MULTI_SITE_DISCOUNT_PCT = 15;

/**
 * Derive the closest tier for any subscription — works for both new tier-based
 * subs and any legacy flag-based subs (Bundle, Base+Compliance, etc.) by
 * inspecting the flag combination. Always prefers the safer (higher) tier.
 */
export function deriveTierFromFlags(flags: {
  base?: boolean; compliance?: boolean; business?: boolean; bundle?: boolean; ai?: boolean;
}): TierId | null {
  const bundleLike = flags.bundle || (flags.base && flags.compliance && flags.business);
  if (flags.ai) return "intelligence";
  if (bundleLike) return "profit";
  if (flags.base && flags.compliance) return "compliance";
  if (flags.base) return "essentials";
  return null;
}

/** Resolve the set of modules that should be active for a tier. */
export function modulesForTier(tier: TierId | null): Set<ModuleName> {
  const out = new Set<ModuleName>();
  if (!tier) return out;
  TIERS[tier].modules.forEach((m) => out.add(m));
  return out;
}

/** Legacy helper — derive modules from old flag shape. Kept for backwards-compat. */
export function modulesForFlags(flags: {
  base?: boolean; compliance?: boolean; business?: boolean; bundle?: boolean; ai?: boolean;
}): Set<ModuleName> {
  const tier = deriveTierFromFlags(flags);
  return modulesForTier(tier);
}

/**
 * Multi-site cost calculator. Per-tier base price with a 15% discount
 * applied per-site from the second site onwards.
 */
export function calcTierTotalCost(opts: {
  tier: TierId;
  cycle: BillingCycle;
  sites: number;
}): { perSite: number; total: number; discountedSiteCost: number; saving: number } {
  const t = TIERS[opts.tier];
  const perSite = tierPrice(t, opts.cycle);
  const discountedSiteCost = perSite * (1 - MULTI_SITE_DISCOUNT_PCT / 100);
  const extraSites = Math.max(0, opts.sites - 1);
  const total = perSite + extraSites * discountedSiteCost;
  const saving = extraSites * (perSite - discountedSiteCost);
  return { perSite, total, discountedSiteCost, saving };
}

/** Back-compat shim for the old flag-based calculator. New code should call calcTierTotalCost. */
export function calcTotalCost(opts: {
  base?: boolean; compliance?: boolean; business?: boolean; bundle?: boolean; ai?: boolean;
  cycle: BillingCycle; sites: number;
}): { perSite: number; total: number; discountedSiteCost: number; saving: number } {
  const tier = deriveTierFromFlags(opts) ?? "essentials";
  return calcTierTotalCost({ tier, cycle: opts.cycle, sites: opts.sites });
}

/**
 * Lightweight legacy PLANS shim. A handful of older surfaces (e.g.
 * the Account page) import `PLANS` and `PlanDef` to print module names for
 * a given plan-group. Kept as a thin facade over TIERS so we don't have to
 * touch every legacy import in this pass.
 */
export interface PlanDef {
  id: PlanId;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  modules: ModuleName[];
  tagline: string;
  highlight?: boolean;
}

export const PLANS: Record<PlanId, PlanDef> = {
  base: {
    id: "base", name: "Essentials",
    monthlyPrice: TIERS.essentials.monthlyPrice, yearlyPrice: TIERS.essentials.yearlyPrice,
    modules: BASE_MODULES, tagline: TIERS.essentials.tagline,
  },
  compliance: {
    id: "compliance", name: "Compliance",
    monthlyPrice: TIERS.compliance.monthlyPrice - TIERS.essentials.monthlyPrice,
    yearlyPrice: TIERS.compliance.yearlyPrice - TIERS.essentials.yearlyPrice,
    modules: COMPLIANCE_MODULES, tagline: TIERS.compliance.tagline,
  },
  business: {
    id: "business", name: "Profit",
    monthlyPrice: TIERS.profit.monthlyPrice - TIERS.compliance.monthlyPrice,
    yearlyPrice: TIERS.profit.yearlyPrice - TIERS.compliance.yearlyPrice,
    modules: BUSINESS_MODULES, tagline: TIERS.profit.tagline,
  },
  bundle: {
    id: "bundle", name: "Profit",
    monthlyPrice: TIERS.profit.monthlyPrice, yearlyPrice: TIERS.profit.yearlyPrice,
    modules: PROFIT_TIER_MODULES, tagline: TIERS.profit.tagline, highlight: true,
  },
  ai: {
    id: "ai", name: "Intelligence",
    monthlyPrice: TIERS.intelligence.monthlyPrice - TIERS.profit.monthlyPrice,
    yearlyPrice: TIERS.intelligence.yearlyPrice - TIERS.profit.yearlyPrice,
    modules: AI_MODULES, tagline: TIERS.intelligence.tagline,
  },
};

/** Which plan group does a module belong to? */
export function planForModule(mod: ModuleName): PlanId {
  if (BASE_MODULES.includes(mod)) return "base";
  if (COMPLIANCE_MODULES.includes(mod)) return "compliance";
  if (AI_MODULES.includes(mod)) return "ai";
  return "business";
}
