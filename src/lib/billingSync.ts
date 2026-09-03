import { supabase } from "@/integrations/supabase/client";

/**
 * Fire-and-forget sync of the per-user add-on quantity on the org's MiseOS HACCP
 * Stripe subscription. Safe to call any time — the edge function is idempotent
 * and no-ops for legacy plans or when the count is already correct.
 *
 * Call after adding, suspending, reactivating, or removing a staff member.
 */
export async function syncHaccpUserQuantity(): Promise<void> {
  try {
    await supabase.functions.invoke("sync-haccp-user-quantity", { body: {} });
  } catch (e) {
    // Non-fatal: billing reconciles on the next webhook anyway.
    console.warn("[billing] HACCP user-quantity sync failed", e);
  }
}

/**
 * Fire-and-forget sync of the site-quantity line item on the org's MiseOS HACCP
 * Stripe subscription. Safe to call any time — the edge function is idempotent
 * and no-ops for legacy plans or when the count is already correct.
 *
 * Call after a site is archived or reopened.
 */
export async function syncHaccpSiteQuantity(): Promise<void> {
  try {
    await supabase.functions.invoke("sync-haccp-site-quantity", { body: {} });
  } catch (e) {
    // Non-fatal: billing reconciles on the next webhook anyway.
    console.warn("[billing] HACCP site-quantity sync failed", e);
  }
}
