import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { guard, ok } from "../helpers";

export default defineTool({
  name: "dispose_batch",
  title: "Dispose of a batch",
  description:
    "Write a batch off as disposed. A reason is required and is kept on the permanent HACCP record. Ask the user to confirm before disposing of a batch.",
  inputSchema: {
    site_id: z.string().uuid().describe("Site id from list_sites."),
    batch_id: z.string().uuid().describe("Batch id from list_batches."),
    reason: z.string().describe("Why the batch was disposed of, e.g. 'past use-by', 'temperature breach'."),
    notes: z.string().optional().describe("Any further detail, e.g. how much was thrown away."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: guard<{ site_id: string; batch_id: string; reason: string; notes?: string }>({
    tool: "dispose_batch",
    level: "write",
    site: (i) => i.site_id,
    run: async ({ client, input, actorId, actorName, organisationId }) => {
      const reason = input.reason.trim();
      if (!reason) throw new Error("A reason is required to dispose of a batch.");

      const current = ok(
        await client
          .from("batches")
          .select("id, product_name, status")
          .eq("id", input.batch_id)
          .eq("site_id", input.site_id)
          .maybeSingle(),
      ) as { id: string; product_name: string; status: string } | null;
      if (!current) throw new Error("Batch not found for this site.");
      if (current.status === "disposed") return { batch: current, already_disposed: true };

      const batch = ok(
        await client
          .from("batches")
          .update({ status: "disposed", completed_at: new Date().toISOString() })
          .eq("id", input.batch_id)
          .eq("site_id", input.site_id)
          .select("id, batch_code, product_name, status, completed_at")
          .single(),
      );
      ok(
        await client
          .from("batch_actions")
          .insert({
            batch_id: input.batch_id,
            site_id: input.site_id,
            organisation_id: organisationId,
            action_type: "disposed",
            reason,
            notes: input.notes?.trim() || null,
            performed_by_user_id: actorId,
            performed_by_name: actorName,
          })
          .select("id")
          .single(),
      );
      return { batch, already_disposed: false, reason };
    },
  }),
});
