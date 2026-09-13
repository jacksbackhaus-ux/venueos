import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { guard, isoDate, ok, siteMeta, siteToday } from "../helpers";

/** Same shape the app generates: SITE-YYYYMMDD-NNN. */
function buildBatchCode(siteName: string, dateISO: string, sequence: number): string {
  const prefix = siteName.substring(0, 4).toUpperCase().replace(/\s/g, "");
  return `${prefix}-${dateISO.replace(/-/g, "")}-${String(sequence).padStart(3, "0")}`;
}

export default defineTool({
  name: "create_batch",
  title: "Create a production batch",
  description:
    "Record a batch of product produced at a site, for traceability. A batch code is generated automatically.",
  inputSchema: {
    site_id: z.string().uuid().describe("Site id from list_sites."),
    product_name: z.string().describe("What was produced, e.g. 'Lemon drizzle cake'."),
    quantity: z.number().optional().describe("How much was produced."),
    unit: z.string().optional().describe("Unit for the quantity, e.g. units, kg, litres, trays."),
    date_produced: z.string().optional().describe("Production date (YYYY-MM-DD). Defaults to today."),
    use_by_date: z.string().optional().describe("Use-by date (YYYY-MM-DD)."),
    notes: z.string().optional().describe("Anything worth recording about the batch."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: guard<{
    site_id: string;
    product_name: string;
    quantity?: number;
    unit?: string;
    date_produced?: string;
    use_by_date?: string;
    notes?: string;
  }>({
    tool: "create_batch",
    level: "write",
    site: (i) => i.site_id,
    run: async ({ client, input, actorId, organisationId }) => {
      const productName = input.product_name.trim();
      if (!productName) throw new Error("A product name is required.");
      if (input.quantity != null && input.quantity < 0) throw new Error("Quantity cannot be negative.");

      const site = await siteMeta(client, input.site_id);
      const today = siteToday(site.timezone);
      const produced = input.date_produced ? isoDate(input.date_produced, "date_produced") : today;
      const useBy = input.use_by_date ? isoDate(input.use_by_date, "use_by_date") : null;
      if (useBy && useBy < produced) {
        throw new Error("The use-by date cannot be before the production date.");
      }

      // Sequence within the site, matching the app's batch code format.
      const { count } = await client
        .from("batches")
        .select("id", { count: "exact", head: true })
        .eq("site_id", input.site_id);

      // Batch numbers run per product, so continue this product's own sequence.
      const priorForProduct = ok(
        await client
          .from("batches")
          .select("recipe_number")
          .eq("site_id", input.site_id)
          .eq("product_name", productName)
          .not("recipe_number", "is", null)
          .order("recipe_number", { ascending: false })
          .limit(1),
      ) as { recipe_number: number }[] | null;
      const recipeNumber = (priorForProduct?.[0]?.recipe_number ?? 0) + 1;

      const batch = ok(
        await client
          .from("batches")
          .insert({
            site_id: input.site_id,
            organisation_id: organisationId,
            batch_code: buildBatchCode(site.name, today, (count ?? 0) + 1),
            product_name: productName,
            recipe_ref: productName,
            recipe_number: recipeNumber,
            quantity_produced: input.quantity ?? null,
            quantity_unit: input.unit?.trim() || "units",
            date_produced: produced,
            use_by_date: useBy,
            notes: input.notes?.trim() || null,
            created_by_user_id: actorId,
          })
          .select(
            "id, batch_code, product_name, recipe_number, quantity_produced, quantity_unit, status, date_produced, use_by_date, notes",
          )
          .single(),
      );
      return { batch };
    },
  }),
});
