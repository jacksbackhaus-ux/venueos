import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { json, requireClient } from "../helpers";

export default defineTool({
  name: "list_batches",
  title: "List production batches",
  description:
    "List recent production batches for a site, newest first, with batch code, product, quantity and use-by date.",
  inputSchema: {
    site_id: z.string().uuid().describe("Site id from list_sites."),
    days: z.number().int().optional().describe("How many days back to look. Defaults to 14, max 180."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ site_id, days }, ctx) => {
    const client = requireClient(ctx);
    const window = Math.min(Math.max(days ?? 14, 1), 180);
    const since = new Date(Date.now() - window * 86_400_000).toISOString();
    const { data, error } = await client
      .from("batches")
      .select("id, batch_code, product_name, quantity_produced, quantity_unit, status, date_produced, use_by_date, created_at")
      .eq("site_id", site_id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new ToolError(error.message);
    return json({ days: window, batches: data ?? [] });
  },
});
