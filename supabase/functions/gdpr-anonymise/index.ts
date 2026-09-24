// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { cors, json, loadCaller, canManage } from "../_shared/gdprAuthz.ts";

/**
 * gdpr-anonymise — POST { target_user_id?: uuid, password?: string }
 * Self-service (no target): non-owners only, password required.
 * Manager: org owner / site owner anonymising a deactivated, non-owner person in their org.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const r = await loadCaller(req);
    if ("error" in r) return r.error;
    const { svc, caller, url, anon } = r;
    const body = await req.json().catch(() => ({}));
    const targetId: string = body?.target_user_id ?? caller.user.id;
    const self = targetId === caller.user.id;

    const { data: target } = await svc.from("users")
      .select("id, organisation_id, auth_user_id, status, anonymised_at").eq("id", targetId).maybeSingle();
    if (!target) return json({ error: "Person not found" }, 404);
    if (target.anonymised_at) return json({ error: "Already anonymised" }, 409);

    // Never anonymise a business owner — checked on the server for both paths.
    const { data: ownerRow } = await svc.from("org_users").select("id")
      .eq("user_id", target.id).eq("org_role", "org_owner").limit(1);
    if ((ownerRow ?? []).length) {
      return json({
        error: self
          ? "Business owners can't delete their own account here. Cancel your subscription and contact support."
          : "Business owners can't be anonymised.",
      }, 403);
    }

    if (self) {
      if (!body?.password || !caller.email) return json({ error: "Enter your password to confirm." }, 400);
      const check = createClient(url, anon, { auth: { persistSession: false } });
      const { error: pwErr } = await check.auth.signInWithPassword({ email: caller.email, password: body.password });
      if (pwErr) return json({ error: "Password incorrect." }, 403);
      await check.auth.signOut().catch(() => undefined);
    } else {
      if (!(await canManage(svc, caller, target))) return json({ error: "You can only anonymise people you manage." }, 403);
      if (target.status === "active") return json({ error: "Deactivate this person first." }, 409);
    }

    // Decide about the sign-in account before changing anything.
    let deleteAuth = false;
    let contactSupport = false;
    if (target.auth_user_id) {
      const { count } = await svc.from("users").select("id", { count: "exact", head: true })
        .eq("auth_user_id", target.auth_user_id);
      if ((count ?? 0) > 1) contactSupport = true; else deleteAuth = true;
    }

    const { error: rpcErr } = await svc.rpc("gdpr_anonymise_user", { _target: target.id, _actor: caller.user.id, _self: self });
    if (rpcErr) return json({ error: rpcErr.message }, 400);

    // Same seat sync a normal deactivation runs.
    try {
      await fetch(`${url}/functions/v1/sync-haccp-user-quantity`, {
        method: "POST",
        headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ organisation_id: target.organisation_id }),
      });
    } catch (e) { console.warn("[gdpr-anonymise] seat sync failed", e); }

    let authDeleted = false;
    if (deleteAuth && target.auth_user_id) {
      const { error } = await svc.auth.admin.deleteUser(target.auth_user_id);
      if (error) console.warn("[gdpr-anonymise] auth delete failed", error.message); else authDeleted = true;
    }

    return json({ ok: true, auth_deleted: authDeleted, contact_support: contactSupport });
  } catch (e) {
    console.error("[gdpr-anonymise]", e);
    return json({ error: "Anonymise failed" }, 500);
  }
});
