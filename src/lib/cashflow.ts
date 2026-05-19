// Cashflow analytics — pure helpers.
// Builds a daily cash series from sales, batches, overheads and manual adjustments.
// All calculations are estimates and labelled as such in the UI.

import { supabase } from "@/integrations/supabase/client";
import { sumOverheads } from "@/lib/channelMath";

export type PeriodKey = "7d" | "30d" | "90d" | "12m";
export type ChannelFilter = "all" | "dtc" | "wholesale";

export function periodDays(p: PeriodKey): number {
  switch (p) {
    case "7d": return 7;
    case "30d": return 30;
    case "90d": return 90;
    case "12m": return 365;
  }
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function rangeStart(p: PeriodKey): string {
  const d = new Date();
  d.setDate(d.getDate() - periodDays(p) + 1);
  return isoDay(d);
}

export function makeDailySeries(startIso: string, days: number): string[] {
  const start = new Date(startIso + "T00:00:00");
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(isoDay(d));
  }
  return out;
}

export interface CashflowInputs {
  siteIds: string[];      // 1+ sites; "all sites" passes all owned site ids
  startIso: string;
  endIso: string;
  channel: ChannelFilter;
}

export interface CashflowDataset {
  byDay: Record<string, { in: number; out: number; salesDtc: number; salesWholesale: number; cogs: number; labour: number; overheads: number; adjustmentsIn: number; adjustmentsOut: number }>;
  totals: { salesDtc: number; salesWholesale: number; sales: number; cogs: number; labour: number; overheads: number; adjustmentsIn: number; adjustmentsOut: number; netIn: number; netOut: number; net: number };
  hasSales: boolean;
  hasBatches: boolean;
  hasTimesheets: boolean;
  hasOverheads: boolean;
  hasChannel: boolean;     // sales rows carry channel
  cogsMethod: "batches" | "sales-estimate" | "unavailable";
  startingCash: number | null;
  days: string[];
}

function blankDay() {
  return { in: 0, out: 0, salesDtc: 0, salesWholesale: 0, cogs: 0, labour: 0, overheads: 0, adjustmentsIn: 0, adjustmentsOut: 0 };
}

/** Load all data needed for the Cashflow tab. */
export async function loadCashflow(opts: CashflowInputs): Promise<CashflowDataset> {
  const { siteIds, startIso, endIso, channel } = opts;
  const days = makeDailySeries(startIso, Math.round((Date.parse(endIso) - Date.parse(startIso)) / 86400000) + 1);
  const byDay: CashflowDataset["byDay"] = {};
  for (const d of days) byDay[d] = blankDay();

  if (siteIds.length === 0) {
    return {
      byDay,
      totals: { salesDtc: 0, salesWholesale: 0, sales: 0, cogs: 0, labour: 0, overheads: 0, adjustmentsIn: 0, adjustmentsOut: 0, netIn: 0, netOut: 0, net: 0 },
      hasSales: false, hasBatches: false, hasTimesheets: false, hasOverheads: false, hasChannel: false,
      cogsMethod: "unavailable", startingCash: null, days,
    };
  }

  // --- Sales ---
  let salesQ = supabase
    .from("sales_line_items")
    .select("sale_date, net_sales, gross_sales, quantity, channel, linked_product_id, ignored")
    .in("site_id", siteIds)
    .gte("sale_date", startIso)
    .lte("sale_date", endIso)
    .eq("ignored", false);
  if (channel !== "all") salesQ = salesQ.eq("channel", channel);
  const { data: salesRows } = await salesQ;
  const sales = (salesRows || []) as any[];
  const hasSales = sales.length > 0;
  const hasChannel = sales.some((s) => s.channel);

  // --- Batches (for COGS primary) ---
  const { data: batchRows } = await supabase
    .from("batches")
    .select("date_produced, quantity_produced, unit_cost_snapshot, total_production_cost, site_id, recipe_id")
    .in("site_id", siteIds)
    .gte("date_produced", startIso)
    .lte("date_produced", endIso);
  const batches = (batchRows || []) as any[];
  const hasBatches = batches.length > 0;

  // --- Recipes cost map (for sales-based COGS fallback) ---
  // Use sale_price snapshot is not enough — we want cost per unit. Pull from recipes referenced by sales.
  const linkedIds = Array.from(new Set(sales.map((s) => s.linked_product_id).filter(Boolean)));
  const recipeCostMap: Record<string, number> = {};
  if (linkedIds.length) {
    // Use batches.unit_cost_snapshot most recent per recipe as a cheap cost-per-unit proxy.
    const { data: latestBatches } = await supabase
      .from("batches")
      .select("recipe_id, unit_cost_snapshot, date_produced")
      .in("recipe_id", linkedIds)
      .order("date_produced", { ascending: false })
      .limit(500);
    for (const b of (latestBatches || []) as any[]) {
      if (b.recipe_id && recipeCostMap[b.recipe_id] == null && b.unit_cost_snapshot != null) {
        recipeCostMap[b.recipe_id] = Number(b.unit_cost_snapshot);
      }
    }
  }

  // --- Overheads ---
  const { data: overheadRows } = await supabase
    .from("site_overheads_monthly")
    .select("*")
    .in("site_id", siteIds);
  const overheads = (overheadRows || []) as any[];
  const hasOverheads = overheads.length > 0;

  // --- Adjustments ---
  const { data: adjRows } = await supabase
    .from("cashflow_adjustments")
    .select("event_date, direction, amount")
    .in("site_id", siteIds)
    .gte("event_date", startIso)
    .lte("event_date", endIso);
  const adjustments = (adjRows || []) as any[];

  // --- Timesheets / labour ---
  // Try shift_compensation_logs first — has computed amounts. If empty, hide.
  let labourByDay: Record<string, number> = {};
  const { data: scl } = await supabase
    .from("shift_compensation_logs")
    .select("shift_date, compensation_amount, site_id")
    .in("site_id", siteIds)
    .gte("shift_date", startIso)
    .lte("shift_date", endIso);
  let hasTimesheets = false;
  if (scl && scl.length) {
    hasTimesheets = true;
    for (const r of scl as any[]) {
      labourByDay[r.shift_date] = (labourByDay[r.shift_date] || 0) + Number(r.compensation_amount || 0);
    }
  }

  // --- Starting cash (only relevant for single-site view; sum if multi) ---
  const { data: cashRows } = await supabase
    .from("site_cash_settings")
    .select("starting_cash")
    .in("site_id", siteIds);
  const startingCash = cashRows && cashRows.length
    ? (cashRows as any[]).reduce((s, r) => s + (Number(r.starting_cash) || 0), 0)
    : null;

  // === Aggregation ===
  // Sales by day
  for (const s of sales) {
    const day = s.sale_date;
    if (!byDay[day]) continue;
    const net = Number(s.net_sales ?? s.gross_sales ?? 0) || 0;
    byDay[day].in += net;
    if (s.channel === "wholesale") byDay[day].salesWholesale += net;
    else byDay[day].salesDtc += net;
  }

  // COGS
  let cogsMethod: CashflowDataset["cogsMethod"] = "unavailable";
  if (hasBatches) {
    cogsMethod = "batches";
    for (const b of batches) {
      const day = b.date_produced;
      if (!byDay[day]) continue;
      const total = b.total_production_cost != null
        ? Number(b.total_production_cost)
        : Number(b.unit_cost_snapshot || 0) * Number(b.quantity_produced || 0);
      byDay[day].cogs += total || 0;
      byDay[day].out += total || 0;
    }
  } else if (hasSales && Object.keys(recipeCostMap).length) {
    cogsMethod = "sales-estimate";
    for (const s of sales) {
      const day = s.sale_date;
      if (!byDay[day]) continue;
      const cpu = recipeCostMap[s.linked_product_id] ?? 0;
      const c = cpu * (Number(s.quantity) || 0);
      byDay[day].cogs += c;
      byDay[day].out += c;
    }
  }

  // Labour
  for (const day of Object.keys(labourByDay)) {
    if (!byDay[day]) continue;
    byDay[day].labour += labourByDay[day];
    byDay[day].out += labourByDay[day];
  }

  // Overheads — allocate monthly total evenly across days of the month within range
  for (const oh of overheads) {
    const month: string = oh.month; // YYYY-MM-01
    const total = sumOverheads(oh);
    if (!total) continue;
    const [y, m] = month.split("-").map(Number);
    const dim = new Date(y, m, 0).getDate();
    const per = total / dim;
    for (let i = 1; i <= dim; i++) {
      const day = `${y}-${String(m).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      if (!byDay[day]) continue;
      byDay[day].overheads += per;
      byDay[day].out += per;
    }
  }

  // Adjustments
  for (const a of adjustments) {
    const day = a.event_date;
    if (!byDay[day]) continue;
    const amt = Number(a.amount) || 0;
    if (a.direction === "in") { byDay[day].adjustmentsIn += amt; byDay[day].in += amt; }
    else { byDay[day].adjustmentsOut += amt; byDay[day].out += amt; }
  }

  // Totals
  const totals = days.reduce((t, d) => {
    const r = byDay[d];
    t.salesDtc += r.salesDtc;
    t.salesWholesale += r.salesWholesale;
    t.sales += r.salesDtc + r.salesWholesale;
    t.cogs += r.cogs;
    t.labour += r.labour;
    t.overheads += r.overheads;
    t.adjustmentsIn += r.adjustmentsIn;
    t.adjustmentsOut += r.adjustmentsOut;
    t.netIn += r.in;
    t.netOut += r.out;
    t.net += r.in - r.out;
    return t;
  }, { salesDtc: 0, salesWholesale: 0, sales: 0, cogs: 0, labour: 0, overheads: 0, adjustmentsIn: 0, adjustmentsOut: 0, netIn: 0, netOut: 0, net: 0 });

  return {
    byDay, totals, hasSales, hasBatches, hasTimesheets, hasOverheads, hasChannel,
    cogsMethod, startingCash, days,
  };
}

export function runwayDays(startingCash: number | null, totals: CashflowDataset["totals"], periodDaysVal: number): number | null {
  if (startingCash == null || startingCash <= 0) return null;
  const avgDailyOut = totals.netOut / periodDaysVal;
  if (avgDailyOut <= 0) return null;
  return startingCash / avgDailyOut;
}
