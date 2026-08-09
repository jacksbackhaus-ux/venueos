import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { json, requireClient } from "../helpers";

export default defineTool({
  name: "list_temperature_units",
  title: "List temperature units",
  description:
    "List the fridges, freezers and other monitored units for a site, with their pass/fail temperature range.",
  inputSchema: { site_id: z.string().uuid().describe("Site id from list_sites.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ site_id }, ctx) => {
    const client = requireClient(ctx);
    const { data, error } = await client
      .from("temp_units")
      .select("id, name, type, min_temp, max_temp, active")
      .eq("site_id", site_id)
      .eq("active", true)
      .order("sort_order");
    if (error) throw new ToolError(error.message);
    return json({ units: data ?? [] });
  },
});
