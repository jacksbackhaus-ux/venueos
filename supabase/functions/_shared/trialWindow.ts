// Pure trial-window logic for HACCP checkout (no Deno/Stripe imports, unit-tested).
//
// Every new organisation gets an automatic 14-day in-app trial row at creation
// (handle_new_organisation trigger sets trial_end). That placeholder must NOT
// count as "trial already used" — only a real past Stripe subscription or the
// explicit has_used_trial flag does. The Stripe trial is anchored to the
// original in-app trial_end (never extended), and Stripe requires a trial to
// end at least 48h in the future, so under 2 days left means charge as normal.

export const TRIAL_DAYS = 14;
export const STRIPE_MIN_TRIAL_MS = 48 * 60 * 60 * 1000;
const SAFETY_MS = 60 * 60 * 1000; // 1h buffer so Stripe never rejects as "< 48h"

export interface TrialInput {
  isHaccp: boolean;
  addSiteMode: boolean;
  hasUsedTrial?: boolean | null;
  stripeSubscriptionId?: string | null;
  placeholderTrialEnd?: string | null; // subscriptions.trial_end from the signup trigger
  nowMs: number;
}

/** Returns the Stripe trial_end (unix seconds) to apply, or null to charge now. */
export function computeStripeTrialEnd(i: TrialInput): number | null {
  if (!i.isHaccp || i.addSiteMode) return null;
  if (i.hasUsedTrial || i.stripeSubscriptionId) return null;
  const maxEnd = i.nowMs + TRIAL_DAYS * 86400000;
  let endMs = maxEnd;
  if (i.placeholderTrialEnd) {
    const t = new Date(i.placeholderTrialEnd).getTime();
    if (!Number.isFinite(t)) return null;
    endMs = Math.min(t, maxEnd); // never extend past the original 14 days
  }
  if (endMs - i.nowMs < STRIPE_MIN_TRIAL_MS + SAFETY_MS) return null;
  return Math.floor(endMs / 1000);
}
