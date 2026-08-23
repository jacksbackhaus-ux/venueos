import { format } from "date-fns";
import type { ReportData } from "./reports";

/**
 * Shared model for the Inspection Pack export.
 *
 * The pack is deliberately structured around the three areas a Food Standards
 * Agency inspector scores:
 *   1. Hygienic food handling
 *   2. Physical condition / cleanliness of premises
 *   3. Confidence in management  (the heaviest-weighted area)
 *
 * Both the PDF and the Excel workbook consume this model so the two outputs
 * always tell the same story.
 */

export type PackDetail = "overview" | "full";

export type PackSectionKey =
  | "temperatures"
  | "cleaning"
  | "allergens"
  | "batches"
  | "training"
  | "incidents"
  | "suppliers"
  | "pest"
  | "reviews"
  | "fsms";

export const PACK_SECTIONS: { key: PackSectionKey; label: string }[] = [
  { key: "temperatures", label: "Temperatures" },
  { key: "cleaning", label: "Cleaning" },
  { key: "allergens", label: "Allergens" },
  { key: "batches", label: "Batch & Traceability" },
  { key: "training", label: "Staff Training" },
  { key: "incidents", label: "Incidents" },
  { key: "suppliers", label: "Suppliers" },
  { key: "pest", label: "Pest & Maintenance" },
  { key: "reviews", label: "Reviews" },
  { key: "fsms", label: "Food Safety Management System" },
];

export type PackSections = Record<PackSectionKey, boolean>;

export function allSectionsOn(): PackSections {
  return PACK_SECTIONS.reduce((acc, s) => {
    acc[s.key] = true;
    return acc;
  }, {} as PackSections);
}

export interface PackOptions {
  detail: PackDetail;
  sections: PackSections;
}

export const defaultPackOptions = (): PackOptions => ({
  detail: "overview",
  sections: allSectionsOn(),
});

export const FSA_AREAS = {
  hygiene: "Hygienic Food Handling",
  premises: "Premises & Cleanliness",
  management: "Confidence in Management",
} as const;

export interface PackStat {
  label: string;
  value: string;
}

export interface PackSummary {
  /** "1 Jan 2026 – 31 Mar 2026" */
  periodLabel: string;
  /** "production days" for on-demand sites, "open days" otherwise */
  dayBasis: string;
  dayBasisNote: string;
  premisesLabel: string;
  fsmsStatement: string;
  hygiene: PackStat[];
  premises: PackStat[];
  management: PackStat[];
}

export function premisesTypeLabel(type: string): string {
  switch (type) {
    case "home":
      return "Home kitchen (registered domestic premises)";
    case "mobile":
      return "Mobile / market trader";
    case "production":
      return "Prep or production unit";
    default:
      return "Commercial premises";
  }
}

export function periodLabel(data: ReportData): string {
  return `${format(data.range.from, "d MMM yyyy")} – ${format(data.range.to, "d MMM yyyy")}`;
}

/** Plain-English description of the food safety management system in operation. */
export function fsmsStatement(data: ReportData): string {
  const route = (data.sfbbSystem as any)?.route;
  const docs = data.sfbbDocuments || [];
  const documented = (data.safeMethods || []).filter((m: any) => m.status === "documented").length;
  const relevant = (data.safeMethods || []).filter((m: any) => m.status !== "not_relevant").length;
  const publishedHaccp = (data.haccpPlans || []).filter((h: any) => h.status === "published").length;

  if (route === "upload" && docs.length > 0) {
    return (
      "This business operates a documented food safety management system based on Safer Food Better Business. " +
      `The completed SFBB pack is held on file (${docs.length} document${docs.length === 1 ? "" : "s"} uploaded to MiseOS) ` +
      "and the daily records that support it are maintained in MiseOS."
    );
  }
  if (relevant > 0) {
    return (
      "This business operates a documented food safety management system based on Safer Food Better Business, " +
      `with ${documented} of ${relevant} relevant safe methods written up and daily records maintained in MiseOS.`
    );
  }
  if (publishedHaccp > 0) {
    return (
      `This business operates a documented HACCP-based food safety management system (${publishedHaccp} published plan${publishedHaccp === 1 ? "" : "s"}), ` +
      "with daily records maintained in MiseOS."
    );
  }
  return "This business maintains its daily food safety records in MiseOS. A written food safety management system (Safer Food Better Business or HACCP) has not yet been completed in the app.";
}

const pctText = (done: number, total: number) =>
  total === 0 ? "No records found for this period" : `${Math.round((done / total) * 100)}% (${done} of ${total})`;

export function buildPackSummary(data: ReportData): PackSummary {
  const onDemand = data.operatingMode === "on_demand";
  const dayBasis = onDemand ? "production days" : "open days";

  const dayBasisNote = onDemand
    ? `${data.productionDaysCount} production day${data.productionDaysCount === 1 ? "" : "s"} declared in this period. Days not declared as production days carry no checks and are excluded from all completion figures.`
    : `${data.closedDaysCount} closed day${data.closedDaysCount === 1 ? "" : "s"} in this period are excluded from all completion figures.`;

  const storage = data.storageTempLogs || [];
  const process = data.processTempLogs || [];
  const recipesApproved = (data.recipes || []).filter((r: any) => r.approved).length;
  const probesPassed = (data.probeCalibrations || []).filter((c: any) => c.pass).length;
  const openRecalls = (data.recalls || []).length;

  const hygiene: PackStat[] = [
    {
      label: "Storage temperature records (fridge / freezer)",
      value: storage.length === 0 ? "No records found for this period" : `${storage.length} readings logged`,
    },
    {
      label: "Process checks (cooking, reheating, hot-holding, cooling, delivery)",
      value: process.length === 0 ? "No records found for this period" : `${process.length} checks logged`,
    },
    {
      label: "Temperature pass rate",
      value:
        data.tempLogs.length === 0
          ? "No records found for this period"
          : `${data.tempPassPct}% pass — ${data.tempBreaches.length} recorded failure${data.tempBreaches.length === 1 ? "" : "s"} with corrective action`,
    },
    {
      label: "Probe calibration",
      value:
        (data.probeCalibrations || []).length === 0
          ? "No records found for this period"
          : `${probesPassed} of ${data.probeCalibrations.length} checks passed`,
    },
    {
      label: "Allergen information",
      value:
        (data.recipes || []).length === 0
          ? "No recipes recorded"
          : `${recipesApproved} of ${data.recipes.length} recipes approved · ${data.ppdsRecipes.length} PPDS item${data.ppdsRecipes.length === 1 ? "" : "s"}`,
    },
    {
      label: "Batch & traceability",
      value:
        (data.batches || []).length === 0
          ? "No batches recorded for this period"
          : `${data.batches.length} batch${data.batches.length === 1 ? "" : "es"} produced · ${openRecalls} withdrawal/recall record${openRecalls === 1 ? "" : "s"}`,
    },
  ];

  const premises: PackStat[] = [
    {
      label: "Cleaning completion",
      value:
        data.cleaningTasksTotal === 0
          ? "No cleaning schedule configured"
          : `${data.cleaningCompletionPct}% (${data.cleaningTasksDone} of ${data.cleaningTasksTotal} scheduled occurrences)`,
    },
    {
      label: "Pest control",
      value:
        (data.pestLogs || []).length === 0
          ? "No sightings or issues recorded"
          : `${data.pestLogs.length} entries · ${data.openPestLogs} open`,
    },
    {
      label: "Maintenance",
      value:
        (data.maintenanceLogs || []).length === 0
          ? "No maintenance issues recorded"
          : `${data.maintenanceLogs.length} issues · ${data.openMaintenance} open`,
    },
    {
      label: "Planned preventative maintenance",
      value:
        (data.ppmTasks || []).length === 0
          ? "No PPM tasks configured"
          : `${data.ppmTasks.length} scheduled tasks · ${data.ppmOverdue} overdue`,
    },
  ];

  const trainingTotal = (data.trainingRecords || []).length;
  const trainingValid = trainingTotal - data.trainingExpired;
  const management: PackStat[] = [
    { label: "Food safety management system", value: fsmsSummaryValue(data) },
    {
      label: "Staff training up to date",
      value:
        trainingTotal === 0
          ? "No training records found for this period"
          : `${pctText(trainingValid, trainingTotal)} in date · ${data.trainingExpired} expired · ${data.trainingExpiringSoon} expiring within 30 days`,
    },
    {
      label: data.operatingMode === "on_demand" ? "Periodic reviews completed" : "4-weekly reviews completed",
      value:
        (data.reviews || []).length === 0
          ? "No reviews found for this period"
          : `${data.reviews.length} completed review${data.reviews.length === 1 ? "" : "s"} on file`,
    },
    {
      label: "Incidents & corrective actions",
      value:
        (data.incidents || []).length === 0
          ? "No incidents recorded for this period"
          : `${data.incidents.length - data.openIncidents} resolved · ${data.openIncidents} open`,
    },
    {
      label: "Fitness to work records",
      value:
        (data.fitnessRecords || []).length === 0
          ? "No exclusions recorded"
          : `${data.fitnessRecords.length} record${data.fitnessRecords.length === 1 ? "" : "s"}`,
    },
    {
      label: "Approved suppliers",
      value:
        (data.suppliers || []).length === 0
          ? "No suppliers recorded"
          : `${data.suppliers.filter((s: any) => s.approved).length} of ${data.suppliers.length} approved`,
    },
    {
      label: `Records completed across ${dayBasis}`,
      value: dayBasisNote,
    },
  ];

  return {
    periodLabel: periodLabel(data),
    dayBasis,
    dayBasisNote,
    premisesLabel: premisesTypeLabel(data.premisesType),
    fsmsStatement: fsmsStatement(data),
    hygiene,
    premises,
    management,
  };
}

function fsmsSummaryValue(data: ReportData): string {
  const route = (data.sfbbSystem as any)?.route;
  const sys = data.sfbbSystem as any;
  const first = sys?.first_completed_at ? format(new Date(sys.first_completed_at), "d MMM yyyy") : null;
  const last = sys?.last_reviewed_at ? format(new Date(sys.last_reviewed_at), "d MMM yyyy") : null;
  const dates = [first ? `first completed ${first}` : null, last ? `last reviewed ${last}` : null]
    .filter(Boolean)
    .join(" · ");

  if (route === "upload" && (data.sfbbDocuments || []).length > 0) {
    return `Safer Food Better Business — completed pack uploaded${dates ? ` (${dates})` : ""}`;
  }
  const documented = (data.safeMethods || []).filter((m: any) => m.status === "documented").length;
  const relevant = (data.safeMethods || []).filter((m: any) => m.status !== "not_relevant").length;
  if (relevant > 0) {
    return `Safer Food Better Business — ${documented} of ${relevant} safe methods documented${dates ? ` (${dates})` : ""}`;
  }
  const published = (data.haccpPlans || []).filter((h: any) => h.status === "published").length;
  if (published > 0) return `HACCP-based plan — ${published} published`;
  return "Not yet completed in MiseOS";
}
