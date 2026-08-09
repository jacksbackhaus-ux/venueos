import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { json, requireClient, siteOrganisationId } from "../helpers";

export default defineTool({
  name: "create_incident",
  title: "Report an incident",
  description:
    "Report a food safety incident or non-conformance for a site. Creates an open incident record.",
  inputSchema: {
    site_id: z.string().uuid().describe("Site id from list_sites."),
    title: z.string().describe("Short summary of what happened."),
    description: z.string().describe("What happened, in detail."),
    immediate_action: z.string().describe("What was done straight away to make things safe."),
    type: z.string().optional().describe("Incident type, e.g. temperature, pest, allergen, equipment, other."),
    root_cause: z.string().optional().describe("Root cause, if already known."),
    prevention: z.string().optional().describe("How a repeat will be prevented."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const client = requireClient(ctx);
    const organisation_id = await siteOrganisationId(client, input.site_id);
    const { data, error } = await client
      .from("incidents")
      .insert({
        site_id: input.site_id,
        organisation_id,
        title: input.title,
        description: input.description,
        immediate_action: input.immediate_action,
        type: input.type ?? "other",
        root_cause: input.root_cause ?? null,
        prevention: input.prevention ?? null,
        status: "open",
        reported_by_name: ctx.getUserEmail() ?? "MCP",
        reported_by_user_id: ctx.getUserId() ?? null,
      })
      .select("id, title, type, status, reported_at")
      .single();
    if (error) throw new ToolError(error.message);
    return json({ incident: data });
  },
});
