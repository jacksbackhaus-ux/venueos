import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { suggestedReturnDate } from "../../sfbb";
import { guard, isoDate, ok, siteMeta, siteToday } from "../helpers";

export default defineTool({
  name: "record_fitness_to_work",
  title: "Record fitness to work",
  description:
    "Record that a member of staff has been excluded from food handling because of illness, or clear someone to return to work. Managers and owners only. Pass record_id with cleared_to_return to clear an existing exclusion; otherwise a new exclusion is recorded.",
  inputSchema: {
    site_id: z.string().uuid().describe("Site id from list_sites."),
    record_id: z
      .string()
      .uuid()
      .optional()
      .describe("Existing fitness-to-work record to clear. Omit to record a new exclusion."),
    staff_name: z.string().optional().describe("Who is affected. Required when recording a new exclusion."),
    user_id: z.string().uuid().optional().describe("The staff member's user id from list_staff, if they have an account."),
    symptoms: z.string().optional().describe("Symptoms reported, e.g. vomiting, diarrhoea."),
    excluded_from: z.string().optional().describe("First date excluded from food handling (YYYY-MM-DD). Defaults to today."),
    cleared_to_return: z
      .string()
      .optional()
      .describe("Date cleared to return to food handling (YYYY-MM-DD). Setting this clears the exclusion."),
    notes: z.string().optional().describe("Anything else worth recording."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: guard<{
    site_id: string;
    record_id?: string;
    staff_name?: string;
    user_id?: string;
    symptoms?: string;
    excluded_from?: string;
    cleared_to_return?: string;
    notes?: string;
  }>({
    tool: "record_fitness_to_work",
    level: "manage",
    site: (i) => i.site_id,
    run: async ({ client, input, actorId, actorName, organisationId }) => {
      const site = await siteMeta(client, input.site_id);
      const today = siteToday(site.timezone);
      const cleared = input.cleared_to_return
        ? isoDate(input.cleared_to_return, "cleared_to_return")
        : null;

      const columns =
        "id, staff_name, user_id, reported_date, symptoms, excluded_from, cleared_to_return, status, notes, recorded_by_name";

      // Clearing someone who is already on record as excluded.
      if (input.record_id) {
        if (!cleared) {
          throw new Error("Pass cleared_to_return to clear an existing fitness-to-work record.");
        }
        const existing = ok(
          await client
            .from("fitness_to_work")
            .select("id, staff_name, excluded_from")
            .eq("id", input.record_id)
            .eq("site_id", input.site_id)
            .maybeSingle(),
        ) as { id: string; staff_name: string; excluded_from: string | null } | null;
        if (!existing) throw new Error("Fitness-to-work record not found for this site.");
        if (existing.excluded_from && cleared < existing.excluded_from) {
          throw new Error("The return date cannot be before the exclusion started.");
        }

        const patch: Record<string, unknown> = { status: "cleared", cleared_to_return: cleared };
        if (input.notes !== undefined) patch.notes = input.notes.trim() || null;

        const record = ok(
          await client
            .from("fitness_to_work")
            .update(patch)
            .eq("id", input.record_id)
            .eq("site_id", input.site_id)
            .select(columns)
            .single(),
        );
        return { record, cleared: true };
      }

      const staffName = input.staff_name?.trim();
      if (!staffName) throw new Error("staff_name is required when recording a new exclusion.");
      const excludedFrom = input.excluded_from ? isoDate(input.excluded_from, "excluded_from") : today;
      if (cleared && cleared < excludedFrom) {
        throw new Error("The return date cannot be before the exclusion started.");
      }

      const record = ok(
        await client
          .from("fitness_to_work")
          .insert({
            site_id: input.site_id,
            organisation_id: organisationId,
            staff_name: staffName,
            user_id: input.user_id ?? null,
            symptoms: input.symptoms?.trim() || null,
            reported_date: today,
            excluded_from: excludedFrom,
            cleared_to_return: cleared,
            status: cleared ? "cleared" : "excluded",
            notes: input.notes?.trim() || null,
            recorded_by: actorId,
            recorded_by_name: actorName,
          })
          .select(columns)
          .single(),
      );

      return {
        record,
        cleared: !!cleared,
        // SFBB rule: 48 hours symptom-free before returning to food handling.
        suggested_return_date: cleared ? null : suggestedReturnDate(excludedFrom),
        guidance: cleared
          ? undefined
          : "Under Safer Food Better Business, anyone with vomiting or diarrhoea must stay away from food handling until they have been symptom-free for 48 hours.",
      };
    },
  }),
});
