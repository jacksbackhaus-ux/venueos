// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

export type Caller = { authUserId: string; email: string | null; user: any; isOrgOwner: boolean };

/** Verify JWT, load the email-login caller, block impersonation and Staff ID sessions. */
export async function loadCaller(req: Request) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const svc = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return { error: json({ error: "Unauthorised" }, 401) };
  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: claims, error } = await userClient.auth.getClaims(auth.slice(7));
  if (error || !claims?.claims?.sub) return { error: json({ error: "Unauthorised" }, 401) };
  const authUserId = claims.claims.sub as string;

  const { data: imp } = await userClient.rpc("active_impersonation_org");
  if (imp) return { error: json({ error: "Not available during support access." }, 403) };

  const { data: user } = await svc
    .from("users")
    .select("id, organisation_id, display_name, email, auth_type, status, anonymised_at")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (!user || user.auth_type !== "email" || user.status !== "active") {
    return { error: json({ error: "Sign in with your email account to do this. Staff ID users should ask their manager." }, 403) };
  }
  const { data: owner } = await svc
    .from("org_users").select("id").eq("user_id", user.id).eq("organisation_id", user.organisation_id)
    .eq("org_role", "org_owner").eq("active", true).maybeSingle();
  return { svc, url, anon, caller: { authUserId, email: user.email, user, isOrgOwner: !!owner } as Caller };
}

/** Org owners manage anyone in their org; site owners manage people on a site they own. */
export async function canManage(svc: any, caller: Caller, target: any): Promise<boolean> {
  if (target.organisation_id !== caller.user.organisation_id) return false;
  if (caller.isOrgOwner) return true;
  const { data: mine } = await svc.from("memberships").select("site_id")
    .eq("user_id", caller.user.id).eq("site_role", "owner").eq("active", true);
  const siteIds = (mine ?? []).map((m: any) => m.site_id);
  if (!siteIds.length) return false;
  const { data: theirs } = await svc.from("memberships").select("id")
    .eq("user_id", target.id).in("site_id", siteIds).limit(1);
  return (theirs ?? []).length > 0;
}
