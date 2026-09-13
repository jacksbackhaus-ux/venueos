import { ToolError, type ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "./supabase";

type Client = ReturnType<typeof supabaseForUser>;

/** Permission level a tool needs, mapped onto MiseOS site roles. */
export type Level = "read" | "write" | "manage";

export interface Guarded<I> {
  /** Validated tool input. */
  input: I;
  /** RLS-scoped client acting as the signed-in user. */
  client: Client;
  /** MiseOS users.id of the caller. */
  actorId: string;
  actorName: string;
  organisationId: string;
  siteRole: string | null;
}

/** Returns an RLS-scoped client for the caller, or throws a caller-visible error. */
export function requireClient(ctx: ToolContext): Client {
  if (!ctx.isAuthenticated()) {
    throw new ToolError("Not signed in. Connect this MCP server to your MiseOS account first.");
  }
  return supabaseForUser(ctx);
}

/** Resolves the organisation that owns a site the caller can access. */
export async function siteOrganisationId(client: Client, siteId: string): Promise<string> {
  const { data, error } = await client
    .from("sites")
    .select("organisation_id")
    .eq("id", siteId)
    .maybeSingle();
  if (error) throw new ToolError(error.message);
  if (!data) throw new ToolError("Site not found, or you do not have access to it.");
  return data.organisation_id as string;
}

export function json(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

async function actorRecord(client: Client, authUserId: string) {
  const { data, error } = await client
    .from("users")
    .select("id, display_name, email, organisation_id, status")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw new ToolError(error.message);
  if (!data) throw new ToolError("No MiseOS account found for this login.");
  if (data.status !== "active") throw new ToolError("This MiseOS account is not active.");
  return data;
}

async function siteRoleFor(
  client: Client,
  actorId: string,
  siteId: string,
  organisationId: string,
) {
  const { data, error } = await client
    .from("memberships")
    .select("site_role")
    .eq("user_id", actorId)
    .eq("site_id", siteId)
    .eq("active", true)
    .maybeSingle();
  if (error) throw new ToolError(error.message);
  const membershipRole = (data?.site_role as string | undefined) ?? null;
  if (membershipRole) return membershipRole;

  // No membership row: fall back to the organisation-level role, exactly as
  // is_site_supervisor_or_owner() does in the database. An org owner or HQ
  // admin is a Manager at every site in their org; an HQ auditor is read-only.
  const { data: org, error: orgError } = await client
    .from("org_users")
    .select("org_role, expires_at")
    .eq("user_id", actorId)
    .eq("organisation_id", organisationId)
    .eq("active", true)
    .maybeSingle();
  if (orgError) throw new ToolError(orgError.message);
  if (!org) return null;
  const expiresAt = org.expires_at as string | null;
  if (expiresAt && new Date(expiresAt) <= new Date()) return null;
  const orgRole = org.org_role as string;
  if (orgRole === "org_owner" || orgRole === "hq_admin") return "owner";
  if (orgRole === "hq_auditor") return "read_only";
  return null;
}

function assertLevel(level: Level, role: string | null) {
  if (level === "read") return;
  if (!role) throw new ToolError("You do not have access to this site.");
  if (role === "read_only") {
    throw new ToolError("Read-only accounts cannot record or change records.");
  }
  if (level === "manage" && !["supervisor", "owner"].includes(role)) {
    throw new ToolError("Only supervisors and owners can do this.");
  }
}

async function assertEnabled(client: Client, organisationId: string) {
  const { data, error } = await client
    .from("mcp_settings")
    .select("enabled")
    .eq("organisation_id", organisationId)
    .maybeSingle();
  if (error) throw new ToolError(error.message);
  if (data && data.enabled === false) {
    throw new ToolError(
      "AI assistant access is switched off for this organisation. An owner can turn it back on in Settings › Connected apps.",
    );
  }
}

const RATE_LIMIT_PER_MINUTE = 60;

async function assertUnderRateLimit(client: Client, authUserId: string) {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count, error } = await client
    .from("mcp_activity_log")
    .select("id", { count: "exact", head: true })
    .eq("actor_auth_user_id", authUserId)
    .gte("created_at", since);
  if (error) return; // never block a legitimate call because the log is unreadable
  if ((count ?? 0) >= RATE_LIMIT_PER_MINUTE) {
    throw new ToolError("Too many assistant requests in the last minute. Please slow down.");
  }
}

function redact(input: unknown) {
  if (!input || typeof input !== "object") return input ?? {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    out[key] = typeof value === "string" && value.length > 240 ? `${value.slice(0, 240)}…` : value;
  }
  return out;
}

async function logActivity(
  client: Client,
  row: {
    organisation_id: string;
    site_id: string | null;
    actor_auth_user_id: string;
    actor_email: string | null;
    client_name: string | null;
    tool_name: string;
    arguments: unknown;
    outcome: "success" | "error";
    error_message?: string | null;
  },
) {
  try {
    await client.from("mcp_activity_log").insert({
      ...row,
      arguments: redact(row.arguments) as never,
      error_message: row.error_message ?? null,
    });
  } catch {
    // Auditing must never break a legitimate action; failures are visible in function logs.
  }
}

/**
 * Wraps a tool handler with: authentication, org kill-switch, role check,
 * rate limiting and an append-only audit entry attributed to the caller.
 */
export function guard<I extends Record<string, unknown>>(opts: {
  tool: string;
  level: Level;
  /** Pulls the site the call targets out of the input, when there is one. */
  site?: (input: I) => string | undefined;
  run: (g: Guarded<I>) => Promise<unknown>;
}) {
  return async (input: I, ctx: ToolContext) => {
    const client = requireClient(ctx);
    const authUserId = ctx.getUserId();
    if (!authUserId) throw new ToolError("Could not identify the signed-in MiseOS user.");

    const actor = await actorRecord(client, authUserId);
    const siteId = opts.site?.(input) ?? null;
    const organisationId = siteId
      ? await siteOrganisationId(client, siteId)
      : (actor.organisation_id as string);

    await assertEnabled(client, organisationId);
    await assertUnderRateLimit(client, authUserId);

    const siteRole = siteId
      ? await siteRoleFor(client, actor.id as string, siteId, organisationId)
      : null;
    const base = {
      organisation_id: organisationId,
      site_id: siteId,
      actor_auth_user_id: authUserId,
      actor_email: (actor.email as string) ?? ctx.getUserEmail() ?? null,
      client_name: ctx.getClientId() ?? null,
      tool_name: opts.tool,
      arguments: input,
    };

    try {
      assertLevel(opts.level, siteRole);
      const result = await opts.run({
        input,
        client,
        actorId: actor.id as string,
        actorName: (actor.display_name as string) ?? (actor.email as string) ?? "MiseOS user",
        organisationId,
        siteRole,
      });
      await logActivity(client, { ...base, outcome: "success" });
      return json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await logActivity(client, { ...base, outcome: "error", error_message: message });
      throw err instanceof ToolError ? err : new ToolError(message);
    }
  };
}

/** Throws if a Supabase error came back. */
export function ok<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new ToolError(res.error.message);
  return res.data;
}

// ──────────────────────────────────────────────────────────────────
// SHARED SITE + DATE HELPERS
// ──────────────────────────────────────────────────────────────────

export interface SiteMeta {
  id: string;
  name: string;
  premises_type: "commercial" | "home" | "mobile" | "production";
  operating_mode: "scheduled" | "on_demand";
  timezone: string;
  organisation_id: string;
  /** Nothing before this date exists, so nothing before it can be overdue. */
  created_on: string;
}

/** Site row every tool needs before it can decide what "a day" means here. */
export async function siteMeta(client: Client, siteId: string): Promise<SiteMeta> {
  const { data, error } = await client
    .from("sites")
    .select("id, name, premises_type, operating_mode, timezone, organisation_id, created_at")
    .eq("id", siteId)
    .maybeSingle();
  if (error) throw new ToolError(error.message);
  if (!data) throw new ToolError("Site not found, or you do not have access to it.");
  return {
    id: data.id as string,
    name: data.name as string,
    premises_type: ((data.premises_type as string) ?? "commercial") as SiteMeta["premises_type"],
    operating_mode: ((data.operating_mode as string) ?? "scheduled") as SiteMeta["operating_mode"],
    timezone: (data.timezone as string) || "Europe/London",
    organisation_id: data.organisation_id as string,
    created_on: String(data.created_at ?? "").slice(0, 10),
  };
}

/** Plain-English premises description, for reports an inspector may read. */
export function premisesLabel(type: string): string {
  switch (type) {
    case "home":
      return "Home kitchen (registered domestic premises)";
    case "mobile":
      return "Mobile / market trader";
    case "production":
      return "Prep or production unit";
    default:
      return "Commercial premises";
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Validates a YYYY-MM-DD input and returns it unchanged. */
export function isoDate(value: string, field = "date"): string {
  if (!ISO_DATE.test(value)) throw new ToolError(`${field} must be a date in YYYY-MM-DD format.`);
  return value;
}

/**
 * "Now" at the site, not at the server. The MCP function runs in UTC, so a
 * British Summer Time evening would otherwise be read as the next morning.
 */
export function siteNow(timezone: string, at: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const hour = Number(get("hour")) % 24;
  return {
    dateISO: `${get("year")}-${get("month")}-${get("day")}`,
    hour,
    minutes: hour * 60 + Number(get("minute")),
  };
}

/** Today at the site, as YYYY-MM-DD. */
export function siteToday(timezone: string): string {
  return siteNow(timezone).dateISO;
}

export function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetweenISO(fromISO: string, toISO: string): number {
  return Math.round(
    (Date.parse(`${toISO}T12:00:00Z`) - Date.parse(`${fromISO}T12:00:00Z`)) / 86_400_000,
  );
}

/** Every date from `fromISO` to `toISO` inclusive. */
export function eachDateISO(fromISO: string, toISO: string): string[] {
  const out: string[] = [];
  for (let d = fromISO; d <= toISO; d = addDaysISO(d, 1)) {
    out.push(d);
    if (out.length > 1500) break; // guard against a malformed range
  }
  return out;
}
