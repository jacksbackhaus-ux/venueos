import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleaningCompletion,
  currentTrainingRecords,
  outstandingActions,
  previousWorkingDay,
} from "@/lib/mcp/compliance";
import { addDaysISO, daysBetweenISO, eachDateISO, isoDate, siteNow, type SiteMeta } from "@/lib/mcp/helpers";
import { fakeClient, type Fixtures } from "./fakeClient";

const scheduledSite: SiteMeta = {
  id: "site-1",
  name: "Bakery",
  premises_type: "commercial",
  operating_mode: "scheduled",
  timezone: "Europe/London",
  organisation_id: "org-1",
  created_on: "2026-01-01",
};

const onDemandSite: SiteMeta = { ...scheduledSite, id: "site-2", premises_type: "home", operating_mode: "on_demand" };

/** Enough empty tables that the fake client never returns undefined. */
function baseFixtures(overrides: Fixtures = {}): Fixtures {
  const empty = [
    "closed_days", "production_days", "temp_logs", "temp_units", "cleaning_tasks",
    "cleaning_logs", "day_sheet_sections", "day_sheet_items", "day_sheets",
    "day_sheet_entries", "incidents", "batches", "training_records",
    "probe_calibrations", "reviews",
  ];
  const fixtures: Fixtures = {};
  for (const table of empty) fixtures[table] = [];
  return { ...fixtures, ...overrides };
}

describe("MCP date helpers", () => {
  it("walks dates without drifting across a British Summer Time change", () => {
    // 29 March 2026 is the spring-forward Sunday in the UK.
    expect(addDaysISO("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDaysISO("2026-03-29", 1)).toBe("2026-03-30");
    expect(addDaysISO("2026-10-24", 3)).toBe("2026-10-27");
    expect(daysBetweenISO("2026-03-28", "2026-03-31")).toBe(3);
    expect(eachDateISO("2026-03-28", "2026-03-31")).toEqual([
      "2026-03-28", "2026-03-29", "2026-03-30", "2026-03-31",
    ]);
  });

  it("reads the clock at the site, not on the server", () => {
    // 21:30 UTC on a July evening is 22:30 in London, still the same day.
    const at = new Date("2026-07-15T21:30:00Z");
    expect(siteNow("Europe/London", at)).toEqual({ dateISO: "2026-07-15", hour: 22, minutes: 22 * 60 + 30 });
    // 23:30 UTC is already the next day in London during summer time.
    expect(siteNow("Europe/London", new Date("2026-07-15T23:30:00Z")).dateISO).toBe("2026-07-16");
  });

  it("rejects anything that is not a plain YYYY-MM-DD date", () => {
    expect(isoDate("2026-07-15")).toBe("2026-07-15");
    expect(() => isoDate("15/07/2026")).toThrow(/YYYY-MM-DD/);
    expect(() => isoDate("2026-07-15T10:00:00Z")).toThrow(/YYYY-MM-DD/);
  });
});

describe("currentTrainingRecords", () => {
  it("keeps only the most recent record per person and course", () => {
    const rows = [
      { user_id: "u1", training_name: "Level 2 Food Safety", completed_date: "2024-01-01", expiry_date: "2025-01-01" },
      { user_id: "u1", training_name: "level 2 food safety", completed_date: "2026-01-01", expiry_date: "2029-01-01" },
      { user_id: "u2", training_name: "Level 2 Food Safety", completed_date: "2026-02-01", expiry_date: "2029-02-01" },
    ];
    const current = currentTrainingRecords(rows);
    expect(current).toHaveLength(2);
    expect(current.map((r) => r.expiry_date).sort()).toEqual(["2029-01-01", "2029-02-01"]);
  });
});

describe("cleaningCompletion", () => {
  const dates = eachDateISO("2026-06-01", "2026-06-07");

  it("counts one bucket per day for a daily task", () => {
    const result = cleaningCompletion(
      [{ id: "t1", frequency: "daily" }],
      [{ task_id: "t1", log_date: "2026-06-01", done: true }],
      dates,
      dates,
    );
    expect(result).toMatchObject({ expected: 7, done: 1, exempt: 0, pct: 14 });
  });

  it("drops closed and non-production days from both sides of the figure", () => {
    // Only two of the seven days count — the rest are closed or non-production.
    const counted = ["2026-06-03", "2026-06-04"];
    const result = cleaningCompletion(
      [{ id: "t1", frequency: "daily" }],
      [{ task_id: "t1", log_date: "2026-06-03", done: true }],
      counted,
      dates,
    );
    expect(result).toMatchObject({ expected: 2, done: 1, exempt: 5, pct: 50 });
  });

  it("treats a weekly task as one occurrence, not seven", () => {
    const result = cleaningCompletion(
      [{ id: "t1", frequency: "weekly" }],
      [{ task_id: "t1", log_date: "2026-06-04", done: true }],
      dates,
      dates,
    );
    // 1–7 June 2026 spans two ISO weeks (Mon 1st starts one, Mon 8th is outside).
    expect(result.expected).toBe(1);
    expect(result.done).toBe(1);
    expect(result.pct).toBe(100);
  });

  it("never reports a failure when every day in the period is exempt", () => {
    const result = cleaningCompletion([{ id: "t1", frequency: "daily" }], [], [], dates);
    expect(result).toMatchObject({ expected: 0, done: 0, exempt: 7, pct: null });
  });
});

describe("outstandingActions — days that do not count", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T15:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("reports nothing on a declared closed day", async () => {
    const { client } = fakeClient(
      baseFixtures({
        closed_days: [{ id: "c1", site_id: "site-1", closed_date: "2026-06-10" }],
        temp_units: [{ id: "u1", site_id: "site-1", name: "Walk-in fridge", active: true }],
        incidents: [{ id: "i1", site_id: "site-1", status: "open", title: "Old incident", type: "other", reported_at: "2026-06-01T09:00:00Z" }],
      }),
    );
    const result = await outstandingActions(client, scheduledSite, "2026-06-10");
    expect(result.actions).toEqual([]);
    expect(result.nothing_due_reason).toMatch(/closed/i);
  });

  it("reports nothing on an on-demand site with no production day declared", async () => {
    const { client } = fakeClient(
      baseFixtures({
        temp_units: [{ id: "u1", site_id: "site-2", name: "Fridge", active: true }],
        cleaning_tasks: [{ id: "t1", site_id: "site-2", task: "Wipe surfaces", area: "Kitchen", frequency: "daily", active: true, due_time: null }],
      }),
    );
    const result = await outstandingActions(client, onDemandSite, "2026-06-10");
    expect(result.actions).toEqual([]);
    expect(result.nothing_due_reason).toMatch(/production day/i);
  });

  it("does report on an on-demand site once a production day is declared", async () => {
    const { client } = fakeClient(
      baseFixtures({
        production_days: [{ id: "p1", site_id: "site-2", production_date: "2026-06-10" }],
        temp_units: [{ id: "u1", site_id: "site-2", name: "Fridge", active: true }],
      }),
    );
    const result = await outstandingActions(client, onDemandSite, "2026-06-10");
    expect(result.nothing_due_reason).toBeUndefined();
    expect(result.actions.some((a) => a.title.includes("AM check not logged"))).toBe(true);
  });

  it("never chases the previous calendar day on an on-demand site", async () => {
    const { client } = fakeClient(
      baseFixtures({
        production_days: [{ id: "p1", site_id: "site-2", production_date: "2026-06-10" }],
        cleaning_tasks: [{ id: "t1", site_id: "site-2", task: "Wipe surfaces", area: "Kitchen", frequency: "daily", active: true, due_time: null }],
      }),
    );
    const result = await outstandingActions(client, onDemandSite, "2026-06-10");
    // 9 June was not a production day, so it can carry no missed cleaning.
    expect(result.actions.some((a) => a.title.includes("2026-06-09"))).toBe(false);
  });

  it("skips a temperature failure that was logged on a closed day", async () => {
    const { client } = fakeClient(
      baseFixtures({
        closed_days: [{ id: "c1", site_id: "site-1", closed_date: "2026-06-08" }],
        temp_logs: [
          { id: "l1", site_id: "site-1", value: 12, pass: false, corrective_action: null, unit_id: "u1", food_item: null, logged_at: "2026-06-08T09:00:00Z" },
        ],
        temp_units: [{ id: "u1", site_id: "site-1", name: "Walk-in fridge", active: true }],
      }),
    );
    const result = await outstandingActions(client, scheduledSite, "2026-06-10");
    expect(result.actions.some((a) => a.area === "Temperatures" && a.severity === "critical")).toBe(false);
  });

  it("raises an unresolved temperature failure on a day that does count", async () => {
    const { client } = fakeClient(
      baseFixtures({
        temp_logs: [
          { id: "l1", site_id: "site-1", value: 12, pass: false, corrective_action: null, unit_id: "u1", food_item: null, logged_at: "2026-06-09T09:00:00Z" },
        ],
        temp_units: [{ id: "u1", site_id: "site-1", name: "Walk-in fridge", active: true }],
      }),
    );
    const result = await outstandingActions(client, scheduledSite, "2026-06-10");
    const breach = result.actions.find((a) => a.severity === "critical");
    expect(breach?.title).toContain("Walk-in fridge failed at 12°C");
    expect(result.counts.critical).toBe(1);
  });

  it("does not flag training that has since been renewed", async () => {
    const { client } = fakeClient(
      baseFixtures({
        training_records: [
          { id: "tr1", site_id: "site-1", user_id: "u1", training_name: "Level 2 Food Safety", completed_date: "2023-01-01", expiry_date: "2024-01-01" },
          { id: "tr2", site_id: "site-1", user_id: "u1", training_name: "Level 2 Food Safety", completed_date: "2026-01-01", expiry_date: "2029-01-01" },
        ],
      }),
    );
    const result = await outstandingActions(client, scheduledSite, "2026-06-10");
    expect(result.actions.some((a) => a.area === "Training")).toBe(false);
  });

  it("flags training whose most recent record has expired", async () => {
    const { client } = fakeClient(
      baseFixtures({
        training_records: [
          { id: "tr1", site_id: "site-1", user_id: "u1", training_name: "Allergen awareness", completed_date: "2023-01-01", expiry_date: "2026-06-01" },
        ],
      }),
    );
    const result = await outstandingActions(client, scheduledSite, "2026-06-10");
    expect(result.actions.find((a) => a.area === "Training")?.title).toBe(
      "Allergen awareness expired 9 days ago",
    );
  });

  it("leaves a cleaning task alone until its due time has passed", async () => {
    vi.setSystemTime(new Date("2026-06-10T07:00:00Z")); // 08:00 in London
    const { client } = fakeClient(
      baseFixtures({
        cleaning_tasks: [
          { id: "t1", site_id: "site-1", task: "End of day deep clean", area: "Kitchen", frequency: "daily", active: true, due_time: "21:00" },
        ],
      }),
    );
    const result = await outstandingActions(client, scheduledSite, "2026-06-10");
    expect(result.actions.some((a) => a.title.includes("End of day deep clean") && a.title.startsWith("Due today"))).toBe(false);
  });
});

describe("previousWorkingDay", () => {
  it("never reaches back past the day the site was created", async () => {
    const { client } = fakeClient(baseFixtures());
    const newSite = { ...scheduledSite, created_on: "2026-06-10" };
    expect(await previousWorkingDay(client, newSite, "2026-06-10")).toBeNull();
  });

  it("skips a closed day rather than treating it as missed work", async () => {
    const { client } = fakeClient(
      baseFixtures({ closed_days: [{ id: "c1", site_id: "site-1", closed_date: "2026-06-09" }] }),
    );
    expect(await previousWorkingDay(client, scheduledSite, "2026-06-10")).toBeNull();
  });

  it("uses the last declared production day on an on-demand site", async () => {
    const { client } = fakeClient(
      baseFixtures({
        production_days: [
          { id: "p1", site_id: "site-2", production_date: "2026-06-02" },
          { id: "p2", site_id: "site-2", production_date: "2026-06-07" },
          { id: "p3", site_id: "site-2", production_date: "2026-06-10" },
        ],
      }),
    );
    expect(await previousWorkingDay(client, onDemandSite, "2026-06-10")).toBe("2026-06-07");
  });
});
