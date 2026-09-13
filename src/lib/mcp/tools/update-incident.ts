import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { guard, ok } from "../helpers";

export default defineTool({
  name: "update_incident",
  title: "Update an incident",
  description:
    "Update the root cause, prevention, verification or status of an existing incident. Managers and owners only. Ask the user before closing an incident.",
  inputSchema: {
    site_id: z.string().uuid().describe("Site id from list_sites."),
    incident_id: z.string().uuid().describe("Incident id from list_incidents."),
    root_cause: z.string().optional().describe("Why it happened."),
    prevention: z.string().optional().describe("How a repeat will be prevented."),
    status: z.string().optional().describe("New status, e.g. open, in_progress, closed."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: guard<{
    site_id: string;
    incident_id: string;
    root_cause?: string;
    prevention?: string;
    status?: string;
  }>({
    tool: "update_incident",
    level: "manage",
    site: (i) => i.site_id,
    run: async ({ client, input, actorName }) => {
      const patch: Record<string, unknown> = {};
      if (input.root_cause !== undefined) patch.root_cause = input.root_cause;
      if (input.prevention !== undefined) patch.prevention = input.prevention;
      if (input.status !== undefined) {
        patch.status = input.status;
        if (input.status === "closed") {
          patch.verified_by_name = actorName;
          patch.verified_at = new Date().toISOString();
        }
      }
      if (Object.keys(patch).length === 0) throw new Error("Nothing to update.");
      const incident = ok(
        await client
          .from("incidents")
          .update(patch)
          .eq("id", input.incident_id)
          .eq("site_id", input.site_id)
          .select("id, title, status, root_cause, prevention, verified_at")
          .maybeSingle(),
      );
      if (!incident) throw new Error("Incident not found for this site.");
      return { incident };
    },
  }),
});
