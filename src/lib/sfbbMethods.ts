/**
 * Safer Food Better Business (SFBB) for Caterers — safe method content.
 *
 * Pure data. The safety points and "why" text below are app-provided
 * reference content shown to guide the operator; only their *responses*
 * and status are stored per site.
 *
 * Each method uses the same shape so one reusable template component can
 * render the whole pack consistently.
 */

import type { PremisesType } from "@/lib/premises";

export type SafeMethodStatus = "to_do" | "completed" | "not_relevant";

/** Legacy value written by the first version of the safe-methods tab. */
export function normaliseStatus(s: string | null | undefined): SafeMethodStatus {
  if (s === "documented" || s === "completed") return "completed";
  if (s === "not_relevant") return "not_relevant";
  return "to_do";
}

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

export const SAFE_METHOD_CATEGORY_BLURB: Record<SafeMethodCategory, string> = {
  cross_contamination: "Stopping harmful bacteria and allergens spreading onto food.",
  cleaning: "Keeping hands, surfaces and equipment genuinely clean.",
  chilling: "Keeping cold food cold so bacteria can't grow.",
  cooking: "Making sure food is cooked, reheated and held safely.",
  management: "Proving the system works, day after day.",
};

// ──────────────────────────────────────────────────────────────────
// FIELD SCHEMA
// ──────────────────────────────────────────────────────────────────

export type MethodField =
  | { kind: "text"; key: string; label: string; placeholder?: string; rows?: number }
  | { kind: "yesno"; key: string; label: string; ifNoLabel?: string }
  | { kind: "checklist"; key: string; label: string; options: readonly { key: string; label: string }[] };

export type FieldResponse = string | { value: "yes" | "no" | null; note?: string } | string[];
export type MethodResponses = Record<string, FieldResponse>;

export interface SafeMethodDef {
  key: string;
  category: SafeMethodCategory;
  title: string;
  /** One-line summary shown in the list. */
  summary: string;
  /** Read-only SFBB safety points. */
  safetyPoints: readonly string[];
  /** Read-only "why this matters" text. */
  why: string;
  /** The fillable parts. */
  fields: readonly MethodField[];
  /** Where the daily records for this method actually live. */
  link?: { label: string; href: string };
  /** Premises types that should see this method first. */
  priorityFor?: readonly PremisesType[];
  /** Premises types where this is usually not needed (soft flag only). */
  optionalFor?: readonly PremisesType[];
}

const HOW = (label = "How do you do this?", placeholder?: string, rows = 4): MethodField =>
  ({ kind: "text", key: "how", label, placeholder, rows });

// ──────────────────────────────────────────────────────────────────
// THE PACK
// ──────────────────────────────────────────────────────────────────

export const SAFE_METHODS: readonly SafeMethodDef[] = [
  // ═══════════ CROSS-CONTAMINATION ═══════════
  {
    key: "personal_hygiene",
    category: "cross_contamination",
    title: "Personal hygiene and fitness to work",
    summary: "Clean hands, clean clothes, and nobody working while ill.",
    safetyPoints: [
      "Always wash hands before handling food, and after handling raw food or waste.",
      "Wear clean clothes and a clean apron when preparing food; change aprons between raw and ready-to-eat work.",
      "Tie back and cover long hair; keep jewellery, false nails and strong perfume out of the kitchen.",
      "Do not smoke, vape, eat or chew gum where food is handled.",
      "Cover cuts and sores with a brightly coloured waterproof dressing.",
      "Anyone with sickness or diarrhoea must stay away from food work until 48 hours symptom-free.",
    ],
    why: "People carry bacteria on hands, hair and clothing. Someone working while ill with sickness or diarrhoea is one of the most common causes of food poisoning outbreaks.",
    fields: [
      HOW("How do you make sure everyone handling food is clean, appropriately dressed and fit to work?"),
      { kind: "yesno", key: "reporting", label: "Do staff know they must report sickness and diarrhoea to you before starting work?", ifNoLabel: "What will you put in place?" },
      { kind: "yesno", key: "rule_48h", label: "Do you apply the 48-hour rule before someone returns to food work?", ifNoLabel: "If not, what do you do?" },
      { kind: "text", key: "workwear", label: "What workwear do you use, and how is it kept clean?", rows: 3 },
    ],
    link: { label: "Fitness to work log", href: "/staff-training?tab=fitness" },
    priorityFor: ["commercial", "home", "mobile", "production"],
  },
  {
    key: "cloths",
    category: "cross_contamination",
    title: "Cloths",
    summary: "Cloths spread bacteria unless they're disposable or properly washed.",
    safetyPoints: [
      "Disposable cloths are safest — use once, then throw away.",
      "Reusable cloths must be washed on a hot cycle (at least 90°C) or boiled, then dried.",
      "Use different cloths for raw and ready-to-eat areas.",
      "Never use the same cloth to wipe raw meat juice and then a worktop or plate.",
    ],
    why: "A damp, reused cloth is a perfect place for bacteria to multiply and is one of the easiest ways to carry them around the kitchen.",
    fields: [
      { kind: "checklist", key: "types", label: "Which do you use?", options: [
        { key: "disposable", label: "Disposable cloths" },
        { key: "reusable", label: "Reusable cloths washed at 90°C or boiled" },
        { key: "colour_coded", label: "Colour-coded cloths for different areas" },
      ] },
      HOW("How do you use, wash or replace cloths so they don't spread bacteria?"),
    ],
    priorityFor: ["commercial", "home", "mobile", "production"],
  },
  {
    key: "raw_rte",
    category: "cross_contamination",
    title: "Separating foods",
    summary: "Keeping raw food apart from ready-to-eat food at every stage.",
    safetyPoints: [
      "Delivery: check raw and ready-to-eat foods arrive separately and are properly wrapped.",
      "Storage: store raw meat, poultry, fish and eggs below and away from ready-to-eat food.",
      "Defrosting: defrost raw food in the fridge in a covered container on the bottom shelf.",
      "Preparation: use separate boards, knives and areas — or prepare ready-to-eat food first, then clean down.",
      "Wash fruit, salad and vegetables thoroughly before use.",
      "Complex equipment (slicers, mincers, vac-packers) needs stripping down and disinfecting between raw and ready-to-eat use.",
      "Never let raw food or its juices touch cooked or ready-to-eat food.",
    ],
    why: "Raw meat, poultry, eggs, fish and unwashed vegetables carry harmful bacteria. Food that won't be cooked again has no second chance to kill them.",
    fields: [
      HOW("How do you keep raw food away from ready-to-eat food during delivery, storage, prep and service?"),
      { kind: "yesno", key: "separate_equipment", label: "Do you use separate (or colour-coded) boards and equipment for raw and ready-to-eat food?", ifNoLabel: "If not, how do you separate the work?" },
      { kind: "yesno", key: "fridge_layout", label: "Is raw food always stored below ready-to-eat food?", ifNoLabel: "If not, what do you do?" },
      { kind: "text", key: "produce_wash", label: "How do you wash fruit, salad and vegetables?", rows: 2 },
    ],
    priorityFor: ["commercial", "home", "mobile", "production"],
  },
  {
    key: "allergens",
    category: "cross_contamination",
    title: "Food allergies and food hypersensitivity",
    summary: "Handling the 14 allergens so an allergic customer is safe.",
    safetyPoints: [
      "Know the 14 regulated allergens and which of your dishes contain them.",
      "Delivery and storage: keep allergen ingredients labelled, sealed and separate.",
      "Preparation: clean down thoroughly and use clean equipment before making an allergen-free order.",
      "Service and takeaway: label clearly and make sure the right meal reaches the right customer.",
      "Never guess. If you can't be sure, say so.",
    ],
    why: "A tiny trace of an allergen can cause a severe or fatal reaction. Allergen cross-contact cannot be cooked out.",
    fields: [
      HOW("How do you handle allergen ingredients from delivery through to service?"),
      { kind: "checklist", key: "controls", label: "Which controls do you use?", options: [
        { key: "labelled_store", label: "Allergen ingredients labelled and stored separately" },
        { key: "clean_down", label: "Full clean-down before an allergen-free order" },
        { key: "dedicated_equipment", label: "Dedicated equipment or utensils" },
        { key: "order_flagging", label: "Allergy orders flagged through to the pass" },
      ] },
      { kind: "yesno", key: "staff_know", label: "Do all staff know what to do when a customer declares an allergy?", ifNoLabel: "What will you put in place?" },
    ],
    link: { label: "Allergen matrix", href: "/allergens" },
    priorityFor: ["commercial", "home", "mobile", "production"],
  },
  {
    key: "physical_chemical",
    category: "cross_contamination",
    title: "Physical and chemical contamination",
    summary: "Keeping glass, packaging, jewellery and chemicals out of food.",
    safetyPoints: [
      "Store cleaning chemicals away from food, in clearly labelled original containers.",
      "Keep food covered and off the floor.",
      "Avoid glass and hard plastic in food areas; deal with breakages immediately by clearing and discarding exposed food.",
      "Remove damaged or chipped equipment and crockery from use.",
      "Keep packaging, staples, string and dressings out of food.",
    ],
    why: "Foreign objects and cleaning chemicals in food cause injury and illness, and are among the most common customer complaints.",
    fields: [
      HOW("How do you stop glass, packaging, jewellery or cleaning chemicals getting into food?"),
      { kind: "yesno", key: "chem_storage", label: "Are all chemicals stored away from food in labelled containers?", ifNoLabel: "If not, what do you do?" },
      { kind: "text", key: "breakage", label: "What do you do if something breaks over food?", rows: 2 },
    ],
    priorityFor: ["commercial", "home", "mobile", "production"],
  },
  {
    key: "pest_control",
    category: "cross_contamination",
    title: "Pest control",
    summary: "Checking for pests and acting fast when you find signs.",
    safetyPoints: [
      "Check daily for droppings, gnaw marks, nests, insects and unusual smells.",
      "Keep external doors and windows screened or closed; block gaps.",
      "Check deliveries for damaged packaging and signs of pests before accepting.",
      "Keep external areas, bins and yards clean and tidy.",
      "Use a pest contractor if you find any evidence, and keep their reports.",
    ],
    why: "Pests carry harmful bacteria straight onto food and surfaces, and an active infestation can close a business.",
    fields: [
      HOW("How and how often do you check for pests, and what do you do if you find signs?"),
      { kind: "yesno", key: "contractor", label: "Do you use a pest control contractor?", ifNoLabel: "How do you deal with pests instead?" },
      { kind: "text", key: "contractor_details", label: "Contractor name and contact (if used)", rows: 2 },
    ],
    link: { label: "Pest & maintenance log", href: "/pest-maintenance" },
    priorityFor: ["commercial", "home", "mobile", "production"],
  },
  {
    key: "maintenance",
    category: "cross_contamination",
    title: "Maintenance",
    summary: "Premises and equipment kept in good, cleanable repair.",
    safetyPoints: [
      "Surfaces, floors and walls must be smooth, intact and easy to clean.",
      "Keep extractor fans and ventilation clean and working.",
      "Replace chopping boards that are deeply scored.",
      "Repair or remove broken equipment; check fridge and freezer seals.",
      "Check your probe thermometer is accurate.",
    ],
    why: "Damaged surfaces and equipment trap dirt and bacteria and can't be cleaned properly.",
    fields: [
      HOW("How do you keep the premises and equipment in good repair?"),
      { kind: "text", key: "reporting", label: "How do staff report a fault, and who fixes it?", rows: 3 },
    ],
    link: { label: "Maintenance log", href: "/pest-maintenance" },
    priorityFor: ["commercial", "production"],
  },

  // ═══════════ CLEANING ═══════════
  {
    key: "handwashing",
    category: "cleaning",
    title: "Handwashing",
    summary: "The single most effective control you have.",
    safetyPoints: [
      "Wet hands, apply soap, rub all surfaces for at least 20 seconds, rinse and dry thoroughly.",
      "Wash before starting work and before handling ready-to-eat food.",
      "Wash after handling raw food, waste, cleaning, touching your face, or using the toilet.",
      "Use a dedicated wash-hand basin with hot and cold water, soap and disposable towels.",
      "Hand gel is not a substitute for washing.",
    ],
    why: "Hands move bacteria from raw food, bins and people directly onto food that won't be cooked again.",
    fields: [
      HOW("When and how does everyone wash their hands?"),
      { kind: "yesno", key: "dedicated_basin", label: "Is there a dedicated hand-wash basin with soap and towels?", ifNoLabel: "What handwashing setup do you use?" },
    ],
    priorityFor: ["commercial", "home", "mobile", "production"],
  },
  {
    key: "cleaning_effectively",
    category: "cleaning",
    title: "Cleaning effectively",
    summary: "Two-stage cleaning, correct dilution, correct contact time.",
    safetyPoints: [
      "Two-stage clean: remove visible dirt first, then disinfect the clean surface.",
      "Follow the manufacturer's dilution instructions exactly.",
      "Leave disinfectant on for the stated contact time before wiping or rinsing.",
      "Use disinfectants that meet BS EN 1276 or BS EN 13697.",
      "High-priority items (hand contact points, chopping boards, equipment touching ready-to-eat food) need cleaning and disinfecting.",
    ],
    why: "Disinfectant applied to a dirty surface, at the wrong strength, or wiped straight off does not kill bacteria.",
    fields: [
      HOW("How do you clean and then disinfect surfaces and equipment?"),
      { kind: "text", key: "products", label: "Which products do you use, at what dilution and contact time?", rows: 3 },
      { kind: "yesno", key: "bs_en", label: "Do your disinfectants meet BS EN 1276 or BS EN 13697?", ifNoLabel: "If not, what will you change to?" },
    ],
    link: { label: "Cleaning module", href: "/cleaning" },
    priorityFor: ["commercial", "home", "mobile", "production"],
  },
  {
    key: "clear_clean_as_you_go",
    category: "cleaning",
    title: "Clear and clean as you go",
    summary: "Keeping the workspace clear and clean while you work.",
    safetyPoints: [
      "Remove packaging and waste from work areas as you go.",
      "Clear and clean surfaces between tasks, especially between raw and ready-to-eat work.",
      "Clear up spills straight away.",
      "Keep food waste covered and away from food preparation.",
    ],
    why: "Clutter and spills hide dirt, attract pests, and make cross-contamination far more likely.",
    fields: [
      HOW("How do you keep work areas clear and clean while you work?"),
      { kind: "text", key: "waste", label: "How is food waste handled and removed?", rows: 2 },
    ],
    priorityFor: ["commercial", "home", "mobile", "production"],
  },
  {
    key: "cleaning_schedule",
    category: "cleaning",
    title: "Your cleaning schedule",
    summary: "What gets cleaned, how often, how, and by whom.",
    safetyPoints: [
      "List every item and area that needs cleaning.",
      "Set a frequency for each: after each use, daily, weekly, or periodic.",
      "State the method and product for each item.",
      "Name who is responsible, and record it when it's done.",
    ],
    why: "A written schedule is how you prove cleaning happens, rather than hoping someone remembered.",
    fields: [
      HOW("How is your cleaning schedule organised, and who is responsible?"),
      { kind: "yesno", key: "recorded", label: "Is cleaning recorded when it's completed?", ifNoLabel: "How will you record it?" },
    ],
    link: { label: "Cleaning schedule & records", href: "/cleaning" },
    priorityFor: ["commercial", "home", "mobile", "production"],
  },

  // ═══════════ CHILLING ═══════════
  {
    key: "chilled_storage",
    category: "chilling",
    title: "Chilled storage and displaying chilled food",
    summary: "Cold food kept cold, and use-by dates respected.",
    safetyPoints: [
      "Aim for 5°C or below in fridges; the legal maximum in England, Wales and Northern Ireland is 8°C.",
      "Check and record fridge temperatures at least daily.",
      "Never use food after its use-by date.",
      "Chilled food can be displayed out of temperature control for up to 4 hours — once only — then it must be used or thrown away.",
      "Don't overfill fridges; cold air needs to circulate.",
    ],
    why: "Harmful bacteria multiply quickly between 8°C and 63°C. Keeping food cold keeps that growth in check.",
    fields: [
      HOW("How do you keep chilled food cold enough in storage and on display?"),
      { kind: "yesno", key: "daily_checks", label: "Do you check and record fridge temperatures daily?", ifNoLabel: "How often do you check?" },
      { kind: "text", key: "display", label: "If you display chilled food out of the fridge, how do you control the 4-hour rule?", rows: 2 },
    ],
    link: { label: "Temperature records", href: "/temperature" },
    priorityFor: ["commercial", "home", "mobile", "production"],
  },
  {
    key: "chilling_down",
    category: "chilling",
    title: "Chilling down hot food",
    summary: "Cooling cooked food fast, then getting it in the fridge.",
    safetyPoints: [
      "Cool cooked food as quickly as possible — aim for within 90 minutes.",
      "Divide into smaller portions, use shallow trays, or use an ice bath or blast chiller.",
      "Never put large amounts of hot food straight into the fridge.",
      "Cover and refrigerate as soon as it stops steaming.",
      "Prove it: time and probe one batch to show your method works.",
    ],
    why: "Slow cooling leaves food in the danger zone for hours, which is exactly when spore-forming bacteria multiply.",
    fields: [
      { kind: "checklist", key: "methods", label: "Which cooling methods do you use?", options: [
        { key: "portioning", label: "Divide into smaller portions" },
        { key: "shallow", label: "Shallow trays" },
        { key: "ice_bath", label: "Ice bath or cold water" },
        { key: "blast", label: "Blast chiller" },
        { key: "fan", label: "Cool in a cool, draughty area" },
      ] },
      HOW("How do you cool hot food quickly and safely?"),
      { kind: "text", key: "prove_it", label: "Prove it — what did you measure when you checked your cooling method?", rows: 2 },
    ],
    link: { label: "Cooling checks", href: "/temperature" },
    priorityFor: ["commercial", "production"],
  },
  {
    key: "defrosting",
    category: "chilling",
    title: "Defrosting",
    summary: "Defrost cold, defrost fully, keep raw separate.",
    safetyPoints: [
      "Defrost in the fridge wherever possible, on the bottom shelf in a covered container.",
      "Keep defrosting raw food away from and below ready-to-eat food.",
      "Make sure food is fully defrosted before cooking — check the centre.",
      "Cook defrosted food within 24 hours; never refreeze defrosted raw food.",
      "Discard defrosting liquid safely and clean down afterwards.",
    ],
    why: "Partly frozen food may not reach a safe temperature in the centre when cooked, and defrosting liquid spreads bacteria.",
    fields: [
      HOW("How do you defrost food safely?"),
      { kind: "yesno", key: "fridge_defrost", label: "Do you defrost in the fridge?", ifNoLabel: "What method do you use instead?" },
    ],
    priorityFor: ["commercial", "home", "mobile", "production"],
  },
  {
    key: "freezing",
    category: "chilling",
    title: "Freezing",
    summary: "Freeze promptly, label clearly, keep at −18°C.",
    safetyPoints: [
      "Freeze food promptly, while it is still within its use-by date.",
      "Portion before freezing so it defrosts evenly.",
      "Label everything with what it is and the date it was frozen.",
      "Keep freezers at −18°C or below and check regularly.",
      "Never refreeze food that has been defrosted.",
    ],
    why: "Freezing stops bacteria multiplying but doesn't kill them — so what you freeze must already be safe, and you must know how old it is.",
    fields: [
      HOW("How do you freeze, label and date food?"),
      { kind: "yesno", key: "labelled", label: "Is everything in the freezer labelled and dated?", ifNoLabel: "How will you fix this?" },
    ],
    link: { label: "Temperature records", href: "/temperature" },
    priorityFor: ["commercial", "home", "mobile", "production"],
  },

  // ═══════════ COOKING ═══════════
  {
    key: "cooking_safely",
    category: "cooking",
    title: "Cooking safely",
    summary: "Cooked through, checked, and never touching raw food again.",
    safetyPoints: [
      "Preheat ovens, fryers and grills before cooking.",
      "Cook to 75°C in the centre, or an equivalent combination (80°C/6s, 70°C/2min, 65°C/10min, 60°C/45min).",
      "Check the thickest part with a clean, disinfected probe.",
      "Never let cooked food touch raw food, raw juices, or equipment used for raw food.",
      "Rare steaks and whole cuts can be served rare only if the outside is fully sealed; burgers, sausages, poultry, rolled joints and offal must be cooked through.",
      "Liver and offal must be thoroughly cooked all the way through.",
      "Stir liquid dishes so they heat evenly, and check more than one spot.",
    ],
    why: "Thorough cooking is the step that actually kills harmful bacteria. Everything else only limits their growth.",
    fields: [
      HOW("How do you check food is cooked through before serving or selling?"),
      { kind: "yesno", key: "probe_used", label: "Do you use a probe thermometer to check cooking?", ifNoLabel: "What visual or timing checks do you use instead?" },
      { kind: "text", key: "combo", label: "Which time/temperature combination do you work to?", rows: 2 },
      { kind: "yesno", key: "rare", label: "Do you serve any rare or lightly cooked meat?", ifNoLabel: "" },
    ],
    link: { label: "Cooking temperature checks", href: "/temperature" },
    priorityFor: ["commercial", "production"],
  },
  {
    key: "extra_care_foods",
    category: "cooking",
    title: "Foods that need extra care",
    summary: "Eggs, rice, pulses, shellfish, fish and other higher-risk items.",
    safetyPoints: [
      "Use British Lion eggs where possible; use pasteurised egg for dishes not fully cooked, if serving vulnerable groups.",
      "Rice: cook only what you need, cool within 90 minutes, refrigerate, use within 24 hours, reheat once until piping hot.",
      "Dried beans and pulses: soak and boil vigorously as instructed before use.",
      "Shellfish: buy from an approved supplier, keep records, cook thoroughly.",
      "Fish for raw or lightly cooked service must be frozen first to the required parasite treatment.",
      "Cream, mousses and unbaked desserts must be kept chilled and used within their date.",
    ],
    why: "These foods carry specific risks — spore-forming bacteria in rice and pulses, salmonella in eggs, viruses and toxins in shellfish — that normal handling doesn't cover.",
    fields: [
      { kind: "checklist", key: "which", label: "Which of these do you handle?", options: [
        { key: "eggs", label: "Raw or lightly cooked eggs" },
        { key: "rice", label: "Rice or grains" },
        { key: "pulses", label: "Dried beans or pulses" },
        { key: "shellfish", label: "Shellfish" },
        { key: "raw_fish", label: "Raw or lightly cooked fish" },
        { key: "cream", label: "Cream, mousse or unbaked desserts" },
      ] },
      HOW("How do you handle these higher-risk foods safely?"),
    ],
    priorityFor: ["commercial", "home", "production"],
  },
  {
    key: "reheating",
    category: "cooking",
    title: "Reheating",
    summary: "Reheating is cooking again — once, and properly.",
    safetyPoints: [
      "Reheat to at least 75°C in the centre (82°C in Scotland).",
      "Reheat only once; discard anything not used.",
      "Stir liquid dishes during reheating and check in more than one place.",
      "Never use hot-holding equipment to reheat food.",
      "Check with a clean probe and record it.",
    ],
    why: "Reheating is the last chance to kill bacteria that grew while the food was chilled or stored.",
    fields: [
      HOW("How do you reheat food to a safe core temperature?"),
      { kind: "yesno", key: "once_only", label: "Do you reheat food once only?", ifNoLabel: "If not, what do you do?" },
    ],
    link: { label: "Reheating checks", href: "/temperature" },
    optionalFor: ["home", "mobile"],
    priorityFor: ["commercial", "production"],
  },
  {
    key: "checking_menu",
    category: "cooking",
    title: "Checking your menu",
    summary: "A recorded check for each key cooked dish.",
    safetyPoints: [
      "List the dishes on your menu that need cooking, reheating or hot holding.",
      "For each one, record how you check it is safe — probe temperature, time, or visual signs.",
      "Recheck when you change a recipe, portion size or piece of equipment.",
      "Keep the record with your safe methods.",
    ],
    why: "Every dish behaves differently. Checking each one once means staff know what 'done' looks like without guessing.",
    fields: [
      { kind: "text", key: "dishes", label: "List your key cooked dishes and how each one is checked", rows: 6, placeholder: "e.g. Sausage rolls — probe centre, 75°C+\nQuiche — probe centre, 75°C+, 35 min at 180°C" },
      { kind: "yesno", key: "recheck", label: "Do you recheck when a recipe or piece of equipment changes?", ifNoLabel: "" },
    ],
    priorityFor: ["commercial", "production", "home"],
  },
  {
    key: "hot_holding",
    category: "cooking",
    title: "Hot holding",
    summary: "63°C or above, and the 2-hour display rule.",
    safetyPoints: [
      "Keep hot food at 63°C or above.",
      "Preheat hot-holding equipment before putting food in it.",
      "Never use hot-holding equipment to heat or reheat food.",
      "Food can be displayed below 63°C for up to 2 hours — once only — then it must be used or thrown away.",
      "Check and record hot-holding temperatures.",
      "For delivery, keep hot food hot and cold food cold in transit.",
    ],
    why: "Between 8°C and 63°C bacteria multiply. Hot holding is only safe if the temperature genuinely stays above 63°C.",
    fields: [
      HOW("How do you keep hot food at 63°C or above?"),
      { kind: "yesno", key: "recorded", label: "Do you record hot-holding temperatures?", ifNoLabel: "How do you check instead?" },
      { kind: "text", key: "two_hour", label: "How do you manage the 2-hour rule for food displayed below 63°C?", rows: 2 },
    ],
    link: { label: "Hot holding checks", href: "/temperature" },
    optionalFor: ["home"],
    priorityFor: ["commercial", "mobile"],
  },
  {
    key: "ready_to_eat",
    category: "cooking",
    title: "Ready-to-eat food",
    summary: "Food that won't be cooked again needs the strictest handling.",
    safetyPoints: [
      "Prepare ready-to-eat food away from raw food, in time or in space.",
      "Use clean, disinfected equipment and hands.",
      "Apply and respect use-by dates on ready-to-eat items you make.",
      "Slicers and other complex equipment must be stripped down and disinfected between raw and ready-to-eat use.",
      "Wash all fruit, salad and vegetables served raw.",
    ],
    why: "There is no cooking step left to kill bacteria, so anything that gets onto ready-to-eat food reaches the customer.",
    fields: [
      HOW("How do you prepare and protect food that won't be cooked again?"),
      { kind: "yesno", key: "slicer", label: "Do you use a slicer, mincer or vac-packer?", ifNoLabel: "" },
      { kind: "text", key: "slicer_clean", label: "If yes, how is it stripped down and disinfected?", rows: 2 },
    ],
    priorityFor: ["commercial", "home", "mobile", "production"],
  },
  {
    key: "acrylamide",
    category: "cooking",
    title: "Acrylamide",
    summary: "Cook to golden yellow, not brown, when frying, roasting or baking.",
    safetyPoints: [
      "Aim for golden yellow rather than dark brown when frying, roasting, grilling or baking.",
      "Store potatoes above 6°C and not in the fridge.",
      "Follow manufacturer cooking instructions for chips and par-baked products.",
      "Soak raw chipped potatoes before frying where practical.",
      "Toast bread and bake pastry to the lightest acceptable colour.",
    ],
    why: "Acrylamide forms when starchy foods are cooked at high temperatures for too long. It is a chemical safety issue enforcers now check.",
    fields: [
      HOW("How do you keep baking, roasting and frying colour light?"),
      { kind: "yesno", key: "applies", label: "Do you fry, roast, grill or bake starchy foods?", ifNoLabel: "Mark this method not relevant if you don't." },
    ],
    optionalFor: ["mobile"],
    priorityFor: ["commercial", "production", "home"],
  },

  // ═══════════ MANAGEMENT ═══════════
  {
    key: "opening_closing",
    category: "management",
    title: "Opening and closing checks",
    summary: "The short list you run at the start and end of every day.",
    safetyPoints: [
      "Opening: fridges and freezers at temperature, no pest signs, staff fit for work, handwashing supplies stocked, area clean.",
      "Closing: all food covered, dated and put away; hot food cooled and chilled; waste removed; clean-down completed.",
      "Record the checks — that record is your everyday evidence.",
      "If something isn't right, write down what you did about it.",
    ],
    why: "Opening and closing checks catch problems before they reach food, and they're the first thing an inspector asks to see.",
    fields: [
      HOW("What do you check at the start and end of each day, and who does it?"),
      { kind: "yesno", key: "recorded", label: "Are these checks recorded?", ifNoLabel: "How will you record them?" },
    ],
    link: { label: "Day sheet", href: "/day-sheet" },
    priorityFor: ["commercial", "home", "mobile", "production"],
  },
  {
    key: "extra_checks",
    category: "management",
    title: "Extra checks",
    summary: "The periodic checks that aren't part of the daily routine.",
    safetyPoints: [
      "Deep cleaning of ovens, extractors, storage areas and behind equipment.",
      "Dishwasher and glasswasher running at the right temperature.",
      "Probe thermometer accuracy check.",
      "Equipment servicing and pest contractor visits.",
      "Set a frequency for each and record when it's done.",
    ],
    why: "Things that happen monthly or quarterly are the easiest to forget, and the ones inspectors ask for proof of.",
    fields: [
      { kind: "text", key: "list", label: "What extra checks do you do, and how often?", rows: 5 },
    ],
    link: { label: "Planned maintenance", href: "/ppm" },
    priorityFor: ["commercial", "production"],
  },
  {
    key: "prove_it",
    category: "management",
    title: "Prove it",
    summary: "The evidence that your safe methods actually work.",
    safetyPoints: [
      "Use a clean, disinfected probe thermometer to check cooking, reheating, hot holding and chilling.",
      "Check probe accuracy against iced water (0°C) and boiling water (100°C).",
      "Record the temperatures you take, including anything out of range and what you did.",
      "Keep supplier assurances, contractor reports and training records.",
    ],
    why: "'We always do it properly' isn't evidence. Records are what turn a good kitchen into a good hygiene rating.",
    fields: [
      HOW("How do you record evidence that your safe methods are being followed?"),
      { kind: "yesno", key: "calibration", label: "Do you check your probe's accuracy regularly?", ifNoLabel: "How will you start?" },
    ],
    link: { label: "Probe calibration", href: "/temperature" },
    priorityFor: ["commercial", "home", "mobile", "production"],
  },
  {
    key: "managing_allergen_info",
    category: "management",
    title: "Managing food allergen information",
    summary: "Accurate allergen information, available every time it's asked for.",
    safetyPoints: [
      "Keep an up-to-date allergen matrix for every dish, and update it when recipes or suppliers change.",
      "Prepacked for direct sale (PPDS) food must carry a full ingredient list with allergens emphasised.",
      "Signpost clearly so customers know to ask.",
      "Phone and online orders need the same information before the customer commits to buy.",
      "Check ingredient labels every delivery — recipes change without warning.",
    ],
    why: "Getting allergen information wrong is a criminal offence and has cost lives. Natasha's Law made PPDS labelling mandatory.",
    fields: [
      HOW("How do you keep allergen information accurate and available?"),
      { kind: "yesno", key: "ppds", label: "Do you sell prepacked for direct sale (PPDS) food?", ifNoLabel: "" },
      { kind: "text", key: "ppds_labels", label: "If yes, how are PPDS labels produced and checked?", rows: 2 },
    ],
    link: { label: "Allergen matrix", href: "/allergens" },
    priorityFor: ["commercial", "home", "mobile", "production"],
  },
  {
    key: "training_supervision",
    category: "management",
    title: "Training and supervision",
    summary: "Everyone trained to the level of the job they do.",
    safetyPoints: [
      "Train new staff in your safe methods before they handle food unsupervised.",
      "Supervise new and young staff closely.",
      "Refresh training when methods, menus or equipment change.",
      "Keep dated training records for each person.",
    ],
    why: "Your safe methods only work if the people doing the work know them.",
    fields: [
      HOW("How are staff trained and supervised in your safe methods?"),
      { kind: "yesno", key: "records", label: "Do you keep dated training records?", ifNoLabel: "How will you record training?" },
    ],
    link: { label: "Staff training", href: "/staff-training" },
    priorityFor: ["commercial", "production"],
  },
  {
    key: "customers_complaints",
    category: "management",
    title: "Customers and complaints",
    summary: "Recording, investigating and learning from complaints.",
    safetyPoints: [
      "Record every food complaint: date, customer, what they ate, and what happened.",
      "Investigate — check batch records, temperatures and who was working.",
      "Keep any remaining food, packaging or the product itself.",
      "Review and change your safe methods if the complaint reveals a problem.",
      "Report suspected food poisoning to your local authority.",
    ],
    why: "A complaint is early warning. Investigating it properly is exactly what 'confidence in management' means.",
    fields: [
      HOW("How do you record and investigate a food complaint?"),
      { kind: "yesno", key: "who", label: "Is it clear who handles complaints?", ifNoLabel: "Who will handle them?" },
    ],
    link: { label: "Customer feedback", href: "/customer-feedback" },
    priorityFor: ["commercial", "home", "mobile", "production"],
  },
  {
    key: "suppliers_contractors",
    category: "management",
    title: "Suppliers and contractors",
    summary: "Knowing where your food came from, and who came into your kitchen.",
    safetyPoints: [
      "Buy from reputable suppliers and keep their contact details.",
      "Keep invoices, delivery notes and receipts — this is your traceability.",
      "Check deliveries: temperature, date codes, packaging condition, and pest signs.",
      "Check contractors work hygienically and don't contaminate food areas.",
      "Keep records of contractor visits and reports.",
    ],
    why: "If a product has to be withdrawn, supplier records are how you find out what you have and who to tell.",
    fields: [
      HOW("How do you choose suppliers and record who you buy from?"),
      { kind: "yesno", key: "records_kept", label: "Do you keep invoices or receipts for all food purchases?", ifNoLabel: "How will you keep records?" },
      { kind: "text", key: "delivery_checks", label: "What do you check when a delivery arrives?", rows: 3 },
    ],
    link: { label: "Suppliers", href: "/suppliers" },
    priorityFor: ["commercial", "home", "mobile", "production"],
  },
  {
    key: "stock_control",
    category: "management",
    title: "Stock control",
    summary: "Date labelling, rotation, and buying the right amount.",
    safetyPoints: [
      "Plan your menu and order so stock is used within date.",
      "Check date codes on delivery — don't accept short-dated or out-of-date stock.",
      "Label food you decant or prepare with a date.",
      "Rotate stock: first in, first out.",
      "Throw away anything past its use-by date.",
    ],
    why: "Most avoidable waste and a good share of food safety incidents come down to stock that nobody could date.",
    fields: [
      HOW("How do you date-label and rotate stock?"),
      { kind: "yesno", key: "fifo", label: "Do you operate first in, first out?", ifNoLabel: "If not, what do you do?" },
    ],
    priorityFor: ["commercial", "home", "mobile", "production"],
  },
  {
    key: "withdrawal_recall",
    category: "management",
    title: "Product withdrawal and recall",
    summary: "What you'd do if unsafe food had already left the kitchen.",
    safetyPoints: [
      "Withdrawal = removing product from sale. Recall = asking customers to return or destroy it.",
      "Identify affected batches using your batch and supplier records.",
      "Stop sale and quarantine remaining stock immediately.",
      "Tell your local authority, and the FSA if the food has reached consumers.",
      "Tell customers clearly — signage, social media, direct contact where possible.",
      "Record what happened, what you did, and what you changed.",
    ],
    why: "A recall is judged on how quickly and completely you act. Having the plan written down beforehand is the whole point.",
    fields: [
      HOW("What would you do if you had to withdraw or recall a product?"),
      { kind: "text", key: "contacts", label: "Who would you contact, and how?", rows: 3 },
      { kind: "yesno", key: "traceable", label: "Can you identify which customers received a specific batch?", ifNoLabel: "How would you reach them?" },
    ],
    link: { label: "Withdrawals & recalls", href: "/batches?tab=recalls" },
    priorityFor: ["commercial", "home", "mobile", "production"],
  },
] as const;

// ──────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────

export function safeMethodDef(key: string): SafeMethodDef | undefined {
  return SAFE_METHODS.find((m) => m.key === key);
}

/** Soft flag only — the method is still shown and can always be used. */
export function isOptionalForPremises(m: SafeMethodDef, type: PremisesType | null | undefined): boolean {
  return !!m.optionalFor?.includes((type ?? "commercial") as PremisesType);
}

export function isPriorityForPremises(m: SafeMethodDef, type: PremisesType | null | undefined): boolean {
  if (!m.priorityFor) return true;
  return m.priorityFor.includes((type ?? "commercial") as PremisesType);
}

/** Extra guidance shown at the top of the list for small-scale premises. */
export const PREMISES_HINT: Partial<Record<PremisesType, string>> = {
  home: "Leading with the methods a home food business actually needs. Anything marked optional is still available — open it any time.",
  mobile: "Mobile and market traders: pay particular attention to transport temperatures, your handwashing setup, and allergen information at events.",
};

/**
 * Ordering: priority methods first within each category, then optional ones.
 * Never hides anything.
 */
export function orderMethods(
  list: readonly SafeMethodDef[],
  type: PremisesType | null | undefined,
): SafeMethodDef[] {
  return [...list].sort((a, b) => {
    const rank = (m: SafeMethodDef) =>
      isOptionalForPremises(m, type) ? 2 : isPriorityForPremises(m, type) ? 0 : 1;
    return rank(a) - rank(b);
  });
}

/** A method counts as addressed once it's completed or marked not relevant. */
export function isAddressed(status: SafeMethodStatus): boolean {
  return status === "completed" || status === "not_relevant";
}

export function methodProgress(
  byKey: Record<string, { status?: string | null }>,
): { addressed: number; completed: number; total: number; pct: number } {
  const total = SAFE_METHODS.length;
  let addressed = 0;
  let completed = 0;
  SAFE_METHODS.forEach((m) => {
    const s = normaliseStatus(byKey[m.key]?.status);
    if (s === "completed") completed++;
    if (isAddressed(s)) addressed++;
  });
  return { addressed, completed, total, pct: total ? Math.round((addressed / total) * 100) : 0 };
}

/** How much of a single method has been filled in (drives the per-row bar). */
export function methodFieldProgress(def: SafeMethodDef, responses: MethodResponses | null | undefined): number {
  const r = responses ?? {};
  const filled = def.fields.filter((f) => {
    const v = r[f.key];
    if (v == null) return false;
    if (typeof v === "string") return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    return !!v.value;
  }).length;
  return def.fields.length ? Math.round((filled / def.fields.length) * 100) : 0;
}
