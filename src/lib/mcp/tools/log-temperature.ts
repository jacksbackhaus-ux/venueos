import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { guard, ok } from "../helpers";

export default defineTool({
  name: "log_temperature",
  title: "Log a temperature reading",
  description:
    "Record a temperature reading for a site. Pass/fail is derived from the unit's range when a unit_id is given.",
  inputSchema: {
    site_id: z.string().uuid().describe("Site id from list_sites."),
    value: z.number().describe("Temperature in degrees Celsius."),
    unit_id: z.string().uuid().optional().describe("Monitored unit id from list_temperature_units."),
    log_type: z
      .string()
      .optional()
      .describe("Reading type, e.g. unit, cooking, reheating, hot_holding, cooling, delivery."),
    food_item: z.string().optional().describe("Food item the reading relates to, for process checks."),
    corrective_action: z.string().optional().describe("Action taken if the reading failed."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: guard<{
    site_id: string;
    value: number;
    unit_id?: string;
    log_type?: string;
    food_item?: string;
    corrective_action?: string;
  }>({
    tool: "log_temperature",
    level: "write",
    site: (i) => i.site_id,
    run: async ({ client, input, actorId, actorName, organisationId }) => {
      let pass = true;
      if (input.unit_id) {
        const unit = ok(
          await client
            .from("temp_units")
            .select("min_temp, max_temp")
            .eq("id", input.unit_id)
            .eq("site_id", input.site_id)
            .maybeSingle(),
        );
        if (!unit) throw new Error("Unit not found for this site.");
        const min = unit.min_temp as number | null;
        const max = unit.max_temp as number | null;
        pass = (min === null || input.value >= min) && (max === null || input.value <= max);
      }
      const log = ok(
        await client
          .from("temp_logs")
          .insert({
            site_id: input.site_id,
            organisation_id: organisationId,
            unit_id: input.unit_id ?? null,
            value: input.value,
            pass,
            log_type: input.log_type ?? (input.unit_id ? "unit" : "cooking"),
            food_item: input.food_item ?? null,
            corrective_action: input.corrective_action ?? null,
            logged_by_user_id: actorId,
            logged_by_name: actorName,
          })
          .select("id, value, pass, log_type, logged_at")
          .single(),
      );
      return { log, pass };
    },
  }),
});
