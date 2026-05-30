/**
 * Operator-friendly language map. Single source of truth for customer-facing
 * terminology. If a bakery owner wouldn't say it, change it here — not in the
 * component — so the term stays consistent everywhere.
 *
 * Exception: the HACCP plan builder keeps its regulatory wording.
 *
 * Usage:
 *   import { L } from "@/lib/language";
 *   <Button>{L.markFixed}</Button>
 */
export const L = {
  // ── Module names (canonical, operator-first) ──────────────────────
  profitPricing: "Profit & Pricing",
  bestSellers: "Best sellers & problems",
  yourPrices: "Your prices",
  whereYouSell: "Where you sell",
  profitAfterCosts: "Profit after costs",
  profitBeforeOverhead: "Profit before overhead",
  moneyKeptAfterFees: "Money kept after fees",
  wasteTracking: "Waste tracking",

  // ── Incidents ─────────────────────────────────────────────────────
  incidentsTitle: "Incidents",
  reportIncident: "Report issue",
  markFixed: "Mark fixed",
  confirmFixed: "Confirm fixed",
  fixApplied: "Fix applied",
  whatYouDid: "What you did",
  whyItHappened: "Why it happened",
  whatStopsIt: "How to prevent it",

  // ── Temperature ───────────────────────────────────────────────────
  correctiveAction: "Fix applied",
  withinSpec: "All units OK",

  // ── Cleaning / Day sheet ──────────────────────────────────────────
  markDone: "Mark done",
  tasksDue: "Tasks due",

  // ── Generic ───────────────────────────────────────────────────────
  open: "Open",
  inProgress: "In progress",
  done: "Done",

  // ── Trust indicators (shown next to numbers when context matters) ─
  estimated: "Using estimated cost",
  noDataYet: "No data yet",
  last30Days: "Based on last 30 days",
  last7Days: "Based on last 7 days",
  waitingForSetup: "Waiting for setup",
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
