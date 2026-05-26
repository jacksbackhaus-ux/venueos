// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { assertSiteAccess } from "../_shared/siteAuthz.ts";
import { assertIntelligenceTier } from "../_shared/aiTierGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { site_id, period_days = 30 } = await req.json();
    if (!site_id) return new Response(JSON.stringify({ error: "site_id required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const access = await assertSiteAccess({ authUserId: u.user.id, siteId: site_id, svc, corsHeaders });
    if (access) return access;
    const tier = await assertIntelligenceTier({ siteId: site_id, svc, corsHeaders });
    if (tier) return tier;

    // Cache (7 days)
    const { data: cached } = await svc.from("ai_insights")
      .select("id, narrative, content, generated_at")
      .eq("site_id", site_id).eq("insight_type", "sales_insights")
      .gt("valid_until", new Date().toISOString())
      .order("generated_at", { ascending: false }).limit(1).maybeSingle();
    if (cached) return new Response(JSON.stringify({ cached: true, ...cached }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const since = new Date(Date.now() - period_days * 86400000).toISOString().slice(0, 10);
    const { data: rows } = await svc.from("sales_line_items")
      .select("product_name_raw, quantity, net_sales, sale_date, linked_product_id")
      .eq("site_id", site_id).gte("sale_date", since).limit(5000);

    const byProduct = new Map<string, { qty: number; net: number }>();
    for (const r of (rows || []) as any[]) {
      const k = r.product_name_raw || "(unknown)";
      const cur = byProduct.get(k) || { qty: 0, net: 0 };
      cur.qty += Number(r.quantity) || 0;
      cur.net += Number(r.net_sales) || 0;
      byProduct.set(k, cur);
    }
    const top = [...byProduct.entries()].sort((a, b) => b[1].net - a[1].net).slice(0, 10);

    const LOVABLE = Deno.env.get("LOVABLE_API_KEY");
    const summaryInput = { period_days, totals: { products: byProduct.size, rows: rows?.length ?? 0 }, top };
    const prompt = `You are a hospitality margin coach. From this ${period_days}-day sales summary, return 3 short, plain-text action lines. No markdown, no headers, no bullets, no bold. Each line under 140 chars.
${JSON.stringify(summaryInput)}`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Plain text, 3 short action lines, no markdown." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!r.ok) return new Response(JSON.stringify({ error: "AI error" }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    const j = await r.json();
    const narrative = (j?.choices?.[0]?.message?.content ?? "").trim();

    const { data: ins } = await svc.from("ai_insights").insert({
      site_id, organisation_id: (await svc.from("sites").select("organisation_id").eq("id", site_id).maybeSingle()).data?.organisation_id,
      insight_type: "sales_insights",
      narrative,
      content: { top, period_days, totals: summaryInput.totals },
      generated_at: new Date().toISOString(),
      valid_until: new Date(Date.now() + 7 * 86400000).toISOString(),
      model_used: "google/gemini-2.5-flash",
    }).select("id, narrative, content, generated_at").single();

    return new Response(JSON.stringify({ cached: false, ...(ins || { narrative }) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-sales-insights error:", e);
    return new Response(JSON.stringify({ error: "An unexpected error occurred. Please try again." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
