import { describe, expect, it } from "vitest";
import { incidentCurrentStage, incidentStageTimeline, nextIncidentAction, LEGACY_NOTE, type IncidentStageRecord } from "../incidentStages";

const base: IncidentStageRecord = {
  status: "open",
  reported_at: "2026-10-01T09:00:00Z",
  reported_by_name: "Reporter",
  description: "Issue reported",
};
const states = (i: IncidentStageRecord) => incidentStageTimeline(i).map((s) => s.state);

describe("incident stage mapping (evidence-based)", () => {
  it("new open incident: middle stages pending, not legacy", () => {
    const i = { ...base, stage_schema_version: 1 };
    expect(states(i)).toEqual(["complete", "current", "pending", "pending"]);
    expect(nextIncidentAction(i)).toBe("resolved");
  });

  it("open incident with no version flag is also pending, not legacy", () => {
    expect(states(base)).toEqual(["complete", "current", "pending", "pending"]);
  });

  it("old-flow action-taken: middle stages legacy, verify is next", () => {
    const i = { ...base, status: "action-taken" };
    const t = incidentStageTimeline(i);
    expect(t.map((s) => s.state)).toEqual(["complete", "legacy", "legacy", "current"]);
    expect(t[1].note).toBe(LEGACY_NOTE);
    expect(nextIncidentAction(i)).toBe("verified");
  });

  it("old-flow verified (even if flagged version 1): middle stages legacy, never complete", () => {
    const i = { ...base, status: "verified", stage_schema_version: 1, verified_at: "2026-10-01T12:00:00Z", verified_by_name: "Boss" };
    const t = incidentStageTimeline(i);
    expect(t.map((s) => s.state)).toEqual(["complete", "legacy", "legacy", "complete"]);
    expect(t[3].actor).toBe("Boss");
    expect(nextIncidentAction(i)).toBeNull();
  });

  it("connector-closed incident: middle stages legacy, verified complete", () => {
    const i = { ...base, status: "closed", verified_at: "2026-10-01T12:00:00Z", verified_by_name: "Bot user" };
    expect(states(i)).toEqual(["complete", "legacy", "legacy", "complete"]);
    expect(incidentCurrentStage(i)).toBe("verified");
  });

  it("full four-stage chain shows every stage complete with evidence", () => {
    const resolved = { ...base, stage_schema_version: 1, resolved_at_stage: "2026-10-01T10:00:00Z", resolved_summary: "Made safe", resolved_by_name: "A" };
    expect(states(resolved)).toEqual(["complete", "complete", "current", "pending"]);
    expect(nextIncidentAction(resolved)).toBe("corrective_action");
    const corrected = { ...resolved, status: "action-taken", corrective_action_at: "2026-10-01T11:00:00Z", corrective_action_summary: "Process changed" };
    expect(states(corrected)).toEqual(["complete", "complete", "complete", "current"]);
    expect(nextIncidentAction(corrected)).toBe("verified");
    const verified = { ...corrected, status: "verified", verification_at_stage: "2026-10-01T12:00:00Z", verification_summary: "Checked" };
    expect(states(verified)).toEqual(["complete", "complete", "complete", "complete"]);
    expect(nextIncidentAction(verified)).toBeNull();
  });

  it("keeps the historical display name", () => {
    expect(incidentStageTimeline({ ...base, reported_by_name: "Removed staff member" })[0].actor).toBe("Removed staff member");
  });

  it("accepts long evidence notes without truncating them", () => {
    const note = "x".repeat(20_000);
    const t = incidentStageTimeline({ ...base, resolved_summary: note, resolved_at_stage: "2026-10-01T10:00:00Z" });
    expect(t[1].note).toHaveLength(20_000);
  });
});
