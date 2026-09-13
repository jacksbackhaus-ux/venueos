import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { guard, ok } from "../helpers";

export default defineTool({
  name: "list_incidents",
  title: "List incidents",
  description: "List food safety incidents and non-conformances for a site, newest first.",
  inputSchema: {
    site_id: z.string().uuid().describe("Site id from list_sites."),
    status: z.string().optional().describe("Filter by status, e.g. open or closed."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: guard<{ site_id: string; status?: string }>({
    tool: "list_incidents",
    level: "read",
    site: (i) => i.site_id,
    run: async ({ client, input }) => {
      let query = client
        .from("incidents")
        .select(
          "id, title, type, status, description, immediate_action, root_cause, prevention, reported_at, reported_by_name",
        )
        .eq("site_id", input.site_id)
        .order("reported_at", { ascending: false })
        .limit(100);
      if (input.status) query = query.eq("status", input.status);
      const incidents = ok(await query);
      return { incidents: incidents ?? [] };
    },
  }),
});
