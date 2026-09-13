import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { addDaysISO, guard, isoDate, ok, siteMeta, siteToday } from "../helpers";

const MAX_DAYS = 730;

export default defineTool({
  name: "summarise_incidents",
  title: "Summarise incidents",
  description:
    "Summarise food safety incidents and non-conformances at a site over a period, grouped by type and status, with the ones still open listed out.",
  inputSchema: {
    site_id: z.string().uuid().describe("Site id from list_sites."),
    days: z.number().int().optional().describe("How many days back to cover. Defaults to 90, max 730. Ignored when from/to are given."),
    from: z.string().optional().describe("Start date (YYYY-MM-DD)."),
    to: z.string().optional().describe("End date (YYYY-MM-DD)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: guard<{ site_id: string; days?: number; from?: string; to?: string }>({
    tool: "summarise_incidents",
    level: "read",
    site: (i) => i.site_id,
    run: async ({ client, input }) => {
      const site = await siteMeta(client, input.site_id);
      const today = siteToday(site.timezone);
      const to = input.to ? isoDate(input.to, "to") : today;
      const from = input.from
        ? isoDate(input.from, "from")
        : addDaysISO(to, -(Math.min(Math.max(input.days ?? 90, 1), MAX_DAYS) - 1));
      if (from > to) throw new Error("`from` must be on or before `to`.");

      const incidents =
        (ok(
          await client
            .from("incidents")
            .select(
              "id, title, type, status, description, immediate_action, root_cause, prevention, reported_at, reported_by_name, verified_at",
            )
            .eq("site_id", input.site_id)
            .gte("reported_at", `${from}T00:00:00`)
            .lte("reported_at", `${to}T23:59:59`)
            .order("reported_at", { ascending: false })
            .limit(500),
        ) as Record<string, unknown>[] | null) ?? [];

      const tally = (key: string) => {
        const counts: Record<string, number> = {};
        for (const i of incidents) {
          const value = String(i[key] ?? "unspecified");
          counts[value] = (counts[value] ?? 0) + 1;
        }
        return counts;
      };

      const isOpen = (i: Record<string, unknown>) => i.status !== "closed" && i.status !== "verified";
      const open = incidents.filter(isOpen);

      return {
        period: { from, to },
        total: incidents.length,
        open: open.length,
        resolved: incidents.length - open.length,
        by_type: tally("type"),
        by_status: tally("status"),
        without_root_cause: incidents.filter((i) => !i.root_cause).length,
        still_open: open.map((i) => ({
          id: i.id,
          title: i.title,
          type: i.type,
          status: i.status,
          reported_at: i.reported_at,
          reported_by: i.reported_by_name,
          immediate_action: i.immediate_action,
          root_cause: i.root_cause,
          prevention: i.prevention,
        })),
      };
    },
  }),
});
