import { describe, expect, it } from "vitest";
import { calculateMissedSchedule, type MissedScheduleInput } from "@/lib/scheduleHistory";

const base: MissedScheduleInput = {
  from: "2026-10-02",
  to: "2026-10-02",
  cutoverDate: "2026-10-02",
  timezone: "Europe/London",
  operatingMode: "scheduled",
  temperatureVersions: [],
  cleaningVersions: [],
  temperatureLogs: [],
  cleaningLogs: [],
  dayBasis: [{ date: "2026-10-02", closed: false, productionDay: false }],
  now: new Date("2026-10-02T19:00:00Z"),
};

describe("historical schedule shadow calculation", () => {
  it("returns Unknown before cutover rather than claiming a miss", () => {
    const result = calculateMissedSchedule({
      ...base, from: "2026-10-01", to: "2026-10-01",
      temperatureVersions: [{ temp_unit_id: "u1", effective_from: "2026-10-02", effective_to: null, scheduled: true, expected_check_types: ["AM Check", "PM Check"] }],
      dayBasis: [{ date: "2026-10-01", closed: false, productionDay: false }],
    });
    expect(result.every((item) => item.state === "unknown")).toBe(true);
  });

  it("covers AM, PM and configured spot checks", () => {
    const result = calculateMissedSchedule({
      ...base,
      temperatureVersions: [{ temp_unit_id: "u1", effective_from: "2026-10-02", effective_to: null, scheduled: true, expected_check_types: ["AM Check", "PM Check", "Spot Check"] }],
      temperatureLogs: [{ parentId: "u1", date: "2026-10-02", kind: "AM Check" }],
    });
    expect(result.map((item) => [item.kind, item.state])).toEqual([
      ["AM Check", "complete"], ["PM Check", "missing"], ["Spot Check", "missing"],
    ]);
  });

  it("uses only the version active on each date across edits and deactivation", () => {
    const result = calculateMissedSchedule({
      ...base, from: "2026-10-02", to: "2026-10-05",
      temperatureVersions: [
        { temp_unit_id: "u1", effective_from: "2026-10-02", effective_to: "2026-10-03", scheduled: true, expected_check_types: ["AM Check"] },
        { temp_unit_id: "u1", effective_from: "2026-10-03", effective_to: "2026-10-04", scheduled: true, expected_check_types: ["AM Check", "PM Check"] },
        { temp_unit_id: "u1", effective_from: "2026-10-05", effective_to: null, scheduled: true, expected_check_types: ["AM Check"] },
      ],
      dayBasis: [2, 3, 4, 5].map((day) => ({ date: `2026-10-0${day}`, closed: false, productionDay: false })),
      now: new Date("2026-10-06T12:00:00Z"),
    });
    expect(result.map((item) => item.date)).toEqual(["2026-10-02", "2026-10-03", "2026-10-03", "2026-10-05"]);
  });

  it.each(["daily", "weekly", "monthly"] as const)("calculates %s cleaning boundaries", (frequency) => {
    const result = calculateMissedSchedule({
      ...base, from: "2026-10-01", to: "2026-10-31", cutoverDate: "2026-10-01",
      cleaningVersions: [{ cleaning_task_id: "c1", effective_from: "2026-10-01", effective_to: null, scheduled: true, frequency, due_time: null }],
      dayBasis: Array.from({ length: 31 }, (_, index) => ({ date: `2026-10-${String(index + 1).padStart(2, "0")}`, closed: false, productionDay: false })),
      now: new Date("2026-11-02T12:00:00Z"),
    });
    expect(result).toHaveLength(frequency === "daily" ? 31 : frequency === "weekly" ? 5 : 1);
  });

  it("exempts closed days and non-production days", () => {
    const version = [{ temp_unit_id: "u1", effective_from: "2026-10-02", effective_to: null, scheduled: true, expected_check_types: ["AM Check"] }];
    const closed = calculateMissedSchedule({ ...base, temperatureVersions: version, dayBasis: [{ date: "2026-10-02", closed: true, productionDay: false }] });
    const onDemand = calculateMissedSchedule({ ...base, operatingMode: "on_demand", temperatureVersions: version });
    expect(closed[0]?.state).toBe("exempt");
    expect(onDemand[0]?.state).toBe("exempt");
  });

  it("uses the site clock across UK daylight-saving changes", () => {
    const version = [{ temp_unit_id: "u1", effective_from: "2026-03-29", effective_to: null, scheduled: true, expected_check_types: ["AM Check"] }];
    const result = calculateMissedSchedule({
      ...base, from: "2026-03-29", to: "2026-03-29", cutoverDate: "2026-03-29",
      temperatureVersions: version, dayBasis: [{ date: "2026-03-29", closed: false, productionDay: false }],
      now: new Date("2026-03-29T09:30:00Z"),
    });
    expect(result[0]?.state).toBe("pending");
  });

  it("matches current-day AM/PM behavior for active scheduled units", () => {
    const result = calculateMissedSchedule({
      ...base,
      temperatureVersions: [{ temp_unit_id: "u1", effective_from: "2026-10-02", effective_to: null, scheduled: true, expected_check_types: ["AM Check", "PM Check"] }],
      temperatureLogs: [{ parentId: "u1", date: "2026-10-02", kind: "AM Check" }],
      now: new Date("2026-10-02T16:00:00Z"),
    });
    expect(result.map((item) => item.state)).toEqual(["complete", "pending"]);
  });
});
