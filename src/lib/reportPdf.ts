import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import type { ReportData } from "./reports";

export interface PdfBranding {
  primary?: string;        // hex e.g. "#2563EB"
  secondary?: string;
  businessName?: string;   // overrides org name in header chip
  logoDataUrl?: string;    // base64 data URL of logo
}

const DEFAULT_BRAND = {
  primary: [37, 99, 235] as [number, number, number],
  secondary: [245, 158, 11] as [number, number, number],
  success: [22, 163, 74] as [number, number, number],
  warn: [217, 119, 6] as [number, number, number],
  bad: [220, 38, 38] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
};

function hexToRgb(hex?: string): [number, number, number] | null {
  if (!hex) return null;
  const c = hex.replace("#", "");
  if (c.length !== 6) return null;
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

const sevColor = (b: typeof DEFAULT_BRAND, sev: "high" | "medium" | "low") =>
  sev === "high" ? b.bad : sev === "medium" ? b.warn : b.muted;

const readinessColor = (b: typeof DEFAULT_BRAND, r: "green" | "amber" | "red") =>
  r === "green" ? b.success : r === "amber" ? b.warn : b.bad;

const readinessLabel = (r: "green" | "amber" | "red") =>
  r === "green" ? "READY" : r === "amber" ? "PARTIAL READINESS" : "ACTION REQUIRED";

export function generateInspectionPackPdf(
  data: ReportData,
  aiNarrative?: string,
  branding?: PdfBranding,
) {
  const BRAND = { ...DEFAULT_BRAND };
  const primary = hexToRgb(branding?.primary);
  if (primary) BRAND.primary = primary;
  const secondary = hexToRgb(branding?.secondary);
  if (secondary) BRAND.secondary = secondary;

  const businessName = branding?.businessName?.trim() || data.orgName;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 14;

  const scoreColor = (s: number): [number, number, number] =>
    s >= 80 ? BRAND.success : s >= 60 ? BRAND.warn : BRAND.bad;

  function header(pageTitle: string) {
    doc.setFillColor(...BRAND.primary);
    doc.rect(0, 0, pw, 18, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`${businessName} — ${data.siteName}`, 14, 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(pageTitle, pw - 14, 11, { align: "right" });
    doc.setTextColor(0, 0, 0);
  }

  function footer() {
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(...BRAND.muted);
      doc.text(
        `Generated ${format(new Date(data.generatedAt), "d MMM yyyy HH:mm")} • ${data.range.label} • Page ${i} of ${pageCount}`,
        pw / 2, ph - 8, { align: "center" }
      );
      doc.setTextColor(0, 0, 0);
    }
  }

  // ====== COVER ======
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, 0, pw, 70, "F");

  // Logo (top-left, white tile)
  if (branding?.logoDataUrl) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin, 12, 28, 28, 2, 2, "F");
      doc.addImage(branding.logoDataUrl, "PNG", margin + 2, 14, 24, 24, undefined, "FAST");
    } catch { /* ignore broken logo */ }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  const titleX = branding?.logoDataUrl ? margin + 34 : margin;
  doc.text("EHO Inspection Pack", titleX, 28);
  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.text(`${businessName} — ${data.siteName}`, titleX, 40);
  doc.setFontSize(10);
  doc.text(
    `Reporting period: ${format(data.range.from, "d MMM yyyy")} – ${format(data.range.to, "d MMM yyyy")}`,
    titleX, 48
  );
  doc.text(`Generated: ${format(new Date(data.generatedAt), "d MMM yyyy 'at' HH:mm")}`, titleX, 55);
  doc.setTextColor(0, 0, 0);

  // Statement of source
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.muted);
  doc.text(
    "This pack is generated from operational records captured in MiseOS for the period above.",
    margin, 78,
  );
  doc.setTextColor(0, 0, 0);

  // Inspection readiness traffic light
  let y = 90;
  doc.setFillColor(...readinessColor(BRAND, data.readiness));
  doc.roundedRect(margin, y, pw - margin * 2, 18, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`Inspection readiness: ${readinessLabel(data.readiness)}`, margin + 6, y + 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Overall ${data.overallScore}% • Est. FHRS ${data.ratingEstimate}/5 • ${data.highRiskBreaches} high-risk events`,
    pw - margin - 6, y + 11, { align: "right" }
  );
  doc.setTextColor(0, 0, 0);
  y += 26;

  // What EHOs look for (brief, not legal advice)
  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text("What EHOs look for", margin, y); y += 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
  const explainer = [
    "1. Hygienic handling of food — preparation, cooking, reheating, cooling and storage controls.",
    "2. Premises & structure — cleanliness, layout, ventilation and pest control.",
    "3. Confidence in management — documented processes, training records and management oversight.",
    "",
    "This pack is structured around those three areas and presents the records held in MiseOS that evidence each. It is provided as guidance and does not replace official EHO inspection judgement.",
  ];
  explainer.forEach((line) => {
    const lines = doc.splitTextToSize(line, pw - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 4.5 + 1;
  });

  // ====== EXECUTIVE SUMMARY PAGE ======
  doc.addPage(); header("Executive Summary");
  let ey = 28;
  doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.text("Executive Summary", margin, ey); ey += 8;

  // 3 KPI cards
  const cardW = (pw - margin * 2 - 8) / 3;
  const cards = [
    { label: "Overall Compliance", value: `${data.overallScore}%`, color: scoreColor(data.overallScore) },
    { label: "Estimated FHRS", value: `${data.ratingEstimate} / 5`, color: scoreColor(data.overallScore) },
    { label: "Data Completeness", value: `${data.dataCompleteness}%`, color: scoreColor(data.dataCompleteness) },
  ];
  cards.forEach((c, i) => {
    const x = margin + i * (cardW + 4);
    doc.setDrawColor(220); doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, ey, cardW, 24, 2, 2, "FD");
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(...BRAND.muted);
    doc.text(c.label, x + 4, ey + 8);
    doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...c.color);
    doc.text(c.value, x + 4, ey + 19);
    doc.setTextColor(0, 0, 0);
  });
  ey += 30;

  // High-risk + closed days strip
  doc.setFontSize(9); doc.setTextColor(...BRAND.muted);
  doc.text(
    `High-risk events: ${data.tempBreaches.length} temperature breach(es), ${data.deliveries.filter((d: any) => d.accepted === false).length} rejected delivery, ${data.openIncidents} open incident(s).`,
    margin, ey,
  );
  ey += 5;
  doc.text(
    `Closed days excluded from completion calculations: ${data.closedDaysCount}.`,
    margin, ey,
  );
  ey += 7;
  doc.setTextColor(0, 0, 0);

  // Top issues
  if (data.topFixes.length > 0) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("Top issues detected", margin, ey); ey += 3;
    autoTable(doc, {
      startY: ey,
      head: [["#", "Issue", "Severity"]],
      body: data.topFixes.map((f, i) => [String(i + 1), f.text, f.severity.toUpperCase()]),
      headStyles: { fillColor: BRAND.primary, textColor: 255, fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 2 },
      margin: { left: margin, right: margin },
      didParseCell: (h) => {
        if (h.section === "body" && h.column.index === 2) {
          h.cell.styles.textColor = sevColor(BRAND, data.topFixes[h.row.index].severity);
          h.cell.styles.fontStyle = "bold";
        }
      },
    });
    ey = (doc as any).lastAutoTable.finalY + 6;
  }

  // Top strengths
  if (data.topStrengths.length > 0) {
    if (ey > ph - 50) { doc.addPage(); header("Executive Summary"); ey = 28; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("Top strengths", margin, ey); ey += 3;
    autoTable(doc, {
      startY: ey,
      head: [["#", "Strength"]],
      body: data.topStrengths.map((s, i) => [String(i + 1), s.text]),
      headStyles: { fillColor: BRAND.success, textColor: 255, fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 2 },
      margin: { left: margin, right: margin },
    });
    ey = (doc as any).lastAutoTable.finalY + 6;
  }

  // FHRS-aligned breakdown
  if (ey > ph - 60) { doc.addPage(); header("Executive Summary"); ey = 28; }
  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text("FHRS-aligned breakdown", margin, ey); ey += 3;
  const pillarLabels: Record<string, string> = {
    hygiene: "Food Handling Controls",
    premises: "Premises & Structure",
    management: "Confidence in Management",
  };
  autoTable(doc, {
    startY: ey,
    head: [["FHRS area", "Score", "Status"]],
    body: data.pillars.map((p) => [
      pillarLabels[p.key] || p.name,
      `${p.score}%`,
      p.score >= 80 ? "Good" : p.score >= 60 ? "Improvement needed" : "Action required",
    ]),
    headStyles: { fillColor: BRAND.primary, textColor: 255 },
    styles: { fontSize: 10, cellPadding: 3 },
    margin: { left: margin, right: margin },
    didParseCell: (h) => {
      if (h.section === "body" && h.column.index === 1) {
        h.cell.styles.textColor = scoreColor(data.pillars[h.row.index].score);
        h.cell.styles.fontStyle = "bold";
      }
    },
  });

  // ====== AI Compliance Assessment (optional) ======
  if (aiNarrative && aiNarrative.trim().length > 0) {
    doc.addPage(); header("AI Compliance Assessment");
    let ay = 28;
    doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text("AI Compliance Assessment", margin, ay); ay += 8;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    aiNarrative.split(/\n+/).forEach((para) => {
      if (!para.trim()) { ay += 3; return; }
      const lines = doc.splitTextToSize(para, pw - margin * 2);
      if (ay + lines.length * 5 > ph - 25) { doc.addPage(); header("AI Compliance Assessment"); ay = 28; }
      doc.text(lines, margin, ay); ay += lines.length * 5 + 3;
    });
    ay += 4;
    doc.setFont("helvetica", "italic"); doc.setFontSize(8.5); doc.setTextColor(...BRAND.muted);
    const aiDisclaimer = "This assessment was generated by AI based on the compliance data in this report. It is provided as a management support tool and does not replace professional food safety advice or an official EHO inspection.";
    const dlines = doc.splitTextToSize(aiDisclaimer, pw - margin * 2);
    if (ay + dlines.length * 4.5 > ph - 25) { doc.addPage(); header("AI Compliance Assessment"); ay = 28; }
    doc.text(dlines, margin, ay);
    doc.setTextColor(0, 0, 0);
  }

  // ====== EVIDENCE SECTIONS ======
  const addEvidence = (
    title: string,
    head: string[][] | null,
    body: any[][],
    blocks?: { whatControlled?: string; recordsExist?: string; completion?: string; exceptions?: string; summary?: string },
  ) => {
    doc.addPage(); header(title);
    let cy = 28;
    doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text(title, margin, cy); cy += 6;

    const stat = (label: string, value?: string) => {
      if (!value) return;
      doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(0, 0, 0);
      doc.text(`${label}: `, margin, cy);
      const w = doc.getTextWidth(`${label}: `);
      doc.setFont("helvetica", "normal"); doc.setTextColor(...BRAND.muted);
      const lines = doc.splitTextToSize(value, pw - margin * 2 - w);
      doc.text(lines, margin + w, cy);
      cy += lines.length * 4.5 + 1.5;
      doc.setTextColor(0, 0, 0);
    };

    if (blocks) {
      stat("What is being controlled", blocks.whatControlled);
      stat("Records held in this period", blocks.recordsExist);
      stat("Completion rate", blocks.completion);
      stat("Exceptions & corrective actions", blocks.exceptions);
      if (blocks.summary) {
        doc.setFont("helvetica", "italic"); doc.setFontSize(9.5); doc.setTextColor(...BRAND.muted);
        const lines = doc.splitTextToSize(blocks.summary, pw - margin * 2);
        doc.text(lines, margin, cy); cy += lines.length * 4.5 + 1;
        doc.setTextColor(0, 0, 0);
      }
      cy += 2;
    }

    if (!head || body.length === 0) {
      doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.setTextColor(...BRAND.muted);
      doc.text("No records found for this period.", margin, cy + 2);
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

  // ===== A. Daily Controls =====
  // Day Sheets
  addEvidence(
    "Daily Controls — Day Sheets",
    [["Date", "Created", "Locked", "Signed off by", "Signed off at", "Manager note"]],
    data.daySheets
      .sort((a: any, b: any) => (a.sheet_date < b.sheet_date ? 1 : -1))
      .map((d: any) => [
        d.sheet_date ? format(parseISO(d.sheet_date), "dd/MM/yyyy") : "—",
        "Yes",
        d.locked ? "Yes" : "No",
        d.signed_off ? (d.signed_off_by_name || d.signed_off_by || "—") : "—",
        d.signed_off_at ? format(new Date(d.signed_off_at), "d MMM HH:mm") : "—",
        ((d.manager_note || d.problem_notes || "—") + (d.is_retrospective ? ` [Retrospective: ${d.retrospective_note || ""}]` : "")).slice(0, 100),
      ]),
    {
      whatControlled: "Daily opening, in-shift and closing checks captured by managers.",
      recordsExist: `${data.daySheets.length} day sheets for the period.`,
      completion: `${data.daySheetCompletionPct}% (closed days excluded). ${data.daySheetsLockedPct}% locked off by a manager.`,
      exceptions: `Manager notes & problem notes are recorded on each sheet — see right-hand column.`,
    },
  );

  // Temperature
  addEvidence(
    "Daily Controls — Temperature Records",
    [["Logged at", "Type", "Item / Unit", "Reading °C", "Result", "Corrective action"]],
    data.tempLogs
      .sort((a: any, b: any) => (a.logged_at < b.logged_at ? 1 : -1))
      .slice(0, 250)
      .map((t: any) => [
        format(new Date(t.logged_at), "d MMM HH:mm"),
        t.log_type || "—",
        (t.temp_units?.name || t.food_item || "—") + (t.is_retrospective ? " [Retro]" : ""),
        `${t.value}°C`,
        t.pass ? "PASS" : "FAIL",
        ((t.corrective_action || "—") + (t.is_retrospective && t.retrospective_note ? ` — ${t.retrospective_note}` : "")).slice(0, 80),
      ]),
    {
      whatControlled: "Equipment and food temperature checks against safe ranges.",
      recordsExist: `${data.tempLogs.length} readings.`,
      completion: data.tempLogs.length === 0 ? "No data" : `${Math.round((data.tempLogs.filter((t: any) => t.pass).length / data.tempLogs.length) * 100)}% pass rate`,
      exceptions: `${data.tempBreaches.length} breach(es) requiring corrective action.${data.tempLogs.length > 250 ? " Showing latest 250." : ""}`,
    },
  );

  // Cleaning — full day-by-day for daily tasks
  const closedSet = new Set((data.closedDays || []).map((c: any) => c.closed_date));
  const dailyTasks = (data.cleaningTasks || []).filter(
    (t: any) => (t.frequency || "daily").toLowerCase() === "daily",
  );
  const allDates = eachDayOfInterval({ start: data.range.from, end: data.range.to }).map(
    (d) => format(d, "yyyy-MM-dd"),
  );
  const cleaningRows: any[][] = [];
  for (const date of allDates) {
    const isClosed = closedSet.has(date);
    const dayLogs = (data.cleaningLogs || []).filter((l: any) => l.log_date === date);
    for (const task of dailyTasks) {
      const log = dayLogs.find((l: any) => l.task_id === task.id);
      let status: string;
      if (isClosed) status = "Exempt";
      else if (log?.done) status = "Done";
      else status = "Missed";
      cleaningRows.push([
        format(parseISO(date), "dd/MM/yyyy"),
        task.task || "—",
        task.area || "—",
        status + (log?.is_retrospective ? " (Retro)" : ""),
        log?.completed_by_name || (status === "Done" ? "—" : ""),
        log?.completed_at ? format(new Date(log.completed_at), "d MMM HH:mm") : "",
      ]);
    }
  }
  // Append non-daily logs for completeness
  for (const log of (data.cleaningLogs || []).filter((l: any) => {
    const t = (data.cleaningTasks || []).find((x: any) => x.id === l.task_id);
    return t && (t.frequency || "daily").toLowerCase() !== "daily";
  })) {
    const task = (data.cleaningTasks || []).find((t: any) => t.id === log.task_id);
    cleaningRows.push([
      log.log_date ? format(parseISO(log.log_date), "dd/MM/yyyy") : "—",
      task?.task || "—",
      task?.area || "—",
      log.done ? "Done" : "Missed",
      log.completed_by_name || "—",
      log.completed_at ? format(new Date(log.completed_at), "d MMM HH:mm") : "",
    ]);
  }
  addEvidence(
    "Daily Controls — Cleaning Schedule",
    [["Date", "Task", "Area", "Status", "Completed by", "Completed at"]],
    cleaningRows.slice(0, 400),
    {
      whatControlled: "Daily, weekly and monthly cleaning tasks for the kitchen and front of house.",
      recordsExist: `${data.cleaningTasksDone} of ${data.cleaningTasksTotal} expected completions logged.`,
      completion: `${data.cleaningCompletionPct}% (closed days exempt).`,
      exceptions: cleaningRows.filter((r) => r[3] === "Missed").length + " missed task occurrences in period.",
      summary: cleaningRows.length > 400 ? "Showing first 400 rows. Full data available in the Excel export." : undefined,
    },
  );

  // ===== B. Deliveries & Suppliers =====
  addEvidence(
    "Deliveries & Supplier Controls",
    [["Date", "Supplier", "Items", "Temp °C", "Use-by OK", "Accepted"]],
    data.deliveries
      .sort((a: any, b: any) => (a.logged_at < b.logged_at ? 1 : -1))
      .slice(0, 200)
      .map((d: any) => [
        format(new Date(d.logged_at), "d MMM"),
        d.suppliers?.name || d.supplier_name || d.supplier || "—",
        (d.items || d.items_received || "").slice(0, 40),
        d.temp != null ? `${d.temp}°C` : (d.temperature != null ? `${d.temperature}°C` : "—"),
        d.use_by_ok ? "Yes" : "No",
        d.accepted ? "Yes" : "REJECTED",
      ]),
    {
      whatControlled: "Goods-in checks and supplier acceptance against approved supplier list.",
      recordsExist: `${data.deliveries.length} deliveries logged.`,
      completion: `${data.deliveryAcceptPct}% accepted on receipt.`,
      exceptions: `${data.deliveries.filter((d: any) => d.accepted === false).length} rejected.`,
    },
  );

  // ===== C. Allergens & PPDS =====
  addEvidence(
    "Allergens & PPDS Labelling",
    [["Recipe", "Type", "Approved", "Last reviewed"]],
    data.recipes.map((r: any) => [
      r.name,
      (r.label_type || "—").toUpperCase(),
      r.approved ? "Yes" : "No",
      r.last_reviewed_at ? format(new Date(r.last_reviewed_at), "d MMM yyyy") : "—",
    ]),
    {
      whatControlled: "Recipe & allergen records, including PPDS items requiring on-pack labelling.",
      recordsExist: `${data.recipes.length} active recipes • ${data.ppdsRecipes.length} PPDS items • ${data.ingredients.length} ingredients tracked.`,
      completion: `${data.recipes.length === 0 ? 0 : Math.round((data.recipes.filter((r: any) => r.approved).length / data.recipes.length) * 100)}% of recipes approved.`,
      exceptions: data.ppdsRecipes.length > 0
        ? "PPDS items require the food name and full ingredients list with the 14 regulated allergens emphasised."
        : "No PPDS items recorded for this period.",
    },
  );

  // ===== D. Incidents =====
  addEvidence(
    "Incidents & Corrective Actions",
    [["Reported", "Type", "Title", "Status", "Immediate action"]],
    data.incidents
      .sort((a: any, b: any) => (a.reported_at < b.reported_at ? 1 : -1))
      .map((i: any) => [
        format(new Date(i.reported_at), "d MMM yyyy"),
        i.type || i.incident_type || "—",
        (i.title || "").slice(0, 40),
        i.status || "open",
        (i.immediate_action || "—").slice(0, 60),
      ]),
    {
      whatControlled: "Food safety, equipment and customer incidents with corrective and preventative actions.",
      recordsExist: `${data.incidents.length} incidents logged.`,
      completion: data.incidents.length === 0 ? "No incidents" : `${Math.round(((data.incidents.length - data.openIncidents) / data.incidents.length) * 100)}% closed.`,
      exceptions: `${data.openIncidents} open.`,
    },
  );

  // ===== E. Pest, Maintenance & PPM =====
  addEvidence(
    "Pest Control",
    [["Reported", "Type", "Location", "Action taken", "Resolved"]],
    data.pestLogs.map((p: any) => [
      format(new Date(p.reported_at), "d MMM yyyy"),
      p.type, p.location,
      (p.action_taken || "").slice(0, 60),
      p.resolved ? "Yes" : "Open",
    ]),
    {
      whatControlled: "Pest sightings, contractor visits and resolution actions.",
      recordsExist: `${data.pestLogs.length} entries.`,
      completion: data.pestLogs.length === 0 ? "No sightings" : `${data.pestLogs.length - data.openPestLogs} of ${data.pestLogs.length} resolved.`,
      exceptions: `${data.openPestLogs} open pest entries.`,
    },
  );

  addEvidence(
    "Maintenance & PPM Schedule",
    [["Reported", "Item", "Issue", "Priority", "Status"]],
    data.maintenanceLogs.map((m: any) => [
      format(new Date(m.reported_at), "d MMM yyyy"),
      m.item, (m.issue || "").slice(0, 40), m.priority, m.status,
    ]),
    {
      whatControlled: "Reactive maintenance issues plus scheduled (PPM) tasks for equipment and structure.",
      recordsExist: `${data.maintenanceLogs.length} reactive issues • ${data.ppmTasks.length} PPM tasks configured.`,
      completion: `${data.maintenanceLogs.length - data.openMaintenance} of ${data.maintenanceLogs.length} reactive issues resolved.`,
      exceptions: `${data.openMaintenance} open maintenance issues • ${data.ppmOverdue} overdue PPM tasks.`,
    },
  );

  // ===== F. Staff Training =====
  addEvidence(
    "Staff Training & Competence",
    [["Training", "Type", "Completed", "Expires", "Status"]],
    data.trainingRecords
      .sort((a: any, b: any) => ((a.expiry_date || "") > (b.expiry_date || "") ? 1 : -1))
      .map((t: any) => {
        const exp = t.expiry_date ? new Date(t.expiry_date) : null;
        const status = !exp ? "—" : exp < new Date() ? "EXPIRED" : (exp.getTime() - Date.now()) / 86400000 <= 30 ? "Expiring" : "Valid";
        return [
          t.training_name || "—",
          t.training_type || "—",
          t.completed_date ? format(new Date(t.completed_date), "d MMM yyyy") : "—",
          exp ? format(exp, "d MMM yyyy") : "—",
          status,
        ];
      }),
    {
      whatControlled: "Food hygiene, allergen and role-specific training certificates held for staff.",
      recordsExist: `${data.trainingRecords.length} training records • ${data.trainingRequirements.length} requirements defined.`,
      completion: `${data.trainingExpired} expired • ${data.trainingExpiringSoon} expiring within 30 days.`,
      exceptions: data.trainingExpired > 0 ? "Expired training must be renewed before staff perform regulated tasks." : "No expired training.",
    },
  );

  // ===== G. HACCP =====
  addEvidence(
    "HACCP Plan",
    [["Plan", "Business type", "Status", "Last reviewed", "Next review"]],
    data.haccpPlans.map((h: any) => [
      h.name || "—",
      h.food_business_type || "—",
      (h.status || "draft").toUpperCase(),
      h.last_reviewed_at ? format(new Date(h.last_reviewed_at), "d MMM yyyy") : "—",
      h.review_due_at ? format(new Date(h.review_due_at), "d MMM yyyy") : "—",
    ]),
    {
      whatControlled: "Documented HACCP / food safety management plan(s) for this site.",
      recordsExist: `${data.haccpPlans.length} plan(s).`,
      completion: data.haccpPlans.filter((h: any) => h.status === "published").length + " published.",
      exceptions: data.haccpPlans.filter((h: any) => h.review_due_at && new Date(h.review_due_at) < new Date()).length + " plan(s) overdue for review.",
    },
  );

  // ===== H. Waste & Continuous Improvement =====
  addEvidence(
    "Waste & Continuous Improvement",
    [["Date", "Category", "Item", "Qty", "Unit", "Cost (£)"]],
    data.wasteLogs
      .sort((a: any, b: any) => (a.shift_date < b.shift_date ? 1 : -1))
      .slice(0, 200)
      .map((w: any) => [
        w.shift_date ? format(parseISO(w.shift_date), "dd/MM/yyyy") : "—",
        w.category || "—",
        w.item_name || "—",
        w.quantity ?? "",
        w.unit || "",
        w.estimated_cost != null ? Number(w.estimated_cost).toFixed(2) : "—",
      ]),
    {
      whatControlled: "Waste logged by shift, used to identify recurring loss and improvement opportunities.",
      recordsExist: `${data.wasteLogs.length} waste entries.`,
      completion: `Total estimated cost £${data.wasteCostTotal.toFixed(2)} for the period.`,
      exceptions: data.wasteLogs.length === 0 ? "No waste logged." : "",
    },
  );

  // ===== Cost & Margin (gated) =====
  if (data.costMargin && data.costMargin.recipes.length > 0) {
    const cm = data.costMargin;
    addEvidence(
      "Profit & Pricing Summary",
      [["Recipe", "Cost/unit", "Recommended", "Current", "Margin %", "Target %"]],
      cm.recipes.map((r) => [
        r.name,
        `£${r.costPerUnit.toFixed(3)}`,
        `£${r.recommendedSellExVat.toFixed(2)}`,
        r.currentSellExVat != null ? `£${r.currentSellExVat.toFixed(2)}` : "—",
        r.marginPct != null ? `${r.marginPct.toFixed(1)}%` : "—",
        `${r.targetMarginPct.toFixed(0)}%`,
      ]),
      {
        whatControlled: "Recipe gross margin against target.",
        recordsExist: `${cm.recipes.length} recipes priced.`,
        completion: cm.averageMarginPct != null ? `Avg margin ${cm.averageMarginPct.toFixed(1)}%.` : "—",
        exceptions: `${cm.recipesBelowTarget} below target • ${cm.recipesMissingPrice} without a sell price.`,
      },
    );
  }

  // ===== WORKPLACE SAFETY ADDENDUM (optional) =====
  doc.addPage(); header("Workplace Safety Addendum");
  let wy = 28;
  doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.text("Workplace Safety Addendum", margin, wy); wy += 7;
  doc.setFont("helvetica", "italic"); doc.setFontSize(9.5); doc.setTextColor(...BRAND.muted);
  const wsLines = doc.splitTextToSize(
    "This addendum supports general workplace safety visibility but is not a full Health & Safety management system. It re-presents existing operational records (maintenance, incidents, training, cleaning, PPM) under H&S-style headings.",
    pw - margin * 2,
  );
  doc.text(wsLines, margin, wy); wy += wsLines.length * 4.5 + 3;
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: wy,
    head: [["Area", "Source", "Open / Issue", "Total"]],
    body: [
      ["Workplace hazards logged", "Maintenance log", String(data.openMaintenance), String(data.maintenanceLogs.length)],
      ["Incident reporting & corrective actions", "Incidents", String(data.openIncidents), String(data.incidents.length)],
      ["Competence & training records", "Training records", `${data.trainingExpired} expired`, String(data.trainingRecords.length)],
      ["Workplace hygiene & housekeeping", "Cleaning logs", `${data.cleaningCompletionPct}% complete`, String(data.cleaningTasksTotal)],
      ["Planned preventative maintenance", "PPM schedule", `${data.ppmOverdue} overdue`, String(data.ppmTasks.length)],
    ],
    headStyles: { fillColor: BRAND.primary, textColor: 255 },
    styles: { fontSize: 9.5, cellPadding: 2.5 },
    margin: { left: margin, right: margin },
  });

  // ===== AUDIT TRAIL =====
  doc.addPage(); header("Audit Trail & Methodology");
  let ty = 28;
  doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.text("Audit Trail", margin, ty); ty += 8;

  autoTable(doc, {
    startY: ty,
    body: [
      ["Generated by", "MiseOS — Reports & Inspection Pack"],
      ["Generated at", format(new Date(data.generatedAt), "d MMM yyyy 'at' HH:mm")],
      ["Site", `${businessName} — ${data.siteName}`],
      ["Reporting period", `${format(data.range.from, "d MMM yyyy")} – ${format(data.range.to, "d MMM yyyy")} (${data.range.days} days)`],
      ["Closed days excluded", String(data.closedDaysCount)],
      ["Estimated FHRS", `${data.ratingEstimate} / 5`],
      ["Overall compliance", `${data.overallScore}%`],
      ["Inspection readiness", readinessLabel(data.readiness)],
      ["Data retention", "Records retained for 7 years in line with food safety record-keeping practice."],
    ],
    styles: { fontSize: 9.5, cellPadding: 2.5 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 55 } },
    margin: { left: margin, right: margin },
  });
  ty = (doc as any).lastAutoTable.finalY + 6;

  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("Modules active during the period", margin, ty); ty += 5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
  const modText = data.activeModules.length > 0 ? data.activeModules.join(" • ") : "No active modules detected.";
  const modLines = doc.splitTextToSize(modText, pw - margin * 2);
  doc.text(modLines, margin, ty); ty += modLines.length * 4.5 + 4;

  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("Closed-days exclusion", margin, ty); ty += 5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
  const cdLines = doc.splitTextToSize(
    "Closed days are removed from both the numerator and denominator of every completion calculation. This means a venue is not penalised for not logging records on a day it was legitimately closed.",
    pw - margin * 2,
  );
  doc.text(cdLines, margin, ty); ty += cdLines.length * 4.5 + 4;

  doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(...BRAND.muted);
  const finalDisclaimer = doc.splitTextToSize(
    "This pack is generated from records logged in MiseOS. The estimated Food Hygiene Rating is an indicator only — the rating awarded by the local authority Environmental Health Officer (EHO) may differ as it depends on physical inspection, observed practices, evidence outside this app, and officer discretion.",
    pw - margin * 2,
  );
  doc.text(finalDisclaimer, margin, ty);
  doc.setTextColor(0, 0, 0);

  footer();
  doc.save(`Inspection-Pack_${data.siteName.replace(/\s+/g, "-")}_${format(new Date(), "yyyy-MM-dd")}.pdf`);
}
