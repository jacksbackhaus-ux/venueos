import { defineTool } from "@lovable.dev/mcp-js";
import { guard, ok } from "../helpers";

export default defineTool({
  name: "list_sites",
  title: "List sites",
  description:
    "List the MiseOS sites (premises) the signed-in user can access, with premises type and operating mode.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: guard<Record<string, never>>({
    tool: "list_sites",
    level: "read",
    run: async ({ client }) => {
      const sites = ok(
        await client
          .from("sites")
          .select("id, name, site_code, premises_type, operating_mode, timezone, active")
          .eq("active", true)
          .order("name"),
      );
      return { sites: sites ?? [] };
    },
  }),
});
