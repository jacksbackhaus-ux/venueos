import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import type { ReportData } from "./reports";

const BRAND = { primary: [37, 99, 235] as [number, number, number], success: [22, 163, 74] as [number, number, number], warn: [217, 119, 6] as [number, number, number], bad: [220, 38, 38] as [number, number, number], muted: [100, 116, 139] as [number, number, number] };

const scoreColor = (s: number): [number, number, number] =>
  s >= 80 ? BRAND.success : s >= 60 ? BRAND.warn : BRAND.bad;

function header(doc: jsPDF, data: ReportData, pageTitle: string) {
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`${data.orgName} — ${data.siteName}`, 14, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(pageTitle, doc.internal.pageSize.getWidth() - 14, 11, { align: "right" });
  doc.setTextColor(0, 0, 0);
}

function footer(doc: jsPDF, data: ReportData) {
  const pageCount = (doc as any).internal.getNumberOfPages();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.muted);
    doc.text(
      `Generated ${format(new Date(), "d MMM yyyy HH:mm")} • ${data.range.label} • Page ${i} of ${pageCount}`,
      pw / 2, ph - 8, { align: "center" }
    );
    doc.setTextColor(0, 0, 0);
  }
}

export function generateInspectionPackPdf(data: ReportData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const margin = 14;

  // ====== COVER ======
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, 0, pw, 60, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Food Safety Inspection Pack", margin, 30);
  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.orgName} — ${data.siteName}`, margin, 42);
  doc.setFontSize(10);
  doc.text(`Reporting period: ${format(data.range.from, "d MMM yyyy")} – ${format(data.range.to, "d MMM yyyy")}`, margin, 50);
  doc.setTextColor(0, 0, 0);

  // Headline stats
  let y = 75;
  doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text("At a Glance", margin, y); y += 8;

  const cardW = (pw - margin * 2 - 8) / 3;
  const cards = [
    { label: "Overall Compliance", value: `${data.overallScore}%`, color: scoreColor(data.overallScore) },
    { label: "Estimated Rating", value: `${data.ratingEstimate} / 5`, color: scoreColor(data.overallScore) },
    { label: "Data Completeness", value: `${data.dataCompleteness}%`, color: scoreColor(data.dataCompleteness) },
  ];
  cards.forEach((c, i) => {
    const x = margin + i * (cardW + 4);
    doc.setDrawColor(220); doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, cardW, 28, 2, 2, "FD");
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(...BRAND.muted);
    doc.text(c.label, x + 4, y + 8);
    doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(...c.color);
    doc.text(c.value, x + 4, y + 22);
    doc.setTextColor(0, 0, 0);
  });
  y += 38;

  // Pillars
  doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(0, 0, 0);
  doc.text("Three FSA Pillars", margin, y); y += 6;
  autoTable(doc, {
    startY: y,
    head: [["Pillar", "Score", "Status"]],
    body: data.pillars.map(p => [p.name, `${p.score}%`, p.score >= 80 ? "Good" : p.score >= 60 ? "Improvement needed" : "Action required"]),
    headStyles: { fillColor: BRAND.primary, textColor: 255 },
    styles: { fontSize: 10, cellPadding: 3 },
    margin: { left: margin, right: margin },
    didParseCell: (hookData) => {
      if (hookData.section === "body" && hookData.column.index === 1) {
        const s = data.pillars[hookData.row.index].score;
        hookData.cell.styles.textColor = scoreColor(s);
        hookData.cell.styles.fontStyle = "bold";
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Top fixes
  if (data.topFixes.length) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("Priority Actions", margin, y); y += 4;
    autoTable(doc, {
      startY: y,
      head: [["#", "Action", "Severity"]],
      body: data.topFixes.map((f, i) => [String(i + 1), f.text, f.severity.toUpperCase()]),
      headStyles: { fillColor: BRAND.primary, textColor: 255 },
      styles: { fontSize: 9, cellPadding: 2.5 },
      margin: { left: margin, right: margin },
      didParseCell: (hookData) => {
        if (hookData.section === "body" && hookData.column.index === 2) {
          const sev = data.topFixes[hookData.row.index].severity;
          hookData.cell.styles.textColor = sev === "high" ? BRAND.bad : sev === "medium" ? BRAND.warn : BRAND.muted;
          hookData.cell.styles.fontStyle = "bold";
        }
      },
    });
  }

  // Disclaimer
  doc.addPage(); header(doc, data, "Disclaimer & Methodology");
  let yy = 28;
  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text("About this report", margin, yy); yy += 7;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  const disclaimer = [
    "This Inspection Pack is generated from records logged in the food safety management system for the period above.",
    "",
    "The estimated Food Hygiene Rating (0–5) is an indicator only, derived from the records present in this app. The actual rating awarded by the local authority Environmental Health Officer (EHO) may differ — it depends on physical inspection, observed practices, documentary evidence beyond this app, and officer discretion.",
    "",
    "Pillar scoring follows the FSA's three areas of assessment (Hygiene, Structural / Cleanliness, Management Confidence). Within each pillar, weighted indicators are computed from completion rates, breach counts, and approval status across the relevant modules.",
    "",
    "This report is intended to (a) support EHO inspections by collating evidence in one place, and (b) give the business an internal compliance overview to identify and resolve issues proactively.",
  ];
  disclaimer.forEach(line => {
    const lines = doc.splitTextToSize(line, pw - margin * 2);
    doc.text(lines, margin, yy);
    yy += lines.length * 5 + 1;
  });

  // ====== EVIDENCE TABLES ======
  const addEvidence = (title: string, head: string[][], body: any[][], summary?: string) => {
    doc.addPage(); header(doc, data, title);
    let cy = 28;
    doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text(title, margin, cy); cy += 6;
    if (summary) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...BRAND.muted);
      const lines = doc.splitTextToSize(summary, pw - margin * 2);
      doc.text(lines, margin, cy); cy += lines.length * 5 + 2;
      doc.setTextColor(0, 0, 0);
    }
    if (body.length === 0) {
      doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.setTextColor(...BRAND.muted);
      doc.text("No records in this period.", margin, cy + 4);
      doc.setTextColor(0, 0, 0);
      return;
    }
    autoTable(doc, {
      startY: cy,
      head, body,
      headStyles: { fillColor: BRAND.primary, textColor: 255, fontSize: 9 },
      styles: { fontSize: 8.5, cellPadding: 2, overflow: "linebreak" },
      margin: { left: margin, right: margin },
    });
  };

  // Day sheets
  addEvidence(
    "Daily Records (Day Sheets)",
    [["Date", "Created", "Locked", "Locked at", "Manager note"]],
    data.daySheets
      .sort((a, b) => (a.sheet_date < b.sheet_date ? 1 : -1))
      .map(d => [
        d.sheet_date,
        "Yes",
        d.locked ? "Yes" : "No",
        d.locked_at ? format(new Date(d.locked_at), "d MMM HH:mm") : "—",
        (d.manager_note || d.problem_notes || "—").slice(0, 80),
      ]),
    `${data.daySheets.length} day sheets created • ${data.daySheetCompletionPct}% completion vs expected • ${data.daySheetsLockedPct}% locked by a manager.`
  );

  // Temperature logs
  addEvidence(
    "Temperature Records",
    [["Logged at", "Type", "Item / Unit", "Reading °C", "Pass", "Corrective action"]],
    data.tempLogs
      .sort((a, b) => (a.logged_at < b.logged_at ? 1 : -1))
      .slice(0, 200)
      .map(t => [
        format(new Date(t.logged_at), "d MMM HH:mm"),
        t.log_type || "—",
        t.food_item || t.unit_id?.slice(0, 8) || "—",
        `${t.value}°C`,
        t.pass ? "PASS" : "FAIL",
        (t.corrective_action || "—").slice(0, 60),
      ]),
    `${data.tempLogs.length} readings • ${data.tempBreaches.length} breach(es) requiring corrective action.${data.tempLogs.length > 200 ? " Showing latest 200." : ""}`
  );

  // Cleaning
  addEvidence(
    "Cleaning Schedule Compliance",
    [["Period summary", "Value"]],
    [
      ["Active cleaning tasks", `${data.cleaningTasksTotal > 0 ? "configured" : "0"}`],
      ["Tasks completed in period", String(data.cleaningTasksDone)],
      ["Expected completions", String(data.cleaningTasksTotal)],
      ["Completion rate", `${data.cleaningCompletionPct}%`],
    ],
    "Based on configured cleaning tasks and their frequency. Completion logs are stored against each task and date."
  );

  // Incidents
  addEvidence(
    "Incident Register",
    [["Reported", "Type", "Title", "Status", "Immediate action"]],
    data.incidents
      .sort((a, b) => (a.reported_at < b.reported_at ? 1 : -1))
      .map(i => [
        format(new Date(i.reported_at), "d MMM yyyy"),
        i.type,
        (i.title || "").slice(0, 40),
        i.status,
        (i.immediate_action || "—").slice(0, 60),
      ]),
    `${data.incidents.length} incident(s) recorded • ${data.openIncidents} still open.`
  );

  // Deliveries
  addEvidence(
    "Delivery Records",
    [["Date", "Supplier", "Items", "Temp °C", "Use-by OK", "Accepted"]],
    data.deliveries
      .sort((a, b) => (a.logged_at < b.logged_at ? 1 : -1))
      .slice(0, 150)
      .map(d => [
        format(new Date(d.logged_at), "d MMM"),
        d.suppliers?.name || "—",
        (d.items || "").slice(0, 40),
        d.temp != null ? `${d.temp}°C` : "—",
        d.use_by_ok ? "Yes" : "No",
        d.accepted ? "Yes" : "REJECTED",
      ]),
    `${data.deliveries.length} deliveries • ${data.deliveryAcceptPct}% accepted.`
  );

  // Suppliers
  addEvidence(
    "Approved Supplier List",
    [["Name", "Category", "Contact", "Approved"]],
    data.suppliers.map(s => [
      s.name,
      s.category || "—",
      s.contact_name || s.contact_email || s.contact_phone || "—",
      s.approved ? "Yes" : "PENDING",
    ]),
    `${data.suppliers.length} active suppliers • ${data.supplierApprovedPct}% approved.`
  );

  // Pest & maintenance
  addEvidence(
    "Pest Control Log",
    [["Reported", "Type", "Location", "Action taken", "Resolved"]],
    data.pestLogs.map(p => [
      format(new Date(p.reported_at), "d MMM yyyy"),
      p.type, p.location,
      (p.action_taken || "").slice(0, 60),
      p.resolved ? "Yes" : "Open",
    ]),
    `${data.pestLogs.length} entries • ${data.openPestLogs} open.`
  );

  addEvidence(
    "Maintenance Log",
    [["Reported", "Item", "Issue", "Priority", "Status"]],
    data.maintenanceLogs.map(m => [
      format(new Date(m.reported_at), "d MMM yyyy"),
      m.item, (m.issue || "").slice(0, 40), m.priority, m.status,
    ]),
    `${data.maintenanceLogs.length} entries • ${data.openMaintenance} open.`
  );

  // Allergens / recipes
  addEvidence(
    "Allergen Matrix (Recipes)",
    [["Recipe", "Category", "Approved", "Last reviewed"]],
    data.recipes.map(r => [
      r.name, r.category || "—",
      r.approved ? "Yes" : "No",
      r.last_reviewed_at ? format(new Date(r.last_reviewed_at), "d MMM yyyy") : "—",
    ]),
    `${data.recipes.length} active recipes • ${data.ingredients.length} ingredients tracked.`
  );

  // Cost & Margin (only when authorised caller passed includeCostMargin)
  if (data.costMargin && data.costMargin.recipes.length > 0) {
    const cm = data.costMargin;
    addEvidence(
      "Cost & Margin Summary",
      [["Recipe", "Cost/unit", "Recommended", "Current", "Margin %", "Target %"]],
      cm.recipes.map(r => [
        r.name,
        `£${r.costPerUnit.toFixed(3)}`,
        `£${r.recommendedSellExVat.toFixed(2)}`,
        r.currentSellExVat != null ? `£${r.currentSellExVat.toFixed(2)}` : "—",
        r.marginPct != null ? `${r.marginPct.toFixed(1)}%` : "—",
        `${r.targetMarginPct.toFixed(0)}%`,
      ]),
      `${cm.recipes.length} recipes • Avg margin ${cm.averageMarginPct != null ? cm.averageMarginPct.toFixed(1) + "%" : "—"} • ${cm.recipesBelowTarget} below target • ${cm.recipesMissingPrice} without a sell price.`
    );
  }

  footer(doc, data);
  doc.save(`Inspection-Pack_${data.siteName.replace(/\s+/g, "-")}_${format(new Date(), "yyyy-MM-dd")}.pdf`);
}
