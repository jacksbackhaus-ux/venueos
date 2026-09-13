import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { guard, isoDate, ok, siteMeta, siteToday } from "../helpers";

/** Chilled deliveries must arrive at 8°C or below; MiseOS records 5°C as the working limit. */
const CHILLED_LIMIT_C = 5;

export default defineTool({
  name: "record_delivery",
  title: "Record a delivery",
  description:
    "Record a delivery from a supplier, with its temperature check and the condition it arrived in. Whether the delivery is accepted is derived from the temperature, the packaging and the use-by check.",
  inputSchema: {
    site_id: z.string().uuid().describe("Site id from list_sites."),
    supplier_id: z.string().uuid().describe("Supplier id from list_suppliers."),
    items: z.string().describe("What was delivered."),
    temperature: z.number().optional().describe("Temperature of chilled or frozen goods on arrival, in degrees Celsius."),
    packaging: z
      .string()
      .optional()
      .describe("Condition of the packaging: good or damaged. Defaults to good."),
    use_by_ok: z.boolean().optional().describe("Whether the use-by or best-before dates were acceptable. Defaults to true."),
    date: z.string().optional().describe("Delivery date (YYYY-MM-DD). Defaults to today."),
    note: z.string().optional().describe("Anything worth recording, e.g. what was rejected and why."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: guard<{
    site_id: string;
    supplier_id: string;
    items: string;
    temperature?: number;
    packaging?: string;
    use_by_ok?: boolean;
    date?: string;
    note?: string;
  }>({
    tool: "record_delivery",
    level: "write",
    site: (i) => i.site_id,
    run: async ({ client, input, actorId, actorName, organisationId }) => {
      const items = input.items.trim();
      if (!items) throw new Error("Describe what was delivered.");

      const supplier = ok(
        await client
          .from("suppliers")
          .select("id, name, approved")
          .eq("id", input.supplier_id)
          .eq("site_id", input.site_id)
          .maybeSingle(),
      ) as { id: string; name: string; approved: boolean } | null;
      if (!supplier) throw new Error("Supplier not found for this site. Use list_suppliers, or add them first.");

      const site = await siteMeta(client, input.site_id);
      const today = siteToday(site.timezone);
      const date = input.date ? isoDate(input.date) : today;
      if (date > today) throw new Error("A delivery cannot be recorded for a future date.");

      const packaging = (input.packaging ?? "good").trim().toLowerCase();
      const useByOk = input.use_by_ok ?? true;
      const tempPass = input.temperature == null ? null : input.temperature <= CHILLED_LIMIT_C;
      const accepted = tempPass !== false && packaging !== "damaged" && useByOk;

      const loggedAt = date < today ? `${date}T12:00:00.000Z` : new Date().toISOString();

      const delivery = ok(
        await client
          .from("delivery_logs")
          .insert({
            site_id: input.site_id,
            organisation_id: organisationId,
            supplier_id: input.supplier_id,
            items,
            temp: input.temperature ?? null,
            temp_pass: tempPass,
            packaging,
            use_by_ok: useByOk,
            accepted,
            note: input.note?.trim() || null,
            logged_at: loggedAt,
            logged_by_user_id: actorId,
            logged_by_name: actorName,
          })
          .select("id, items, temp, temp_pass, packaging, use_by_ok, accepted, note, logged_at")
          .single(),
      );

      return {
        delivery,
        supplier: { id: supplier.id, name: supplier.name, approved: supplier.approved },
        accepted,
        guidance: accepted
          ? undefined
          : "This delivery was not accepted. Record what happened to the goods, and report an incident if any reached food production.",
      };
    },
  }),
});
