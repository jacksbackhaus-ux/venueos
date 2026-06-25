/**
 * MiseOS launch feature flags.
 *
 * Single source of truth for which parts of the product are visible to
 * customers at launch. Hidden code is NOT deleted — it stays in the build,
 * routes still exist, components still compile. Flipping LAUNCH_MODE back
 * to "full" restores everything.
 *
 * Internal MiseOS staff console is NOT affected by these flags.
 */

import type { ModuleName } from "@/lib/plans";

export type LaunchMode = "haccp" | "full";

/** Current launch mode. "haccp" = focused HACCP launch. "full" = pre-pivot. */
export const LAUNCH_MODE: LaunchMode = "haccp";

/** Customer-facing AI features (morning briefing, margin watchdog, smart rota, …) */
export const showAIFeatures = LAUNCH_MODE !== "haccp";

/** Commercial / margin / sales modules (Profit & Pricing, Tip Tracker, Sales, Overheads). */
export const showCommercialModules = LAUNCH_MODE !== "haccp";

/** Operational-but-not-HACCP modules (Shifts, Timesheets, Batch Tracking, Waste Log). */
export const showOperationalCommercialModules = LAUNCH_MODE !== "haccp";

/** Multi-site HQ console (future paid upgrade). */
export const showMultiSiteHQ = LAUNCH_MODE !== "haccp";

/** Modules hidden from customer UI in HACCP launch mode. */
export const HIDDEN_MODULES: ReadonlySet<ModuleName> = new Set<ModuleName>(
  LAUNCH_MODE === "haccp"
    ? [
        "shifts",
        "timesheets",
        "batch_tracking",
        "waste_log",
        "cost_margin",
        "tip_tracker",
        "ai_insights",
      ]
    : [],
);

/** Visible-to-customer modules in HACCP launch mode. */
export const VISIBLE_MODULES: ReadonlySet<ModuleName> = new Set<ModuleName>([
  "day_sheet",
  "temperatures",
  "cleaning",
  "messenger",
  "customer_feedback",
  "allergens",
  "suppliers",
  "pest_maintenance",
  "incidents",
  "staff_training",
  "haccp",
  "ppm_schedule",
  "reports",
]);

/** Should this module be visible in the customer-facing UI? */
export function isModuleVisibleInLaunch(mod: ModuleName): boolean {
  if (LAUNCH_MODE !== "haccp") return true;
  return !HIDDEN_MODULES.has(mod);
}
