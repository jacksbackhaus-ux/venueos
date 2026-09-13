import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { guard, isoDate, ok, siteMeta, siteToday } from "../helpers";

const TRAINING_TYPES = [
  "induction",
  "food_safety",
  "allergens",
  "haccp",
  "fire_safety",
  "manual_handling",
  "other",
] as const;

export default defineTool({
  name: "add_training_record",
  title: "Add a training record",
  description:
    "Record training a member of staff has completed. Managers and owners only. Certificate files cannot be uploaded over chat — pass a certificate reference (a number or where the certificate is filed) and it is stored with the record.",
  inputSchema: {
    site_id: z.string().uuid().describe("Site id from list_sites."),
    user_id: z.string().uuid().describe("The staff member's user id from list_staff."),
    training_name: z.string().describe("What the training was, e.g. 'Level 2 Food Safety'."),
    training_type: z
      .enum(TRAINING_TYPES)
      .optional()
      .describe("Category of training. Defaults to other."),
    completed_date: z.string().optional().describe("Date the training was completed (YYYY-MM-DD). Defaults to today."),
    expiry_date: z.string().optional().describe("Date the training expires (YYYY-MM-DD), if it does."),
    certificate_reference: z
      .string()
      .optional()
      .describe("Certificate number or where the certificate is kept."),
    notes: z.string().optional().describe("Anything else worth recording."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: guard<{
    site_id: string;
    user_id: string;
    training_name: string;
    training_type?: (typeof TRAINING_TYPES)[number];
    completed_date?: string;
    expiry_date?: string;
    certificate_reference?: string;
    notes?: string;
  }>({
    tool: "add_training_record",
    level: "manage",
    site: (i) => i.site_id,
    run: async ({ client, input, actorId, organisationId }) => {
      const name = input.training_name.trim();
      if (!name) throw new Error("A training name is required.");

      const site = await siteMeta(client, input.site_id);
      const today = siteToday(site.timezone);
      const completed = input.completed_date ? isoDate(input.completed_date, "completed_date") : today;
      if (completed > today) throw new Error("Training cannot be recorded as completed in the future.");
      const expiry = input.expiry_date ? isoDate(input.expiry_date, "expiry_date") : null;
      if (expiry && expiry < completed) {
        throw new Error("The expiry date cannot be before the completion date.");
      }

      // The person must actually have access to this site.
      const membership = ok(
        await client
          .from("memberships")
          .select("id, users(display_name)")
          .eq("site_id", input.site_id)
          .eq("user_id", input.user_id)
          .eq("active", true)
          .maybeSingle(),
      ) as { id: string; users: { display_name: string } | null } | null;
      if (!membership) throw new Error("That person does not have access to this site. Use list_staff.");

      // Match an existing catalog entry by name so the record shows against the
      // requirement rather than as a loose extra record.
      const catalog = ok(
        await client
          .from("training_requirements")
          .select("id, training_name, training_type")
          .eq("site_id", input.site_id)
          .eq("is_active", true)
          .is("deleted_at", null),
      ) as { id: string; training_name: string; training_type: string }[] | null;
      const matched = (catalog ?? []).find(
        (c) => c.training_name.trim().toLowerCase() === name.toLowerCase(),
      );

      const noteParts = [
        input.certificate_reference?.trim()
          ? `Certificate reference: ${input.certificate_reference.trim()}`
          : null,
        input.notes?.trim() || null,
      ].filter(Boolean);

      const record = ok(
        await client
          .from("training_records")
          .insert({
            site_id: input.site_id,
            organisation_id: organisationId,
            user_id: input.user_id,
            training_name: name,
            training_type: input.training_type ?? matched?.training_type ?? "other",
            training_catalog_id: matched?.id ?? null,
            completed_date: completed,
            expiry_date: expiry,
            notes: noteParts.length > 0 ? noteParts.join(" · ") : null,
            created_by: actorId,
          })
          .select("id, training_name, training_type, completed_date, expiry_date, notes")
          .single(),
      );

      return {
        record,
        staff_name: membership.users?.display_name ?? null,
        matched_catalog_entry: matched?.training_name ?? null,
      };
    },
  }),
});
