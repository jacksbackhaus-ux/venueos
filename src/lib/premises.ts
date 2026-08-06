/**
 * Premises types and operating modes.
 *
 * Single source of truth for:
 *   - what kind of place a site is (premises_type)
 *   - how compliance days are declared (operating_mode)
 *   - which modules are visible for that premises type
 *   - which customer-facing words change for that premises type
 *
 * Nothing here forks a component. Module visibility flows through the
 * existing launch-flag / useModuleAccess system, and language flows through
 * a single label lookup used by shared components.
 *
 * Commercial + production behave exactly as MiseOS always has.
 */

import type { ModuleName } from "@/lib/plans";

export type PremisesType = "commercial" | "home" | "mobile" | "production";
export type OperatingMode = "scheduled" | "on_demand";

export interface PremisesMeta {
  type: PremisesType;
  title: string;
  examples: string;
  /** lucide-react icon name, resolved by the picker */
  icon: "Store" | "Home" | "Truck" | "Factory";
  defaultMode: OperatingMode;
}

export const PREMISES_TYPES: readonly PremisesMeta[] = [
  {
    type: "commercial",
    title: "Commercial premises",
    examples: "Café, bakery, restaurant, shop",
    icon: "Store",
    defaultMode: "scheduled",
  },
  {
    type: "home",
    title: "Home kitchen",
    examples: "Registered domestic kitchen",
    icon: "Home",
    defaultMode: "on_demand",
  },
  {
    type: "mobile",
    title: "Mobile or market",
    examples: "Van, stall, trailer, pop-up",
    icon: "Truck",
    defaultMode: "on_demand",
  },
  {
    type: "production",
    title: "Prep or production",
    examples: "Unit, dark kitchen, wholesale",
    icon: "Factory",
    defaultMode: "scheduled",
  },
] as const;

export function premisesMeta(type: PremisesType | null | undefined): PremisesMeta {
  return PREMISES_TYPES.find((p) => p.type === type) ?? PREMISES_TYPES[0];
}

/** Short badge label used in the site switcher and All Sites cards. */
export function premisesBadge(type: PremisesType | null | undefined): string {
  switch (type) {
    case "home": return "Home";
    case "mobile": return "Mobile";
    case "production": return "Prep";
    default: return "Commercial";
  }
}

export function defaultOperatingMode(type: PremisesType): OperatingMode {
  return premisesMeta(type).defaultMode;
}

/** Small-scale premises: home kitchens and market traders. */
export function isSmallScale(type: PremisesType | null | undefined): boolean {
  return type === "home" || type === "mobile";
}

// ──────────────────────────────────────────────────────────────────
// MODULE VISIBILITY
// ──────────────────────────────────────────────────────────────────

/**
 * Modules hidden for a premises type. Nothing is deleted — flipping the
 * premises type (or emptying these sets) restores every module instantly.
 */
const HIDDEN_BY_PREMISES: Record<PremisesType, ReadonlySet<ModuleName>> = {
  commercial: new Set<ModuleName>(),
  production: new Set<ModuleName>(),
  // Home: the Production Day replaces the Day Sheet, PPM/pest folds into cleaning.
  home: new Set<ModuleName>(["day_sheet", "ppm_schedule", "pest_maintenance"]),
  // Mobile: same as home, but stalls and vans genuinely need pest & maintenance.
  mobile: new Set<ModuleName>(["day_sheet", "ppm_schedule"]),
};

export function isModuleVisibleForPremises(
  mod: ModuleName,
  type: PremisesType | null | undefined,
): boolean {
  return !HIDDEN_BY_PREMISES[(type ?? "commercial") as PremisesType]?.has(mod);
}

// ──────────────────────────────────────────────────────────────────
// LANGUAGE
// ──────────────────────────────────────────────────────────────────

export interface PremisesLabels {
  site: string;
  sitePlural: string;
  safeToTrade: string;
  openingChecks: string;
  closingChecks: string;
  suppliers: string;
  productionDay: string;
}

const COMMERCIAL_LABELS: PremisesLabels = {
  site: "Site",
  sitePlural: "Sites",
  safeToTrade: "Safe to trade",
  openingChecks: "Opening checks",
  closingChecks: "Closing checks",
  suppliers: "Suppliers & Deliveries",
  productionDay: "Production day",
};

const LABELS: Record<PremisesType, PremisesLabels> = {
  commercial: COMMERCIAL_LABELS,
  production: COMMERCIAL_LABELS,
  home: {
    site: "Kitchen",
    sitePlural: "Kitchens",
    safeToTrade: "Ready to bake",
    openingChecks: "Before you start",
    closingChecks: "After you finish",
    suppliers: "Where I buy ingredients",
    productionDay: "Production day",
  },
  mobile: {
    site: "Pitch",
    sitePlural: "Pitches",
    safeToTrade: "Ready to trade",
    openingChecks: "Before you start",
    closingChecks: "After you finish",
    suppliers: "Where I buy ingredients",
    productionDay: "Trading day",
  },
};

export function premisesLabels(type: PremisesType | null | undefined): PremisesLabels {
  return LABELS[(type ?? "commercial") as PremisesType] ?? COMMERCIAL_LABELS;
}

// ──────────────────────────────────────────────────────────────────
// HOME KITCHEN SETUP CHECK
// ──────────────────────────────────────────────────────────────────

export interface KitchenSetupItem {
  key: string;
  label: string;
}

export const KITCHEN_SETUP_ITEMS: readonly KitchenSetupItem[] = [
  { key: "handwashing", label: "Handwashing facilities available with hot water, soap and paper towels" },
  { key: "toilet", label: "Toilet does not open directly into the kitchen" },
  { key: "pets", label: "Pets can be excluded during food preparation" },
  { key: "separate_storage", label: "Separate storage for raw and ready-to-eat foods" },
  { key: "boards", label: "Colour-coded boards or clear separation of equipment" },
  { key: "fridge", label: "Fridge maintains below 5°C" },
  { key: "freezer", label: "Freezer maintains below -18°C" },
  { key: "surfaces", label: "Surfaces are sealed, intact and easy to clean" },
  { key: "lighting", label: "Adequate lighting and ventilation" },
  { key: "chemicals", label: "Safe storage for cleaning chemicals away from food" },
] as const;

export interface KitchenSetupAnswer {
  checked: boolean;
  note?: string;
}
export type KitchenSetupAnswers = Record<string, KitchenSetupAnswer>;

// ──────────────────────────────────────────────────────────────────
// DISMISSIBLE PROMPTS (device-local, never reappear once dismissed)
// ──────────────────────────────────────────────────────────────────

export function promptDismissed(key: string, siteId: string): boolean {
  try {
    return localStorage.getItem(`miseos_prompt_${key}_${siteId}`) === "1";
  } catch {
    return true;
  }
}

export function dismissPrompt(key: string, siteId: string) {
  try {
    localStorage.setItem(`miseos_prompt_${key}_${siteId}`, "1");
  } catch { /* storage unavailable — prompt simply shows again */ }
}

/**
 * Safe-to-Trade hero band labels, worded for the premises type.
 * Commercial and production keep the original wording exactly.
 */
export function bandLabelsFor(
  type: PremisesType | null | undefined,
): Record<"green" | "amber" | "red", string> | undefined {
  if (type === "home") {
    return {
      green: "Ready to bake",
      amber: "Ready to bake — with risks",
      red: "Not ready to bake",
    };
  }
  if (type === "mobile") {
    return {
      green: "Ready to trade",
      amber: "Ready to trade — with risks",
      red: "Not ready to trade",
    };
  }
  return undefined;
}
