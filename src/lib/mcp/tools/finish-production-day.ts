import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { guard, isoDate, ok, siteMeta, siteToday } from "../helpers";

export default defineTool({
  name: "finish_production_day",
  title: "Finish a production day",
  description:
    "Close off the production day for an on-demand site, optionally with notes about how it went.",
  inputSchema: {
    site_id: z.string().uuid().describe("Site id from list_sites. Must be an on-demand site."),
    date: z.string().optional().describe("Production date to close (YYYY-MM-DD). Defaults to today."),
    notes: z.string().optional().describe("Notes about the production day."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: guard<{ site_id: string; date?: string; notes?: string }>({
    tool: "finish_production_day",
    level: "write",
    site: (i) => i.site_id,
    run: async ({ client, input, actorId }) => {
      const site = await siteMeta(client, input.site_id);
      if (site.operating_mode !== "on_demand") {
        throw new Error(
          `${site.name} trades on a daily schedule, so it does not use production days.`,
        );
      }
      const date = input.date ? isoDate(input.date) : siteToday(site.timezone);

      const existing = ok(
        await client
          .from("production_days")
          .select("id, completed_at")
          .eq("site_id", input.site_id)
          .eq("production_date", date)
          .maybeSingle(),
      ) as { id: string; completed_at: string | null } | null;
      if (!existing) {
        throw new Error(`No production day has been started for ${date}, so there is nothing to close.`);
      }

      const productionDay = ok(
        await client
          .from("production_days")
          .update({
            completed_at: new Date().toISOString(),
            completed_by: actorId,
            notes: input.notes?.trim() || null,
          })
          .eq("id", existing.id)
          .select("id, production_date, started_at, completed_at, notes")
          .single(),
      );
      return {
        production_day: productionDay,
        reclosed: !!existing.completed_at,
      };
    },
  }),
});
