import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { guard, ok } from "../helpers";

export default defineTool({
  name: "mark_batch_used",
  title: "Mark a batch as used",
  description:
    "Close a batch off as sold or used. The batch record stays on file for traceability.",
  inputSchema: {
    site_id: z.string().uuid().describe("Site id from list_sites."),
    batch_id: z.string().uuid().describe("Batch id from list_batches."),
    notes: z.string().optional().describe("Anything worth recording, e.g. where it went."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: guard<{ site_id: string; batch_id: string; notes?: string }>({
    tool: "mark_batch_used",
    level: "write",
    site: (i) => i.site_id,
    run: async ({ client, input, actorId, actorName, organisationId }) => {
      const current = ok(
        await client
          .from("batches")
          .select("id, product_name, status")
          .eq("id", input.batch_id)
          .eq("site_id", input.site_id)
          .maybeSingle(),
      ) as { id: string; product_name: string; status: string } | null;
      if (!current) throw new Error("Batch not found for this site.");
      if (current.status === "disposed") {
        throw new Error("This batch was disposed of, so it cannot be marked as used.");
      }
      if (current.status === "used") {
        return { batch: current, already_used: true };
      }

      const batch = ok(
        await client
          .from("batches")
          .update({ status: "used", completed_at: new Date().toISOString() })
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
            action_type: "used",
            notes: input.notes?.trim() || null,
            performed_by_user_id: actorId,
            performed_by_name: actorName,
          })
          .select("id")
          .single(),
      );
      return { batch, already_used: false };
    },
  }),
});
