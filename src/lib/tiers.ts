// Tier definitions for VenueOS subscription system. All prices in GBP.

export type Tier = "starter" | "pro" | "multisite";

export interface TierDef {
  id: Tier;
  name: string;
  basePrice: number;          // £/month for the first site
  extraSitePrice: number;     // £/month per additional site (multisite only)
  basePriceId: string;        // Stripe lookup_key for base price
  extraSitePriceId?: string;  // Stripe lookup_key for additional sites
  staffLimit: number | null;  // null = unlimited
  modules: string[];          // human-readable list
  // Module slugs the user is allowed to access on this tier
  allowedModules: Set<string>;
  highlight?: boolean;
}

const STARTER_MODULES = [
  "dashboard", "shifts", "temperatures", "day-sheet", "cleaning",
  "incidents", "allergens",
];
const PRO_MODULES = [
  ...STARTER_MODULES,
  "reports", "batches", "suppliers", "pest-maintenance", "cost-margin",
];
const MULTISITE_MODULES = [...PRO_MODULES, "hq"];

export const TIERS: Record<Tier, TierDef> = {
  starter: {
    id: "starter",
    name: "Starter",
    basePrice: 4.99,
    extraSitePrice: 0,
    basePriceId: "venueos_starter_monthly",
    staffLimit: 5,
    modules: [
      "Dashboard", "Temperatures", "Day Sheet", "Cleaning", "Shifts",
      "Incidents", "Allergens & Labels",
    ],
    allowedModules: new Set(STARTER_MODULES),
  },
  pro: {
    id: "pro",
    name: "Pro",
    basePrice: 8.99,
    extraSitePrice: 0,
    basePriceId: "venueos_pro_monthly",
    staffLimit: null,
    modules: [
      "Everything in Starter",
      "Reports & Exports",
      "Batch Tracking",
      "Suppliers & Deliveries",
      "Pest & Maintenance",
      "Cost & Margin",
      "Unlimited staff",
    ],
    allowedModules: new Set(PRO_MODULES),
    highlight: true,
  },
  multisite: {
    id: "multisite",
    name: "Multi-site",
    basePrice: 10.99,
    extraSitePrice: 2.0,
    basePriceId: "venueos_multisite_base",
    extraSitePriceId: "venueos_multisite_extra_site",
    staffLimit: null,
    modules: [
      "Everything in Pro",
      "HQ Dashboard",
      "Multi-site management",
      "+£2/mo per additional site",
    ],
    allowedModules: new Set(MULTISITE_MODULES),
  },
};

export function tierMonthlyTotal(tier: Tier, sites: number): number {
  const t = TIERS[tier];
  if (tier === "multisite") {
    return t.basePrice + Math.max(0, sites - 1) * t.extraSitePrice;
  }
  return t.basePrice;
}

export function formatGBP(amount: number): string {
  return `£${amount.toFixed(2)}`;
}
