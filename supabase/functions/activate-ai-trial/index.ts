import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );

    const { data: { user }, error: authErr } = await authClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve org + verify the caller is org_owner
    const { data: appUser, error: auErr } = await admin
      .from("users")
      .select("organisation_id")
      .eq("id", user.id)
      .maybeSingle();
    if (auErr || !appUser?.organisation_id) {
      return new Response(JSON.stringify({ error: "No organisation" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleRow } = await admin
      .from("organisation_roles")
      .select("org_role")
      .eq("user_id", user.id)
      .eq("organisation_id", appUser.organisation_id)
      .maybeSingle();
    if (roleRow?.org_role !== "org_owner") {
      return new Response(JSON.stringify({ error: "Only the organisation owner can do this" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sub, error: subErr } = await admin
      .from("subscriptions")
      .select("id, status, is_comped, comped_until, trial_end, ai_active")
      .eq("organisation_id", appUser.organisation_id)
      .maybeSingle();
    if (subErr || !sub) {
      return new Response(JSON.stringify({ error: "No subscription found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = Date.now();
    const compedActive = !!sub.is_comped && (!sub.comped_until || new Date(sub.comped_until).getTime() > now);
    const trialActive = sub.status === "trialing" && sub.trial_end && new Date(sub.trial_end).getTime() > now;

    if (!compedActive && !trialActive) {
      return new Response(JSON.stringify({ error: "AI Insights requires checkout for paid plans" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updErr } = await admin
      .from("subscriptions")
      .update({ ai_active: true })
      .eq("id", sub.id);
    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
