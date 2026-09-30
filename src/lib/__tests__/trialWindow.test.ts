import { describe, it, expect } from "vitest";
import { computeStripeTrialEnd } from "../../../supabase/functions/_shared/trialWindow";

const now = Date.UTC(2026, 8, 30, 12, 0, 0);
const day = 86400000;
const base = { isHaccp: true, addSiteMode: false, nowMs: now };

describe("computeStripeTrialEnd", () => {
  it("brand-new org with signup placeholder gets a trial ending on the original date", () => {
    const placeholder = new Date(now + 14 * day - 60000).toISOString();
    expect(computeStripeTrialEnd({ ...base, placeholderTrialEnd: placeholder }))
      .toBe(Math.floor(new Date(placeholder).getTime() / 1000));
  });
  it("paying on day 5 keeps the original end date (not extended)", () => {
    const placeholder = new Date(now + 9 * day).toISOString();
    expect(computeStripeTrialEnd({ ...base, placeholderTrialEnd: placeholder }))
      .toBe(Math.floor((now + 9 * day) / 1000));
  });
  it("never exceeds 14 days even if placeholder is later", () => {
    const placeholder = new Date(now + 40 * day).toISOString();
    expect(computeStripeTrialEnd({ ...base, placeholderTrialEnd: placeholder }))
      .toBe(Math.floor((now + 14 * day) / 1000));
  });
  it("under 2 days left charges now", () => {
    expect(computeStripeTrialEnd({ ...base, placeholderTrialEnd: new Date(now + 1.5 * day).toISOString() })).toBeNull();
  });
  it("expired trial charges now", () => {
    expect(computeStripeTrialEnd({ ...base, placeholderTrialEnd: new Date(now - day).toISOString() })).toBeNull();
  });
  it("no placeholder row gives full 14 days", () => {
    expect(computeStripeTrialEnd(base)).toBe(Math.floor((now + 14 * day) / 1000));
  });
  it("real past Stripe subscription or explicit flag means no trial", () => {
    const p = new Date(now + 10 * day).toISOString();
    expect(computeStripeTrialEnd({ ...base, placeholderTrialEnd: p, stripeSubscriptionId: "sub_1" })).toBeNull();
    expect(computeStripeTrialEnd({ ...base, placeholderTrialEnd: p, hasUsedTrial: true })).toBeNull();
  });
  it("add-site and legacy plans never get a trial", () => {
    expect(computeStripeTrialEnd({ ...base, addSiteMode: true })).toBeNull();
    expect(computeStripeTrialEnd({ ...base, isHaccp: false })).toBeNull();
  });
});
