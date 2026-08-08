/**
 * Safer Food Better Business (SFBB) reference data.
 *
 * Pure data + pure functions — no React, no Supabase. Used by the periodic
 * review (Compliance Overview), the safe-methods tab (HACCP Plan) and the
 * Inspection Pack.
 */

import type { PremisesType, OperatingMode } from "@/lib/premises";

// ──────────────────────────────────────────────────────────────────
// PERIODIC REVIEW CHECKLIST (SFBB "4-weekly review")
// ──────────────────────────────────────────────────────────────────

export interface ReviewQuestion {
  key: string;
  label: string;
}

export const REVIEW_QUESTIONS: readonly ReviewQuestion[] = [
  { key: "repeat_problem", label: "Any problem observed, or the same issue 3+ times in this period?" },
  { key: "safe_methods_reviewed", label: "Have you reviewed your safe methods?" },
  { key: "allergen_info", label: "Has allergen information been updated for any menu or ingredient changes?" },
  { key: "equipment_changes", label: "Have any equipment or processes changed that affect your safe methods?" },
  { key: "new_suppliers", label: "Have new suppliers been recorded with contact details?" },
  { key: "cleaning_schedule", label: "Does the cleaning schedule need updating?" },
  { key: "new_staff_trained", label: "Have new staff been trained in all safe methods?" },
  { key: "refresher_training", label: "Do any existing staff need refresher training?" },
  { key: "extra_checks_needed", label: "Are any extra opening or closing checks required?" },
  { key: "complaints_investigated", label: "Have food complaints been investigated and safe methods reviewed?" },
  { key: "probe_calibrated", label: "Have probes been calibrated in this period and results recorded?" },
  { key: "extra_checks_recorded", label: "Have extra checks been completed and recorded?" },
  { key: "prove_it", label: "Are \"prove it\" checks being completed and recorded?" },
] as const;

export type ReviewAnswer = { value: "yes" | "no" | null; note?: string };
export type ReviewChecklist = Record<string, ReviewAnswer>;

export function emptyChecklist(): ReviewChecklist {
  const c: ReviewChecklist = {};
  REVIEW_QUESTIONS.forEach((q) => { c[q.key] = { value: null }; });
  return c;
}

export function checklistAnswered(checklist: ReviewChecklist | null | undefined): number {
  if (!checklist) return 0;
  return REVIEW_QUESTIONS.filter((q) => checklist[q.key]?.value).length;
}

// ──────────────────────────────────────────────────────────────────
// REVIEW CADENCE
// ──────────────────────────────────────────────────────────────────

export const SCHEDULED_REVIEW_DAYS = 28;         // every 4 weeks
export const ON_DEMAND_REVIEW_PRODUCTION_DAYS = 20;
export const ON_DEMAND_REVIEW_MAX_DAYS = 92;     // ~3 months backstop

export interface ReviewCadenceInput {
  mode: OperatingMode;
  /** Date the last review period ended, or the site's start point (ISO date). */
  periodStartISO: string;
  /** Production day dates (ISO) on/after periodStartISO. Only used for on_demand. */
  productionDates?: string[];
  todayISO?: string;
}

export interface ReviewCadence {
  due: boolean;
  periodStart: string;
  periodEnd: string;
  /** Only meaningful for on_demand sites. */
  productionDaysCovered: number;
  /** Human explanation of what the period is measured in. */
  progressLabel: string;
  /** Consistent wording for the review itself. */
  reviewLabel: string;
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86400000,
  );
}

/**
 * Works out whether a periodic review is due.
 *
 * scheduled  → 4 calendar weeks after the period start.
 * on_demand  → 20 production days, or 3 months elapsed, whichever first.
 *              Calendar days with no production day never count, so a home
 *              baker who bakes twice a month is never nagged.
 */
export function computeReviewCadence(input: ReviewCadenceInput): ReviewCadence {
  const today = input.todayISO ?? new Date().toISOString().slice(0, 10);
  const periodStart = input.periodStartISO;
  const elapsed = Math.max(0, daysBetween(periodStart, today));

  if (input.mode === "on_demand") {
    const dates = (input.productionDates ?? []).filter((d) => d >= periodStart && d <= today);
    const covered = new Set(dates).size;
    const dueByDays = covered >= ON_DEMAND_REVIEW_PRODUCTION_DAYS;
    const dueByTime = elapsed >= ON_DEMAND_REVIEW_MAX_DAYS;
    return {
      due: dueByDays || dueByTime,
      periodStart,
      periodEnd: today,
      productionDaysCovered: covered,
      progressLabel: `${covered} of ${ON_DEMAND_REVIEW_PRODUCTION_DAYS} production days`,
      reviewLabel: "periodic review",
    };
  }

  return {
    due: elapsed >= SCHEDULED_REVIEW_DAYS,
    periodStart,
    periodEnd: elapsed >= SCHEDULED_REVIEW_DAYS ? addDaysISO(periodStart, SCHEDULED_REVIEW_DAYS - 1) : today,
    productionDaysCovered: 0,
    progressLabel: `Day ${Math.min(elapsed + 1, SCHEDULED_REVIEW_DAYS)} of ${SCHEDULED_REVIEW_DAYS}`,
    reviewLabel: "4-weekly review",
  };
}

export function reviewLabelFor(mode: OperatingMode): string {
  return mode === "on_demand" ? "periodic review" : "4-weekly review";
}

// ──────────────────────────────────────────────────────────────────
// SAFE METHODS (SFBB safe method set)
// ──────────────────────────────────────────────────────────────────

export type SafeMethodStatus = "to_do" | "documented" | "not_relevant";

export const SAFE_METHOD_CATEGORIES = [
  "cross_contamination",
  "cleaning",
  "chilling",
  "cooking",
  "management",
] as const;
export type SafeMethodCategory = typeof SAFE_METHOD_CATEGORIES[number];

export const SAFE_METHOD_CATEGORY_LABEL: Record<SafeMethodCategory, string> = {
  cross_contamination: "Cross-contamination",
  cleaning: "Cleaning",
  chilling: "Chilling",
  cooking: "Cooking",
  management: "Management",
};

export interface SafeMethodDef {
  key: string;
  category: SafeMethodCategory;
  title: string;
  prompt: string;
  /** Premises types where this method is suggested. Others can still open it. */
  suggestedFor?: readonly PremisesType[];
}

const ALL: readonly PremisesType[] = ["commercial", "home", "mobile", "production"];
const COMMERCIAL_ONLY: readonly PremisesType[] = ["commercial", "production"];

export const SAFE_METHODS: readonly SafeMethodDef[] = [
  // Cross-contamination
  { key: "personal_hygiene", category: "cross_contamination", title: "Personal hygiene & fitness to work", prompt: "How do you make sure anyone handling food is clean, appropriately dressed and fit to work?", suggestedFor: ALL },
  { key: "cloths", category: "cross_contamination", title: "Cloths", prompt: "How do you use, wash or replace cloths so they don't spread bacteria?", suggestedFor: ALL },
  { key: "raw_rte", category: "cross_contamination", title: "Separating raw and ready-to-eat foods", prompt: "How do you keep raw food away from ready-to-eat food during storage, prep and serving?", suggestedFor: ALL },
  { key: "allergens", category: "cross_contamination", title: "Food allergies & allergen handling", prompt: "How do you handle allergen ingredients and give customers accurate information?", suggestedFor: ALL },
  { key: "physical_chemical", category: "cross_contamination", title: "Physical & chemical contamination", prompt: "How do you stop glass, packaging, jewellery or cleaning chemicals getting into food?", suggestedFor: ALL },
  { key: "pest_control", category: "cross_contamination", title: "Pest control", prompt: "How do you check for and deal with pests?", suggestedFor: ALL },
  { key: "maintenance", category: "cross_contamination", title: "Maintenance", prompt: "How do you keep the premises and equipment in good repair?", suggestedFor: ALL },

  // Cleaning
  { key: "handwashing", category: "cleaning", title: "Handwashing", prompt: "When and how does everyone wash their hands?", suggestedFor: ALL },
  { key: "cleaning_effectively", category: "cleaning", title: "Cleaning effectively (2-stage)", prompt: "How do you clean and then disinfect surfaces and equipment?", suggestedFor: ALL },
  { key: "clear_clean_as_you_go", category: "cleaning", title: "Clear & clean as you go", prompt: "How do you keep work areas clear and clean while you work?", suggestedFor: ALL },
  { key: "cleaning_schedule", category: "cleaning", title: "Cleaning schedule", prompt: "What gets cleaned, how often, and who is responsible?", suggestedFor: ALL },

  // Chilling
  { key: "chilled_storage", category: "chilling", title: "Chilled storage & display", prompt: "How do you keep chilled food cold enough in storage and on display?", suggestedFor: ALL },
  { key: "chilling_down", category: "chilling", title: "Chilling down hot food", prompt: "How do you cool hot food quickly and safely?", suggestedFor: ALL },
  { key: "defrosting", category: "chilling", title: "Defrosting", prompt: "How do you defrost food safely?", suggestedFor: ALL },
  { key: "freezing", category: "chilling", title: "Freezing", prompt: "How do you freeze, label and date food?", suggestedFor: ALL },

  // Cooking
  { key: "cooking_safely", category: "cooking", title: "Cooking safely", prompt: "How do you check food is cooked through before serving or selling?", suggestedFor: ALL },
  { key: "extra_care_foods", category: "cooking", title: "Foods that need extra care", prompt: "How do you handle higher-risk foods (rice, eggs, cream, shellfish)?", suggestedFor: ALL },
  { key: "reheating", category: "cooking", title: "Reheating", prompt: "How do you reheat food to a safe core temperature?", suggestedFor: COMMERCIAL_ONLY },
  { key: "checking_menu", category: "cooking", title: "Checking your menu", prompt: "How do you review what you sell against your safe methods?", suggestedFor: ALL },
  { key: "hot_holding", category: "cooking", title: "Hot holding", prompt: "How do you keep hot food at 63°C or above?", suggestedFor: COMMERCIAL_ONLY },
  { key: "ready_to_eat", category: "cooking", title: "Ready-to-eat food", prompt: "How do you prepare and protect food that won't be cooked again?", suggestedFor: ALL },
  { key: "acrylamide", category: "cooking", title: "Acrylamide", prompt: "How do you keep baking and frying colour light to reduce acrylamide?", suggestedFor: ALL },

  // Management
  { key: "opening_closing", category: "management", title: "Opening & closing checks", prompt: "What do you check at the start and end of each day?", suggestedFor: ALL },
  { key: "extra_checks", category: "management", title: "Extra checks", prompt: "What extra checks do you do, and when?", suggestedFor: ALL },
  { key: "prove_it", category: "management", title: "Prove it", prompt: "How do you record evidence that your safe methods are being followed?", suggestedFor: ALL },
  { key: "managing_allergen_info", category: "management", title: "Managing allergen information", prompt: "How do you keep allergen information accurate and available?", suggestedFor: ALL },
  { key: "training_supervision", category: "management", title: "Training & supervision", prompt: "How are staff trained and supervised in your safe methods?", suggestedFor: ALL },
  { key: "customers_complaints", category: "management", title: "Customers & complaints", prompt: "How do you record and investigate a food complaint?", suggestedFor: ALL },
  { key: "suppliers_contractors", category: "management", title: "Suppliers & contractors", prompt: "How do you choose suppliers and record who you buy from?", suggestedFor: ALL },
  { key: "stock_control", category: "management", title: "Stock control", prompt: "How do you date-label and rotate stock?", suggestedFor: ALL },
  { key: "withdrawal_recall", category: "management", title: "Product withdrawal & recall", prompt: "What would you do if you had to withdraw or recall a product?", suggestedFor: ALL },
] as const;

export function safeMethodDef(key: string): SafeMethodDef | undefined {
  return SAFE_METHODS.find((m) => m.key === key);
}

/** Suggested (not enforced) method set for a premises type. */
export function isSuggestedForPremises(m: SafeMethodDef, type: PremisesType | null | undefined): boolean {
  if (!m.suggestedFor) return true;
  return m.suggestedFor.includes((type ?? "commercial") as PremisesType);
}

// ──────────────────────────────────────────────────────────────────
// COOKING TIME / TEMPERATURE COMBINATIONS
// ──────────────────────────────────────────────────────────────────

export interface CookCombo {
  key: string;
  temp: number;
  holdLabel: string;
  label: string;
}

export const COOK_COMBOS: readonly CookCombo[] = [
  { key: "80_6s",   temp: 80, holdLabel: "6 seconds",  label: "80°C for 6 seconds" },
  { key: "75_30s",  temp: 75, holdLabel: "30 seconds", label: "75°C for 30 seconds" },
  { key: "70_2m",   temp: 70, holdLabel: "2 minutes",  label: "70°C for 2 minutes" },
  { key: "65_10m",  temp: 65, holdLabel: "10 minutes", label: "65°C for 10 minutes" },
  { key: "60_45m",  temp: 60, holdLabel: "45 minutes", label: "60°C for 45 minutes" },
] as const;

// ──────────────────────────────────────────────────────────────────
// PROBE CALIBRATION
// ──────────────────────────────────────────────────────────────────

export function probeCalibrationPass(iced: number, boiling: number): boolean {
  return iced >= -1 && iced <= 1 && boiling >= 99 && boiling <= 101;
}

// ──────────────────────────────────────────────────────────────────
// RECALLS
// ──────────────────────────────────────────────────────────────────

export const RECALL_REASONS = [
  "Harmful bacteria",
  "Physical contamination",
  "Mislabelling",
  "Allergen",
  "Other",
] as const;

export const RECALL_SOURCES = [
  "Manufacturer",
  "Supplier",
  "Local authority",
  "FSA",
  "Own staff",
] as const;

// ──────────────────────────────────────────────────────────────────
// FITNESS TO WORK
// ──────────────────────────────────────────────────────────────────

/** SFBB 48-hour rule: symptom-free for 48 hours before returning to food work. */
export function suggestedReturnDate(symptomEndISO: string): string {
  const d = new Date(`${symptomEndISO}T12:00:00`);
  d.setDate(d.getDate() + 2);
  return d.toISOString().slice(0, 10);
}
