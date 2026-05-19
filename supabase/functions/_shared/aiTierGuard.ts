// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Ensures the org owning `site_id` has an active Intelligence tier
 * subscription (or active trial / comped access). Returns a 403 Response
 * on failure, or null on success. Call AFTER assertSiteAccess.
 */
export async function assertIntelligenceTier(opts: {
  siteId: string;
  svc: ReturnType<typeof createClient>;
  corsHeaders: Record<string, string>;
}): Promise<Response | null> {
  const { siteId, svc, corsHeaders } = opts;

  const { data: site } = await svc
    .from("sites")
    .select("organisation_id")
    .eq("id", siteId)
    .maybeSingle();

  const orgId = (site as any)?.organisation_id;
  if (!orgId) {
    return new Response(JSON.stringify({ error: "Site not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: sub } = await svc
    .from("subscriptions")
    .select("status, tier, is_comped, comped_until, trial_end, current_period_end")
    .eq("organisation_id", orgId)
    .maybeSingle();

  const now = Date.now();
  const s: any = sub || {};
  const compedActive = !!s.is_comped && (!s.comped_until || new Date(s.comped_until).getTime() > now);
  const trialActive = s.status === "trialing" && s.trial_end && new Date(s.trial_end).getTime() > now;
  const paidActive = ["active", "past_due"].includes(s.status) &&
    (!s.current_period_end || new Date(s.current_period_end).getTime() > now);
  const hasAccess = compedActive || trialActive || paidActive;

  // Intelligence required. Trial users get full access while trialing.
  const isIntelligence = s.tier === "intelligence" || (trialActive && (!s.tier || true));

  if (!hasAccess || !isIntelligence) {
    return new Response(
      JSON.stringify({ error: "This feature is available on the Intelligence plan." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Also confirm module_activation has ai_insights for this site
  const { data: mod } = await svc
    .from("module_activation")
    .select("is_active")
    .eq("site_id", siteId)
    .eq("module_name", "ai_insights")
    .maybeSingle();

  if (!(mod as any)?.is_active) {
    return new Response(
      JSON.stringify({ error: "AI Insights is not enabled for this site." }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return null;
}
