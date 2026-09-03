import { describe, it, expect } from "vitest";
import { decideSiteQuantity, MIN_SITE_QUANTITY } from "../../../supabase/functions/_shared/siteQuantity.ts";

describe("decideSiteQuantity", () => {
  it("is unchanged when Stripe's quantity already matches active sites", () => {
    expect(decideSiteQuantity(3, 3)).toEqual({ targetQuantity: 3, changed: false });
  });

  it("flags a change when Stripe is under-billing", () => {
    expect(decideSiteQuantity(3, 2)).toEqual({ targetQuantity: 3, changed: true });
  });

  it("flags a change when Stripe is over-billing (e.g. a site was archived)", () => {
    expect(decideSiteQuantity(1, 2)).toEqual({ targetQuantity: 1, changed: true });
  });

  it("never lets the target drop below the minimum, even with zero active sites", () => {
    expect(decideSiteQuantity(0, 2)).toEqual({ targetQuantity: MIN_SITE_QUANTITY, changed: true });
  });

  it("treats a missing Stripe line item (null) as needing a change", () => {
    expect(decideSiteQuantity(2, null)).toEqual({ targetQuantity: 2, changed: true });
  });
});
