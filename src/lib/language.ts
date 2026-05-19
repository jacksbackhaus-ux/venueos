/**
 * Operator-friendly language map. Phase 4: replace jargon with plain words
 * everywhere EXCEPT the HACCP plan builder (which must keep regulatory terms).
 *
 * Usage:
 *   import { L } from "@/lib/language";
 *   <Button>{L.markFixed}</Button>
 */
export const L = {
  // Incidents
  incidentsTitle: "Incidents",
  reportIncident: "Report issue",
  markFixed: "Mark fixed",
  confirmFixed: "Confirm fixed",
  fixApplied: "Fix applied",
  whatYouDid: "What you did",
  whyItHappened: "Why it happened",
  whatStopsIt: "How to prevent it",

  // Temperature
  correctiveAction: "Fix applied",
  withinSpec: "All units OK",

  // Cleaning / Day sheet
  markDone: "Mark done",
  tasksDue: "Tasks due",

  // Generic
  open: "Open",
  inProgress: "In progress",
  done: "Done",
} as const;

/**
 * Status -> friendly label mapper for incident rows.
 */
export function incidentStatusLabel(status: string): string {
  switch (status) {
    case "open":
      return "Open";
    case "action-taken":
      return "Fix applied";
    case "verified":
      return "Closed";
    default:
      return status;
  }
}
