/**
 * Server-side Inspection Pack for the MCP connector.
 *
 * Structured around the three areas a Food Standards Agency inspector scores,
 * matching the PDF/Excel pack the app exports from Reports (src/lib/
 * inspectionPack.ts) so the two outputs always tell the same story. Closed and
 * non-production days are excluded throughout, via loadDayBasis.
 */

import { complianceSummary, loadDayBasis, type ComplianceSummary } from "./compliance";
import { ok, premisesLabel, type SiteMeta } from "./helpers";
import type { supabaseForUser } from "./supabase";

type Client = ReturnType<typeof supabaseForUser>;

export interface PackStat {
  label: string;
  value: string;
}

export interface InspectionPack {
  site: { id: string; name: string; address: string | null; premises: string };
  organisation: string;
  period: { from: string; to: string; label: string };
  day_basis: { label: string; counted_days: number; note: string };
  food_safety_management_system: string;
  hygienic_food_handling: PackStat[];
  premises_and_cleanliness: PackStat[];
  confidence_in_management: PackStat[];
  record_authors: { name: string; records: number }[];
  summary: ComplianceSummary;
  download: {
    note: string;
    url_path: string;
  };
}

const none = (n: number, text: string, empty: string) => (n === 0 ? empty : text);

export async function buildInspectionPack(
  client: Client,
  site: SiteMeta,
  requestedFrom: string,
  toISO: string,
): Promise<InspectionPack> {
  // Days before the site existed cannot carry checks, so never count them.
  const fromISO = requestedFrom < site.created_on ? site.created_on : requestedFrom;
  const [summary, basis] = await Promise.all([
    complianceSummary(client, site, fromISO, toISO),
    loadDayBasis(client, site, fromISO, toISO),
  ]);

  const [org, siteRow, pest, maintenance, recipes, recalls, safeMethods, sfbbSystem, sfbbDocs, haccp, authorSources] =
    await Promise.all([
      client.from("organisations").select("name").eq("id", site.organisation_id).maybeSingle(),
      client.from("sites").select("address").eq("id", site.id).maybeSingle(),
      client
        .from("pest_logs")
        .select("id, resolved")
        .eq("site_id", site.id)
        .gte("reported_at", `${fromISO}T00:00:00`)
        .lte("reported_at", `${toISO}T23:59:59`),
      client
        .from("maintenance_logs")
        .select("id, status")
        .eq("site_id", site.id)
        .gte("reported_at", `${fromISO}T00:00:00`)
        .lte("reported_at", `${toISO}T23:59:59`),
      client.from("recipes").select("id, approved, label_type").eq("site_id", site.id).eq("active", true),
      client.from("recalls").select("id").eq("site_id", site.id),
      client.from("safe_methods").select("method_key, status").eq("site_id", site.id),
      client
        .from("sfbb_system")
        .select("route, first_completed_at, last_reviewed_at")
        .eq("site_id", site.id)
        .maybeSingle(),
      client.from("sfbb_documents").select("id").eq("site_id", site.id),
      client.from("haccp_plans").select("id, status").eq("site_id", site.id),
      loadRecordAuthors(client, site, fromISO, toISO),
    ]);

  const pestRows = (ok(pest as never) as { resolved: boolean }[] | null) ?? [];
  const maintRows = (ok(maintenance as never) as { status: string }[] | null) ?? [];
  const recipeRows = (ok(recipes as never) as { approved: boolean; label_type: string | null }[] | null) ?? [];
  const recallCount = ((ok(recalls as never) as unknown[] | null) ?? []).length;
  const methodRows = (ok(safeMethods as never) as { status: string }[] | null) ?? [];
  const system = ok(sfbbSystem as never) as
    | { route: string; first_completed_at: string | null; last_reviewed_at: string | null }
    | null;
  const docCount = ((ok(sfbbDocs as never) as unknown[] | null) ?? []).length;
  const haccpPublished = ((ok(haccp as never) as { status: string }[] | null) ?? []).filter(
    (h) => h.status === "published",
  ).length;

  const t = summary.temperatures;
  const hygienic_food_handling: PackStat[] = [
    {
      label: "Storage temperature records (fridge / freezer)",
      value: none(t.storage_readings, `${t.storage_readings} readings logged`, "No records found for this period"),
    },
    {
      label: "Process checks (cooking, reheating, hot-holding, cooling, delivery)",
      value: none(t.process_checks, `${t.process_checks} checks logged`, "No records found for this period"),
    },
    {
      label: "Temperature pass rate",
      value:
        t.readings === 0
          ? "No records found for this period"
          : `${t.pass_rate_pct}% pass — ${t.failures} recorded failure${t.failures === 1 ? "" : "s"}, ${t.unresolved_failures} still without a corrective action`,
    },
    {
      label: "Probe calibration",
      value:
        summary.probe_calibration.checks === 0
          ? "No records found"
          : `${summary.probe_calibration.passed} of ${summary.probe_calibration.checks} checks passed · last checked ${String(summary.probe_calibration.last_checked).slice(0, 10)}`,
    },
    {
      label: "Allergen information",
      value:
        recipeRows.length === 0
          ? "No recipes recorded"
          : `${recipeRows.filter((r) => r.approved).length} of ${recipeRows.length} recipes approved · ${recipeRows.filter((r) => (r.label_type ?? "").toUpperCase() === "PPDS").length} PPDS item(s)`,
    },
    {
      label: "Batch & traceability",
      value:
        summary.batches.produced === 0
          ? "No batches recorded for this period"
          : `${summary.batches.produced} batch(es) produced · ${recallCount} withdrawal/recall record(s) on file`,
    },
    {
      label: "Deliveries",
      value:
        summary.deliveries.total === 0
          ? "No deliveries recorded for this period"
          : `${summary.deliveries.total} recorded · ${summary.deliveries.rejected} rejected on arrival`,
    },
  ];

  const premises_and_cleanliness: PackStat[] = [
    {
      label: "Cleaning completion",
      value:
        summary.cleaning.expected === 0
          ? "No cleaning schedule configured"
          : `${summary.cleaning.completion_pct}% (${summary.cleaning.done} of ${summary.cleaning.expected} scheduled occurrences${summary.cleaning.exempt > 0 ? `, ${summary.cleaning.exempt} exempt` : ""})`,
    },
    {
      label: "Pest control",
      value: none(
        pestRows.length,
        `${pestRows.length} entries · ${pestRows.filter((p) => !p.resolved).length} open`,
        "No sightings or issues recorded",
      ),
    },
    {
      label: "Maintenance",
      value: none(
        maintRows.length,
        `${maintRows.length} issues · ${maintRows.filter((m) => m.status !== "resolved" && m.status !== "closed").length} open`,
        "No maintenance issues recorded",
      ),
    },
  ];

  const confidence_in_management: PackStat[] = [
    { label: "Food safety management system", value: fsmsSummary(system, docCount, methodRows, haccpPublished) },
    {
      label: "Opening and closing checks",
      value:
        summary.day_sheets.expected === 0
          ? "No days to report on in this period"
          : `${summary.day_sheets.completion_pct}% of ${summary.day_basis.label} have a day sheet (${summary.day_sheets.created} of ${summary.day_sheets.expected}) · ${summary.day_sheets.signed_off} signed off`,
    },
    {
      label: "Staff training up to date",
      value:
        summary.training.records === 0
          ? "No training records found"
          : `${summary.training.records} record(s) · ${summary.training.expired} expired · ${summary.training.expiring_soon} expiring within 30 days`,
    },
    {
      label: summary.reviews.review_label === "periodic review" ? "Periodic reviews completed" : "4-weekly reviews completed",
      value:
        summary.reviews.completed_in_period === 0
          ? "No completed reviews fall in this period"
          : `${summary.reviews.completed_in_period} completed review(s) on file`,
    },
    {
      label: "Incidents & corrective actions",
      value:
        summary.incidents.total === 0
          ? "No incidents recorded for this period"
          : `${summary.incidents.total - summary.incidents.open} resolved · ${summary.incidents.open} open`,
    },
    {
      label: "Fitness to work records",
      value: none(
        summary.fitness_to_work.records,
        `${summary.fitness_to_work.records} record(s) · ${summary.fitness_to_work.currently_excluded} currently excluded`,
        "No exclusions recorded",
      ),
    },
    {
      label: "Approved suppliers",
      value: none(
        summary.suppliers.total,
        `${summary.suppliers.approved} of ${summary.suppliers.total} approved`,
        "No suppliers recorded",
      ),
    },
    { label: `Records completed across ${basis.label}`, value: basis.note },
  ];

  return {
    site: {
      id: site.id,
      name: site.name,
      address: ((ok(siteRow as never) as { address: string | null } | null)?.address) ?? null,
      premises: premisesLabel(site.premises_type),
    },
    organisation: ((ok(org as never) as { name: string } | null)?.name) ?? "Organisation",
    period: { from: fromISO, to: toISO, label: `${fromISO} to ${toISO}` },
    day_basis: summary.day_basis,
    food_safety_management_system: fsmsStatement(system, docCount, methodRows, haccpPublished),
    hygienic_food_handling,
    premises_and_cleanliness,
    confidence_in_management,
    record_authors: authorSources,
    summary,
    download: {
      note:
        "This is the full pack content. To download it as a branded PDF or Excel workbook, open Reports in MiseOS, pick the same timeframe and export the Inspection Pack.",
      url_path: "/reports",
    },
  };
}

/** Who actually recorded the evidence during the period — an inspector asks. */
async function loadRecordAuthors(
  client: Client,
  site: SiteMeta,
  fromISO: string,
  toISO: string,
): Promise<{ name: string; records: number }[]> {
  const [temps, cleaning, incidents, deliveries] = await Promise.all([
    client
      .from("temp_logs")
      .select("logged_by_name")
      .eq("site_id", site.id)
      .gte("logged_at", `${fromISO}T00:00:00`)
      .lte("logged_at", `${toISO}T23:59:59`),
    client
      .from("cleaning_logs")
      .select("completed_by_name")
      .eq("site_id", site.id)
      .gte("log_date", fromISO)
      .lte("log_date", toISO),
    client
      .from("incidents")
      .select("reported_by_name")
      .eq("site_id", site.id)
      .gte("reported_at", `${fromISO}T00:00:00`)
      .lte("reported_at", `${toISO}T23:59:59`),
    client
      .from("delivery_logs")
      .select("logged_by_name")
      .eq("site_id", site.id)
      .gte("logged_at", `${fromISO}T00:00:00`)
      .lte("logged_at", `${toISO}T23:59:59`),
  ]);

  const tally = new Map<string, number>();
  const add = (name: unknown) => {
    const n = typeof name === "string" ? name.trim() : "";
    if (!n) return;
    tally.set(n, (tally.get(n) ?? 0) + 1);
  };
  for (const r of (ok(temps as never) as Record<string, unknown>[] | null) ?? []) add(r.logged_by_name);
  for (const r of (ok(cleaning as never) as Record<string, unknown>[] | null) ?? []) add(r.completed_by_name);
  for (const r of (ok(incidents as never) as Record<string, unknown>[] | null) ?? []) add(r.reported_by_name);
  for (const r of (ok(deliveries as never) as Record<string, unknown>[] | null) ?? []) add(r.logged_by_name);

  return [...tally.entries()]
    .map(([name, records]) => ({ name, records }))
    .sort((a, b) => b.records - a.records);
}

type SfbbSystem = { route: string; first_completed_at: string | null; last_reviewed_at: string | null } | null;

function fsmsSummary(
  system: SfbbSystem,
  docCount: number,
  methods: { status: string }[],
  haccpPublished: number,
): string {
  const dates = [
    system?.first_completed_at ? `first completed ${String(system.first_completed_at).slice(0, 10)}` : null,
    system?.last_reviewed_at ? `last reviewed ${String(system.last_reviewed_at).slice(0, 10)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  if ((system?.route === "uploaded" || system?.route === "both") && docCount > 0) {
    return `Safer Food Better Business — completed pack uploaded${dates ? ` (${dates})` : ""}`;
  }
  const documented = methods.filter((m) => m.status === "documented").length;
  const relevant = methods.filter((m) => m.status !== "not_relevant").length;
  if (relevant > 0) {
    return `Safer Food Better Business — ${documented} of ${relevant} safe methods documented${dates ? ` (${dates})` : ""}`;
  }
  if (haccpPublished > 0) return `HACCP-based plan — ${haccpPublished} published`;
  return "Not yet completed in MiseOS";
}

function fsmsStatement(
  system: SfbbSystem,
  docCount: number,
  methods: { status: string }[],
  haccpPublished: number,
): string {
  const documented = methods.filter((m) => m.status === "documented").length;
  const relevant = methods.filter((m) => m.status !== "not_relevant").length;
  if ((system?.route === "uploaded" || system?.route === "both") && docCount > 0) {
    return (
      "This business operates a documented food safety management system based on Safer Food Better Business. " +
      `The completed SFBB pack is held on file (${docCount} document${docCount === 1 ? "" : "s"} uploaded to MiseOS) ` +
      "and the daily records that support it are maintained in MiseOS."
    );
  }
  if (relevant > 0) {
    return (
      "This business operates a documented food safety management system based on Safer Food Better Business, " +
      `with ${documented} of ${relevant} relevant safe methods written up and daily records maintained in MiseOS.`
    );
  }
  if (haccpPublished > 0) {
    return (
      `This business operates a documented HACCP-based food safety management system (${haccpPublished} published plan${haccpPublished === 1 ? "" : "s"}), ` +
      "with daily records maintained in MiseOS."
    );
  }
  return "This business maintains its daily food safety records in MiseOS. A written food safety management system (Safer Food Better Business or HACCP) has not yet been completed in the app.";
}
