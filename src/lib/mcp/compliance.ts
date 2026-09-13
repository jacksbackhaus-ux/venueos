/**
 * Shared compliance maths for the MCP read tools and the Inspection Pack.
 *
 * These are the same rules the app applies on screen (useSafeToTrade,
 * usePriorityFeed, lib/reports): a closed day and a day with no declared
 * production day are NEUTRAL. They never raise an overdue item and they are
 * removed from both sides of every completion figure, so an assistant can
 * never tell a home baker they missed checks on a day they did not trade.
 */

import { classifySection } from "../opsTime";
import { computeReviewCadence } from "../sfbb";
import {
  addDaysISO,
  daysBetweenISO,
  eachDateISO,
  ok,
  siteNow,
  type SiteMeta,
} from "./helpers";
import type { supabaseForUser } from "./supabase";

type Client = ReturnType<typeof supabaseForUser>;

/** Probe calibrations are expected monthly, matching useProbeCalibrations. */
const PROBE_CALIBRATION_DAYS = 31;
/** Training expiring inside this window is worth flagging, as in the app. */
const TRAINING_EXPIRY_WARNING_DAYS = 30;

/**
 * Training is renewed by adding a new record, so the superseded one stays on
 * file. Only the most recent record for each person/course says whether that
 * training is actually in date — anything older must never raise a flag.
 */
export interface TrainingRecordRow {
  user_id?: string | null;
  training_name?: string | null;
  expiry_date?: string | null;
  completed_date?: string | null;
}

export function currentTrainingRecords<T extends TrainingRecordRow>(rows: T[]): T[] {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const key = `${row.user_id ?? ""}::${(row.training_name ?? "").trim().toLowerCase()}`;
    const held = latest.get(key);
    const rank = (r: T) => `${r.completed_date ?? ""}|${r.expiry_date ?? ""}`;
    if (!held || rank(row) > rank(held)) latest.set(key, row);
  }
  return [...latest.values()];
}

// ──────────────────────────────────────────────────────────────────
// WHICH DAYS COUNT
// ──────────────────────────────────────────────────────────────────

export interface DayBasis {
  /** Dates the site declared closed inside the range. */
  closedDates: Set<string>;
  /** Declared production dates inside the range (on_demand sites only). */
  productionDates: Set<string>;
  /** The only dates compliance may be measured against. */
  countedDates: string[];
  /** "production days" or "open days". */
  label: string;
  /** One sentence explaining what was excluded and why. */
  note: string;
}

export async function loadDayBasis(
  client: Client,
  site: SiteMeta,
  fromISO: string,
  toISO: string,
): Promise<DayBasis> {
  const onDemand = site.operating_mode === "on_demand";
  const [closedRows, productionRows] = await Promise.all([
    client
      .from("closed_days")
      .select("closed_date")
      .eq("site_id", site.id)
      .gte("closed_date", fromISO)
      .lte("closed_date", toISO),
    onDemand
      ? client
          .from("production_days")
          .select("production_date")
          .eq("site_id", site.id)
          .gte("production_date", fromISO)
          .lte("production_date", toISO)
      : Promise.resolve({ data: [] as { production_date: string }[], error: null }),
  ]);

  const closedDates = new Set(
    ((ok(closedRows as never) as { closed_date: string }[] | null) ?? []).map((r) => r.closed_date),
  );
  const productionDates = new Set(
    ((ok(productionRows as never) as { production_date: string }[] | null) ?? []).map(
      (r) => r.production_date,
    ),
  );

  const allDates = eachDateISO(fromISO, toISO);
  const countedDates = onDemand
    ? allDates.filter((d) => productionDates.has(d) && !closedDates.has(d))
    : allDates.filter((d) => !closedDates.has(d));

  const note = onDemand
    ? `${countedDates.length} production day${countedDates.length === 1 ? "" : "s"} declared in this period. ` +
      "Days with no declared production carry no checks and are excluded from every figure here."
    : `${closedDates.size} closed day${closedDates.size === 1 ? "" : "s"} in this period are excluded from every figure here.`;

  return {
    closedDates,
    productionDates,
    countedDates,
    label: onDemand ? "production days" : "open days",
    note,
  };
}

/**
 * The previous day the site was actually working — yesterday for a scheduled
 * site, the last declared production day for an on-demand one. Returns null
 * when there isn't one, so nothing is ever reported as missed.
 */
export async function previousWorkingDay(
  client: Client,
  site: SiteMeta,
  dateISO: string,
): Promise<string | null> {
  if (dateISO <= site.created_on) return null;
  if (site.operating_mode === "on_demand") {
    const rows = ok(
      await client
        .from("production_days")
        .select("production_date")
        .eq("site_id", site.id)
        .lt("production_date", dateISO)
        .order("production_date", { ascending: false })
        .limit(1),
    ) as { production_date: string }[] | null;
    return rows?.[0]?.production_date ?? null;
  }
  const yesterday = addDaysISO(dateISO, -1);
  if (yesterday < site.created_on) return null;
  const closed = ok(
    await client
      .from("closed_days")
      .select("id")
      .eq("site_id", site.id)
      .eq("closed_date", yesterday)
      .maybeSingle(),
  );
  return closed ? null : yesterday;
}

// ──────────────────────────────────────────────────────────────────
// OUTSTANDING ACTIONS
// ──────────────────────────────────────────────────────────────────

export type Severity = "critical" | "important" | "operational";

export interface OutstandingAction {
  severity: Severity;
  area: string;
  title: string;
  detail?: string;
}

export interface OutstandingResult {
  site_id: string;
  site_name: string;
  date: string;
  /** Set when nothing is due at all, with the reason why. */
  nothing_due_reason?: string;
  operating_mode: string;
  actions: OutstandingAction[];
  counts: { critical: number; important: number; operational: number };
}

export async function outstandingActions(
  client: Client,
  site: SiteMeta,
  dateISO: string,
): Promise<OutstandingResult> {
  const empty = (reason: string): OutstandingResult => ({
    site_id: site.id,
    site_name: site.name,
    date: dateISO,
    nothing_due_reason: reason,
    operating_mode: site.operating_mode,
    actions: [],
    counts: { critical: 0, important: 0, operational: 0 },
  });

  const basis = await loadDayBasis(client, site, dateISO, dateISO);
  if (basis.closedDates.has(dateISO)) {
    return empty("The site was closed on this date, so nothing was due.");
  }
  if (site.operating_mode === "on_demand" && !basis.productionDates.has(dateISO)) {
    return empty(
      "No production day is declared for this date. On-demand sites are only measured on declared production days, so nothing is due or overdue.",
    );
  }

  const now = siteNow(site.timezone);
  const viewingToday = dateISO === now.dateISO;
  const backWindow = addDaysISO(dateISO, -14);
  const prevWorkingDay = await previousWorkingDay(client, site, dateISO);

  const [
    breaches,
    units,
    tempLogsToday,
    cleaningTasks,
    cleaningLogsPrev,
    cleaningLogsToday,
    sections,
    daySheet,
    incidents,
    expiredBatches,
    training,
    probes,
    reviews,
    reviewProductionDays,
    closedWindow,
  ] = await Promise.all([
    client
      .from("temp_logs")
      .select("id, value, unit_id, food_item, logged_at")
      .eq("site_id", site.id)
      .eq("pass", false)
      .is("corrective_action", null)
      .gte("logged_at", `${backWindow}T00:00:00`)
      .lte("logged_at", `${dateISO}T23:59:59`)
      .order("logged_at", { ascending: false })
      .limit(25),
    client.from("temp_units").select("id, name").eq("site_id", site.id).eq("active", true),
    client
      .from("temp_logs")
      .select("unit_id, log_type")
      .eq("site_id", site.id)
      .gte("logged_at", `${dateISO}T00:00:00`)
      .lte("logged_at", `${dateISO}T23:59:59`),
    client
      .from("cleaning_tasks")
      .select("id, task, area, due_time")
      .eq("site_id", site.id)
      .eq("active", true)
      .eq("frequency", "daily"),
    prevWorkingDay
      ? client
          .from("cleaning_logs")
          .select("task_id, done")
          .eq("site_id", site.id)
          .eq("log_date", prevWorkingDay)
      : Promise.resolve({ data: [] as { task_id: string; done: boolean }[], error: null }),
    client.from("cleaning_logs").select("task_id, done").eq("site_id", site.id).eq("log_date", dateISO),
    client
      .from("day_sheet_sections")
      .select("id, title, default_time, day_sheet_items(id, label, active)")
      .eq("site_id", site.id)
      .eq("active", true),
    client
      .from("day_sheets")
      .select("id, day_sheet_entries(item_id, done)")
      .eq("site_id", site.id)
      .eq("sheet_date", dateISO)
      .maybeSingle(),
    client
      .from("incidents")
      .select("id, title, type, reported_at")
      .eq("site_id", site.id)
      .eq("status", "open")
      .order("reported_at", { ascending: false })
      .limit(25),
    client
      .from("batches")
      .select("id, product_name, use_by_date")
      .eq("site_id", site.id)
      .neq("status", "disposed")
      .neq("status", "used")
      .not("use_by_date", "is", null)
      .lt("use_by_date", dateISO)
      .limit(25),
    client
      .from("training_records")
      .select("id, training_name, expiry_date, completed_date, user_id")
      .eq("site_id", site.id)
      .not("expiry_date", "is", null),
    client
      .from("probe_calibrations")
      .select("calibrated_at")
      .eq("site_id", site.id)
      .order("calibrated_at", { ascending: false })
      .limit(1),
    client
      .from("reviews")
      .select("id, status, period_start, period_end")
      .eq("site_id", site.id)
      .order("period_end", { ascending: false })
      .limit(10),
    site.operating_mode === "on_demand"
      ? client.from("production_days").select("production_date").eq("site_id", site.id)
      : Promise.resolve({ data: [] as { production_date: string }[], error: null }),
    client
      .from("closed_days")
      .select("closed_date")
      .eq("site_id", site.id)
      .gte("closed_date", backWindow)
      .lte("closed_date", dateISO),
  ]);

  const actions: OutstandingAction[] = [];
  const unitRows = (ok(units as never) as { id: string; name: string }[] | null) ?? [];
  const unitName = new Map(unitRows.map((u) => [u.id, u.name]));

  // Days in the back-window that carry no obligations at all.
  const closedBack = new Set(
    ((ok(closedWindow as never) as { closed_date: string }[] | null) ?? []).map(
      (c) => c.closed_date,
    ),
  );
  const productionAll = new Set(
    ((ok(reviewProductionDays as never) as { production_date: string }[] | null) ?? []).map(
      (p) => p.production_date,
    ),
  );
  const countedBackDay = (d: string) => {
    if (closedBack.has(d)) return false;
    if (site.operating_mode === "on_demand") return productionAll.has(d);
    return true;
  };

  // 🔴 Temperature failures with no corrective action recorded.
  for (const b of (ok(breaches as never) as Record<string, unknown>[] | null) ?? []) {
    const logDate = String(b.logged_at ?? "").slice(0, 10);
    if (!countedBackDay(logDate)) continue;
    const label = unitName.get(b.unit_id as string) ?? (b.food_item as string) ?? "Reading";
    actions.push({
      severity: "critical",
      area: "Temperatures",
      title: `${label} failed at ${b.value}°C with no corrective action recorded`,
      detail: `Logged ${logDate}. Record what was done to make the food safe.`,
    });
  }

  // 🟠 Temperature rounds that are past their expected time.
  // Only overdue once the time has actually passed — never before.
  const logsToday = (ok(tempLogsToday as never) as { unit_id: string; log_type: string }[] | null) ?? [];
  const amDone = new Set(logsToday.filter((l) => l.log_type === "AM Check").map((l) => l.unit_id));
  const pmDone = new Set(logsToday.filter((l) => l.log_type === "PM Check").map((l) => l.unit_id));
  const amOverdue = !viewingToday || now.hour >= 11;
  const pmOverdue = !viewingToday || now.hour >= 18;
  for (const u of unitRows) {
    if (amOverdue && !amDone.has(u.id)) {
      actions.push({ severity: "important", area: "Temperatures", title: `${u.name} — AM check not logged` });
    }
    if (pmOverdue && !pmDone.has(u.id)) {
      actions.push({ severity: "important", area: "Temperatures", title: `${u.name} — PM check not logged` });
    }
  }

  // 🟠 Cleaning due today (only once its due time has passed) and cleaning
  // missed on the previous day the site actually worked.
  const dailyTasks =
    (ok(cleaningTasks as never) as { id: string; task: string; area: string; due_time: string | null }[] | null) ??
    [];
  const prevDone = new Set(
    ((ok(cleaningLogsPrev as never) as { task_id: string; done: boolean }[] | null) ?? [])
      .filter((l) => l.done)
      .map((l) => l.task_id),
  );
  // Only chase the previous working day when it is recent enough to still be
  // worth catching up on — an on-demand site's last production day may be
  // months back, and nagging about it helps nobody.
  const chasePreviousDay = !!prevWorkingDay && daysBetweenISO(prevWorkingDay, dateISO) <= 14;
  if (prevWorkingDay && chasePreviousDay) {
    for (const t of dailyTasks) {
      if (!prevDone.has(t.id)) {
        actions.push({
          severity: "important",
          area: "Cleaning",
          title: `Not completed on ${prevWorkingDay} — ${t.task}`,
          detail: t.area,
        });
      }
    }
  }

  const todayDone = new Set(
    ((ok(cleaningLogsToday as never) as { task_id: string; done: boolean }[] | null) ?? [])
      .filter((l) => l.done)
      .map((l) => l.task_id),
  );
  for (const t of dailyTasks) {
    if (todayDone.has(t.id)) continue;
    // A task with a due time is not outstanding until that time has passed.
    if (viewingToday && t.due_time) {
      const [hh, mm] = String(t.due_time).slice(0, 5).split(":").map(Number);
      if (!Number.isNaN(hh) && now.minutes < hh * 60 + (Number.isNaN(mm) ? 0 : mm)) continue;
    }
    actions.push({
      severity: "operational",
      area: "Cleaning",
      title: viewingToday ? `Due today — ${t.task}` : `Not completed on ${dateISO} — ${t.task}`,
      detail: t.area,
    });
  }

  // 🟠 Day sheet items that are due in the window that has already passed.
  const sectionRows =
    (ok(sections as never) as {
      id: string;
      title: string;
      default_time: string | null;
      day_sheet_items: { id: string; label: string; active: boolean }[] | null;
    }[] | null) ?? [];
  const sheet = ok(daySheet as never) as
    | { id: string; day_sheet_entries: { item_id: string; done: boolean }[] | null }
    | null;
  const doneItems = new Set(
    (sheet?.day_sheet_entries ?? []).filter((e) => e.done).map((e) => e.item_id),
  );
  const opsWindow = !viewingToday
    ? "closing"
    : now.hour < 11
      ? "opening"
      : now.hour < 16
        ? "midday"
        : "closing";
  for (const section of sectionRows) {
    const cls = classifySection(section);
    const dueNow =
      cls === "opening" ||
      (cls === "midday" && (opsWindow === "midday" || opsWindow === "closing")) ||
      (cls === "closing" && opsWindow === "closing");
    if (!dueNow) continue;
    for (const item of (section.day_sheet_items ?? []).filter((i) => i.active)) {
      if (!doneItems.has(item.id)) {
        actions.push({
          severity: "important",
          area: "Day sheet",
          title: `${section.title} — ${item.label}`,
        });
      }
    }
  }

  // 🟠 Open incidents.
  for (const inc of (ok(incidents as never) as Record<string, unknown>[] | null) ?? []) {
    actions.push({
      severity: "important",
      area: "Incidents",
      title: `Open incident: ${inc.title}`,
      detail: `${inc.type ?? "incident"} · reported ${String(inc.reported_at ?? "").slice(0, 10)}`,
    });
  }

  // 🟠 Stock past its use-by that has not been used or disposed.
  for (const b of (ok(expiredBatches as never) as Record<string, unknown>[] | null) ?? []) {
    actions.push({
      severity: "important",
      area: "Batches",
      title: `${b.product_name} is past its use-by (${b.use_by_date})`,
      detail: "Dispose of it and record the reason, or extend the use-by with a justification.",
    });
  }

  // 🟠 Training that has expired or is about to.
  const currentTraining = currentTrainingRecords(
    ((ok(training as never) as Record<string, unknown>[] | null) ?? []) as TrainingRecordRow[],
  );
  for (const t of currentTraining) {
    const expiry = String(t.expiry_date);
    const days = daysBetweenISO(dateISO, expiry);
    // Renewed training is not overdue, and training that expires months away
    // is not yet worth raising.
    if (days > TRAINING_EXPIRY_WARNING_DAYS) continue;
    actions.push({
      severity: days < 0 ? "important" : "operational",
      area: "Training",
      title:
        days < 0
          ? `${t.training_name} expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`
          : `${t.training_name} expires in ${days} day${days === 1 ? "" : "s"}`,
    });
  }

  // 🔵 Probe calibration.
  const lastProbe = (ok(probes as never) as { calibrated_at: string }[] | null)?.[0] ?? null;
  const probeAgeDays = lastProbe
    ? daysBetweenISO(String(lastProbe.calibrated_at).slice(0, 10), dateISO)
    : null;
  if (probeAgeDays === null || probeAgeDays > PROBE_CALIBRATION_DAYS) {
    actions.push({
      severity: "operational",
      area: "Probe calibration",
      title:
        probeAgeDays === null
          ? "No probe calibration check has ever been recorded"
          : `Probe last calibrated ${probeAgeDays} days ago`,
      detail: "An iced-water and boiling-water check is expected monthly.",
    });
  }

  // 🟠 Periodic review. Only ever due once a first period exists, so no
  // existing customer is handed retroactive work.
  const reviewRows = (ok(reviews as never) as Record<string, unknown>[] | null) ?? [];
  const lastComplete = reviewRows.find((r) => r.status === "complete") ?? null;
  const openReview = reviewRows.find((r) => r.status !== "complete") ?? null;
  const periodStart =
    (openReview?.period_start as string | undefined) ??
    (lastComplete ? addDaysISO(lastComplete.period_end as string, 1) : null);
  if (periodStart) {
    const cadence = computeReviewCadence({
      mode: site.operating_mode,
      periodStartISO: periodStart,
      productionDates: [...productionAll],
      todayISO: dateISO,
    });
    if (cadence.due) {
      actions.push({
        severity: "important",
        area: "Compliance",
        title: `The ${cadence.reviewLabel} is due`,
        detail: `Period from ${cadence.periodStart} · ${cadence.progressLabel}`,
      });
    }
  }

  const counts = {
    critical: actions.filter((a) => a.severity === "critical").length,
    important: actions.filter((a) => a.severity === "important").length,
    operational: actions.filter((a) => a.severity === "operational").length,
  };
  const order: Record<Severity, number> = { critical: 0, important: 1, operational: 2 };
  actions.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    site_id: site.id,
    site_name: site.name,
    date: dateISO,
    operating_mode: site.operating_mode,
    actions,
    counts,
  };
}

// ──────────────────────────────────────────────────────────────────
// COMPLETION FIGURES OVER A PERIOD
// ──────────────────────────────────────────────────────────────────

const pct = (done: number, total: number) => (total === 0 ? null : Math.round((done / total) * 100));

/** Start of the ISO week (Monday) containing `dateISO`. */
function weekStartISO(dateISO: string): string {
  const d = new Date(`${dateISO}T12:00:00Z`);
  const shift = (d.getUTCDay() + 6) % 7; // Monday = 0
  return addDaysISO(dateISO, -shift);
}

function monthStartISO(dateISO: string): string {
  return `${dateISO.slice(0, 7)}-01`;
}

/**
 * Cleaning completion, counted in the buckets each task is actually scheduled
 * in (daily / weekly / monthly). A bucket whose every in-range day is closed or
 * non-production is exempt — it leaves the denominator entirely.
 */
export function cleaningCompletion(
  tasks: { id: string; frequency: string | null }[],
  logs: { task_id: string; log_date: string; done: boolean }[],
  countedDates: string[],
  allDates: string[],
) {
  const counted = new Set(countedDates);
  const doneByTask = new Map<string, Set<string>>();
  for (const l of logs) {
    if (!l.done) continue;
    if (!doneByTask.has(l.task_id)) doneByTask.set(l.task_id, new Set());
    doneByTask.get(l.task_id)!.add(l.log_date);
  }

  let expected = 0;
  let done = 0;
  let exempt = 0;

  for (const task of tasks) {
    const freq = (task.frequency ?? "daily").toLowerCase();
    const buckets = new Map<string, string[]>();
    for (const d of allDates) {
      const key = freq === "weekly" ? weekStartISO(d) : freq === "monthly" ? monthStartISO(d) : d;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(d);
    }
    const logged = doneByTask.get(task.id) ?? new Set<string>();
    for (const days of buckets.values()) {
      if (!days.some((d) => counted.has(d))) {
        exempt += 1;
        continue;
      }
      expected += 1;
      if (days.some((d) => logged.has(d))) done += 1;
    }
  }

  return { expected, done, exempt, pct: pct(done, expected) };
}

export interface ComplianceSummary {
  site: { id: string; name: string; premises_type: string; operating_mode: string };
  period: { from: string; to: string; days: number };
  day_basis: { label: string; counted_days: number; note: string };
  temperatures: {
    readings: number;
    failures: number;
    unresolved_failures: number;
    pass_rate_pct: number | null;
    storage_readings: number;
    process_checks: number;
  };
  cleaning: { completion_pct: number | null; done: number; expected: number; exempt: number };
  day_sheets: { created: number; expected: number; completion_pct: number | null; signed_off: number };
  incidents: { total: number; open: number };
  batches: { produced: number; past_use_by_unresolved: number };
  deliveries: { total: number; accepted: number; rejected: number };
  suppliers: { total: number; approved: number };
  training: { records: number; expired: number; expiring_soon: number };
  probe_calibration: { checks: number; passed: number; last_checked: string | null; due: boolean };
  reviews: { completed_in_period: number; due_now: boolean; review_label: string; progress: string };
  fitness_to_work: { records: number; currently_excluded: number };
}

export async function complianceSummary(
  client: Client,
  site: SiteMeta,
  requestedFrom: string,
  toISO: string,
): Promise<ComplianceSummary> {
  // Days before the site existed cannot carry checks, so never count them.
  const fromISO = requestedFrom < site.created_on ? site.created_on : requestedFrom;
  const basis = await loadDayBasis(client, site, fromISO, toISO);
  const allDates = eachDateISO(fromISO, toISO);
  const counted = new Set(basis.countedDates);
  const todayISO = siteNow(site.timezone).dateISO;

  const [
    tempLogs,
    cleaningTasks,
    cleaningLogs,
    daySheets,
    incidents,
    batches,
    expiredBatches,
    deliveries,
    suppliers,
    training,
    probes,
    reviews,
    reviewProductionDays,
    fitness,
  ] = await Promise.all([
    client
      .from("temp_logs")
      .select("id, unit_id, pass, corrective_action, logged_at")
      .eq("site_id", site.id)
      .gte("logged_at", `${fromISO}T00:00:00`)
      .lte("logged_at", `${toISO}T23:59:59`),
    client.from("cleaning_tasks").select("id, frequency").eq("site_id", site.id).eq("active", true),
    client
      .from("cleaning_logs")
      .select("task_id, log_date, done")
      .eq("site_id", site.id)
      .gte("log_date", fromISO)
      .lte("log_date", toISO),
    client
      .from("day_sheets")
      .select("id, sheet_date, signed_off, locked")
      .eq("site_id", site.id)
      .gte("sheet_date", fromISO)
      .lte("sheet_date", toISO),
    client
      .from("incidents")
      .select("id, status")
      .eq("site_id", site.id)
      .gte("reported_at", `${fromISO}T00:00:00`)
      .lte("reported_at", `${toISO}T23:59:59`),
    client
      .from("batches")
      .select("id")
      .eq("site_id", site.id)
      .gte("date_produced", fromISO)
      .lte("date_produced", toISO),
    client
      .from("batches")
      .select("id")
      .eq("site_id", site.id)
      .neq("status", "disposed")
      .neq("status", "used")
      .not("use_by_date", "is", null)
      .lt("use_by_date", todayISO),
    client
      .from("delivery_logs")
      .select("id, accepted")
      .eq("site_id", site.id)
      .gte("logged_at", `${fromISO}T00:00:00`)
      .lte("logged_at", `${toISO}T23:59:59`),
    client.from("suppliers").select("id, approved").eq("site_id", site.id).eq("active", true),
    client
      .from("training_records")
      .select("id, user_id, training_name, expiry_date, completed_date")
      .eq("site_id", site.id),
    client
      .from("probe_calibrations")
      .select("id, pass, calibrated_at")
      .eq("site_id", site.id)
      .order("calibrated_at", { ascending: false })
      .limit(50),
    client
      .from("reviews")
      .select("id, status, period_start, period_end, completed_at")
      .eq("site_id", site.id)
      .order("period_end", { ascending: false })
      .limit(30),
    site.operating_mode === "on_demand"
      ? client.from("production_days").select("production_date").eq("site_id", site.id)
      : Promise.resolve({ data: [] as { production_date: string }[], error: null }),
    client.from("fitness_to_work").select("id, status, reported_date").eq("site_id", site.id),
  ]);

  // Readings logged on a day that does not count are excluded outright.
  const temps = ((ok(tempLogs as never) as Record<string, unknown>[] | null) ?? []).filter((t) =>
    counted.has(String(t.logged_at ?? "").slice(0, 10)),
  );
  const failures = temps.filter((t) => t.pass === false);

  const cleaning = cleaningCompletion(
    (ok(cleaningTasks as never) as { id: string; frequency: string | null }[] | null) ?? [],
    (ok(cleaningLogs as never) as { task_id: string; log_date: string; done: boolean }[] | null) ?? [],
    basis.countedDates,
    allDates,
  );

  const sheets = ((ok(daySheets as never) as Record<string, unknown>[] | null) ?? []).filter((d) =>
    counted.has(String(d.sheet_date)),
  );
  const incidentRows = (ok(incidents as never) as { status: string }[] | null) ?? [];
  const deliveryRows = (ok(deliveries as never) as { accepted: boolean }[] | null) ?? [];
  const supplierRows = (ok(suppliers as never) as { approved: boolean }[] | null) ?? [];
  const allTraining = (ok(training as never) as TrainingRecordRow[] | null) ?? [];
  // Only each person's most recent record for a course decides whether that
  // training is in date; superseded records must never read as expired.
  const trainingRows = currentTrainingRecords(allTraining);
  const probeRows = (ok(probes as never) as { pass: boolean; calibrated_at: string }[] | null) ?? [];
  const reviewRows = (ok(reviews as never) as Record<string, unknown>[] | null) ?? [];
  const fitnessRows = (ok(fitness as never) as { status: string }[] | null) ?? [];

  const warnBy = addDaysISO(todayISO, TRAINING_EXPIRY_WARNING_DAYS);
  const lastProbe = probeRows[0]?.calibrated_at ?? null;
  const probeAge = lastProbe ? daysBetweenISO(String(lastProbe).slice(0, 10), todayISO) : null;

  const lastComplete = reviewRows.find((r) => r.status === "complete") ?? null;
  const openReview = reviewRows.find((r) => r.status !== "complete") ?? null;
  const periodStart =
    (openReview?.period_start as string | undefined) ??
    (lastComplete ? addDaysISO(lastComplete.period_end as string, 1) : null);
  const cadence = computeReviewCadence({
    mode: site.operating_mode,
    periodStartISO: periodStart ?? todayISO,
    productionDates: ((ok(reviewProductionDays as never) as { production_date: string }[] | null) ?? []).map(
      (p) => p.production_date,
    ),
    todayISO,
  });

  return {
    site: {
      id: site.id,
      name: site.name,
      premises_type: site.premises_type,
      operating_mode: site.operating_mode,
    },
    period: { from: fromISO, to: toISO, days: allDates.length },
    day_basis: { label: basis.label, counted_days: basis.countedDates.length, note: basis.note },
    temperatures: {
      readings: temps.length,
      failures: failures.length,
      unresolved_failures: failures.filter((t) => !t.corrective_action).length,
      pass_rate_pct: pct(temps.length - failures.length, temps.length),
      storage_readings: temps.filter((t) => !!t.unit_id).length,
      process_checks: temps.filter((t) => !t.unit_id).length,
    },
    cleaning: {
      completion_pct: cleaning.pct,
      done: cleaning.done,
      expected: cleaning.expected,
      exempt: cleaning.exempt,
    },
    day_sheets: {
      created: sheets.length,
      expected: basis.countedDates.length,
      completion_pct: pct(sheets.length, basis.countedDates.length),
      signed_off: sheets.filter((d) => d.signed_off === true).length,
    },
    incidents: {
      total: incidentRows.length,
      open: incidentRows.filter((i) => i.status !== "closed" && i.status !== "verified").length,
    },
    batches: {
      produced: ((ok(batches as never) as unknown[] | null) ?? []).length,
      past_use_by_unresolved: ((ok(expiredBatches as never) as unknown[] | null) ?? []).length,
    },
    deliveries: {
      total: deliveryRows.length,
      accepted: deliveryRows.filter((d) => d.accepted).length,
      rejected: deliveryRows.filter((d) => d.accepted === false).length,
    },
    suppliers: {
      total: supplierRows.length,
      approved: supplierRows.filter((s) => s.approved).length,
    },
    training: {
      records: allTraining.length,
      expired: trainingRows.filter((t) => t.expiry_date && t.expiry_date < todayISO).length,
      expiring_soon: trainingRows.filter(
        (t) => t.expiry_date && t.expiry_date >= todayISO && t.expiry_date <= warnBy,
      ).length,
    },
    probe_calibration: {
      checks: probeRows.length,
      passed: probeRows.filter((p) => p.pass).length,
      last_checked: lastProbe ? String(lastProbe) : null,
      due: probeAge === null || probeAge > PROBE_CALIBRATION_DAYS,
    },
    reviews: {
      completed_in_period: reviewRows.filter(
        (r) =>
          r.status === "complete" &&
          String(r.period_end ?? "") >= fromISO &&
          String(r.period_end ?? "") <= toISO,
      ).length,
      due_now: periodStart ? cadence.due : false,
      review_label: cadence.reviewLabel,
      progress: cadence.progressLabel,
    },
    fitness_to_work: {
      records: fitnessRows.length,
      currently_excluded: fitnessRows.filter((f) => f.status === "excluded").length,
    },
  };
}
