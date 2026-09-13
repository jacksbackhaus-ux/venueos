import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { addDaysISO, guard, isoDate, ok, siteMeta, siteToday } from "../helpers";

const RECORD_TYPES = [
  "temperatures",
  "cleaning",
  "day_sheets",
  "batches",
  "deliveries",
  "incidents",
  "probe_calibrations",
  "production_days",
  "training",
  "fitness_to_work",
] as const;

type RecordType = (typeof RECORD_TYPES)[number];

const MAX_DAYS = 365;
const PER_TYPE_LIMIT = 200;

export default defineTool({
  name: "list_recent_records",
  title: "List recent records",
  description:
    "Pull the raw records behind a site's compliance for a date range — temperatures, cleaning, day sheets, batches, deliveries, incidents, probe calibrations, production days, training and fitness to work. Ask for only the types you need.",
  inputSchema: {
    site_id: z.string().uuid().describe("Site id from list_sites."),
    types: z
      .array(z.enum(RECORD_TYPES))
      .optional()
      .describe("Which record types to return. Defaults to temperatures, cleaning and batches."),
    days: z.number().int().optional().describe("How many days back to cover. Defaults to 7, max 365. Ignored when from/to are given."),
    from: z.string().optional().describe("Start date (YYYY-MM-DD)."),
    to: z.string().optional().describe("End date (YYYY-MM-DD)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: guard<{
    site_id: string;
    types?: RecordType[];
    days?: number;
    from?: string;
    to?: string;
  }>({
    tool: "list_recent_records",
    level: "read",
    site: (i) => i.site_id,
    run: async ({ client, input }) => {
      const site = await siteMeta(client, input.site_id);
      const today = siteToday(site.timezone);
      const to = input.to ? isoDate(input.to, "to") : today;
      const from = input.from
        ? isoDate(input.from, "from")
        : addDaysISO(to, -(Math.min(Math.max(input.days ?? 7, 1), MAX_DAYS) - 1));
      if (from > to) throw new Error("`from` must be on or before `to`.");

      const types: RecordType[] = input.types?.length
        ? input.types
        : ["temperatures", "cleaning", "batches"];
      const fromTs = `${from}T00:00:00`;
      const toTs = `${to}T23:59:59`;
      const siteId = input.site_id;

      const queries: Record<RecordType, () => Promise<unknown>> = {
        temperatures: async () =>
          ok(
            await client
              .from("temp_logs")
              .select("id, unit_id, log_type, value, pass, food_item, corrective_action, logged_at, logged_by_name")
              .eq("site_id", siteId)
              .gte("logged_at", fromTs)
              .lte("logged_at", toTs)
              .order("logged_at", { ascending: false })
              .limit(PER_TYPE_LIMIT),
          ),
        cleaning: async () =>
          ok(
            await client
              .from("cleaning_logs")
              .select("id, task_id, log_date, done, note, completed_by_name, completed_at, is_retrospective")
              .eq("site_id", siteId)
              .gte("log_date", from)
              .lte("log_date", to)
              .order("log_date", { ascending: false })
              .limit(PER_TYPE_LIMIT),
          ),
        day_sheets: async () =>
          ok(
            await client
              .from("day_sheets")
              .select("id, sheet_date, locked, signed_off, signed_off_by, signed_off_at, manager_note, problem_notes")
              .eq("site_id", siteId)
              .gte("sheet_date", from)
              .lte("sheet_date", to)
              .order("sheet_date", { ascending: false })
              .limit(PER_TYPE_LIMIT),
          ),
        batches: async () =>
          ok(
            await client
              .from("batches")
              .select("id, batch_code, product_name, quantity_produced, quantity_unit, status, date_produced, use_by_date, notes")
              .eq("site_id", siteId)
              .gte("date_produced", from)
              .lte("date_produced", to)
              .order("date_produced", { ascending: false })
              .limit(PER_TYPE_LIMIT),
          ),
        deliveries: async () =>
          ok(
            await client
              .from("delivery_logs")
              .select("id, supplier_id, items, temp, temp_pass, packaging, use_by_ok, accepted, note, logged_at, logged_by_name, suppliers(name)")
              .eq("site_id", siteId)
              .gte("logged_at", fromTs)
              .lte("logged_at", toTs)
              .order("logged_at", { ascending: false })
              .limit(PER_TYPE_LIMIT),
          ),
        incidents: async () =>
          ok(
            await client
              .from("incidents")
              .select("id, title, type, status, description, immediate_action, root_cause, prevention, reported_at, reported_by_name")
              .eq("site_id", siteId)
              .gte("reported_at", fromTs)
              .lte("reported_at", toTs)
              .order("reported_at", { ascending: false })
              .limit(PER_TYPE_LIMIT),
          ),
        probe_calibrations: async () =>
          ok(
            await client
              .from("probe_calibrations")
              .select("id, probe_name, iced_water_reading, boiling_water_reading, pass, notes, calibrated_at, calibrated_by_name")
              .eq("site_id", siteId)
              .gte("calibrated_at", fromTs)
              .lte("calibrated_at", toTs)
              .order("calibrated_at", { ascending: false })
              .limit(PER_TYPE_LIMIT),
          ),
        production_days: async () =>
          ok(
            await client
              .from("production_days")
              .select("id, production_date, started_at, completed_at, notes, is_retrospective")
              .eq("site_id", siteId)
              .gte("production_date", from)
              .lte("production_date", to)
              .order("production_date", { ascending: false })
              .limit(PER_TYPE_LIMIT),
          ),
        training: async () =>
          ok(
            await client
              .from("training_records")
              .select("id, user_id, training_name, training_type, completed_date, expiry_date, notes")
              .eq("site_id", siteId)
              .gte("completed_date", from)
              .lte("completed_date", to)
              .order("completed_date", { ascending: false })
              .limit(PER_TYPE_LIMIT),
          ),
        fitness_to_work: async () =>
          ok(
            await client
              .from("fitness_to_work")
              .select("id, staff_name, reported_date, symptoms, excluded_from, cleared_to_return, status, notes, recorded_by_name")
              .eq("site_id", siteId)
              .gte("reported_date", from)
              .lte("reported_date", to)
              .order("reported_date", { ascending: false })
              .limit(PER_TYPE_LIMIT),
          ),
      };

      const results = await Promise.all(types.map((t) => queries[t]()));
      const records: Record<string, unknown> = {};
      types.forEach((t, i) => {
        records[t] = results[i] ?? [];
      });

      return {
        period: { from, to },
        note: `Each record type is capped at ${PER_TYPE_LIMIT} rows, newest first. Narrow the date range for a complete set.`,
        records,
      };
    },
  }),
});
