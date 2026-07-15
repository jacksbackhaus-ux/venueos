import { describe, it, expect } from "vitest";
import {
  LAUNCH_MODE,
  HIDDEN_MODULES,
  VISIBLE_MODULES,
  isModuleVisibleInLaunch,
  showAIFeatures,
  showCommercialModules,
  showMessenger,
  showMultiSiteHQ,
} from "@/lib/launchFlags";

describe("launchFlags (HACCP launch regression)", () => {
  it("locks LAUNCH_MODE to 'haccp' for customer launch", () => {
    expect(LAUNCH_MODE).toBe("haccp");
  });

  it("hides all non-HACCP modules from customer UI", () => {
    for (const m of [
      "shifts",
      "timesheets",
      "waste_log",
      "cost_margin",
      "tip_tracker",
      "ai_insights",
      "messenger",
    ] as const) {
      expect(HIDDEN_MODULES.has(m)).toBe(true);
      expect(isModuleVisibleInLaunch(m)).toBe(false);
    }
  });

  it("keeps core HACCP modules visible", () => {
    for (const m of [
      "day_sheet",
      "temperatures",
      "cleaning",
      "batch_tracking",
      "allergens",
      "suppliers",
      "haccp",
      "reports",
    ] as const) {
      expect(VISIBLE_MODULES.has(m)).toBe(true);
      expect(isModuleVisibleInLaunch(m)).toBe(true);
    }
  });

  it("disables commercial/AI/messenger surface but keeps All Sites overview", () => {
    expect(showAIFeatures).toBe(false);
    expect(showCommercialModules).toBe(false);
    expect(showMessenger).toBe(false);
    expect(showMultiSiteHQ).toBe(true);
  });

  it("hidden and visible module sets do not overlap", () => {
    for (const m of HIDDEN_MODULES) {
      expect(VISIBLE_MODULES.has(m)).toBe(false);
    }
  });
});
