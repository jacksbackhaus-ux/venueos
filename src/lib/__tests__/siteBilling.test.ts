import { describe, it, expect } from "vitest";
import { billableSiteCount, decideAddSiteOutcome } from "../../../supabase/functions/_shared/siteQuantity.ts";

describe("billableSiteCount", () => {
  it("counts every active site when there is no transfer", () => {
    expect(billableSiteCount(["a", "b"], null)).toBe(2);
  });
  it("does not bill the old site during a move", () => {
    expect(billableSiteCount(["old", "new"], { from_site_id: "old", to_site_id: "new" })).toBe(1);
  });
  it("keeps billing a closing site (close window, no new site)", () => {
    expect(billableSiteCount(["a", "b"], { from_site_id: "a", to_site_id: null })).toBe(2);
  });
  it("handles a move where the old site is already archived", () => {
    expect(billableSiteCount(["new"], { from_site_id: "old", to_site_id: "new" })).toBe(1);
  });
});

describe("decideAddSiteOutcome", () => {
  const base = { pendingUpdate: null, siteItemQuantity: 2, expectedQuantity: 2, invoiceStatus: "paid", invoiceAmountDue: 0 };
  it("paid invoice, change applied → paid", () => {
    expect(decideAddSiteOutcome(base)).toBe("paid");
  });
  it("pending update (card declined) → payment_failed", () => {
    expect(decideAddSiteOutcome({ ...base, pendingUpdate: { expires_at: 1 }, siteItemQuantity: 1, invoiceStatus: "open", invoiceAmountDue: 250 })).toBe("payment_failed");
  });
  it("open invoice with money still due → needs_review, never paid", () => {
    expect(decideAddSiteOutcome({ ...base, invoiceStatus: "open", invoiceAmountDue: 250 })).toBe("needs_review");
  });
  it("quantity not applied → needs_review", () => {
    expect(decideAddSiteOutcome({ ...base, siteItemQuantity: 1 })).toBe("needs_review");
  });
  it("zero-amount invoice (e.g. during trial) → paid", () => {
    expect(decideAddSiteOutcome({ ...base, invoiceStatus: "draft", invoiceAmountDue: 0 })).toBe("paid");
  });
  it("no invoice at all → needs_review", () => {
    expect(decideAddSiteOutcome({ ...base, invoiceStatus: null, invoiceAmountDue: null })).toBe("needs_review");
  });
});
