import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { guard, ok } from "../helpers";

export default defineTool({
  name: "upsert_supplier",
  title: "Add or update a supplier",
  description:
    "Add a supplier to a site's approved list, or update one that already exists. Managers and owners only. Pass supplier_id to update; omit it to add a new supplier.",
  inputSchema: {
    site_id: z.string().uuid().describe("Site id from list_sites."),
    supplier_id: z.string().uuid().optional().describe("Supplier id from list_suppliers. Omit to add a new supplier."),
    name: z.string().optional().describe("Supplier name. Required when adding."),
    category: z.string().optional().describe("What they supply, e.g. Dairy, Dry goods, Butcher."),
    approved: z.boolean().optional().describe("Whether this supplier is approved for use."),
    active: z.boolean().optional().describe("Set false to retire a supplier without deleting their history."),
    contact_name: z.string().optional().describe("Contact name."),
    contact_email: z.string().optional().describe("Contact email."),
    contact_phone: z.string().optional().describe("Contact phone number."),
    notes: z.string().optional().describe("Anything worth recording about this supplier."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: guard<{
    site_id: string;
    supplier_id?: string;
    name?: string;
    category?: string;
    approved?: boolean;
    active?: boolean;
    contact_name?: string;
    contact_email?: string;
    contact_phone?: string;
    notes?: string;
  }>({
    tool: "upsert_supplier",
    level: "manage",
    site: (i) => i.site_id,
    run: async ({ client, input, organisationId }) => {
      const text = (v: string | undefined) => (v === undefined ? undefined : v.trim() || null);
      const patch: Record<string, unknown> = {};
      if (input.name !== undefined) {
        const name = input.name.trim();
        if (!name) throw new Error("Supplier name cannot be blank.");
        patch.name = name;
      }
      if (input.category !== undefined) patch.category = input.category.trim() || "General";
      if (input.approved !== undefined) patch.approved = input.approved;
      if (input.active !== undefined) patch.active = input.active;
      if (input.contact_name !== undefined) patch.contact_name = text(input.contact_name);
      if (input.contact_email !== undefined) patch.contact_email = text(input.contact_email);
      if (input.contact_phone !== undefined) patch.contact_phone = text(input.contact_phone);
      if (input.notes !== undefined) patch.notes = text(input.notes);

      const columns = "id, name, category, approved, active, contact_name, contact_email, contact_phone, notes";

      if (input.supplier_id) {
        if (Object.keys(patch).length === 0) throw new Error("Nothing to update.");
        const supplier = ok(
          await client
            .from("suppliers")
            .update(patch)
            .eq("id", input.supplier_id)
            .eq("site_id", input.site_id)
            .select(columns)
            .maybeSingle(),
        );
        if (!supplier) throw new Error("Supplier not found for this site.");
        return { supplier, created: false };
      }

      if (!patch.name) throw new Error("A supplier name is required to add a new supplier.");
      const supplier = ok(
        await client
          .from("suppliers")
          .insert({
            site_id: input.site_id,
            organisation_id: organisationId,
            category: "General",
            approved: input.approved ?? true,
            active: input.active ?? true,
            ...patch,
          })
          .select(columns)
          .single(),
      );
      return { supplier, created: true };
    },
  }),
});
