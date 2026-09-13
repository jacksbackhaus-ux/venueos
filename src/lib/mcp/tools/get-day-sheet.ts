import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { guard, isoDate, ok, siteMeta, siteToday } from "../helpers";

export default defineTool({
  name: "get_day_sheet",
  title: "Get the day sheet",
  description:
    "Get the opening and closing checks for a site on a given date, with each item's id and whether it is done. Use the item ids with complete_day_sheet_items.",
  inputSchema: {
    site_id: z.string().uuid().describe("Site id from list_sites."),
    date: z.string().optional().describe("Date (YYYY-MM-DD). Defaults to today."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: guard<{ site_id: string; date?: string }>({
    tool: "get_day_sheet",
    level: "read",
    site: (i) => i.site_id,
    run: async ({ client, input }) => {
      const site = await siteMeta(client, input.site_id);
      const date = input.date ? isoDate(input.date) : siteToday(site.timezone);

      const [sections, sheet] = await Promise.all([
        client
          .from("day_sheet_sections")
          .select("id, title, default_time, sort_order, day_sheet_items(id, label, active, sort_order)")
          .eq("site_id", input.site_id)
          .eq("active", true)
          .order("sort_order"),
        client
          .from("day_sheets")
          .select(
            "id, sheet_date, locked, signed_off, signed_off_by, signed_off_at, manager_note, problem_notes, day_sheet_entries(item_id, done, completed_by_name, completed_at)",
          )
          .eq("site_id", input.site_id)
          .eq("sheet_date", date)
          .maybeSingle(),
      ]);

      const sheetRow = ok(sheet as never) as Record<string, unknown> | null;
      const entries = (sheetRow?.day_sheet_entries as Record<string, unknown>[] | undefined) ?? [];
      const byItem = new Map(entries.map((e) => [e.item_id as string, e]));

      const sectionRows = (ok(sections as never) as Record<string, unknown>[] | null) ?? [];
      const items = sectionRows.map((s) => ({
        section_id: s.id,
        section: s.title,
        default_time: s.default_time,
        items: ((s.day_sheet_items as Record<string, unknown>[] | null) ?? [])
          .filter((i) => i.active)
          .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
          .map((i) => {
            const entry = byItem.get(i.id as string);
            return {
              item_id: i.id,
              label: i.label,
              done: entry?.done === true,
              completed_by: (entry?.completed_by_name as string) ?? null,
              completed_at: (entry?.completed_at as string) ?? null,
            };
          }),
      }));

      const all = items.flatMap((s) => s.items);
      return {
        date,
        day_sheet: sheetRow
          ? {
              id: sheetRow.id,
              locked: sheetRow.locked,
              signed_off: sheetRow.signed_off,
              signed_off_by: sheetRow.signed_off_by,
              signed_off_at: sheetRow.signed_off_at,
              manager_note: sheetRow.manager_note,
              problem_notes: sheetRow.problem_notes,
            }
          : null,
        completed: all.filter((i) => i.done).length,
        total: all.length,
        sections: items,
      };
    },
  }),
});
