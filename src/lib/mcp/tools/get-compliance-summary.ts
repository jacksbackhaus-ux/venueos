import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { complianceSummary } from "../compliance";
import { addDaysISO, guard, isoDate, siteMeta, siteToday } from "../helpers";

const MAX_DAYS = 400;

export default defineTool({
  name: "get_compliance_summary",
  title: "Get a compliance summary",
  description:
    "Compliance status for a site over a period: temperature pass rate, cleaning and day-sheet completion, incidents, deliveries, training, probe calibration and review status. Closed days and non-production days are excluded from every figure.",
  inputSchema: {
    site_id: z.string().uuid().describe("Site id from list_sites."),
    days: z.number().int().optional().describe("How many days back to cover. Defaults to 28, max 400. Ignored when from/to are given."),
    from: z.string().optional().describe("Start date (YYYY-MM-DD)."),
    to: z.string().optional().describe("End date (YYYY-MM-DD)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: guard<{ site_id: string; days?: number; from?: string; to?: string }>({
    tool: "get_compliance_summary",
    level: "read",
    site: (i) => i.site_id,
    run: async ({ client, input }) => {
      const site = await siteMeta(client, input.site_id);
      const today = siteToday(site.timezone);
      const to = input.to ? isoDate(input.to, "to") : today;
      const from = input.from
        ? isoDate(input.from, "from")
        : addDaysISO(to, -(Math.min(Math.max(input.days ?? 28, 1), MAX_DAYS) - 1));
      if (from > to) throw new Error("`from` must be on or before `to`.");
      return complianceSummary(client, site, from, to);
    },
  }),
});
