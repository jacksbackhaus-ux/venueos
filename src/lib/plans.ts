// MiseOS pricing — Base / Compliance / Business / Bundle.
// All prices in GBP per site per month. Annual = monthly × 10 (2 months free).

export type PlanId = "base" | "compliance" | "business" | "bundle";
export type BillingCycle = "month" | "year";
export type ModuleName =
  | "temperatures" | "day_sheet" | "cleaning" | "shifts" | "timesheets" | "messenger" | "waste_log" | "customer_feedback"
  | "allergens" | "suppliers" | "pest_maintenance" | "incidents" | "batch_tracking" | "staff_training" | "haccp"
  | "cost_margin" | "tip_tracker" | "reports";

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
  cost_margin: "Cost & Margin",
  tip_tracker: "Tip Tracker",
  reports: "Reports",
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
  cost_margin: "/cost-margin",
  tip_tracker: "/tip-tracker",
  reports: "/reports",
};

export const BASE_MODULES: ModuleName[] = ["temperatures", "day_sheet", "cleaning", "shifts", "timesheets", "messenger", "waste_log", "customer_feedback"];
export const COMPLIANCE_MODULES: ModuleName[] = ["allergens", "suppliers", "pest_maintenance", "incidents", "batch_tracking", "staff_training", "haccp"];
export const BUSINESS_MODULES: ModuleName[] = ["cost_margin", "tip_tracker", "reports"];
export const ALL_MODULES: ModuleName[] = [...BASE_MODULES, ...COMPLIANCE_MODULES, ...BUSINESS_MODULES];

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
    modules: ALL_MODULES,
    highlight: true,
    tagline: "Everything you need to run a venue.",
  },
};

export function formatGBP(amount: number): string {
  return `£${amount.toFixed(2)}`;
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
  cycle: BillingCycle;
  sites: number;
}): { perSite: number; total: number; discountedSiteCost: number; saving: number } {
  const { base, compliance, business, bundle, cycle, sites } = opts;
  const price = (p: PlanDef) => cycle === "year" ? p.yearlyPrice : p.monthlyPrice;
  let perSite = 0;
  if (bundle) {
    perSite = price(PLANS.bundle);
  } else {
    if (base) perSite += price(PLANS.base);
    if (compliance) perSite += price(PLANS.compliance);
    if (business) perSite += price(PLANS.business);
  }
  const discountedSiteCost = perSite * (1 - MULTI_SITE_DISCOUNT_PCT / 100);
  const extraSites = Math.max(0, sites - 1);
  const total = perSite + extraSites * discountedSiteCost;
  const saving = extraSites * (perSite - discountedSiteCost);
  return { perSite, total, discountedSiteCost, saving };
}

/** Resolve the set of modules that *should* be active for a given subscription. */
export function modulesForFlags(flags: { base: boolean; compliance: boolean; business: boolean; bundle: boolean }): Set<ModuleName> {
  if (flags.bundle) return new Set(ALL_MODULES);
  const out = new Set<ModuleName>();
  if (flags.base) BASE_MODULES.forEach(m => out.add(m));
  if (flags.compliance) COMPLIANCE_MODULES.forEach(m => out.add(m));
  if (flags.business) BUSINESS_MODULES.forEach(m => out.add(m));
  return out;
}

/** Which plan group does a module belong to? */
export function planForModule(mod: ModuleName): PlanId {
  if (BASE_MODULES.includes(mod)) return "base";
  if (COMPLIANCE_MODULES.includes(mod)) return "compliance";
  return "business";
}
