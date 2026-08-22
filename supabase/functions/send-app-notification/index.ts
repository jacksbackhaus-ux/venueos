// send-app-notification
// Client-callable wrapper around the internal send-transactional-email function.
// The client may only pick from a small allow-list of notification kinds; the
// recipient address and all sensitive template data are derived server-side from
// the caller's own tenant, so a signed-in user can never send mail to arbitrary
// addresses or inject arbitrary template content.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const APP_URL = "https://mise-os.app";

type Kind =
  | "welcome-trial-start"
  | "staff-invited"
  | "staff-deactivated"
  | "inspection-pack-ready";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function firstName(name: unknown): string | null {
  const n = (typeof name === "string" ? name : "").trim();
  return n ? n.split(/\s+/)[0] : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json(401, { error: "missing_auth" });

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) return json(401, { error: "invalid_auth" });
  const authUser = userRes.user;

  let body: { kind?: Kind; target_user_id?: string; site_id?: string; period_label?: string | null };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }
  const kind = body.kind;
  if (!kind) return json(400, { error: "missing_kind" });

  const svc = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Resolve the caller's app user record.
  const { data: appUserRow } = await svc
    .from("users")
    .select("id, display_name, email, status, organisation_id")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();
  const appUser = appUserRow as
    | {
        id: string;
        display_name: string | null;
        email: string | null;
        status: string;
        organisation_id: string | null;
      }
    | null;
  if (!appUser || appUser.status !== "active") return json(403, { error: "no_user" });

  // Caller's organisations (own org + any org_users rows) — used to scope every recipient.
  const { data: orgRows } = await svc
    .from("org_users")
    .select("organisation_id, org_role")
    .eq("user_id", appUser.id)
    .eq("active", true);
  const { data: memberRows } = await svc
    .from("memberships")
    .select("site_id, site_role")
    .eq("user_id", appUser.id)
    .eq("active", true);
  const orgIds = new Set<string>(
    [
      appUser.organisation_id,
      ...(((orgRows as { organisation_id: string }[] | null) ?? []).map((r) => r.organisation_id)),
    ].filter((x): x is string => !!x),
  );
  const isOwner = (((orgRows as { org_role: string }[] | null) ?? [])).some(
    (r) => r.org_role === "org_owner",
  );

  let templateName: string;
  let recipientEmail: string;
  let idempotencyKey: string;
  let templateData: Record<string, unknown>;

  if (kind === "welcome-trial-start" || kind === "inspection-pack-ready") {
    // Self-addressed only.
    const email = appUser.email ?? authUser.email ?? null;
    if (!email) return json(400, { error: "no_recipient" });
    recipientEmail = email;

    if (kind === "welcome-trial-start") {
      const orgId = [...orgIds][0];
      if (!orgId) return json(403, { error: "no_org" });
      const { data: org } = await svc
        .from("organisations")
        .select("name")
        .eq("id", orgId)
        .maybeSingle();
      templateName = "welcome-trial-start";
      idempotencyKey = `welcome:${orgId}`;
      templateData = {
        first_name: firstName(appUser.display_name),
        organisation_name: (org as { name?: string } | null)?.name ?? null,
        app_url: APP_URL,
      };
    } else {
      const siteId = body.site_id;
      if (!siteId || !UUID_RE.test(siteId)) return json(400, { error: "invalid_site_id" });
      const { data: siteRow } = await svc
        .from("sites")
        .select("id, name, organisation_id")
        .eq("id", siteId)
        .maybeSingle();
      const site = siteRow as { id: string; name: string; organisation_id: string } | null;
      if (!site || !orgIds.has(site.organisation_id)) return json(403, { error: "no_site_access" });
      const period = typeof body.period_label === "string" ? body.period_label.slice(0, 120) : null;
      templateName = "inspection-pack-ready";
      idempotencyKey = `inspection-pack:${site.id}:${Date.now()}`;
      templateData = {
        first_name: firstName(appUser.display_name),
        site_name: site.name,
        period_label: period,
        download_url: `${APP_URL}/reports`,
      };
    }
  } else {
    // Staff notifications: recipient must be a user inside the caller's org.
    const targetId = body.target_user_id;
    if (!targetId || !UUID_RE.test(targetId)) return json(400, { error: "invalid_target_user_id" });

    // Caller must be able to manage staff: org owner, or owner/supervisor on a site.
    const canManage =
      isOwner ||
      (((memberRows as { site_role: string | null }[] | null) ?? [])).some(
        (r) => r.site_role === "owner" || r.site_role === "supervisor",
      );
    if (!canManage) return json(403, { error: "not_permitted" });

    const { data: targetRow } = await svc
      .from("users")
      .select("id, display_name, email, organisation_id")
      .eq("id", targetId)
      .maybeSingle();
    const target = targetRow as
      | { id: string; display_name: string | null; email: string | null; organisation_id: string | null }
      | null;
    if (!target?.email) return json(400, { error: "no_recipient" });

    // Verify the target belongs to one of the caller's organisations.
    const { data: tOrgs } = await svc
      .from("org_users")
      .select("organisation_id")
      .eq("user_id", targetId);
    const targetOrgIds = [
      target.organisation_id,
      ...(((tOrgs as { organisation_id: string }[] | null) ?? []).map((r) => r.organisation_id)),
    ].filter((x): x is string => !!x);
    if (!targetOrgIds.some((id) => orgIds.has(id))) return json(403, { error: "not_same_org" });

    recipientEmail = target.email;
    if (kind === "staff-invited") {
      templateName = "staff-invited";
      idempotencyKey = `staff-invite:${target.id}`;
      templateData = {
        first_name: firstName(target.display_name),
        organisation_name: null,
        inviter_name: firstName(appUser.display_name),
        accept_url: `${APP_URL}/auth`,
      };
    } else if (kind === "staff-deactivated") {
      templateName = "staff-deactivated";
      idempotencyKey = `staff-deactivated:${target.id}:${new Date().toISOString().slice(0, 10)}`;
      templateData = { first_name: firstName(target.display_name), organisation_name: null };
    } else {
      return json(400, { error: "unknown_kind" });
    }
  }

  const { error } = await svc.functions.invoke("send-transactional-email", {
    body: { templateName, recipientEmail, idempotencyKey, templateData },
  });
  if (error) {
    console.error("[send-app-notification] send failed", { templateName, error: error.message });
    return json(500, { error: "send_failed" });
  }
  return json(200, { ok: true });
});
