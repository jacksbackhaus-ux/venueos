import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { safeMethodDef } from "@/lib/sfbb";
import { KITCHEN_SETUP_ITEMS } from "@/lib/premises";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import type { ReportData } from "./reports";
import {
  FSA_AREAS,
  buildPackSummary,
  defaultPackOptions,
  premisesTypeLabel,
  type PackOptions,
  type PackStat,
} from "./inspectionPack";

export interface PdfBranding {
  primary?: string;
  secondary?: string;
  businessName?: string;
  logoDataUrl?: string;
}

const DEFAULT_BRAND = {
  primary: [37, 99, 235] as [number, number, number],
  secondary: [245, 158, 11] as [number, number, number],
  success: [22, 163, 74] as [number, number, number],
  warn: [217, 119, 6] as [number, number, number],
  bad: [220, 38, 38] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  ink: [17, 24, 39] as [number, number, number],
};

function hexToRgb(hex?: string): [number, number, number] | null {
  if (!hex) return null;
  const c = hex.replace("#", "");
  if (c.length !== 6) return null;
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

const dateOr = (v: any, fmt = "d MMM yyyy") => {
  if (!v) return "No record";
  try {
    return format(typeof v === "string" && v.length <= 10 ? parseISO(v) : new Date(v), fmt);
  } catch {
    return "No record";
  }
};

export function generateInspectionPackPdf(
  data: ReportData,
  aiNarrative?: string,
  branding?: PdfBranding,
  options?: PackOptions,
) {
  const opts: PackOptions = options ?? defaultPackOptions();
  const full = opts.detail === "full";
  const on = (k: keyof PackOptions["sections"]) => opts.sections[k] !== false;

  const BRAND = { ...DEFAULT_BRAND };
  const primary = hexToRgb(branding?.primary);
  if (primary) BRAND.primary = primary;

  const businessName = branding?.businessName?.trim() || data.orgName;
  const summary = buildPackSummary(data);
  const onDemand = data.operatingMode === "on_demand";

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pw - margin * 2;

  // ── Chrome ────────────────────────────────────────────────────────────────
  function runningHeader() {
    doc.setDrawColor(210);
    doc.setLineWidth(0.3);
    doc.line(margin, 16, pw - margin, 16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...BRAND.ink);
    doc.text(`${businessName} — ${data.siteName}`, margin, 12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND.muted);
    doc.text(summary.periodLabel, pw - margin, 12, { align: "right" });
    doc.setTextColor(...BRAND.ink);
  }

  function newPage(): number {
    doc.addPage();
    runningHeader();
    return 26;
  }

  function ensure(y: number, needed: number): number {
    return y + needed > ph - 18 ? newPage() : y;
  }

  function sectionTitle(y: number, kicker: string, title: string): number {
    let cy = ensure(y, 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...BRAND.muted);
    doc.text(kicker.toUpperCase(), margin, cy);
    cy += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...BRAND.ink);
    doc.text(title, margin, cy);
    cy += 3;
    doc.setDrawColor(...BRAND.primary);
    doc.setLineWidth(0.8);
    doc.line(margin, cy, pw - margin, cy);
    doc.setLineWidth(0.3);
    return cy + 7;
  }

  function subTitle(y: number, text: string): number {
    // Reserve room for the first rows of the block that follows, so a heading
    // never sits alone at the foot of a page.
    let cy = ensure(y, 30);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...BRAND.ink);
    doc.text(text, margin, cy);
    return cy + 5;
  }

  function paragraph(y: number, text: string, size = 9.5, italic = false): number {
    // Font must be set BEFORE measuring, or wrapping uses the previous font size.
    doc.setFont("helvetica", italic ? "italic" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, contentW);
    let cy = ensure(y, lines.length * 4.6 + 2);
    doc.setFont("helvetica", italic ? "italic" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...BRAND.muted);
    doc.text(lines, margin, cy);
    doc.setTextColor(...BRAND.ink);
    return cy + lines.length * 4.6 + 3;
  }


  /** Statement list — prints clearly in black and white. */
  function statBlock(y: number, stats: PackStat[]): number {
    let cy = y;
    for (const s of stats) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      const labelLines = doc.splitTextToSize(s.label, contentW * 0.42);
      doc.setFont("helvetica", "normal");
      const valueLines = doc.splitTextToSize(s.value, contentW * 0.5);
      const h = Math.max(labelLines.length, valueLines.length) * 4.4 + 2.5;

      cy = ensure(cy, h + 2);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...BRAND.ink);
      doc.text(labelLines, margin, cy);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      doc.text(valueLines, margin + contentW * 0.48, cy);
      doc.setTextColor(...BRAND.ink);
      cy += h;
      doc.setDrawColor(232);
      doc.line(margin, cy - 1.5, pw - margin, cy - 1.5);
    }
    return cy + 4;
  }

  function table(y: number, head: string[], body: any[][], colWidths?: Record<number, number>): number {
    if (body.length === 0) {
      return paragraph(y, "No records found for this period.", 9.5, true);
    }
    autoTable(doc, {
      startY: ensure(y, 24),
      head: [head],
      body,
      headStyles: { fillColor: BRAND.primary, textColor: 255, fontSize: 8.5, fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 1.9, overflow: "linebreak", textColor: [30, 30, 30] },
      alternateRowStyles: { fillColor: [246, 248, 251] },
      columnStyles: colWidths
        ? Object.fromEntries(Object.entries(colWidths).map(([k, v]) => [k, { cellWidth: v }]))
        : undefined,
      margin: { left: margin, right: margin },
      didDrawPage: () => runningHeader(),
    });
    return (doc as any).lastAutoTable.finalY + 7;
  }

  // ── COVER ─────────────────────────────────────────────────────────────────
  {
    if (branding?.logoDataUrl) {
      try {
        doc.addImage(branding.logoDataUrl, "PNG", margin, 20, 22, 22, undefined, "FAST");
      } catch {
        /* ignore broken logo */
      }
    }
    let cy = branding?.logoDataUrl ? 52 : 34;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...BRAND.primary);
    doc.text("FOOD SAFETY INSPECTION PACK", margin, cy);
    cy += 12;
    doc.setFontSize(26);
    doc.setTextColor(...BRAND.ink);
    const nameLines = doc.splitTextToSize(businessName, contentW);
    doc.text(nameLines, margin, cy);
    cy += nameLines.length * 10 + 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(13);
    doc.text(data.siteName, margin, cy);
    cy += 8;
    doc.setDrawColor(...BRAND.primary);
    doc.setLineWidth(1);
    doc.line(margin, cy, margin + 40, cy);
    doc.setLineWidth(0.3);
    cy += 12;

    const r = data.registration || {};
    const rows: [string, string][] = [
      ["Premises type", premisesTypeLabel(data.premisesType)],
      ["Address", data.siteAddress || "Not recorded in MiseOS"],
      ["Local authority", r.local_authority_name || "Not recorded in MiseOS"],
      ["Registration reference", r.registration_reference || "Not recorded in MiseOS"],
      [
        "Registered",
        r.registration_date ? dateOr(r.registration_date) : "Not recorded in MiseOS",
      ],
      [
        "Current food hygiene rating",
        r.fhrs_rating === null || r.fhrs_rating === undefined ? "Not yet rated" : `${r.fhrs_rating} / 5`,
      ],
      ["Last inspection", r.last_inspection_date ? dateOr(r.last_inspection_date) : "Not recorded in MiseOS"],
      ["Period covered", summary.periodLabel],
      ["Level of detail", full ? "Full records (all individual logs)" : "Overview (summary)"],
      ["Generated", format(new Date(data.generatedAt), "d MMM yyyy 'at' HH:mm")],
    ];
    doc.setFontSize(9.5);
    for (const [k, v] of rows) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BRAND.ink);
      doc.text(k, margin, cy);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      const lines = doc.splitTextToSize(v, contentW - 55);
      doc.text(lines, margin + 55, cy);
      cy += Math.max(1, lines.length) * 4.6 + 2.6;
    }

    doc.setTextColor(...BRAND.muted);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9.5);
    const foot = doc.splitTextToSize(
      "Food safety records prepared for hygiene inspection. Generated from MiseOS.",
      contentW,
    );
    doc.text(foot, margin, ph - 30);
    doc.setTextColor(...BRAND.ink);
  }

  // ── PAGE 2 — INSPECTION READINESS SUMMARY ─────────────────────────────────
  let y = newPage();
  y = sectionTitle(y, "Page 2", "Inspection Readiness Summary");
  y = paragraph(
    y,
    "A food hygiene inspection scores three areas: hygienic food handling, the physical condition and cleanliness of the premises, and confidence in management. This pack is organised around those three areas. The summaries below show what records exist for the period and how complete they are.",
  );
  y = paragraph(y, summary.fsmsStatement, 10);
  y = paragraph(y, summary.dayBasisNote);

  y = subTitle(y + 2, `1. ${FSA_AREAS.hygiene}`);
  y = statBlock(y, summary.hygiene);
  y = subTitle(y, `2. ${FSA_AREAS.premises}`);
  y = statBlock(y, summary.premises);
  y = subTitle(y, `3. ${FSA_AREAS.management}`);
  y = statBlock(y, summary.management);

  if (aiNarrative && aiNarrative.trim()) {
    y = subTitle(y, "Management commentary");
    y = paragraph(y, aiNarrative.replace(/\n+/g, " "), 9.5);
    y = paragraph(
      y,
      "This commentary was generated by AI from the records in this pack. It supports management review and does not replace professional food safety advice or an official inspection.",
      8.5,
      true,
    );
  }

  // ── SECTION 1 — HYGIENIC FOOD HANDLING ────────────────────────────────────
  y = newPage();
  y = sectionTitle(y, "Section 1 of 3", FSA_AREAS.hygiene);
  y = paragraph(
    y,
    "Temperature control of storage and processes, probe accuracy, allergen information and traceability of what was produced.",
  );
  y = statBlock(y, summary.hygiene);

  if (full) {
    if (on("temperatures")) {
      y = subTitle(y, "Storage temperature records");
      y = table(
        y,
        ["Logged", "Unit", "Reading", "Result", "Corrective action"],
        (data.storageTempLogs || [])
          .slice()
          .sort((a: any, b: any) => (a.logged_at < b.logged_at ? 1 : -1))
          .map((t: any) => [
            dateOr(t.logged_at, "d MMM yyyy HH:mm"),
            t.temp_units?.name || "Unit not named",
            `${t.value}°C`,
            t.pass ? "Pass" : "Fail",
            t.corrective_action || (t.pass ? "—" : "Not recorded"),
          ]),
      );

      y = subTitle(y, "Process checks (cooking, reheating, hot-holding, cooling, delivery)");
      y = table(
        y,
        ["Logged", "Check", "Item", "Reading", "Result", "Corrective action"],
        (data.processTempLogs || [])
          .slice()
          .sort((a: any, b: any) => (a.logged_at < b.logged_at ? 1 : -1))
          .map((t: any) => [
            dateOr(t.logged_at, "d MMM yyyy HH:mm"),
            t.log_type || "—",
            t.food_item || "—",
            `${t.value}°C`,
            t.pass ? "Pass" : "Fail",
            t.corrective_action || (t.pass ? "—" : "Not recorded"),
          ]),
      );

      y = subTitle(y, "Probe calibration records");
      y = table(
        y,
        ["Date", "Probe", "Iced water", "Boiling water", "Result", "By"],
        (data.probeCalibrations || []).map((c: any) => [
          dateOr(c.calibrated_at),
          c.probe_name || "Probe",
          `${c.iced_water_reading}°C`,
          `${c.boiling_water_reading}°C`,
          c.pass ? "Pass" : "Fail",
          c.calibrated_by_name || "—",
        ]),
      );
    }

    if (on("allergens")) {
      y = subTitle(y, "Allergen management");
      y = table(
        y,
        ["Recipe / product", "Label type", "Allergen info approved", "Last reviewed"],
        (data.recipes || []).map((r: any) => [
          r.name,
          (r.label_type || "—").toUpperCase(),
          r.approved ? "Yes" : "No",
          r.last_reviewed_at ? dateOr(r.last_reviewed_at) : "No record",
        ]),
      );
    }

    if (on("batches")) {
      y = subTitle(y, "Batch & traceability records");
      y = table(
        y,
        ["Produced", "Batch code", "Product", "Quantity", "Use by", "Status"],
        (data.batches || []).map((b: any) => [
          dateOr(b.date_produced),
          b.batch_code || "—",
          b.product_name || "—",
          b.quantity_produced != null ? `${b.quantity_produced} ${b.quantity_unit || ""}`.trim() : "—",
          b.use_by_date ? dateOr(b.use_by_date) : "—",
          b.status || "—",
        ]),
      );

      y = subTitle(y, "Withdrawals & recalls");
      y = table(
        y,
        ["Date", "Item", "Reason", "Batches", "Customers told", "Action taken"],
        (data.recalls || []).map((r: any) => [
          dateOr(r.created_at),
          r.item_ref || "—",
          r.reason || "—",
          String((r.affected_batch_ids || []).length),
          r.customers_informed ? "Yes" : "No",
          r.action_taken || "—",
        ]),
      );
    }
  }

  // ── SECTION 2 — PREMISES & CLEANLINESS ────────────────────────────────────
  y = newPage();
  y = sectionTitle(y, "Section 2 of 3", FSA_AREAS.premises);
  y = paragraph(
    y,
    "Cleaning of the premises and equipment, pest control, and the maintenance of the structure and equipment.",
  );
  y = statBlock(y, summary.premises);

  if (full) {
    if (on("cleaning")) {
      y = subTitle(y, onDemand ? "Cleaning records by production day" : "Cleaning records day by day");
      const closedSet = new Set((data.closedDays || []).map((c: any) => c.closed_date));
      const productionSet = new Set(
        (data.productionDays || []).map((d: any) => (d.production_date || "").slice(0, 10)),
      );
      const dailyTasks = (data.cleaningTasks || []).filter(
        (t: any) => (t.frequency || "daily").toLowerCase() === "daily",
      );
      const rows: any[][] = [];
      const dates = eachDayOfInterval({ start: data.range.from, end: data.range.to }).map((d) =>
        format(d, "yyyy-MM-dd"),
      );
      for (const date of dates) {
        const exempt = onDemand ? !productionSet.has(date) : closedSet.has(date);
        if (exempt && !onDemand && !closedSet.has(date)) continue;
        const dayLogs = (data.cleaningLogs || []).filter((l: any) => l.log_date === date);
        for (const task of dailyTasks) {
          const log = dayLogs.find((l: any) => l.task_id === task.id);
          const status = exempt ? (onDemand ? "Not a production day" : "Closed — exempt") : log?.done ? "Done" : "Missed";
          rows.push([
            dateOr(date, "dd/MM/yyyy"),
            task.task || "—",
            task.area || "—",
            status,
            log?.completed_by_name || "—",
            log?.completed_at ? dateOr(log.completed_at, "d MMM HH:mm") : "—",
          ]);
        }
      }
      for (const log of (data.cleaningLogs || []).filter((l: any) => {
        const t = (data.cleaningTasks || []).find((x: any) => x.id === l.task_id);
        return t && (t.frequency || "daily").toLowerCase() !== "daily";
      })) {
        const task = (data.cleaningTasks || []).find((t: any) => t.id === log.task_id);
        rows.push([
          dateOr(log.log_date, "dd/MM/yyyy"),
          task?.task || "—",
          `${task?.area || "—"} (${task?.frequency || "periodic"})`,
          log.done ? "Done" : "Missed",
          log.completed_by_name || "—",
          log.completed_at ? dateOr(log.completed_at, "d MMM HH:mm") : "—",
        ]);
      }
      y = table(y, ["Date", "Task", "Area", "Status", "Completed by", "Completed at"], rows.slice(0, 600));
      if (rows.length > 600) {
        y = paragraph(y, "Showing the first 600 rows. The Excel export contains every row.", 8.5, true);
      }
    }

    if (on("pest")) {
      y = subTitle(y, "Pest control records");
      y = table(
        y,
        ["Reported", "Type", "Location", "Action taken", "Resolved"],
        (data.pestLogs || []).map((p: any) => [
          dateOr(p.reported_at),
          p.type || "—",
          p.location || "—",
          p.action_taken || "—",
          p.resolved ? "Yes" : "Open",
        ]),
      );

      y = subTitle(y, "Maintenance records");
      y = table(
        y,
        ["Reported", "Item", "Issue", "Priority", "Status"],
        (data.maintenanceLogs || []).map((m: any) => [
          dateOr(m.reported_at),
          m.item || "—",
          m.issue || "—",
          m.priority || "—",
          m.status || "open",
        ]),
      );

      y = subTitle(y, "Planned preventative maintenance");
      y = table(
        y,
        ["Task", "Frequency", "Contractor", "Last completed", "Next due", "Status"],
        (data.ppmTasks || []).map((t: any) => {
          const last = (data.ppmCompletions || [])
            .filter((c: any) => c.task_id === t.id)
            .sort((a: any, b: any) => (a.completed_date < b.completed_date ? 1 : -1))[0];
          const next = last?.next_due_date ? new Date(last.next_due_date) : null;
          return [
            t.task_name || "—",
            t.frequency || "—",
            t.contractor_name || t.assigned_to || "—",
            last?.completed_date ? dateOr(last.completed_date) : "No record",
            next ? dateOr(next) : "No record",
            next ? (next < new Date() ? "Overdue" : "On schedule") : "Not started",
          ];
        }),
      );
    }

    if (data.premisesType === "home" && data.kitchenSetup) {
      y = subTitle(y, "Kitchen setup check (domestic premises)");
      const answers = ((data.kitchenSetup as any).items || {}) as Record<string, { checked?: boolean; note?: string }>;
      y = table(
        y,
        ["Requirement", "Confirmed", "Note"],
        KITCHEN_SETUP_ITEMS.map((item) => [
          item.label,
          answers[item.key]?.checked ? "Yes" : "Not confirmed",
          answers[item.key]?.note || "—",
        ]),
        { 0: 90 },
      );
    }
  }

  // ── SECTION 3 — CONFIDENCE IN MANAGEMENT ──────────────────────────────────
  y = newPage();
  y = sectionTitle(y, "Section 3 of 3", FSA_AREAS.management);
  y = paragraph(
    y,
    "The documented food safety management system, staff training and competence, corrective actions, supplier control and management review. This is the area an inspector weights most heavily.",
  );
  y = paragraph(y, summary.fsmsStatement, 10);
  y = statBlock(y, summary.management);

  if (full) {
    if (on("fsms")) {
      y = subTitle(y, "Food safety management system");
      const sys = data.sfbbSystem as any;
      y = table(
        y,
        ["Item", "Detail"],
        [
          ["Route", sys?.route === "upload" ? "Completed SFBB pack uploaded" : "Safe methods completed in MiseOS"],
          ["First completed", sys?.first_completed_at ? dateOr(sys.first_completed_at) : "No record"],
          ["Last reviewed", sys?.last_reviewed_at ? dateOr(sys.last_reviewed_at) : "No record"],
          ["Reviewed by", sys?.reviewed_by_name || "No record"],
        ],
        { 0: 45 },
      );

      if ((data.sfbbDocuments || []).length > 0) {
        y = subTitle(y, "Uploaded food safety management system documents");
        y = table(
          y,
          ["Document", "Date completed", "Review date", "Uploaded by"],
          data.sfbbDocuments.map((d: any) => [
            d.name || "—",
            d.date_completed ? dateOr(d.date_completed) : "No record",
            d.review_date ? dateOr(d.review_date) : "No record",
            d.uploaded_by_name || "—",
          ]),
        );
      }

      y = subTitle(y, "Safe methods");
      y = table(
        y,
        ["Safe method", "Status", "How this is done"],
        (data.safeMethods || []).map((m: any) => [
          safeMethodDef(m.method_key)?.title ?? m.method_key,
          m.status === "documented" ? "Documented" : m.status === "not_relevant" ? "Not relevant" : "To do",
          m.how_text || "—",
        ]),
        { 0: 52, 1: 26 },
      );

      if ((data.haccpPlans || []).length > 0) {
        y = subTitle(y, "HACCP plans");
        y = table(
          y,
          ["Plan", "Status", "Last reviewed", "Next review"],
          data.haccpPlans.map((h: any) => [
            h.name || "—",
            (h.status || "draft").toUpperCase(),
            h.last_reviewed_at ? dateOr(h.last_reviewed_at) : "No record",
            h.review_due_at ? dateOr(h.review_due_at) : "No record",
          ]),
        );
      }
    }

    if (on("training")) {
      y = subTitle(y, "Staff training records");
      y = table(
        y,
        ["Training", "Type", "Completed", "Expires", "Status"],
        (data.trainingRecords || [])
          .slice()
          .sort((a: any, b: any) => ((a.expiry_date || "") > (b.expiry_date || "") ? 1 : -1))
          .map((t: any) => {
            const exp = t.expiry_date ? new Date(t.expiry_date) : null;
            const status = !exp
              ? "No expiry"
              : exp < new Date()
                ? "Expired"
                : (exp.getTime() - Date.now()) / 86400000 <= 30
                  ? "Expiring soon"
                  : "In date";
            return [
              t.training_name || "—",
              t.training_type || "—",
              t.completed_date ? dateOr(t.completed_date) : "No record",
              exp ? dateOr(exp) : "—",
              status,
            ];
          }),
      );

      y = subTitle(y, "Fitness to work records");
      y = table(
        y,
        ["Reported", "Person", "Symptoms", "Excluded from", "Cleared to return", "Status"],
        (data.fitnessRecords || []).map((r: any) => [
          r.reported_date ? dateOr(r.reported_date) : "—",
          r.staff_name || "—",
          r.symptoms || "—",
          r.excluded_from ? dateOr(r.excluded_from) : "—",
          r.cleared_to_return ? dateOr(r.cleared_to_return) : "—",
          r.status === "cleared" ? "Cleared" : "Excluded",
        ]),
      );
    }

    if (on("incidents")) {
      y = subTitle(y, "Incidents and corrective actions");
      y = table(
        y,
        ["Reported", "Type", "Title", "Immediate action", "Root cause", "Status"],
        (data.incidents || [])
          .slice()
          .sort((a: any, b: any) => (a.reported_at < b.reported_at ? 1 : -1))
          .map((i: any) => [
            dateOr(i.reported_at),
            i.type || i.incident_type || "—",
            i.title || "—",
            i.immediate_action || "—",
            i.root_cause || "—",
            i.status || "open",
          ]),
      );
    }

    if (on("suppliers")) {
      y = subTitle(y, "Approved suppliers");
      y = table(
        y,
        ["Supplier", "Category", "Approved", "Notes"],
        (data.suppliers || []).map((s: any) => [
          s.name || "—",
          s.category || "—",
          s.approved ? "Yes" : "No",
          s.notes || "—",
        ]),
      );

      y = subTitle(y, "Delivery records");
      y = table(
        y,
        ["Date", "Supplier", "Items", "Temp", "Use-by OK", "Accepted"],
        (data.deliveries || [])
          .slice()
          .sort((a: any, b: any) => (a.logged_at < b.logged_at ? 1 : -1))
          .map((d: any) => [
            dateOr(d.logged_at),
            d.suppliers?.name || d.supplier_name || "—",
            d.items || d.items_received || "—",
            d.temp != null ? `${d.temp}°C` : d.temperature != null ? `${d.temperature}°C` : "—",
            d.use_by_ok ? "Yes" : "No",
            d.accepted === false ? "Rejected" : "Yes",
          ]),
      );
    }

    if (on("reviews")) {
      y = subTitle(y, onDemand ? "Periodic reviews" : "4-weekly reviews");
      y = table(
        y,
        ["Period", onDemand ? "Production days" : "Completed", "Problems", "Action taken", "By"],
        (data.reviews || []).map((r: any) => [
          `${r.period_start} → ${r.period_end}`,
          onDemand
            ? String(r.production_days_covered ?? "—")
            : r.completed_at
              ? dateOr(r.completed_at)
              : "—",
          r.problems_observed ? r.problems_detail || "Yes" : "None",
          r.action_taken || "—",
          r.completed_by_name || "—",
        ]),
      );
    }

    if (onDemand) {
      y = subTitle(y, data.premisesType === "mobile" ? "Trading days" : "Production days");
      y = table(
        y,
        ["Date", "Started", "Finished", "Notes"],
        (data.productionDays || []).map((d: any) => [
          dateOr(d.production_date),
          d.started_at ? dateOr(d.started_at, "HH:mm") : "—",
          d.finished_at ? dateOr(d.finished_at, "HH:mm") : "Open",
          d.notes || "—",
        ]),
      );
    }

    if ((data.siteEvents || []).length > 0) {
      y = subTitle(y, "Markets & events");
      y = table(
        y,
        ["Date", "Event", "Location", "Transport temp", "Notes"],
        data.siteEvents.map((e: any) => [
          dateOr(e.event_date),
          e.name || "—",
          e.location || "—",
          e.transport_temp_checked
            ? e.transport_temp != null
              ? `${e.transport_temp}°C`
              : "Checked"
            : "Not checked",
          e.notes || "—",
        ]),
      );
    }
  }

  // ── AUDIT TRAIL ───────────────────────────────────────────────────────────
  y = newPage();
  y = sectionTitle(y, "Appendix", "Audit Trail & Record Keeping");
  y = paragraph(
    y,
    "Every record in this pack was completed digitally in MiseOS by a named user and carries a timestamp at the moment of entry. Records entered after the event are flagged as retrospective in the underlying data.",
  );

  y = subTitle(y, "Records completed by user during this period");
  y = table(
    y,
    ["User", "Records completed"],
    (data.recordAuthors || []).map((a) => [a.name, String(a.count)]),
    { 0: 80 },
  );

  y = subTitle(y, "Pack details");
  y = table(
    y,
    ["Item", "Detail"],
    [
      ["Business", businessName],
      ["Site", data.siteName],
      ["Period covered", `${summary.periodLabel} (${data.range.days} days)`],
      ["Level of detail", full ? "Full records" : "Overview"],
      ["Generated", format(new Date(data.generatedAt), "d MMM yyyy 'at' HH:mm")],
      ["Generated by", "MiseOS — Inspection Pack"],
      [
        onDemand ? "Production days in period" : "Closed days in period",
        onDemand ? String(data.productionDaysCount) : String(data.closedDaysCount),
      ],
    ],
    { 0: 50 },
  );

  y = paragraph(
    y,
    onDemand
      ? "Completion figures in this pack are calculated across declared production days only. Days on which the business did not produce food carry no checks and are excluded from both the numerator and the denominator of every completion figure."
      : "Completion figures in this pack exclude days the business was closed. Closed days are removed from both the numerator and the denominator of every completion figure, so the business is not penalised for days it was legitimately closed.",
  );
  y = paragraph(
    y,
    "Records are retained for 7 years in line with food safety record-keeping practice and remain available in MiseOS.",
  );
  y = paragraph(
    y,
    "This pack presents the records held in MiseOS for a single site. It is provided to support inspection and does not replace the judgement of the local authority officer.",
    9,
    true,
  );

  // ── Footer / page numbers on every page ───────────────────────────────────
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.muted);
    doc.text(
      `${businessName} — ${data.siteName} · ${summary.periodLabel}`,
      margin,
      ph - 8,
    );
    doc.text(`Page ${i} of ${pageCount}`, pw - margin, ph - 8, { align: "right" });
    doc.setTextColor(...BRAND.ink);
  }

  doc.save(
    `Inspection-Pack_${data.siteName.replace(/\s+/g, "-")}_${format(new Date(), "yyyy-MM-dd")}.pdf`,
  );
}
