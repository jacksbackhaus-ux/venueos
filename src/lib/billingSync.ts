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
