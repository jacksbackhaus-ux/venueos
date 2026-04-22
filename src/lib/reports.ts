import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay, endOfDay, parseISO, differenceInDays } from "date-fns";

export type DateRangeKey = "7days" | "4weeks" | "3months" | "12months";

export interface ReportRange {
  key: DateRangeKey;
  label: string;
  from: Date;
  to: Date;
  days: number;
}

export function buildRange(key: DateRangeKey): ReportRange {
  const to = endOfDay(new Date());
  const days = key === "7days" ? 7 : key === "4weeks" ? 28 : key === "3months" ? 90 : 365;
  const from = startOfDay(subDays(to, days - 1));
  const labels: Record<DateRangeKey, string> = {
    "7days": "Last 7 days",
    "4weeks": "Last 4 weeks",
    "3months": "Last 3 months",
    "12months": "Last 12 months",
  };
  return { key, label: labels[key], from, to, days };
}

export interface PillarDetail {
  label: string;
  value: string;
  status: "good" | "ok" | "warning" | "bad";
  drilldown: string;
  weight: number; // 0-1, contribution to pillar score
  score: number;  // 0-100
}

export interface Pillar {
  key: "hygiene" | "premises" | "management";
  name: string;
  score: number;
  details: PillarDetail[];
}

export interface ReportData {
  range: ReportRange;
  siteName: string;
  orgName: string;
  pillars: Pillar[];
  overallScore: number;
  ratingEstimate: number;
  dataCompleteness: number;
  topFixes: { text: string; link: string; severity: "high" | "medium" | "low" }[];
  // Raw evidence tables for PDF
  tempLogs: any[];
  tempBreaches: any[];
  cleaningCompletionPct: number;
  cleaningTasksTotal: number;
  cleaningTasksDone: number;
  daySheets: any[];
  daySheetCompletionPct: number;
  daySheetsLockedPct: number;
  incidents: any[];
  openIncidents: number;
  deliveries: any[];
  deliveryAcceptPct: number;
  suppliers: any[];
  supplierApprovedPct: number;
  pestLogs: any[];
  openPestLogs: number;
  maintenanceLogs: any[];
  openMaintenance: number;
  ingredients: any[];
  recipes: any[];
  staffCount: number;
}

const pct = (n: number, d: number) => (d === 0 ? 100 : Math.round((n / d) * 100));
const status = (score: number): PillarDetail["status"] =>
  score >= 90 ? "good" : score >= 75 ? "ok" : score >= 50 ? "warning" : "bad";

export async function fetchReportData(siteId: string, orgId: string, range: ReportRange): Promise<ReportData> {
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();
  const fromDate = format(range.from, "yyyy-MM-dd");
  const toDate = format(range.to, "yyyy-MM-dd");

  // Parallel fetches
  const [
    siteRes, orgRes,
    tempRes, cleaningTasksRes, cleaningLogsRes,
    daySheetsRes, daySheetSectionsRes,
    incidentsRes, deliveriesRes, suppliersRes,
    pestRes, maintRes, ingredientsRes, recipesRes,
    membershipsRes,
  ] = await Promise.all([
    supabase.from("sites").select("name").eq("id", siteId).maybeSingle(),
    supabase.from("organisations").select("name").eq("id", orgId).maybeSingle(),
    supabase.from("temp_logs").select("*").eq("site_id", siteId).gte("logged_at", fromIso).lte("logged_at", toIso),
    supabase.from("cleaning_tasks").select("id, task, area, frequency, active").eq("site_id", siteId).eq("active", true),
    supabase.from("cleaning_logs").select("*").eq("site_id", siteId).gte("log_date", fromDate).lte("log_date", toDate),
    supabase.from("day_sheets").select("*").eq("site_id", siteId).gte("sheet_date", fromDate).lte("sheet_date", toDate),
    supabase.from("day_sheet_sections").select("id, day_sheet_items(id, active)").eq("site_id", siteId).eq("active", true),
    supabase.from("incidents").select("*").eq("site_id", siteId).gte("reported_at", fromIso).lte("reported_at", toIso),
    supabase.from("delivery_logs").select("*, suppliers(name)").eq("site_id", siteId).gte("logged_at", fromIso).lte("logged_at", toIso),
    supabase.from("suppliers").select("*").eq("site_id", siteId).eq("active", true),
    supabase.from("pest_logs").select("*").eq("site_id", siteId).gte("reported_at", fromIso).lte("reported_at", toIso),
    supabase.from("maintenance_logs").select("*").eq("site_id", siteId).gte("reported_at", fromIso).lte("reported_at", toIso),
    supabase.from("ingredients").select("*").eq("site_id", siteId).eq("active", true),
    supabase.from("recipes").select("*").eq("site_id", siteId).eq("active", true),
    supabase.from("memberships").select("id").eq("active", true).in("site_id", [siteId]),
  ]);

  const tempLogs = tempRes.data || [];
  const tempBreaches = tempLogs.filter(t => !t.pass);
  const cleaningTasks = cleaningTasksRes.data || [];
  const cleaningLogs = cleaningLogsRes.data || [];
  const daySheets = daySheetsRes.data || [];
  const sections = daySheetSectionsRes.data || [];
  const incidents = incidentsRes.data || [];
  const deliveries = deliveriesRes.data || [];
  const suppliers = suppliersRes.data || [];
  const pestLogs = pestRes.data || [];
  const maintenanceLogs = maintRes.data || [];
  const ingredients = ingredientsRes.data || [];
  const recipes = recipesRes.data || [];
  const memberships = membershipsRes.data || [];

  // === Day sheet completion ===
  // Each day in range (excluding closed days) should have a sheet; locked = better.
  const totalItemsPerSheet = sections.reduce((s, sec: any) => s + (sec.day_sheet_items?.filter((i: any) => i.active).length || 0), 0);
  const expectedSheets = Math.max(1, range.days);
  const daySheetsCreated = daySheets.length;
  const daySheetsLocked = daySheets.filter(d => d.locked).length;
  const daySheetCompletionPct = pct(daySheetsCreated, expectedSheets);
  const daySheetsLockedPct = daySheetsCreated === 0 ? 0 : pct(daySheetsLocked, daySheetsCreated);

  // === Cleaning completion ===
  // For daily tasks, expected = tasks * days. For weekly = tasks * (days/7), monthly = tasks * (days/30)
  const expectedCleaning = cleaningTasks.reduce((sum, t: any) => {
    const f = (t.frequency || "daily").toLowerCase();
    const mult = f === "daily" ? range.days : f === "weekly" ? Math.max(1, Math.round(range.days / 7)) : f === "monthly" ? Math.max(1, Math.round(range.days / 30)) : range.days;
    return sum + mult;
  }, 0);
  const cleaningDone = cleaningLogs.filter(l => l.done).length;
  const cleaningCompletionPct = expectedCleaning === 0 ? 100 : pct(cleaningDone, expectedCleaning);

  // === Temperature compliance ===
  const tempPassPct = tempLogs.length === 0 ? 0 : pct(tempLogs.filter(t => t.pass).length, tempLogs.length);
  const hasTempData = tempLogs.length > 0;

  // === Incidents ===
  const openIncidents = incidents.filter(i => i.status !== "closed" && i.status !== "verified").length;
  const incidentsResolvedPct = incidents.length === 0 ? 100 : pct(incidents.length - openIncidents, incidents.length);

  // === Deliveries ===
  const deliveryAcceptPct = deliveries.length === 0 ? 100 : pct(deliveries.filter(d => d.accepted).length, deliveries.length);

  // === Suppliers ===
  const supplierApprovedPct = suppliers.length === 0 ? 0 : pct(suppliers.filter(s => s.approved).length, suppliers.length);

  // === Pest / Maintenance ===
  const openPestLogs = pestLogs.filter(p => !p.resolved).length;
  const openMaintenance = maintenanceLogs.filter(m => m.status !== "resolved" && m.status !== "closed").length;

  // === Allergen coverage ===
  const recipesApprovedPct = recipes.length === 0 ? 0 : pct(recipes.filter(r => r.approved).length, recipes.length);

  // === Build Pillars ===
  const hygieneDetails: PillarDetail[] = [
    { label: "Daily day sheets created", value: `${daySheetsCreated}/${expectedSheets} (${daySheetCompletionPct}%)`, status: status(daySheetCompletionPct), drilldown: "/day-sheet", weight: 0.25, score: daySheetCompletionPct },
    { label: "Temperature checks pass rate", value: hasTempData ? `${tempPassPct}% (${tempLogs.length} logs)` : "No data", status: hasTempData ? status(tempPassPct) : "warning", drilldown: "/temperatures", weight: 0.3, score: hasTempData ? tempPassPct : 40 },
    { label: "Temperature breaches", value: `${tempBreaches.length}`, status: tempBreaches.length === 0 ? "good" : tempBreaches.length <= 2 ? "warning" : "bad", drilldown: "/temperatures", weight: 0.15, score: tempBreaches.length === 0 ? 100 : Math.max(0, 100 - tempBreaches.length * 15) },
    { label: "Allergen / recipe approvals", value: recipes.length === 0 ? "No recipes" : `${recipesApprovedPct}%`, status: status(recipesApprovedPct), drilldown: "/allergens", weight: 0.15, score: recipesApprovedPct },
    { label: "Delivery acceptance rate", value: deliveries.length === 0 ? "No deliveries" : `${deliveryAcceptPct}% (${deliveries.length})`, status: status(deliveryAcceptPct), drilldown: "/suppliers", weight: 0.15, score: deliveryAcceptPct },
  ];

  const premisesDetails: PillarDetail[] = [
    { label: "Cleaning task completion", value: `${cleaningCompletionPct}% (${cleaningDone}/${expectedCleaning})`, status: status(cleaningCompletionPct), drilldown: "/cleaning", weight: 0.4, score: cleaningCompletionPct },
    { label: "Open pest issues", value: `${openPestLogs}`, status: openPestLogs === 0 ? "good" : openPestLogs <= 1 ? "warning" : "bad", drilldown: "/pest-maintenance", weight: 0.25, score: openPestLogs === 0 ? 100 : Math.max(0, 100 - openPestLogs * 25) },
    { label: "Open maintenance issues", value: `${openMaintenance}`, status: openMaintenance === 0 ? "good" : openMaintenance <= 2 ? "warning" : "bad", drilldown: "/pest-maintenance", weight: 0.2, score: openMaintenance === 0 ? 100 : Math.max(0, 100 - openMaintenance * 15) },
    { label: "Active cleaning tasks defined", value: `${cleaningTasks.length}`, status: cleaningTasks.length >= 5 ? "good" : cleaningTasks.length >= 1 ? "ok" : "bad", drilldown: "/cleaning", weight: 0.15, score: cleaningTasks.length >= 5 ? 100 : cleaningTasks.length * 20 },
  ];

  const managementDetails: PillarDetail[] = [
    { label: "Day sheets locked by manager", value: `${daySheetsLocked}/${daySheetsCreated} (${daySheetsLockedPct}%)`, status: status(daySheetsLockedPct), drilldown: "/day-sheet", weight: 0.3, score: daySheetsLockedPct },
    { label: "Incidents with corrective action", value: incidents.length === 0 ? "No incidents" : `${incidentsResolvedPct}%`, status: status(incidentsResolvedPct), drilldown: "/incidents", weight: 0.25, score: incidentsResolvedPct },
    { label: "Suppliers approved", value: suppliers.length === 0 ? "No suppliers" : `${suppliers.filter(s => s.approved).length}/${suppliers.length} (${supplierApprovedPct}%)`, status: status(supplierApprovedPct), drilldown: "/suppliers", weight: 0.2, score: supplierApprovedPct },
    { label: "Active staff on site", value: `${memberships.length}`, status: memberships.length >= 2 ? "good" : memberships.length >= 1 ? "ok" : "bad", drilldown: "/settings", weight: 0.1, score: memberships.length >= 2 ? 100 : memberships.length * 50 },
    { label: "Recipes / HACCP records", value: `${recipes.length}`, status: recipes.length >= 3 ? "good" : recipes.length >= 1 ? "ok" : "warning", drilldown: "/allergens", weight: 0.15, score: recipes.length >= 3 ? 100 : recipes.length * 30 },
  ];

  const calcPillarScore = (details: PillarDetail[]) =>
    Math.round(details.reduce((sum, d) => sum + d.score * d.weight, 0));

  const pillars: Pillar[] = [
    { key: "hygiene", name: "Hygienic Handling of Food", score: calcPillarScore(hygieneDetails), details: hygieneDetails },
    { key: "premises", name: "Premises & Cleanliness", score: calcPillarScore(premisesDetails), details: premisesDetails },
    { key: "management", name: "Management Confidence", score: calcPillarScore(managementDetails), details: managementDetails },
  ];

  const overallScore = Math.round(pillars.reduce((s, p) => s + p.score, 0) / pillars.length);
  const ratingEstimate = overallScore >= 85 ? 5 : overallScore >= 70 ? 4 : overallScore >= 55 ? 3 : overallScore >= 40 ? 2 : overallScore >= 25 ? 1 : 0;

  // Data completeness: how many modules have at least some data this period
  const signals = [
    daySheetsCreated > 0,
    tempLogs.length > 0,
    cleaningLogs.length > 0,
    deliveries.length > 0,
    suppliers.length > 0,
    recipes.length > 0,
    cleaningTasks.length > 0,
    sections.length > 0,
  ];
  const dataCompleteness = pct(signals.filter(Boolean).length, signals.length);

  // Top fixes — pick worst details across all pillars
  const allDetails = pillars.flatMap(p => p.details.map(d => ({ ...d, pillar: p.name })));
  const topFixes = allDetails
    .filter(d => d.status === "bad" || d.status === "warning")
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map(d => ({
      text: `${d.label}: ${d.value}`,
      link: d.drilldown,
      severity: (d.status === "bad" ? "high" : d.score < 60 ? "medium" : "low") as "high" | "medium" | "low",
    }));

  return {
    range,
    siteName: siteRes.data?.name || "Site",
    orgName: orgRes.data?.name || "Organisation",
    pillars,
    overallScore,
    ratingEstimate,
    dataCompleteness,
    topFixes,
    tempLogs,
    tempBreaches,
    cleaningCompletionPct,
    cleaningTasksTotal: expectedCleaning,
    cleaningTasksDone: cleaningDone,
    daySheets,
    daySheetCompletionPct,
    daySheetsLockedPct,
    incidents,
    openIncidents,
    deliveries,
    deliveryAcceptPct,
    suppliers,
    supplierApprovedPct,
    pestLogs,
    openPestLogs,
    maintenanceLogs,
    openMaintenance,
    ingredients,
    recipes,
    staffCount: memberships.length,
  };
}
