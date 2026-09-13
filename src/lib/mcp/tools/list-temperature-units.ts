import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { guard, ok } from "../helpers";

export default defineTool({
  name: "list_temperature_units",
  title: "List temperature units",
  description:
    "List the fridges, freezers and other monitored units for a site, with their pass/fail temperature range.",
  inputSchema: { site_id: z.string().uuid().describe("Site id from list_sites.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: guard<{ site_id: string }>({
    tool: "list_temperature_units",
    level: "read",
    site: (i) => i.site_id,
    run: async ({ client, input }) => {
      const units = ok(
        await client
          .from("temp_units")
          .select("id, name, type, min_temp, max_temp, active")
          .eq("site_id", input.site_id)
          .eq("active", true)
          .order("sort_order"),
      );
      return { units: units ?? [] };
    },
  }),
});
