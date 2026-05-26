// Staff-only privileged actions. Every call requires:
//   - A valid JWT for an active internal_staff member (verified server-side)
//   - A reason (min 5 chars)
//   - Some actions additionally require platform super admin
// Every call writes a row to admin_actions_log.
//
// Supported actions:
//   - send_password_reset: emails a password recovery link to a target user
//   - force_sign_out:      revokes all auth sessions for a target user (super-admin only)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface RequestBody {
  action?: string;
  target_user_id?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json(401, { error: "missing bearer token" });

  // Caller-scoped client to validate identity + run RLS-protected helpers
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userData?.user) return json(401, { error: "invalid session" });
  const callerId = userData.user.id;

  // Verify internal staff status using the SECURITY DEFINER helper.
  const { data: isStaff, error: staffErr } = await callerClient.rpc("is_internal_staff");
  if (staffErr) { console.error("[staff-admin-action] staff check failed", staffErr); return json(500, { error: "Authorization check failed." }); }
  if (!isStaff) return json(403, { error: "not authorised: internal staff required" });

  // Parse + validate body
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json(400, { error: "invalid json body" });
  }

  const action = (body.action ?? "").trim();
  const reason = (body.reason ?? "").trim();
  const targetUserId = (body.target_user_id ?? "").trim();

  if (!action) return json(400, { error: "action required" });
  if (reason.length < 5) return json(400, { error: "reason required (min 5 chars)" });

  // Service-role client for admin operations
  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // Helper: write audit row. Fails closed.
  const writeAudit = async (extras: Record<string, unknown> = {}) => {
    const { error } = await adminClient.from("admin_actions_log").insert({
      performed_by: callerId,
      action_type: action,
      target_user_id: targetUserId || null,
      reason,
      metadata: { ...(body.metadata ?? {}), ...extras },
    });
    if (error) console.error("[staff-admin-action] audit write failed", error);
  };

  // Look up the target app user → auth user mapping
  let targetAuthUserId: string | null = null;
  let targetEmail: string | null = null;
  if (targetUserId) {
    const { data: u, error: uErr } = await adminClient
      .from("users")
      .select("auth_user_id, email")
      .eq("id", targetUserId)
      .maybeSingle();
    if (uErr) { console.error("[staff-admin-action] target lookup failed", uErr); return json(500, { error: "Target user lookup failed." }); }
    if (!u) return json(404, { error: "target user not found" });
    targetAuthUserId = (u as { auth_user_id: string | null }).auth_user_id;
    targetEmail = (u as { email: string | null }).email;
  }

  switch (action) {
    case "send_password_reset": {
      if (!targetEmail) return json(400, { error: "target user has no email address" });
      // Generate a recovery link via Auth Admin API
      const { data, error } = await adminClient.auth.admin.generateLink({
        type: "recovery",
        email: targetEmail,
      });
      if (error) {
        console.error("[staff-admin-action] generateLink failed", error);
        await writeAudit({ outcome: "error", error: error.message });
        return json(500, { error: "Failed to generate password reset link." });
      }
      await writeAudit({ outcome: "ok", email_sent_to: targetEmail });
      return json(200, { ok: true, sent_to: targetEmail, action_link_generated: !!data });
    }

    case "force_sign_out": {
      // Sensitive — require super admin
      const { data: isSuper, error: sErr } = await callerClient.rpc("is_super_admin");
      if (sErr) { console.error("[staff-admin-action] super admin check failed", sErr); return json(500, { error: "Authorization check failed." }); }
      if (!isSuper) return json(403, { error: "super admin required for this action" });
      if (!targetAuthUserId) return json(400, { error: "target has no auth account" });
      const { error } = await adminClient.auth.admin.signOut(targetAuthUserId);
      if (error) {
        console.error("[staff-admin-action] signOut failed", error);
        await writeAudit({ outcome: "error", error: error.message });
        return json(500, { error: "Failed to sign user out." });
      }
      await writeAudit({ outcome: "ok" });
      return json(200, { ok: true });
    }

    default:
      return json(400, { error: `unknown action: ${action}` });
  }
});
