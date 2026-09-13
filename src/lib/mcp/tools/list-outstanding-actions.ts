import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { outstandingActions } from "../compliance";
import { guard, isoDate, siteMeta, siteToday } from "../helpers";

export default defineTool({
  name: "list_outstanding_actions",
  title: "What is outstanding or overdue",
  description:
    "Summarise what still needs doing at a site: unresolved temperature failures, missed checks, outstanding cleaning and day-sheet items, open incidents, stock past its use-by, training expiry and whether the periodic review is due. Closed days and, on on-demand sites, days with no declared production day are neutral and never produce an overdue item.",
  inputSchema: {
    site_id: z.string().uuid().describe("Site id from list_sites."),
    date: z.string().optional().describe("Date to assess (YYYY-MM-DD). Defaults to today."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: guard<{ site_id: string; date?: string }>({
    tool: "list_outstanding_actions",
    level: "read",
    site: (i) => i.site_id,
    run: async ({ client, input }) => {
      const site = await siteMeta(client, input.site_id);
      const date = input.date ? isoDate(input.date) : siteToday(site.timezone);
      return outstandingActions(client, site, date);
    },
  }),
});
