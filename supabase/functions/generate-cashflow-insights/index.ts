// Cashflow AI Insights — Intelligence tier only.
// Generates a short plain-text narrative summarising top changes,
// biggest margin leak, biggest cost driver and suggested actions.
// Cached for 7 days in ai_insights.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { assertIntelligenceTier } from "../_shared/aiTierGuard.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const siteId: string | undefined = body?.site_id;
    const period: string = body?.period || "30d";
    const force: boolean = !!body?.force;
    if (!siteId) {
      return new Response(JSON.stringify({ error: "site_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svc = createClient(SUPABASE_URL, SERVICE_ROLE);

    // RLS — verify user can read the site
    const { data: siteOk } = await userClient.from("sites").select("id").eq("id", siteId).maybeSingle();
    if (!siteOk) {
      return new Response(JSON.stringify({ error: "No access to site" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tier + module gate
    const gate = await assertIntelligenceTier({ siteId, svc, corsHeaders });
    if (gate) return gate;

    // Cache (7d)
    if (!force) {
      const { data: cached } = await svc
        .from("ai_insights")
        .select("narrative, generated_at")
        .eq("site_id", siteId)
        .eq("insight_type", "cashflow_insights")
        .gt("valid_until", new Date().toISOString())
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cached) {
        return new Response(JSON.stringify({ narrative: (cached as any).narrative, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Pull lightweight aggregates for the prompt
    const days = period === "7d" ? 7 : period === "90d" ? 90 : period === "12m" ? 365 : 30;
    const since = new Date(); since.setDate(since.getDate() - days);
    const sinceIso = since.toISOString().slice(0, 10);

    const [salesRes, batchesRes, ohRes, adjRes] = await Promise.all([
      svc.from("sales_line_items").select("net_sales, quantity, channel, product_name_raw")
        .eq("site_id", siteId).eq("ignored", false).gte("sale_date", sinceIso),
      svc.from("batches").select("total_production_cost, unit_cost_snapshot, quantity_produced, product_name")
        .eq("site_id", siteId).gte("date_produced", sinceIso),
      svc.from("site_overheads_monthly").select("*").eq("site_id", siteId),
      svc.from("cashflow_adjustments").select("direction, amount, category").eq("site_id", siteId).gte("event_date", sinceIso),
    ]);

    const sales = (salesRes.data || []) as any[];
    const batches = (batchesRes.data || []) as any[];
    const overheads = (ohRes.data || []) as any[];
    const adjustments = (adjRes.data || []) as any[];

    const totalSales = sales.reduce((s, r) => s + Number(r.net_sales || 0), 0);
    const totalCogs = batches.reduce((s, b) => s + (Number(b.total_production_cost || (b.unit_cost_snapshot || 0) * (b.quantity_produced || 0)) || 0), 0);
    const ohTotal = overheads.reduce((s, o) => s + ["rent","utilities","insurance","software_subscriptions","equipment_lease","repairs_maintenance","marketing","other"].reduce((a, k) => a + Number(o[k] || 0), 0), 0);
    const adjIn = adjustments.filter((a) => a.direction === "in").reduce((s, a) => s + Number(a.amount || 0), 0);
    const adjOut = adjustments.filter((a) => a.direction === "out").reduce((s, a) => s + Number(a.amount || 0), 0);

    // Top products by revenue
    const byProduct: Record<string, number> = {};
    for (const s of sales) byProduct[s.product_name_raw || "Unknown"] = (byProduct[s.product_name_raw || "Unknown"] || 0) + Number(s.net_sales || 0);
    const topProducts = Object.entries(byProduct).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const prompt = `You are a friendly financial analyst for an independent bakery.
Write a CONCISE plain-text summary (no markdown, no bullets, just short paragraphs separated by blank lines) covering:
1) Top 3 changes this period
2) Biggest margin leak
3) Biggest cost driver
4) 2 suggested actions

Be specific. Reference numbers. Avoid generic advice. Period: last ${days} days.

DATA:
- Net sales: £${totalSales.toFixed(2)}
- Estimated COGS (from batches): £${totalCogs.toFixed(2)}
- Monthly overheads total (raw): £${ohTotal.toFixed(2)}
- Adjustments: in £${adjIn.toFixed(2)}, out £${adjOut.toFixed(2)}
- Top products: ${topProducts.map(([n, v]) => `${n} £${v.toFixed(0)}`).join(", ") || "no sales"}
`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, text);
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable. Please try again." }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const aiJson = await aiRes.json();
    const narrative: string = aiJson?.choices?.[0]?.message?.content || "No insights generated.";

    // Cache
    const validUntil = new Date(Date.now() + 7 * 86400000).toISOString();
    const { data: orgRow } = await svc.from("sites").select("organisation_id").eq("id", siteId).maybeSingle();
    await svc.from("ai_insights").insert({
      site_id: siteId,
      organisation_id: (orgRow as any)?.organisation_id,
      insight_type: "cashflow_insights",
      content: { period, totals: { sales: totalSales, cogs: totalCogs, overheads: ohTotal } },
      narrative,
      generated_at: new Date().toISOString(),
      valid_until: validUntil,
      model_used: "google/gemini-2.5-flash",
    });

    return new Response(JSON.stringify({ narrative, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-cashflow-insights error:", e);
    return new Response(JSON.stringify({ error: "An unexpected error occurred. Please try again." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
