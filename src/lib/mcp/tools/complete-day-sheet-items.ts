import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { guard, isoDate, ok, siteMeta, siteToday } from "../helpers";

export default defineTool({
  name: "complete_day_sheet_items",
  title: "Complete day sheet items",
  description:
    "Tick off one or more opening or closing checks on a site's day sheet for a date. Use get_day_sheet to find the item ids. Creates the day sheet if it does not exist yet.",
  inputSchema: {
    site_id: z.string().uuid().describe("Site id from list_sites."),
    item_ids: z.array(z.string().uuid()).min(1).describe("Day sheet item ids from get_day_sheet."),
    date: z.string().optional().describe("Date (YYYY-MM-DD). Defaults to today."),
    note: z.string().optional().describe("Note to record against every item completed in this call."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: guard<{ site_id: string; item_ids: string[]; date?: string; note?: string }>({
    tool: "complete_day_sheet_items",
    level: "write",
    site: (i) => i.site_id,
    run: async ({ client, input, actorId, actorName, organisationId }) => {
      const site = await siteMeta(client, input.site_id);
      const today = siteToday(site.timezone);
      const date = input.date ? isoDate(input.date) : today;
      if (date > today) throw new Error("Day sheet items cannot be completed for a future date.");
      const isRetrospective = date < today;

      // Only items that belong to this site's own sections may be ticked.
      const sections = ok(
        await client
          .from("day_sheet_sections")
          .select("id, title, day_sheet_items(id, label, active)")
          .eq("site_id", input.site_id)
          .eq("active", true),
      ) as Record<string, unknown>[] | null;
      const valid = new Map<string, string>();
      for (const s of sections ?? []) {
        for (const i of ((s.day_sheet_items as Record<string, unknown>[] | null) ?? []).filter((i) => i.active)) {
          valid.set(i.id as string, `${s.title} — ${i.label}`);
        }
      }
      const unknown = input.item_ids.filter((id) => !valid.has(id));
      if (unknown.length > 0) {
        throw new Error(`These items do not belong to this site's day sheet: ${unknown.join(", ")}`);
      }

      let sheet = ok(
        await client
          .from("day_sheets")
          .select("id, locked, signed_off")
          .eq("site_id", input.site_id)
          .eq("sheet_date", date)
          .maybeSingle(),
      ) as { id: string; locked: boolean; signed_off: boolean } | null;

      if (sheet?.locked || sheet?.signed_off) {
        throw new Error(
          "This day sheet has been signed off and locked. A manager must reopen it in MiseOS before it can change.",
        );
      }

      if (!sheet) {
        sheet = ok(
          await client
            .from("day_sheets")
            .insert({
              site_id: input.site_id,
              organisation_id: organisationId,
              sheet_date: date,
              is_retrospective: isRetrospective,
            })
            .select("id, locked, signed_off")
            .single(),
        ) as { id: string; locked: boolean; signed_off: boolean };
      }

      const completedAt = isRetrospective ? `${date}T12:00:00.000Z` : new Date().toISOString();
      const existing = ok(
        await client
          .from("day_sheet_entries")
          .select("id, item_id")
          .eq("day_sheet_id", sheet.id)
          .in("item_id", input.item_ids),
      ) as { id: string; item_id: string }[] | null;
      const existingByItem = new Map((existing ?? []).map((e) => [e.item_id, e.id]));

      const payload = {
        done: true,
        completed_at: completedAt,
        completed_by_user_id: actorId,
        completed_by_name: actorName,
        is_retrospective: isRetrospective,
        note: input.note?.trim() || null,
      };

      const completed: { item_id: string; label: string }[] = [];
      for (const itemId of input.item_ids) {
        const entryId = existingByItem.get(itemId);
        if (entryId) {
          ok(await client.from("day_sheet_entries").update(payload).eq("id", entryId).select("id").single());
        } else {
          ok(
            await client
              .from("day_sheet_entries")
              .insert({ day_sheet_id: sheet.id, item_id: itemId, ...payload })
              .select("id")
              .single(),
          );
        }
        completed.push({ item_id: itemId, label: valid.get(itemId)! });
      }

      return { date, day_sheet_id: sheet.id, retrospective: isRetrospective, completed };
    },
  }),
});
