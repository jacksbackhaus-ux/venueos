import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { guard, ok } from "../helpers";

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
    type: z
      .string()
      .optional()
      .describe("Incident type, e.g. temperature, pest, allergen, equipment, other."),
    root_cause: z.string().optional().describe("Root cause, if already known."),
    prevention: z.string().optional().describe("How a repeat will be prevented."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: guard<{
    site_id: string;
    title: string;
    description: string;
    immediate_action: string;
    type?: string;
    root_cause?: string;
    prevention?: string;
  }>({
    tool: "create_incident",
    level: "write",
    site: (i) => i.site_id,
    run: async ({ client, input, actorId, actorName, organisationId }) => {
      const incident = ok(
        await client
          .from("incidents")
          .insert({
            site_id: input.site_id,
            organisation_id: organisationId,
            title: input.title,
            description: input.description,
            immediate_action: input.immediate_action,
            type: input.type ?? "other",
            root_cause: input.root_cause ?? null,
            prevention: input.prevention ?? null,
            status: "open",
            reported_by_name: actorName,
            reported_by_user_id: actorId,
          })
          .select("id, title, type, status, reported_at")
          .single(),
      );
      return { incident };
    },
  }),
});
