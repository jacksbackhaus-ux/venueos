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

const HACCP = LAUNCH_MODE === "haccp";

/** Customer-facing AI features (morning briefing, margin watchdog, smart rota, …) */
export const showAIFeatures = !HACCP;

/** Commercial / margin / sales modules (Profit & Pricing, Tip Tracker, Sales, Overheads). */
export const showCommercialModules = !HACCP;

/** Operational-but-not-HACCP modules (Shifts, Timesheets, Batch Tracking, Waste Log). */
export const showOperationalCommercialModules = !HACCP;

/** Multi-site HQ console (future paid upgrade). */
export const showMultiSiteHQ = !HACCP;

/** Team Messenger (kept in build, hidden from customer UI at launch). */
export const showMessenger = !HACCP;

/** Settings tabs that should only appear in the full product. */
export const showModulesSettingsTab = !HACCP;
export const showBrandingSettingsTab = !HACCP;

/** Show the multi-tier billing UI (sites/billing section with PLANS/TIERS). */
export const showLegacyBillingUI = !HACCP;

/** Modules hidden from customer UI in HACCP launch mode. */
export const HIDDEN_MODULES: ReadonlySet<ModuleName> = new Set<ModuleName>(
  HACCP
    ? [
        "shifts",
        "timesheets",
        "batch_tracking",
        "waste_log",
        "cost_margin",
        "tip_tracker",
        "ai_insights",
        "messenger",
      ]
    : [],
);

/** Visible-to-customer modules in HACCP launch mode. */
export const VISIBLE_MODULES: ReadonlySet<ModuleName> = new Set<ModuleName>([
  "day_sheet",
  "temperatures",
  "cleaning",
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
  if (!HACCP) return true;
  return !HIDDEN_MODULES.has(mod);
}
