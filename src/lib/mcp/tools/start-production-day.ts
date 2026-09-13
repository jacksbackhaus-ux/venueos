import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { guard, isoDate, ok, siteMeta, siteToday } from "../helpers";

export default defineTool({
  name: "start_production_day",
  title: "Start a production day",
  description:
    "Declare a production day for an on-demand site (home kitchen, market trader, bake-to-order unit). Compliance for these sites is measured across declared production days only, so nothing is due until a production day is started.",
  inputSchema: {
    site_id: z.string().uuid().describe("Site id from list_sites. Must be an on-demand site."),
    date: z.string().optional().describe("Production date (YYYY-MM-DD). Defaults to today."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: guard<{ site_id: string; date?: string }>({
    tool: "start_production_day",
    level: "write",
    site: (i) => i.site_id,
    run: async ({ client, input, actorId, organisationId }) => {
      const site = await siteMeta(client, input.site_id);
      if (site.operating_mode !== "on_demand") {
        throw new Error(
          `${site.name} trades on a daily schedule, so it does not use production days. Production days apply to home, mobile and bake-to-order sites.`,
        );
      }
      const today = siteToday(site.timezone);
      const date = input.date ? isoDate(input.date) : today;
      if (date > today) throw new Error("A production day cannot be started for a future date.");

      const existing = ok(
        await client
          .from("production_days")
          .select("id, production_date, started_at, completed_at")
          .eq("site_id", input.site_id)
          .eq("production_date", date)
          .maybeSingle(),
      );
      if (existing) {
        return {
          production_day: existing,
          already_started: true,
          message: `A production day for ${date} already exists.`,
        };
      }

      const productionDay = ok(
        await client
          .from("production_days")
          .insert({
            site_id: input.site_id,
            organisation_id: organisationId,
            production_date: date,
            started_by: actorId,
            // Honest audit trail: recorded now, but for a past production date.
            is_retrospective: date < today,
          })
          .select("id, production_date, started_at, completed_at, is_retrospective")
          .single(),
      );
      return { production_day: productionDay, already_started: false };
    },
  }),
});
