import * as XLSX from "xlsx";
import { eachDayOfInterval, format, parseISO } from "date-fns";
import type { ReportData } from "./reports";
import { safeMethodDef } from "@/lib/sfbb";
import {
  FSA_AREAS,
  buildPackSummary,
  defaultPackOptions,
  premisesTypeLabel,
  type PackOptions,
} from "./inspectionPack";

/**
 * Inspection Pack — Excel workbook.
 * Mirrors the PDF exactly: Summary sheet (readiness), then one worksheet per
 * section grouped under the three FSA areas, then the audit trail.
 */

const dateOr = (v: any, fmt = "dd/MM/yyyy") => {
  if (!v) return "No record";
  try {
    return format(typeof v === "string" && v.length <= 10 ? parseISO(v) : new Date(v), fmt);
  } catch {
    return "No record";
  }
};

function sheet(rows: any[][], widths: number[]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = widths.map((w) => ({ wch: w }));
  return ws;
}

const NONE = [["No records found for this period."]];
const body = (rows: any[][], head: string[]) => (rows.length ? [head, ...rows] : [head, ...NONE]);

export function generateInspectionPackExcel(
  data: ReportData,
  aiNarrative?: string,
  options?: PackOptions,
) {
  const opts = options ?? defaultPackOptions();
  const full = opts.detail === "full";
  const on = (k: keyof PackOptions["sections"]) => opts.sections[k] !== false;
  const s = buildPackSummary(data);
  const onDemand = data.operatingMode === "on_demand";
  const r: any = data.registration || {};

  const wb = XLSX.utils.book_new();
  const add = (name: string, ws: XLSX.WorkSheet) =>
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));

  // ── Summary (cover + readiness) ────────────────────────────────────────────
  const summaryRows: any[][] = [
    ["FOOD SAFETY INSPECTION PACK"],
    [],
    ["Business", data.orgName],
    ["Site", data.siteName],
    ["Premises type", premisesTypeLabel(data.premisesType)],
    ["Address", data.siteAddress || "Not recorded in MiseOS"],
    ["Local authority", r.local_authority_name || "Not recorded in MiseOS"],
    ["Registration reference", r.registration_reference || "Not recorded in MiseOS"],
    [
      "Current food hygiene rating",
      r.fhrs_rating === null || r.fhrs_rating === undefined ? "Not yet rated" : `${r.fhrs_rating} / 5`,
    ],
    ["Period covered", `${s.periodLabel} (${data.range.days} days)`],
    ["Level of detail", full ? "Full records" : "Overview"],
    ["Generated", format(new Date(data.generatedAt), "dd/MM/yyyy HH:mm")],
    [],
    ["Food safety records prepared for hygiene inspection. Generated from MiseOS."],
    [],
    ["INSPECTION READINESS SUMMARY"],
    ["A food hygiene inspection scores three areas. This pack is organised around them."],
    [],
    ["Food safety management system", s.fsmsStatement],
    [onDemand ? "Production days" : "Closed days excluded", s.dayBasisNote],
    [],
    [`1. ${FSA_AREAS.hygiene}`],
    ["Measure", "Result"],
    ...s.hygiene.map((x) => [x.label, x.value]),
    [],
    [`2. ${FSA_AREAS.premises}`],
    ["Measure", "Result"],
    ...s.premises.map((x) => [x.label, x.value]),
    [],
    [`3. ${FSA_AREAS.management}`],
    ["Measure", "Result"],
    ...s.management.map((x) => [x.label, x.value]),
  ];
  if (aiNarrative?.trim()) {
    summaryRows.push([], ["MANAGEMENT COMMENTARY"], [aiNarrative.replace(/\n+/g, " ")]);
  }
  add("Summary", sheet(summaryRows, [46, 80]));

  // ── SECTION 1 — HYGIENIC FOOD HANDLING ────────────────────────────────────
  if (on("temperatures")) {
    add(
      "1 Storage Temps",
      sheet(
        body(
          (data.storageTempLogs || [])
            .slice()
            .sort((a: any, b: any) => (a.logged_at < b.logged_at ? 1 : -1))
            .map((t: any) => [
              dateOr(t.logged_at, "dd/MM/yyyy HH:mm"),
              t.temp_units?.name || "Unit not named",
              t.value != null ? `${t.value}°C` : "—",
              t.pass ? "Pass" : "Fail",
              t.corrective_action || (t.pass ? "" : "Not recorded"),
              t.logged_by_name || "—",
            ]),
          ["Logged", "Unit", "Reading", "Result", "Corrective action", "Logged by"],
        ),
        [20, 26, 12, 10, 46, 20],
      ),
    );

    add(
      "1 Process Checks",
      sheet(
        body(
          (data.processTempLogs || [])
            .slice()
            .sort((a: any, b: any) => (a.logged_at < b.logged_at ? 1 : -1))
            .map((t: any) => [
              dateOr(t.logged_at, "dd/MM/yyyy HH:mm"),
              t.log_type || "—",
              t.food_item || "—",
              t.value != null ? `${t.value}°C` : "—",
              t.pass ? "Pass" : "Fail",
              t.corrective_action || (t.pass ? "" : "Not recorded"),
              t.logged_by_name || "—",
            ]),
          ["Logged", "Check type", "Item", "Reading", "Result", "Corrective action", "Logged by"],
        ),
        [20, 18, 28, 12, 10, 44, 20],
      ),
    );

    add(
      "1 Probe Calibration",
      sheet(
        body(
          (data.probeCalibrations || []).map((c: any) => [
            dateOr(c.calibrated_at),
            c.probe_name || "Probe",
            c.iced_water_reading != null ? `${c.iced_water_reading}°C` : "—",
            c.boiling_water_reading != null ? `${c.boiling_water_reading}°C` : "—",
            c.pass ? "Pass" : "Fail",
            c.action_taken || "",
            c.calibrated_by_name || "—",
          ]),
          ["Date", "Probe", "Iced water", "Boiling water", "Result", "Action taken", "By"],
        ),
        [14, 22, 14, 16, 10, 36, 20],
      ),
    );
  }

  if (on("allergens")) {
    add(
      "1 Allergens",
      sheet(
        body(
          (data.recipes || []).map((rec: any) => [
            rec.name,
            (rec.label_type || "—").toUpperCase(),
            rec.approved ? "Yes" : "No",
            rec.last_reviewed_at ? dateOr(rec.last_reviewed_at) : "No record",
            (rec.allergens || []).join(", ") || "None declared",
          ]),
          ["Recipe / product", "Label type", "Allergen info approved", "Last reviewed", "Allergens"],
        ),
        [34, 14, 20, 16, 50],
      ),
    );
  }

  if (on("batches")) {
    add(
      "1 Batches",
      sheet(
        body(
          (data.batches || []).map((b: any) => [
            dateOr(b.date_produced),
            b.batch_code || "—",
            b.product_name || "—",
            b.quantity_produced != null ? `${b.quantity_produced} ${b.quantity_unit || ""}`.trim() : "—",
            b.use_by_date ? dateOr(b.use_by_date) : "—",
            b.status || "—",
            b.notes || "",
          ]),
          ["Produced", "Batch code", "Product", "Quantity", "Use by", "Status", "Notes"],
        ),
        [14, 18, 28, 14, 14, 14, 40],
      ),
    );

    add(
      "1 Recalls",
      sheet(
        body(
          (data.recalls || []).map((rc: any) => [
            dateOr(rc.created_at),
            rc.item_ref || "—",
            rc.reason || "—",
            String((rc.affected_batch_ids || []).length),
            rc.customers_informed ? "Yes" : "No",
            rc.authority_informed ? "Yes" : "No",
            rc.action_taken || "—",
          ]),
          ["Date", "Item", "Reason", "Batches", "Customers told", "Authority told", "Action taken"],
        ),
        [14, 24, 34, 10, 14, 14, 44],
      ),
    );
  }

  // ── SECTION 2 — PREMISES & CLEANLINESS ────────────────────────────────────
  if (on("cleaning")) {
    const closedSet = new Set((data.closedDays || []).map((c: any) => c.closed_date));
    const productionSet = new Set(
      (data.productionDays || []).map((d: any) => (d.production_date || "").slice(0, 10)),
    );
    const rows: any[][] = [];
    const dates = eachDayOfInterval({ start: data.range.from, end: data.range.to }).map((d) =>
      format(d, "yyyy-MM-dd"),
    );
    for (const date of dates) {
      const exempt = onDemand ? !productionSet.has(date) : closedSet.has(date);
      const dayLogs = (data.cleaningLogs || []).filter((l: any) => l.log_date === date);
      for (const task of data.cleaningTasks || []) {
        const freq = (task.frequency || "daily").toLowerCase();
        const log = dayLogs.find((l: any) => l.task_id === task.id);
        if (freq !== "daily" && !log) continue;
        const status = exempt
          ? onDemand
            ? "Not a production day"
            : "Closed — exempt"
          : log?.done
            ? "Done"
            : "Missed";
        rows.push([
          dateOr(date),
          task.task || "—",
          task.area || "—",
          freq,
          status,
          log?.completed_by_name || "—",
          log?.completed_at ? dateOr(log.completed_at, "dd/MM/yyyy HH:mm") : "—",
          log?.notes || "",
        ]);
      }
    }
    add(
      "2 Cleaning",
      sheet(
        body(rows, ["Date", "Task", "Area", "Frequency", "Status", "Completed by", "Completed at", "Notes"]),
        [12, 30, 18, 12, 20, 20, 20, 34],
      ),
    );
  }

  if (on("pest")) {
    add(
      "2 Pest",
      sheet(
        body(
          (data.pestLogs || []).map((p: any) => [
            dateOr(p.reported_at),
            p.type || "—",
            p.location || "—",
            p.action_taken || "—",
            p.resolved ? "Resolved" : "Open",
            p.reported_by_name || "—",
          ]),
          ["Reported", "Type", "Location", "Action taken", "Status", "Reported by"],
        ),
        [14, 18, 22, 44, 12, 20],
      ),
    );

    add(
      "2 Maintenance",
      sheet(
        body(
          (data.maintenanceLogs || []).map((m: any) => [
            dateOr(m.reported_at),
            m.item || "—",
            m.issue || "—",
            m.priority || "—",
            m.status || "open",
            m.resolved_at ? dateOr(m.resolved_at) : "—",
          ]),
          ["Reported", "Item", "Issue", "Priority", "Status", "Resolved"],
        ),
        [14, 24, 44, 12, 12, 14],
      ),
    );

    add(
      "2 PPM",
      sheet(
        body(
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
          ["Task", "Frequency", "Contractor", "Last completed", "Next due", "Status"],
        ),
        [30, 14, 24, 16, 14, 14],
      ),
    );
  }

  // ── SECTION 3 — CONFIDENCE IN MANAGEMENT ──────────────────────────────────
  if (on("fsms")) {
    const sys: any = data.sfbbSystem || {};
    const fsmsRows: any[][] = [
      ["FOOD SAFETY MANAGEMENT SYSTEM"],
      [],
      ["Statement", s.fsmsStatement],
      ["Route", sys.route === "upload" ? "Completed SFBB pack uploaded" : "Safe methods completed in MiseOS"],
      ["First completed", sys.first_completed_at ? dateOr(sys.first_completed_at) : "No record"],
      ["Last reviewed", sys.last_reviewed_at ? dateOr(sys.last_reviewed_at) : "No record"],
      ["Reviewed by", sys.reviewed_by_name || "No record"],
      [],
      ["UPLOADED DOCUMENTS"],
      ["Document", "Date completed", "Review date", "Uploaded by"],
      ...((data.sfbbDocuments || []).length
        ? data.sfbbDocuments.map((d: any) => [
            d.name || "—",
            d.date_completed ? dateOr(d.date_completed) : "No record",
            d.review_date ? dateOr(d.review_date) : "No record",
            d.uploaded_by_name || "—",
          ])
        : NONE),
      [],
      ["SAFE METHODS"],
      ["Safe method", "Status", "How this is done"],
      ...((data.safeMethods || []).length
        ? data.safeMethods.map((m: any) => [
            safeMethodDef(m.method_key)?.title ?? m.method_key,
            m.status === "documented" ? "Documented" : m.status === "not_relevant" ? "Not relevant" : "To do",
            m.how_text || "—",
          ])
        : NONE),
      [],
      ["HACCP PLANS"],
      ["Plan", "Status", "Last reviewed", "Next review"],
      ...((data.haccpPlans || []).length
        ? data.haccpPlans.map((h: any) => [
            h.name || "—",
            (h.status || "draft").toUpperCase(),
            h.last_reviewed_at ? dateOr(h.last_reviewed_at) : "No record",
            h.review_due_at ? dateOr(h.review_due_at) : "No record",
          ])
        : NONE),
    ];
    add("3 Management System", sheet(fsmsRows, [36, 30, 60, 20]));
  }

  if (on("training")) {
    add(
      "3 Training",
      sheet(
        body(
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
                t.certificate_url ? "On file" : "—",
              ];
            }),
          ["Training", "Type", "Completed", "Expires", "Status", "Certificate"],
        ),
        [30, 18, 14, 14, 16, 14],
      ),
    );

    add(
      "3 Fitness to Work",
      sheet(
        body(
          (data.fitnessRecords || []).map((f: any) => [
            f.reported_date ? dateOr(f.reported_date) : "—",
            f.staff_name || "—",
            f.symptoms || "—",
            f.excluded_from ? dateOr(f.excluded_from) : "—",
            f.cleared_to_return ? dateOr(f.cleared_to_return) : "—",
            f.status === "cleared" ? "Cleared" : "Excluded",
          ]),
          ["Reported", "Person", "Symptoms", "Excluded from", "Cleared to return", "Status"],
        ),
        [14, 22, 34, 16, 18, 12],
      ),
    );
  }

  if (on("incidents")) {
    add(
      "3 Incidents",
      sheet(
        body(
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
              i.resolved_at ? dateOr(i.resolved_at) : "—",
            ]),
          ["Reported", "Type", "Title", "Immediate action", "Root cause", "Status", "Resolved"],
        ),
        [14, 16, 28, 38, 34, 12, 14],
      ),
    );
  }

  if (on("suppliers")) {
    add(
      "3 Suppliers",
      sheet(
        body(
          (data.suppliers || []).map((sp: any) => [
            sp.name || "—",
            sp.category || "—",
            sp.approved ? "Yes" : "No",
            sp.contact_name || "—",
            sp.contact_phone || sp.contact_email || "—",
            sp.notes || "",
          ]),
          ["Supplier", "Category", "Approved", "Contact", "Phone / email", "Notes"],
        ),
        [28, 16, 10, 20, 26, 34],
      ),
    );

    add(
      "3 Deliveries",
      sheet(
        body(
          (data.deliveries || [])
            .slice()
            .sort((a: any, b: any) => (a.logged_at < b.logged_at ? 1 : -1))
            .map((d: any) => [
              dateOr(d.logged_at, "dd/MM/yyyy HH:mm"),
              d.suppliers?.name || d.supplier_name || "—",
              d.items || d.items_received || "—",
              d.temp != null ? `${d.temp}°C` : d.temperature != null ? `${d.temperature}°C` : "—",
              d.use_by_ok ? "Yes" : "No",
              d.packaging_ok === false ? "No" : "Yes",
              d.accepted === false ? "Rejected" : "Accepted",
              d.logged_by_name || "—",
            ]),
          ["Logged", "Supplier", "Items", "Temp", "Use-by OK", "Packaging OK", "Outcome", "Logged by"],
        ),
        [18, 24, 30, 10, 12, 14, 14, 20],
      ),
    );
  }

  if (on("reviews")) {
    add(
      "3 Reviews",
      sheet(
        body(
          (data.reviews || []).map((rv: any) => [
            `${rv.period_start} → ${rv.period_end}`,
            onDemand ? String(rv.production_days_covered ?? "—") : rv.completed_at ? dateOr(rv.completed_at) : "—",
            rv.problems_observed ? "Yes" : "No",
            rv.problems_detail || "—",
            rv.action_taken || "—",
            rv.completed_by_name || "—",
          ]),
          [
            "Period",
            onDemand ? "Production days covered" : "Completed",
            "Problems observed",
            "Detail",
            "Action taken",
            "Completed by",
          ],
        ),
        [26, 20, 16, 38, 38, 20],
      ),
    );
  }

  // ── Day-by-day / production days ──────────────────────────────────────────
  if (full) {
    add(
      onDemand ? "Production Days" : "Day Sheets",
      sheet(
        onDemand
          ? body(
              (data.productionDays || []).map((d: any) => [
                dateOr(d.production_date),
                d.started_at ? dateOr(d.started_at, "HH:mm") : "—",
                d.finished_at ? dateOr(d.finished_at, "HH:mm") : "Open",
                d.notes || "",
              ]),
              ["Production date", "Started", "Finished", "Notes"],
            )
          : body(
              (data.daySheets || [])
                .slice()
                .sort((a: any, b: any) => (a.sheet_date < b.sheet_date ? 1 : -1))
                .map((d: any) => [
                  dateOr(d.sheet_date),
                  d.opening_complete ? "Complete" : "Incomplete",
                  d.closing_complete ? "Complete" : "Incomplete",
                  d.signed_off_by_name || d.locked_by_name || "—",
                  d.locked_at ? dateOr(d.locked_at, "dd/MM/yyyy HH:mm") : "—",
                  d.notes || "",
                ]),
              ["Date", "Opening checks", "Closing checks", "Signed off by", "Locked at", "Notes"],
            ),
        [16, 18, 18, 22, 20, 34],
      ),
    );
  }

  // ── Audit trail ───────────────────────────────────────────────────────────
  const auditRows: any[][] = [
    ["AUDIT TRAIL & RECORD KEEPING"],
    [],
    ["Business", data.orgName],
    ["Site", data.siteName],
    ["Period covered", `${s.periodLabel} (${data.range.days} days)`],
    ["Level of detail", full ? "Full records" : "Overview"],
    ["Generated", format(new Date(data.generatedAt), "dd/MM/yyyy HH:mm")],
    [
      onDemand ? "Production days in period" : "Closed days in period",
      onDemand ? data.productionDaysCount : data.closedDaysCount,
    ],
    [],
    ["RECORDS COMPLETED BY USER"],
    ["User", "Records completed"],
    ...((data.recordAuthors || []).length
      ? data.recordAuthors.map((a) => [a.name, a.count])
      : NONE),
    [],
    ["STATEMENTS"],
    [
      "Records were completed digitally in MiseOS by a named user, with a timestamp captured at the moment of entry.",
    ],
    [
      onDemand
        ? "Completion figures exclude days that were not declared production days; those days carry no checks."
        : "Completion figures exclude days the business was closed; closed days carry no checks.",
    ],
    ["Records are retained for 7 years and remain available in MiseOS."],
    [
      "This workbook presents the records held for a single site. It supports inspection and does not replace the local authority officer's judgement.",
    ],
  ];
  add("Audit Trail", sheet(auditRows, [40, 90]));

  XLSX.writeFile(
    wb,
    `Inspection-Pack_${data.siteName.replace(/\s+/g, "-")}_${format(new Date(), "yyyy-MM-dd")}.xlsx`,
  );
}
