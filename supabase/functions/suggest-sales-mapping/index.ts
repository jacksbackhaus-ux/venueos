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
    const { import_id, headers, sample_rows } = await req.json();
    if (!import_id || !Array.isArray(headers)) {
      return new Response(JSON.stringify({ error: "import_id and headers required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const { data: imp } = await svc.from("sales_imports").select("site_id, organisation_id").eq("id", import_id).maybeSingle();
    if (!imp) return new Response(JSON.stringify({ error: "Import not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const access = await assertSiteAccess({ authUserId: u.user.id, siteId: (imp as any).site_id, svc, corsHeaders });
    if (access) return access;
    const tier = await assertIntelligenceTier({ siteId: (imp as any).site_id, svc, corsHeaders });
    if (tier) return tier;

    const LOVABLE = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE) return new Response(JSON.stringify({ error: "AI not configured" }), {
      status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const prompt = `You are mapping CSV/spreadsheet columns from a hospitality POS export to a sales schema.
Available headers: ${JSON.stringify(headers)}
First sample rows: ${JSON.stringify((sample_rows || []).slice(0, 5))}

Return STRICT JSON only, no markdown, with this shape:
{
  "sale_date": "<header name or null>",
  "sale_timestamp": "<header name or null>",
  "product_name": "<header name>",
  "sku": "<header name or null>",
  "quantity": "<header name>",
  "gross_sales": "<header name or null>",
  "discounts": "<header name or null>",
  "net_sales": "<header name>",
  "channel": "<header name or null>"
}
Use null when no good match. Header values must EXACTLY match one of: ${JSON.stringify(headers)}.`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Return strict JSON. No prose. No markdown." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      return new Response(JSON.stringify({ error: "AI error", detail: t }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const j = await r.json();
    const raw = j?.choices?.[0]?.message?.content ?? "{}";
    let mapping: any = {};
    try { mapping = JSON.parse(raw); } catch { mapping = {}; }

    return new Response(JSON.stringify({ mapping }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
