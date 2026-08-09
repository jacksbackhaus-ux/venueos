import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { json, requireClient, siteOrganisationId } from "../helpers";

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
    logged_by_name: z.string().optional().describe("Who took the reading. Defaults to the signed-in user."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const client = requireClient(ctx);
    const organisation_id = await siteOrganisationId(client, input.site_id);

    let pass = true;
    if (input.unit_id) {
      const { data: unit, error: unitError } = await client
        .from("temp_units")
        .select("min_temp, max_temp")
        .eq("id", input.unit_id)
        .eq("site_id", input.site_id)
        .maybeSingle();
      if (unitError) throw new ToolError(unitError.message);
      if (!unit) throw new ToolError("Unit not found for this site.");
      pass = input.value >= Number(unit.min_temp) && input.value <= Number(unit.max_temp);
    }

    const { data, error } = await client
      .from("temp_logs")
      .insert({
        site_id: input.site_id,
        organisation_id,
        unit_id: input.unit_id ?? null,
        log_type: input.log_type ?? (input.unit_id ? "unit" : "process"),
        value: input.value,
        pass,
        food_item: input.food_item ?? null,
        corrective_action: input.corrective_action ?? null,
        logged_by_name: input.logged_by_name ?? ctx.getUserEmail() ?? "MCP",
        logged_by_user_id: ctx.getUserId() ?? null,
      })
      .select("id, value, pass, log_type, logged_at")
      .single();
    if (error) throw new ToolError(error.message);
    return json({ reading: data });
  },
});
