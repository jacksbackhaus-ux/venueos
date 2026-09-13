import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { guard, ok } from "../helpers";

export default defineTool({
  name: "list_temperature_logs",
  title: "List temperature logs",
  description:
    "List recent temperature readings for a site, newest first, including whether each reading passed.",
  inputSchema: {
    site_id: z.string().uuid().describe("Site id from list_sites."),
    days: z.number().int().optional().describe("How many days back to look. Defaults to 7, max 90."),
    only_failures: z.boolean().optional().describe("Return only readings that failed."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: guard<{ site_id: string; days?: number; only_failures?: boolean }>({
    tool: "list_temperature_logs",
    level: "read",
    site: (i) => i.site_id,
    run: async ({ client, input }) => {
      const window = Math.min(Math.max(input.days ?? 7, 1), 90);
      const since = new Date(Date.now() - window * 86_400_000).toISOString();
      let query = client
        .from("temp_logs")
        .select(
          "id, unit_id, log_type, value, pass, food_item, corrective_action, logged_at, logged_by_name",
        )
        .eq("site_id", input.site_id)
        .gte("logged_at", since)
        .order("logged_at", { ascending: false })
        .limit(200);
      if (input.only_failures) query = query.eq("pass", false);
      const logs = ok(await query);
      return { days: window, logs: logs ?? [] };
    },
  }),
});
