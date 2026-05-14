import * as XLSX from "xlsx";
import { eachDayOfInterval, format, parseISO } from "date-fns";
import type { ReportData } from "./reports";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function col(worksheet: XLSX.WorkSheet, col: string, width: number) {
  if (!worksheet["!cols"]) worksheet["!cols"] = [];
  const idx = XLSX.utils.decode_col(col);
  worksheet["!cols"][idx] = { wch: width };
}

function setColWidths(ws: XLSX.WorkSheet, widths: number[]) {
  ws["!cols"] = widths.map((w) => ({ wch: w }));
}

function headerRow(values: string[]): XLSX.CellObject[] {
  return values.map((v) => ({
    v,
    t: "s",
    s: {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "1A1A2E" } },
      alignment: { horizontal: "center" },
    },
  }));
}

function scoreCell(value: number): XLSX.CellObject {
  const color =
    value >= 80 ? "16A34A" : value >= 60 ? "D97706" : "DC2626";
  return {
    v: `${value}%`,
    t: "s",
    s: { font: { bold: true, color: { rgb: color } } },
  };
}

function passCell(pass: boolean): XLSX.CellObject {
  return {
    v: pass ? "PASS" : "FAIL",
    t: "s",
    s: {
      font: { bold: true, color: { rgb: pass ? "16A34A" : "DC2626" } },
    },
  };
}

// ─── Sheet builders ───────────────────────────────────────────────────────────

function buildOverviewSheet(data: ReportData): XLSX.WorkSheet {
  const readinessLabel =
    data.readiness === "green" ? "READY" : data.readiness === "amber" ? "PARTIAL READINESS" : "ACTION REQUIRED";
  const rows: any[][] = [
    ["MiseOS — EHO Inspection Pack — Overview"],
    [],
    ["Business", data.orgName],
    ["Site", data.siteName],
    ["Reporting period", `${format(data.range.from, "d MMM yyyy")} – ${format(data.range.to, "d MMM yyyy")} (${data.range.days} days)`],
    ["Generated", format(new Date(data.generatedAt), "d MMM yyyy HH:mm")],
    ["Inspection readiness", readinessLabel],
    [],
    ["EXECUTIVE SUMMARY"],
    ["Metric", "Value"],
    ["Overall compliance", `${data.overallScore}%`],
    ["Estimated FHRS", `${data.ratingEstimate} / 5`],
    ["Data completeness", `${data.dataCompleteness}%`],
    ["High-risk events", `${data.highRiskBreaches}`],
    ["Closed days excluded", `${data.closedDaysCount}`],
    [],
    ["FHRS-ALIGNED BREAKDOWN"],
    ["Area", "Score", "Status"],
    ...data.pillars.map((p) => {
      const label = p.key === "hygiene" ? "Food Handling Controls"
        : p.key === "premises" ? "Premises & Structure"
        : "Confidence in Management";
      return [label, `${p.score}%`, p.score >= 80 ? "Good" : p.score >= 60 ? "Improvement needed" : "Action required"];
    }),
    [],
    ["TOP ISSUES DETECTED"],
    ["#", "Issue", "Severity"],
    ...data.topFixes.map((f, i) => [i + 1, f.text, f.severity.toUpperCase()]),
    ...(data.topFixes.length === 0 ? [["—", "No issues detected", ""]] : []),
    [],
    ["TOP STRENGTHS"],
    ["#", "Strength"],
    ...data.topStrengths.map((s, i) => [i + 1, s.text]),
    ...(data.topStrengths.length === 0 ? [["—", "No data"]] : []),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [32, 40, 20]);
  return ws;
}

function buildEvidenceIndexSheet(): XLSX.WorkSheet {
  const rows: any[][] = [
    ["Evidence Index"],
    ["Each evidence area below is documented in its own worksheet."],
    [],
    ["Area", "Worksheet"],
    ["Daily Controls — Day Sheets", "Day Sheets"],
    ["Daily Controls — Temperature", "Temperature Logs"],
    ["Daily Controls — Cleaning", "Cleaning"],
    ["Deliveries & Supplier Controls", "Deliveries"],
    ["Approved Supplier List", "Suppliers"],
    ["Allergens & PPDS Labelling", "Allergen Matrix"],
    ["Incidents & Corrective Actions", "Incidents"],
    ["Pest, Maintenance & PPM", "Pest & Maintenance / PPM"],
    ["Staff Training & Competence", "Training"],
    ["HACCP Plan", "HACCP"],
    ["Waste & Continuous Improvement", "Waste"],
    ["Workplace Safety Addendum", "Workplace Safety"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [40, 26]);
  return ws;
}

function buildTemperatureSheet(data: ReportData): XLSX.WorkSheet {
  const rows: any[][] = [
    ["Temperature Logs"],
    [`Period: ${data.range.label}`],
    [],
    ["Date", "Time", "Unit / Food Item", "Check Type", "Temperature (°C)", "Result", "Logged By", "Corrective Action"],
  ];

  for (const log of data.tempLogs) {
    const dt = new Date(log.logged_at);
    const unitName = log.temp_units?.name || log.food_item || "—";
    rows.push([
      format(dt, "dd/MM/yyyy"),
      format(dt, "HH:mm"),
      unitName,
      log.log_type || "—",
      Number(log.value),
      log.pass ? "PASS" : "FAIL",
      log.logged_by_name || "—",
      log.corrective_action || "",
    ]);
  }

  if (data.tempLogs.length === 0) rows.push(["No temperature logs in this period."]);

  rows.push([], ["SUMMARY"], ["Total logs", data.tempLogs.length], ["Breaches", data.tempBreaches.length]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [14, 8, 24, 16, 18, 8, 20, 36]);
  return ws;
}

function buildDaySheetSheet(data: ReportData): XLSX.WorkSheet {
  const rows: any[][] = [
    ["Day Sheet Records"],
    [`Period: ${data.range.label}`],
    [`Completion: ${data.daySheetCompletionPct}% (closed days excluded)`],
    [],
    ["Date", "Status", "Locked", "Locked By", "Locked At", "Problem Notes", "Manager Note"],
  ];

  for (const ds of data.daySheets) {
    rows.push([
      ds.sheet_date ? format(new Date(ds.sheet_date), "dd/MM/yyyy") : "—",
      ds.locked ? "Locked" : "Open",
      ds.locked ? "Yes" : "No",
      ds.locked_by_name || "—",
      ds.locked_at ? format(new Date(ds.locked_at), "dd/MM/yyyy HH:mm") : "—",
      ds.problem_notes || "",
      ds.manager_note || "",
    ]);
  }

  if (data.daySheets.length === 0) rows.push(["No day sheet records in this period."]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [14, 12, 8, 20, 20, 40, 40]);
  return ws;
}

function buildCleaningSheet(data: ReportData): XLSX.WorkSheet {
  const rows: any[][] = [
    ["Cleaning Schedule Compliance"],
    [`Period: ${data.range.label}`],
    [`Completion: ${data.cleaningTasksDone} of ${data.cleaningTasksTotal} scheduled tasks completed`],
    [],
    ["Date", "Task", "Area", "Frequency", "Status", "Completed By", "Completed At"],
  ];

  const tasks = (data as any).cleaningTasks || [];
  const logs = (data as any).cleaningLogs || [];
  const closedSet = new Set(((data as any).closedDays || []).map((c: any) => c.closed_date));
  const taskById = new Map<string, any>(tasks.map((t: any) => [t.id, t]));

  // Generate ALL dates in the report period for daily tasks
  const allDates = eachDayOfInterval({ start: data.range.from, end: data.range.to }).map((d) => format(d, "yyyy-MM-dd"));
  const dailyTasks = tasks.filter((t: any) => (t.frequency || "daily").toLowerCase() === "daily");

  if (allDates.length > 0 && dailyTasks.length > 0) {
    for (const date of allDates) {
      const isClosed = closedSet.has(date);
      const dateLogs = logs.filter((l: any) => l.log_date === date);
      for (const task of dailyTasks) {
        const log = dateLogs.find((l: any) => l.task_id === task.id);
        let status: string;
        if (isClosed) status = "Exempt";
        else if (log?.done) status = "Done";
        else status = "Missed";
        rows.push([
          format(parseISO(date), "dd/MM/yyyy"),
          task.task || "—",
          task.area || "—",
          task.frequency || "daily",
          status,
          log?.completed_by_name || "—",
          log?.completed_at ? format(new Date(log.completed_at), "dd/MM/yyyy HH:mm") : "—",
        ]);
      }
    }
  } else if (logs.length > 0) {
    for (const log of logs) {
      const task = taskById.get(log.task_id);
      rows.push([
        log.log_date ? format(parseISO(log.log_date), "dd/MM/yyyy") : "—",
        task?.task || "—",
        task?.area || "—",
        task?.frequency || "daily",
        closedSet.has(log.log_date) ? "Exempt" : log.done ? "Done" : "Missed",
        log.completed_by_name || "—",
        log.completed_at ? format(new Date(log.completed_at), "dd/MM/yyyy HH:mm") : "—",
      ]);
    }
  } else {
    rows.push(["No cleaning log activity in this period."]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [14, 32, 20, 12, 10, 20, 20]);
  return ws;
}

function buildIncidentsSheet(data: ReportData): XLSX.WorkSheet {
  const rows: any[][] = [
    ["Incident Register"],
    [`Period: ${data.range.label}`],
    [`Total: ${data.incidents.length} incidents · ${data.openIncidents} open`],
    [],
    ["Date", "Type", "Title", "Description", "Immediate Action", "Root Cause", "Prevention", "Status", "Reported By"],
  ];

  for (const inc of data.incidents) {
    rows.push([
      inc.occurred_at ? format(new Date(inc.occurred_at), "dd/MM/yyyy") : "—",
      inc.incident_type || "—",
      inc.title || "—",
      inc.description || "",
      inc.immediate_action || "",
      inc.root_cause || "",
      inc.prevention || "",
      inc.status || "open",
      inc.reported_by_name || "—",
    ]);
  }

  if (data.incidents.length === 0) rows.push(["No incidents recorded in this period."]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [14, 18, 28, 40, 36, 36, 36, 12, 20]);
  return ws;
}

function buildDeliveriesSheet(data: ReportData): XLSX.WorkSheet {
  const rows: any[][] = [
    ["Delivery Records"],
    [`Period: ${data.range.label}`],
    [`Total: ${data.deliveries.length} deliveries · Acceptance rate: ${data.deliveryAcceptPct}%`],
    [],
    ["Date", "Supplier", "Items", "Temperature (°C)", "Packaging", "Accepted", "Rejected Reason", "Logged By"],
  ];

  for (const d of data.deliveries) {
    rows.push([
      d.delivery_date ? format(new Date(d.delivery_date), "dd/MM/yyyy") : "—",
      d.supplier_name || d.supplier || "—",
      d.items_received || "",
      d.temperature != null ? Number(d.temperature) : "—",
      d.packaging_condition || "—",
      d.accepted === false ? "No" : "Yes",
      d.rejection_reason || "",
      d.logged_by_name || "—",
    ]);
  }

  if (data.deliveries.length === 0) rows.push(["No deliveries recorded in this period."]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [14, 24, 32, 16, 18, 10, 32, 20]);
  return ws;
}

function buildPestSheet(data: ReportData): XLSX.WorkSheet {
  const rows: any[][] = [
    ["Pest & Maintenance Log"],
    [`Period: ${data.range.label}`],
    [],
    ["PEST SIGHTINGS"],
    ["Date", "Type", "Location", "Description", "Action Taken", "Resolved", "Reported By"],
  ];

  for (const p of data.pestLogs) {
    rows.push([
      p.reported_at ? format(new Date(p.reported_at), "dd/MM/yyyy") : "—",
      p.type || "—",
      p.location || "—",
      p.description || "",
      p.action_taken || "",
      p.resolved ? "Yes" : "No",
      p.reported_by_name || "—",
    ]);
  }

  if (data.pestLogs.length === 0) rows.push(["No pest sightings in this period."]);

  rows.push([], ["MAINTENANCE ISSUES"], ["Date", "Item", "Issue", "Priority", "Status", "Resolution", "Reported By"]);

  for (const m of data.maintenanceLogs) {
    rows.push([
      m.reported_at ? format(new Date(m.reported_at), "dd/MM/yyyy") : "—",
      m.item || "—",
      m.issue || "",
      m.priority || "—",
      m.status || "open",
      m.resolution || "",
      m.reported_by_name || "—",
    ]);
  }

  if (data.maintenanceLogs.length === 0) rows.push(["No maintenance issues in this period."]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [14, 20, 20, 32, 32, 12, 32, 20]);
  return ws;
}

function buildSuppliersSheet(data: ReportData): XLSX.WorkSheet {
  const rows: any[][] = [
    ["Approved Supplier List"],
    [`Generated: ${format(new Date(), "d MMM yyyy")}`],
    [`Total: ${data.suppliers.length} suppliers · ${data.supplierApprovedPct}% approved`],
    [],
    ["Supplier Name", "Category", "Contact", "Approved", "Notes"],
  ];

  for (const s of data.suppliers) {
    rows.push([
      s.name || "—",
      s.category || "—",
      s.contact || "",
      s.approved ? "Yes" : "No",
      s.notes || "",
    ]);
  }

  if (data.suppliers.length === 0) rows.push(["No suppliers configured."]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [28, 20, 28, 10, 40]);
  return ws;
}

function buildAllergensSheet(data: ReportData): XLSX.WorkSheet {
  const ALLERGENS = [
    "celery", "cereals_gluten", "crustaceans", "eggs", "fish",
    "lupin", "milk", "molluscs", "mustard", "nuts",
    "peanuts", "sesame", "soya", "sulphites",
  ];

  const ALLERGEN_LABELS: Record<string, string> = {
    celery: "Celery",
    cereals_gluten: "Cereals/Gluten",
    crustaceans: "Crustaceans",
    eggs: "Eggs",
    fish: "Fish",
    lupin: "Lupin",
    milk: "Milk",
    molluscs: "Molluscs",
    mustard: "Mustard",
    nuts: "Tree Nuts",
    peanuts: "Peanuts",
    sesame: "Sesame",
    soya: "Soya",
    sulphites: "Sulphites",
  };

  const rows: any[][] = [
    ["Allergen Matrix"],
    [`Generated: ${format(new Date(), "d MMM yyyy")}`],
    [],
    ["Recipe / Product", ...ALLERGENS.map((a) => ALLERGEN_LABELS[a])],
  ];

  for (const recipe of data.recipes) {
    const ingredientAllergens = new Set<string>();
    for (const ri of recipe.recipe_ingredients || []) {
      const ing = ri.ingredients;
      if (!ing) continue;
      for (const allergen of ALLERGENS) {
        if (ing[allergen]) ingredientAllergens.add(allergen);
      }
    }
    rows.push([
      recipe.name,
      ...ALLERGENS.map((a) => (ingredientAllergens.has(a) ? "●" : "")),
    ]);
  }

  if (data.recipes.length === 0) rows.push(["No recipes configured."]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [28, ...ALLERGENS.map(() => 14)]);
  return ws;
}

// ─── AI assessment sheet ─────────────────────────────────────────────────────

function buildAiAssessmentSheet(narrative: string): XLSX.WorkSheet {
  const rows: any[][] = [
    [{ v: "AI Compliance Assessment", t: "s", s: { font: { bold: true, sz: 14 } } }],
    ["Generated:", format(new Date(), "dd/MM/yyyy")],
    [],
  ];
  narrative.split(/\n/).forEach((line) => rows.push([line]));
  rows.push([]);
  rows.push([
    "This assessment was generated by AI based on the compliance data in this report. It is provided as a management support tool and does not replace professional food safety advice or an official EHO inspection.",
  ]);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [120]);
  return ws;
}

// ─── Main export function ─────────────────────────────────────────────────────

export function generateInspectionPackExcel(data: ReportData, aiNarrative?: string) {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, buildSummarySheet(data), "Summary");
  if (aiNarrative && aiNarrative.trim().length > 0) {
    XLSX.utils.book_append_sheet(wb, buildAiAssessmentSheet(aiNarrative), "AI Assessment");
  }
  XLSX.utils.book_append_sheet(wb, buildTemperatureSheet(data), "Temperature Logs");
  XLSX.utils.book_append_sheet(wb, buildDaySheetSheet(data), "Day Sheets");
  XLSX.utils.book_append_sheet(wb, buildCleaningSheet(data), "Cleaning");
  XLSX.utils.book_append_sheet(wb, buildIncidentsSheet(data), "Incidents");
  XLSX.utils.book_append_sheet(wb, buildDeliveriesSheet(data), "Deliveries");
  XLSX.utils.book_append_sheet(wb, buildPestSheet(data), "Pest & Maintenance");
  XLSX.utils.book_append_sheet(wb, buildSuppliersSheet(data), "Suppliers");
  XLSX.utils.book_append_sheet(wb, buildAllergensSheet(data), "Allergen Matrix");

  const filename = `MiseOS_Inspection_Pack_${data.siteName.replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
  XLSX.writeFile(wb, filename);
}
