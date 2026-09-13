import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { guard, isoDate, ok } from "../helpers";

export default defineTool({
  name: "extend_batch_use_by",
  title: "Extend a batch use-by date",
  description:
    "Push a batch's use-by date back. A reason is required: the old date, the new date and the justification are all kept on the permanent HACCP record. Ask the user to confirm, and never extend a use-by date without a food safety justification from them.",
  inputSchema: {
    site_id: z.string().uuid().describe("Site id from list_sites."),
    batch_id: z.string().uuid().describe("Batch id from list_batches."),
    new_use_by_date: z.string().describe("The new use-by date (YYYY-MM-DD). Must be later than the current one."),
    reason: z.string().describe("The food safety justification for extending the use-by date."),
    notes: z.string().optional().describe("Any further detail."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: guard<{
    site_id: string;
    batch_id: string;
    new_use_by_date: string;
    reason: string;
    notes?: string;
  }>({
    tool: "extend_batch_use_by",
    level: "write",
    site: (i) => i.site_id,
    run: async ({ client, input, actorId, actorName, organisationId }) => {
      const reason = input.reason.trim();
      if (!reason) throw new Error("A reason is required to extend a use-by date.");
      const newUseBy = isoDate(input.new_use_by_date, "new_use_by_date");

      const current = ok(
        await client
          .from("batches")
          .select("id, product_name, status, use_by_date")
          .eq("id", input.batch_id)
          .eq("site_id", input.site_id)
          .maybeSingle(),
      ) as { id: string; product_name: string; status: string; use_by_date: string | null } | null;
      if (!current) throw new Error("Batch not found for this site.");
      if (current.status === "disposed" || current.status === "used") {
        throw new Error(`This batch is already marked as ${current.status}, so its use-by cannot change.`);
      }
      if (current.use_by_date && newUseBy <= current.use_by_date) {
        throw new Error(
          `The new use-by date must be after the current one (${current.use_by_date}). Use update_batch to correct a date entered in error.`,
        );
      }

      const batch = ok(
        await client
          .from("batches")
          .update({ use_by_date: newUseBy })
          .eq("id", input.batch_id)
          .eq("site_id", input.site_id)
          .select("id, batch_code, product_name, status, use_by_date")
          .single(),
      );
      ok(
        await client
          .from("batch_actions")
          .insert({
            batch_id: input.batch_id,
            site_id: input.site_id,
            organisation_id: organisationId,
            action_type: "extended",
            reason,
            notes: input.notes?.trim() || null,
            previous_use_by: current.use_by_date,
            new_use_by: newUseBy,
            performed_by_user_id: actorId,
            performed_by_name: actorName,
          })
          .select("id")
          .single(),
      );
      return { batch, previous_use_by: current.use_by_date, new_use_by: newUseBy, reason };
    },
  }),
});
