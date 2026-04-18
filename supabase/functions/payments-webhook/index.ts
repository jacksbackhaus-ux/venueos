import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyWebhook, type StripeEnv } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const env = (new URL(req.url).searchParams.get("env") || "sandbox") as StripeEnv;

  try {
    const event = await verifyWebhook(req, env);
    console.log("event:", event.type, "env:", env);

    // Log all events
    await supabase.from("billing_events").insert({
      event_type: event.type,
      stripe_event_id: event.id,
      payload: event as any,
      organisation_id: event.data.object?.metadata?.organisation_id || null,
    }).then(() => {}, (e) => console.error("event log fail", e));

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await upsertSubscription(event.data.object, env);
        break;
      case "customer.subscription.deleted":
        await markCanceled(event.data.object, env);
        break;
      case "checkout.session.completed":
        // Subscription metadata + customer come through subscription events
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});

async function upsertSubscription(sub: any, env: StripeEnv) {
  const orgId = sub.metadata?.organisation_id;
  if (!orgId) {
    console.error("no organisation_id in subscription metadata");
    return;
  }
  // Tally quantities from items
  let siteQty = 1;
  let hqQty = 0;
  let interval = "month";
  for (const item of sub.items?.data || []) {
    const lookup = item.price?.lookup_key || "";
    interval = item.price?.recurring?.interval || interval;
    if (lookup.startsWith("site_")) siteQty = 1 + Number(item.quantity || 0);
    if (lookup.startsWith("hq_")) hqQty = Number(item.quantity || 0);
  }

  const periodStart = sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null;
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;

  await supabase.from("subscriptions").upsert({
    organisation_id: orgId,
    stripe_subscription_id: sub.id,
    stripe_customer_id: sub.customer,
    status: sub.status,
    billing_interval: interval,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    cancel_at_period_end: sub.cancel_at_period_end || false,
    site_quantity: siteQty,
    hq_quantity: hqQty,
    environment: env,
    updated_at: new Date().toISOString(),
  }, { onConflict: "organisation_id" });
}

async function markCanceled(sub: any, env: StripeEnv) {
  await supabase.from("subscriptions").update({
    status: "canceled", updated_at: new Date().toISOString(),
  }).eq("stripe_subscription_id", sub.id).eq("environment", env);
}
