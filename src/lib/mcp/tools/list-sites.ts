import { defineTool } from "@lovable.dev/mcp-js";
import { ToolError } from "@lovable.dev/mcp-js";
import { json, requireClient } from "../helpers";

export default defineTool({
  name: "list_sites",
  title: "List sites",
  description:
    "List the MiseOS sites (premises) the signed-in user can access, with premises type and operating mode.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const client = requireClient(ctx);
    const { data, error } = await client
      .from("sites")
      .select("id, name, site_code, premises_type, operating_mode, timezone, active")
      .eq("active", true)
      .order("name");
    if (error) throw new ToolError(error.message);
    return json({ sites: data ?? [] });
  },
});
