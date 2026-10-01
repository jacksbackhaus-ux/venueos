import { describe, expect, it } from "vitest";
import { incidentCurrentStage, incidentStageTimeline, nextIncidentAction, type IncidentStageRecord } from "../incidentStages";

const base: IncidentStageRecord = {
  status: "open",
  reported_at: "2026-10-01T09:00:00Z",
  reported_by_name: "Reporter",
  description: "Issue reported",
};

describe("incident stage mapping", () => {
  it("maps a new incident through all four stages", () => {
    expect(incidentCurrentStage(base)).toBe("reported");
    expect(nextIncidentAction(base)).toBe("resolved");
    const resolved = { ...base, stage_schema_version: 1, resolved_at_stage: "2026-10-01T10:00:00Z", resolved_summary: "Made safe" };
    expect(incidentCurrentStage(resolved)).toBe("resolved");
    expect(nextIncidentAction(resolved)).toBe("corrective_action");
    const corrected = { ...resolved, status: "action-taken", corrective_action_at: "2026-10-01T11:00:00Z", corrective_action_summary: "Process changed" };
    expect(incidentCurrentStage(corrected)).toBe("corrective_action");
    expect(nextIncidentAction(corrected)).toBe("verified");
    expect(nextIncidentAction({ ...corrected, status: "verified", verification_at_stage: "2026-10-01T12:00:00Z" })).toBeNull();
  });

  it.each(["open", "action-taken", "verified"])("shows honest legacy gaps for %s records", (status) => {
    const timeline = incidentStageTimeline({ ...base, status });
    expect(timeline[1].note).toBe("Not separately recorded (legacy record)");
    expect(timeline[2].note).toBe("Not separately recorded (legacy record)");
    expect(timeline[1].state).toBe("legacy");
    expect(timeline[2].state).toBe("legacy");
  });

  it("keeps the historical display name rather than requiring an active staff record", () => {
    const timeline = incidentStageTimeline({ ...base, reported_by_name: "Removed staff member" });
    expect(timeline[0].actor).toBe("Removed staff member");
  });

  it("accepts long evidence notes without truncating them", () => {
    const note = "x".repeat(20_000);
    const timeline = incidentStageTimeline({ ...base, stage_schema_version: 1, resolved_summary: note, resolved_at_stage: "2026-10-01T10:00:00Z" });
    expect(timeline[1].note).toHaveLength(20_000);
  });
});