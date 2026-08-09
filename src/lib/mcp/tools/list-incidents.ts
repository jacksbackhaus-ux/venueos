import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { json, requireClient } from "../helpers";

export default defineTool({
  name: "list_incidents",
  title: "List incidents",
  description: "List food safety incidents and non-conformances for a site, newest first.",
  inputSchema: {
    site_id: z.string().uuid().describe("Site id from list_sites."),
    status: z.string().optional().describe("Filter by status, e.g. open or closed."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ site_id, status }, ctx) => {
    const client = requireClient(ctx);
    let query = client
      .from("incidents")
      .select("id, title, type, status, description, immediate_action, root_cause, prevention, reported_at, reported_by_name")
      .eq("site_id", site_id)
      .order("reported_at", { ascending: false })
      .limit(100);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw new ToolError(error.message);
    return json({ incidents: data ?? [] });
  },
});
