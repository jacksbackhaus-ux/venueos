import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { probeCalibrationPass } from "../../sfbb";
import { guard, ok } from "../helpers";

export default defineTool({
  name: "log_probe_calibration",
  title: "Log a probe calibration check",
  description:
    "Record an iced-water and boiling-water probe calibration check. Pass/fail is derived from the readings (iced water -1°C to 1°C, boiling water 99°C to 101°C).",
  inputSchema: {
    site_id: z.string().uuid().describe("Site id from list_sites."),
    iced_water_reading: z.number().describe("Probe reading in iced water, in degrees Celsius."),
    boiling_water_reading: z.number().describe("Probe reading in boiling water, in degrees Celsius."),
    probe_name: z.string().optional().describe("Which probe was checked, e.g. 'Blue probe'."),
    notes: z.string().optional().describe("Anything worth recording, e.g. what was done if it failed."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: guard<{
    site_id: string;
    iced_water_reading: number;
    boiling_water_reading: number;
    probe_name?: string;
    notes?: string;
  }>({
    tool: "log_probe_calibration",
    level: "write",
    site: (i) => i.site_id,
    run: async ({ client, input, actorId, actorName, organisationId }) => {
      const pass = probeCalibrationPass(input.iced_water_reading, input.boiling_water_reading);
      const calibration = ok(
        await client
          .from("probe_calibrations")
          .insert({
            site_id: input.site_id,
            organisation_id: organisationId,
            probe_name: input.probe_name?.trim() || null,
            iced_water_reading: input.iced_water_reading,
            boiling_water_reading: input.boiling_water_reading,
            pass,
            notes: input.notes?.trim() || null,
            calibrated_by: actorId,
            calibrated_by_name: actorName,
          })
          .select("id, probe_name, iced_water_reading, boiling_water_reading, pass, calibrated_at")
          .single(),
      );
      return {
        calibration,
        pass,
        guidance: pass
          ? "Probe is reading accurately."
          : "Probe failed calibration. Take it out of use or recalibrate it, and record what was done.",
      };
    },
  }),
});
