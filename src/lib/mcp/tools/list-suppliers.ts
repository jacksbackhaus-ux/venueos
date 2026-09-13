import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { guard, ok } from "../helpers";

export default defineTool({
  name: "list_suppliers",
  title: "List suppliers",
  description:
    "List the approved supplier list for a site, with contact details and approval status. Use the ids with record_delivery.",
  inputSchema: {
    site_id: z.string().uuid().describe("Site id from list_sites."),
    include_inactive: z.boolean().optional().describe("Include suppliers no longer in use."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: guard<{ site_id: string; include_inactive?: boolean }>({
    tool: "list_suppliers",
    level: "read",
    site: (i) => i.site_id,
    run: async ({ client, input }) => {
      let query = client
        .from("suppliers")
        .select("id, name, category, approved, active, contact_name, contact_email, contact_phone, notes")
        .eq("site_id", input.site_id)
        .order("name");
      if (!input.include_inactive) query = query.eq("active", true);
      const suppliers = ok(await query);
      return { suppliers: suppliers ?? [] };
    },
  }),
});
