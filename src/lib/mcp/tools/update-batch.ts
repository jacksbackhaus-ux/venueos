import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { guard, isoDate, ok } from "../helpers";

export default defineTool({
  name: "update_batch",
  title: "Update a batch",
  description:
    "Correct the product, quantity, notes or production date on an existing batch. Use extend_batch_use_by to change a use-by date, dispose_batch to write a batch off, and mark_batch_used once it has been sold or used.",
  inputSchema: {
    site_id: z.string().uuid().describe("Site id from list_sites."),
    batch_id: z.string().uuid().describe("Batch id from list_batches."),
    product_name: z.string().optional().describe("Corrected product name."),
    quantity: z.number().optional().describe("Corrected quantity produced."),
    unit: z.string().optional().describe("Corrected unit, e.g. units, kg, trays."),
    date_produced: z.string().optional().describe("Corrected production date (YYYY-MM-DD)."),
    notes: z.string().optional().describe("Notes for the batch."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: guard<{
    site_id: string;
    batch_id: string;
    product_name?: string;
    quantity?: number;
    unit?: string;
    date_produced?: string;
    notes?: string;
  }>({
    tool: "update_batch",
    level: "write",
    site: (i) => i.site_id,
    run: async ({ client, input }) => {
      const current = ok(
        await client
          .from("batches")
          .select("id, product_name, status, use_by_date, date_produced")
          .eq("id", input.batch_id)
          .eq("site_id", input.site_id)
          .maybeSingle(),
      ) as { id: string; product_name: string; status: string; use_by_date: string | null; date_produced: string | null } | null;
      if (!current) throw new Error("Batch not found for this site.");
      if (current.status === "disposed" || current.status === "used") {
        throw new Error(
          `This batch is already marked as ${current.status}. Closed batches are kept as they were recorded.`,
        );
      }

      const patch: Record<string, unknown> = {};
      if (input.product_name !== undefined) {
        const name = input.product_name.trim();
        if (!name) throw new Error("Product name cannot be blank.");
        patch.product_name = name;
        patch.recipe_ref = name;
      }
      if (input.quantity !== undefined) {
        if (input.quantity < 0) throw new Error("Quantity cannot be negative.");
        patch.quantity_produced = input.quantity;
      }
      if (input.unit !== undefined) patch.quantity_unit = input.unit.trim() || "units";
      if (input.notes !== undefined) patch.notes = input.notes.trim() || null;
      if (input.date_produced !== undefined) {
        const produced = isoDate(input.date_produced, "date_produced");
        if (current.use_by_date && produced > current.use_by_date) {
          throw new Error("The production date cannot be after the batch's use-by date.");
        }
        patch.date_produced = produced;
      }
      if (Object.keys(patch).length === 0) throw new Error("Nothing to update.");

      const batch = ok(
        await client
          .from("batches")
          .update(patch)
          .eq("id", input.batch_id)
          .eq("site_id", input.site_id)
          .select(
            "id, batch_code, product_name, quantity_produced, quantity_unit, status, date_produced, use_by_date, notes",
          )
          .single(),
      );

      // batch_actions only records the five status changes the app defines
      // (used / disposed / extended / quarantined / unquarantined). A plain
      // correction is audited in mcp_activity_log by the shared wrapper, which
      // already records who changed what, when and with which assistant.
      return { batch, amended_fields: Object.keys(patch) };
    },
  }),
});
