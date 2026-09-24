// deno-lint-ignore-file no-explicit-any
import { cors, json, loadCaller, canManage } from "../_shared/gdprAuthz.ts";

/**
 * gdpr-export — POST { target_user_id?: uuid }
 * Returns one JSON document of a person's personal data. Never stored.
 * Read-only apart from a single audit_trail row.
 */

// [table, column] pairs matched against the person's users.id.
const LINKS: [string, string, string][] = [
  // section, table, column
  ["roles_and_sites", "memberships", "user_id"],
  ["roles_and_sites", "org_users", "user_id"],
  ["rota", "rota_assignments", "user_id"],
  ["rota", "shift_staff", "user_id"],
  ["rota", "shift_requests", "requester_id"],
  ["rota", "shift_compensation_logs", "user_id"],
  ["availability", "staff_availability", "user_id"],
  ["holidays", "holiday_requests", "user_id"],
  ["training", "training_records", "user_id"],
  ["training", "training_individual_assignments", "user_id"],
  ["fitness_to_work", "fitness_to_work", "user_id"],
  ["records_logged", "temp_logs", "logged_by_user_id"],
  ["records_logged", "cleaning_logs", "completed_by_user_id"],
  ["records_logged", "day_sheets", "locked_by_user_id"],
  ["records_logged", "day_sheet_entries", "completed_by_user_id"],
  ["records_logged", "delivery_logs", "logged_by_user_id"],
  ["records_logged", "incidents", "reported_by_user_id"],
  ["records_logged", "pest_logs", "reported_by_user_id"],
  ["records_logged", "maintenance_logs", "reported_by_user_id"],
  ["records_logged", "waste_logs", "logged_by"],
  ["records_logged", "batches", "created_by_user_id"],
  ["records_logged", "batch_actions", "performed_by_user_id"],
  ["records_logged", "batch_stage_events", "performed_by_user_id"],
  ["records_logged", "shift_task_completions", "completed_by_user_id"],
  ["records_logged", "ppm_completions", "completed_by"],
  ["records_logged", "production_days", "started_by"],
  ["records_logged", "site_events", "logged_by"],
  ["records_logged", "feedback_entries", "logged_by"],
  ["messages_sent", "messenger_messages", "sender_id"],
  ["audit_entries", "audit_trail", "actor_user_id"],
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const r = await loadCaller(req);
    if ("error" in r) return r.error;
    const { svc, caller } = r;
    const body = await req.json().catch(() => ({}));
    const targetId: string = body?.target_user_id ?? caller.user.id;

    const { data: target } = await svc.from("users")
      .select("id, organisation_id, display_name, email, auth_type, staff_code, status, created_at, last_login_at, hourly_rate, deactivated_at, anonymised_at")
      .eq("id", targetId).maybeSingle();
    if (!target) return json({ error: "Person not found" }, 404);
    if (target.id !== caller.user.id && !(await canManage(svc, caller, target))) {
      return json({ error: "You can only export data for people you manage." }, 403);
    }

    const out: Record<string, any> = {
      about_this_export: {
        generated_at: new Date().toISOString(),
        summary:
          "This file contains the personal data MiseOS holds about this person for their employer. It includes their profile, roles and sites, rota, availability, holidays, training, any fitness-to-work records linked to them, food safety records they logged, messages they sent, and audit entries for actions they took. Records they logged may also mention the business's equipment and products.",
      },
      profile: target,
    };
    for (const [section, table, col] of LINKS) {
      const { data, error } = await svc.from(table).select("*").eq(col, target.id).limit(10000);
      if (error) { console.warn("[gdpr-export]", table, error.message); continue; }
      out[section] ??= {};
      out[section][table] = data ?? [];
    }

    await svc.from("audit_trail").insert({
      organisation_id: target.organisation_id,
      actor_user_id: caller.user.id,
      action: "gdpr_export",
      entity_type: "user",
      entity_id: target.id,
      metadata_json: { self_service: target.id === caller.user.id },
    });

    return json(out);
  } catch (e) {
    console.error("[gdpr-export]", e);
    return json({ error: "Export failed" }, 500);
  }
});
