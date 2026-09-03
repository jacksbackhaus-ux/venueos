import { createStripeClient, type StripeEnv } from "../_shared/stripe.ts";

const KEYS = [
  "miseos_haccp_site_monthly","miseos_haccp_site_annual",
  "miseos_haccp_user_monthly","miseos_haccp_user_annual",
];

Deno.serve(async () => {
  const out: Record<string, unknown> = {};
  for (const env of ["sandbox","live"] as StripeEnv[]) {
    try {
      const stripe = createStripeClient(env);
      const list = await stripe.prices.list({ lookup_keys: KEYS, active: true, limit: 20 });
      out[env] = list.data.map((p) => ({
        lookup_key: p.lookup_key, amount: p.unit_amount, currency: p.currency,
        interval: p.recurring?.interval, usage: p.recurring?.usage_type, product: p.product,
      }));
    } catch (e) { out[env] = { error: (e as Error).message }; }
  }
  return new Response(JSON.stringify(out, null, 2), { headers: { "Content-Type": "application/json" } });
});
