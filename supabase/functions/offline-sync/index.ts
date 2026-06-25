// offline-sync: single endpoint that ingests queued offline actions.
// Idempotent: client supplies `client_uuid`, which becomes the row id.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ActionType =
  | "temp_log"
  | "cleaning_log"
  | "day_sheet_update"
  | "incident_create"
  | "delivery_log";

interface Body {
  site_id: string | null;
  action_type: ActionType;
  client_uuid: string;
  payload: Record<string, unknown>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function bad(status: number, error: string) {
  return new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return bad(405, "method_not_allowed");

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return bad(401, "missing_auth");

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // user client (validates JWT)
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) return bad(401, "invalid_auth");
  const user = userRes.user;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return bad(400, "invalid_json");
  }

  const { site_id, action_type, client_uuid, payload } = body || ({} as Body);
  if (!action_type || !client_uuid || !payload) return bad(400, "missing_fields");
  if (!UUID_RE.test(client_uuid)) return bad(400, "invalid_client_uuid");

  // service client for writes (RLS would also accept user client; service avoids edge cases).
  const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Resolve the app user id (memberships.user_id references users.id, NOT auth.uid()).
  const { data: appUser } = await svc
    .from("users")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!appUser) return bad(403, "no_user");
  const appUserId = (appUser as { id: string }).id;

  // site_id is mandatory — never accept rows with no site scope.
  if (!site_id) return bad(400, "missing_site_id");
  if (!UUID_RE.test(site_id)) return bad(400, "invalid_site_id");
  const { data: m } = await svc
    .from("memberships")
    .select("site_id")
    .eq("user_id", appUserId)
    .eq("site_id", site_id)
    .eq("active", true)
    .maybeSingle();
  if (!m) return bad(403, "no_site_access");

  // Look up organisation_id for the site (most tables need it).
  let organisation_id: string | null = null;
  if (site_id) {
    const { data: s } = await svc.from("sites").select("organisation_id").eq("id", site_id).maybeSingle();
    organisation_id = (s as { organisation_id?: string } | null)?.organisation_id ?? null;
  }

  // Idempotency: if a row already exists with this id, return success.
  const tableFor: Record<ActionType, string> = {
    temp_log: "temp_logs",
    cleaning_log: "cleaning_logs",
    day_sheet_update: "day_sheets",
    incident_create: "incidents",
    delivery_log: "delivery_logs",
  };
  const table = tableFor[action_type];
  if (!table) return bad(400, "unknown_action_type");

  const { data: existing } = await svc.from(table).select("id").eq("id", client_uuid).maybeSingle();
  if (existing) {
    return new Response(JSON.stringify({ ok: true, id: client_uuid, deduped: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Build the row depending on action_type. Trust only known fields.
  let row: Record<string, unknown> = { id: client_uuid };
  const p = payload as Record<string, unknown>;

  switch (action_type) {
    case "temp_log":
      row = {
        ...row,
        site_id,
        organisation_id,
        unit_id: p.unit_id ?? null,
        value: p.value ?? null,
        pass: p.pass ?? null,
        log_type: p.log_type ?? "scheduled",
        corrective_action: p.corrective_action ?? null,
        food_item: p.food_item ?? null,
        logged_by_user_id: user.id,
        logged_by_name: p.logged_by_name ?? user.email ?? null,
        logged_at: p.logged_at ?? new Date().toISOString(),
      };
      break;
    case "cleaning_log":
      row = {
        ...row,
        site_id,
        organisation_id,
        task_id: p.task_id ?? null,
        log_date: p.log_date ?? new Date().toISOString().slice(0, 10),
        done: p.done ?? true,
        completed_by_user_id: user.id,
        completed_by_name: p.completed_by_name ?? user.email ?? null,
        completed_at: p.completed_at ?? new Date().toISOString(),
        note: p.note ?? null,
      };
      break;
    case "day_sheet_update":
      row = {
        ...row,
        site_id,
        organisation_id,
        sheet_date: p.sheet_date ?? new Date().toISOString().slice(0, 10),
        manager_note: p.manager_note ?? null,
        problem_notes: p.problem_notes ?? null,
        signed_off: p.signed_off ?? false,
        signed_off_by: p.signed_off_by ?? null,
        signed_off_at: p.signed_off_at ?? null,
      };
      break;
    case "incident_create":
      row = {
        ...row,
        site_id,
        organisation_id,
        type: p.type ?? "other",
        title: p.title ?? "Untitled incident",
        description: p.description ?? null,
        immediate_action: p.immediate_action ?? null,
        status: p.status ?? "open",
        module: p.module ?? null,
        reported_by_user_id: user.id,
        reported_by_name: p.reported_by_name ?? user.email ?? null,
        reported_at: p.reported_at ?? new Date().toISOString(),
      };
      break;
    case "delivery_log":
      row = {
        ...row,
        site_id,
        organisation_id,
        supplier_id: p.supplier_id ?? null,
        items: p.items ?? null,
        temp: p.temp ?? null,
        temp_pass: p.temp_pass ?? null,
        packaging: p.packaging ?? null,
        use_by_ok: p.use_by_ok ?? null,
        accepted: p.accepted ?? null,
        note: p.note ?? null,
        logged_by_user_id: user.id,
        logged_by_name: p.logged_by_name ?? user.email ?? null,
        logged_at: p.logged_at ?? new Date().toISOString(),
      };
      break;
  }

  // Upsert on id so a retry that races itself still returns success.
  const { error: insErr } = await svc.from(table).upsert(row, { onConflict: "id", ignoreDuplicates: true });
  if (insErr) {
    return new Response(JSON.stringify({ ok: false, error: "write_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, id: client_uuid }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
