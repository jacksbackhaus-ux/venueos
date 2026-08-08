import { describe, expect, it } from "vitest";
import { computeReviewCadence, probeCalibrationPass, suggestedReturnDate } from "@/lib/sfbb";

describe("computeReviewCadence — scheduled sites", () => {
  it("is not due inside the 4-week window", () => {
    const c = computeReviewCadence({ mode: "scheduled", periodStartISO: "2026-08-01", todayISO: "2026-08-20" });
    expect(c.due).toBe(false);
    expect(c.reviewLabel).toBe("4-weekly review");
  });

  it("becomes due after 28 days", () => {
    const c = computeReviewCadence({ mode: "scheduled", periodStartISO: "2026-08-01", todayISO: "2026-08-29" });
    expect(c.due).toBe(true);
    expect(c.periodEnd).toBe("2026-08-28");
  });
});

describe("computeReviewCadence — on-demand sites", () => {
  it("ignores calendar days with no production", () => {
    const c = computeReviewCadence({
      mode: "on_demand",
      periodStartISO: "2026-08-01",
      productionDates: ["2026-08-03", "2026-08-10"],
      todayISO: "2026-08-31",
    });
    expect(c.due).toBe(false);
    expect(c.productionDaysCovered).toBe(2);
  });

  it("is due after 20 production days", () => {
    const dates = Array.from({ length: 20 }, (_, i) => `2026-08-${String(i + 1).padStart(2, "0")}`);
    const c = computeReviewCadence({
      mode: "on_demand", periodStartISO: "2026-08-01", productionDates: dates, todayISO: "2026-08-21",
    });
    expect(c.due).toBe(true);
  });

  it("is due after 3 months even with almost no production", () => {
    const c = computeReviewCadence({
      mode: "on_demand", periodStartISO: "2026-01-01", productionDates: ["2026-01-05"], todayISO: "2026-05-01",
    });
    expect(c.due).toBe(true);
  });
});

describe("probeCalibrationPass", () => {
  it("passes inside tolerance", () => {
    expect(probeCalibrationPass(0, 100)).toBe(true);
    expect(probeCalibrationPass(-1, 101)).toBe(true);
  });
  it("fails outside tolerance", () => {
    expect(probeCalibrationPass(3, 100)).toBe(false);
    expect(probeCalibrationPass(0, 96)).toBe(false);
  });
});

describe("suggestedReturnDate", () => {
  it("adds 48 hours to the last day of symptoms", () => {
    expect(suggestedReturnDate("2026-08-10")).toBe("2026-08-12");
  });
});
