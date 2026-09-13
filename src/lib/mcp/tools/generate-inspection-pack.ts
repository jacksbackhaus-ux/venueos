import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { buildInspectionPack } from "../inspection";
import { addDaysISO, guard, isoDate, siteMeta, siteToday } from "../helpers";

const TIMEFRAME_DAYS = {
  "1month": 30,
  "3months": 90,
  "6months": 182,
  "12months": 365,
} as const;

type Timeframe = keyof typeof TIMEFRAME_DAYS;

export default defineTool({
  name: "generate_inspection_pack",
  title: "Generate an Inspection Pack",
  description:
    "Build the Inspection Pack for a site over a timeframe, laid out around the three areas a Food Standards Agency inspector scores: hygienic food handling, premises and cleanliness, and confidence in management. Managers and owners only. Closed days and non-production days are excluded from every figure.",
  inputSchema: {
    site_id: z.string().uuid().describe("Site id from list_sites."),
    timeframe: z
      .enum(["1month", "3months", "6months", "12months"])
      .optional()
      .describe("How far back the pack covers. Defaults to 3 months. Ignored when from/to are given."),
    from: z.string().optional().describe("Custom start date (YYYY-MM-DD)."),
    to: z.string().optional().describe("Custom end date (YYYY-MM-DD)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: guard<{ site_id: string; timeframe?: Timeframe; from?: string; to?: string }>({
    tool: "generate_inspection_pack",
    level: "manage",
    site: (i) => i.site_id,
    run: async ({ client, input }) => {
      const site = await siteMeta(client, input.site_id);
      const today = siteToday(site.timezone);
      const to = input.to ? isoDate(input.to, "to") : today;
      const from = input.from
        ? isoDate(input.from, "from")
        : addDaysISO(to, -(TIMEFRAME_DAYS[input.timeframe ?? "3months"] - 1));
      if (from > to) throw new Error("`from` must be on or before `to`.");
      return buildInspectionPack(client, site, from, to);
    },
  }),
});
