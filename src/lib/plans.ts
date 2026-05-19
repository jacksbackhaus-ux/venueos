// MiseOS pricing — Base / Compliance / Business / Bundle.
// All prices in GBP per site per month. Annual = monthly × 10 (2 months free).

export type PlanId = "base" | "compliance" | "business" | "bundle" | "ai";
export type BillingCycle = "month" | "year";
export type ModuleName =
  | "temperatures" | "day_sheet" | "cleaning" | "shifts" | "timesheets" | "messenger" | "waste_log" | "customer_feedback"
  | "allergens" | "suppliers" | "pest_maintenance" | "incidents" | "batch_tracking" | "staff_training" | "haccp" | "ppm_schedule"
  | "cost_margin" | "tip_tracker" | "reports"
  | "ai_insights";

export interface PlanDef {
  id: PlanId;
  name: string;
  monthlyPrice: number;          // £/site/month
  yearlyPrice: number;           // £/site/year (monthly × 10)
  monthlyPriceId: string;        // Stripe lookup_key
  yearlyPriceId: string;         // Stripe lookup_key
  modules: ModuleName[];         // modules this plan activates
  highlight?: boolean;
  tagline: string;
}

export const MODULE_LABELS: Record<ModuleName, string> = {
  temperatures: "Temperatures",
  day_sheet: "Day Sheet",
  cleaning: "Cleaning",
  shifts: "Shifts",
  timesheets: "Timesheets",
  messenger: "Messenger",
  waste_log: "Waste Log",
  customer_feedback: "Customer Feedback",
  allergens: "Allergens & Labels",
  suppliers: "Suppliers & Deliveries",
  pest_maintenance: "Pest & Maintenance",
  incidents: "Incidents",
  batch_tracking: "Batch Tracking",
  staff_training: "Staff Training",
  haccp: "HACCP Plan",
  ppm_schedule: "PPM Schedule",
  cost_margin: "Cost & Margin",
  tip_tracker: "Tip Tracker",
  reports: "Reports",
  ai_insights: "AI Insights",
};

// Module → URL path for navigation
export const MODULE_ROUTES: Record<ModuleName, string> = {
  temperatures: "/temperatures",
  day_sheet: "/day-sheet",
  cleaning: "/cleaning",
  shifts: "/shifts",
  timesheets: "/timesheets",
  messenger: "/messenger",
  waste_log: "/waste-log",
  customer_feedback: "/customer-feedback",
  allergens: "/allergens",
  suppliers: "/suppliers",
  pest_maintenance: "/pest-maintenance",
  incidents: "/incidents",
  batch_tracking: "/batches",
  staff_training: "/staff-training",
  haccp: "/haccp",
  ppm_schedule: "/ppm-schedule",
  cost_margin: "/cost-margin",
  tip_tracker: "/tip-tracker",
  reports: "/reports",
  ai_insights: "/dashboard",
};

export const BASE_MODULES: ModuleName[] = ["temperatures", "day_sheet", "cleaning", "shifts", "timesheets", "messenger", "waste_log", "customer_feedback"];
export const COMPLIANCE_MODULES: ModuleName[] = ["allergens", "suppliers", "pest_maintenance", "incidents", "batch_tracking", "staff_training", "haccp", "ppm_schedule"];
export const BUSINESS_MODULES: ModuleName[] = ["cost_margin", "tip_tracker", "reports"];
export const AI_MODULES: ModuleName[] = ["ai_insights"];
export const ALL_MODULES: ModuleName[] = [...BASE_MODULES, ...COMPLIANCE_MODULES, ...BUSINESS_MODULES, ...AI_MODULES];

export const PLANS: Record<PlanId, PlanDef> = {
  base: {
    id: "base",
    name: "Base Platform",
    monthlyPrice: 7.99,
    yearlyPrice: 79.90,
    monthlyPriceId: "venueos_base_monthly",
    yearlyPriceId: "venueos_base_yearly",
    modules: BASE_MODULES,
    tagline: "Run your daily operations.",
  },
  compliance: {
    id: "compliance",
    name: "Compliance Add-on",
    monthlyPrice: 3.99,
    yearlyPrice: 39.90,
    monthlyPriceId: "venueos_compliance_monthly",
    yearlyPriceId: "venueos_compliance_yearly",
    modules: COMPLIANCE_MODULES,
    tagline: "Stay inspection-ready.",
  },
  business: {
    id: "business",
    name: "Business Add-on",
    monthlyPrice: 3.99,
    yearlyPrice: 39.90,
    monthlyPriceId: "venueos_business_monthly",
    yearlyPriceId: "venueos_business_yearly",
    modules: BUSINESS_MODULES,
    tagline: "Track costs and profit.",
  },
  bundle: {
    id: "bundle",
    name: "Full Bundle",
    monthlyPrice: 12.99,
    yearlyPrice: 129.90,
    monthlyPriceId: "venueos_bundle_monthly",
    yearlyPriceId: "venueos_bundle_yearly",
    modules: [...BASE_MODULES, ...COMPLIANCE_MODULES, ...BUSINESS_MODULES],
    highlight: true,
    tagline: "Everything you need to run a venue.",
  },
  ai: {
    id: "ai",
    name: "AI Insights",
    monthlyPrice: 4.99,
    yearlyPrice: 49.90,
    monthlyPriceId: "venueos_ai_monthly",
    yearlyPriceId: "venueos_ai_yearly",
    modules: AI_MODULES,
    tagline: "Intelligent operations — briefings, alerts, and recommendations.",
  },
};

export function formatGBP(amount: number): string {
  return `£${amount.toFixed(2)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW 4-TIER MODEL (2026)
// Cumulative tiers: Essentials → Professional → Business → Intelligence.
// Each tier is a single Stripe product. Existing flag columns are reused so
// the rest of the access-control system (module_activation, RLS, useOrgAccess)
// keeps working without changes — see `flagSet` per tier.
// ─────────────────────────────────────────────────────────────────────────────

export type TierId = "essentials" | "professional" | "business_tier" | "intelligence";

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

const PROFESSIONAL_MODULES: ModuleName[] = [...BASE_MODULES, ...COMPLIANCE_MODULES];
const BUSINESS_TIER_MODULES: ModuleName[] = [...PROFESSIONAL_MODULES, ...BUSINESS_MODULES];

// 2026 pricing — per site, unlimited users.
// Annual = monthly × 12 × 0.85 (15% discount), rounded as agreed.
export const TIERS: Record<TierId, TierDef> = {
  essentials: {
    id: "essentials",
    name: "Essentials",
    monthlyPrice: 14.99,
    yearlyPrice: 152.90,
    monthlyPriceId: "miseos_essentials_monthly",
    yearlyPriceId: "miseos_essentials_annual",
    modules: BASE_MODULES,
    flagSet: { base: true, compliance: false, business: false, bundle: false, ai: false },
    tagline: "Run your daily operations.",
    highlights: [
      "Dashboard, Shifts & Timesheets",
      "Day Sheet, Temperatures, Cleaning",
      "Waste Log, Customer Feedback, Messenger",
    ],
  },
  professional: {
    id: "professional",
    name: "Professional",
    monthlyPrice: 25.99,
    yearlyPrice: 265.10,
    monthlyPriceId: "miseos_professional_monthly",
    yearlyPriceId: "miseos_professional_annual",
    modules: PROFESSIONAL_MODULES,
    flagSet: { base: true, compliance: true, business: false, bundle: false, ai: false },
    tagline: "Everything in Essentials + full compliance.",
    highlights: [
      "Allergens & Labels (Natasha's Law)",
      "Suppliers, Pest, PPM, Incidents",
      "Batch Tracking, Staff Training, HACCP",
    ],
    highlight: true,
  },
  business_tier: {
    id: "business_tier",
    name: "Business",
    monthlyPrice: 45.99,
    yearlyPrice: 469.10,
    monthlyPriceId: "miseos_business_tier_monthly",
    yearlyPriceId: "miseos_business_tier_annual",
    modules: BUSINESS_TIER_MODULES,
    flagSet: { base: false, compliance: false, business: false, bundle: true, ai: false },
    tagline: "Everything in Professional + business tools.",
    highlights: [
      "Cost & Margin (True Margin Engine)",
      "Tip Tracker",
      "Reports — EHO Inspection Pack",
    ],
  },
  intelligence: {
    id: "intelligence",
    name: "Intelligence",
    monthlyPrice: 69.99,
    yearlyPrice: 713.90,
    monthlyPriceId: "miseos_intelligence_monthly",
    yearlyPriceId: "miseos_intelligence_annual",
    modules: ALL_MODULES,
    flagSet: { base: false, compliance: false, business: false, bundle: true, ai: true },
    tagline: "Everything in Business + AI superpowers.",
    highlights: [
      "AI Morning Briefing",
      "Smart Rota & Equipment Drift Detection",
      "AI Compliance Narrative",
    ],
    ai: true,
  },
};

/** Annual savings vs paying monthly_term for 12 months. */
export function annualSavings(tier: TierDef): number {
  return Math.round((tier.monthlyPrice * 12 - tier.yearlyPrice) * 100) / 100;
}

export const TIER_ORDER: TierId[] = ["essentials", "professional", "business_tier", "intelligence"];

/**
 * Derive the closest 4-tier name for any subscription — works for both new
 * tier-based subs (where `tier` column is set) and legacy flag-based subs
 * (Bundle, Base+Compliance, etc.) by inspecting the flag combination.
 */
export function deriveTierFromFlags(flags: {
  base?: boolean; compliance?: boolean; business?: boolean; bundle?: boolean; ai?: boolean;
}): TierId | null {
  const bundleLike = flags.bundle || (flags.base && flags.compliance && flags.business);
  if (flags.ai && bundleLike) return "intelligence";
  if (bundleLike) return "business_tier";
  if (flags.base && flags.compliance) return "professional";
  if (flags.base) return "essentials";
  if (flags.ai) return "intelligence"; // AI-only legacy → closest is Intelligence
  return null;
}

export function tierPrice(tier: TierDef, cycle: BillingCycle): number {
  return cycle === "year" ? tier.yearlyPrice : tier.monthlyPrice;
}

export function tierPriceId(tier: TierDef, cycle: BillingCycle): string {
  return cycle === "year" ? tier.yearlyPriceId : tier.monthlyPriceId;
}

export const MULTI_SITE_DISCOUNT_PCT = 15;

/**
 * Total cost for an entire org for the chosen billing cycle.
 * 15% discount applied per-site from the second site onwards.
 */
export function calcTotalCost(opts: {
  base: boolean;
  compliance: boolean;
  business: boolean;
  bundle: boolean;
  ai?: boolean;
  cycle: BillingCycle;
  sites: number;
}): { perSite: number; total: number; discountedSiteCost: number; saving: number } {
  const { base, compliance, business, bundle, ai, cycle, sites } = opts;
  const price = (p: PlanDef) => cycle === "year" ? p.yearlyPrice : p.monthlyPrice;
  let perSite = 0;
  if (bundle) {
    perSite = price(PLANS.bundle);
  } else {
    if (base) perSite += price(PLANS.base);
    if (compliance) perSite += price(PLANS.compliance);
    if (business) perSite += price(PLANS.business);
  }
  if (ai) perSite += price(PLANS.ai);
  const discountedSiteCost = perSite * (1 - MULTI_SITE_DISCOUNT_PCT / 100);
  const extraSites = Math.max(0, sites - 1);
  const total = perSite + extraSites * discountedSiteCost;
  const saving = extraSites * (perSite - discountedSiteCost);
  return { perSite, total, discountedSiteCost, saving };
}

/** Resolve the set of modules that *should* be active for a given subscription. */
export function modulesForFlags(flags: { base: boolean; compliance: boolean; business: boolean; bundle: boolean; ai?: boolean }): Set<ModuleName> {
  const out = new Set<ModuleName>();
  if (flags.bundle) {
    [...BASE_MODULES, ...COMPLIANCE_MODULES, ...BUSINESS_MODULES].forEach(m => out.add(m));
  } else {
    if (flags.base) BASE_MODULES.forEach(m => out.add(m));
    if (flags.compliance) COMPLIANCE_MODULES.forEach(m => out.add(m));
    if (flags.business) BUSINESS_MODULES.forEach(m => out.add(m));
  }
  if (flags.ai) AI_MODULES.forEach(m => out.add(m));
  return out;
}

/** Which plan group does a module belong to? */
export function planForModule(mod: ModuleName): PlanId {
  if (BASE_MODULES.includes(mod)) return "base";
  if (COMPLIANCE_MODULES.includes(mod)) return "compliance";
  if (AI_MODULES.includes(mod)) return "ai";
  return "business";
}
