import { ToolError, type ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "./supabase";

/** Returns an RLS-scoped client for the caller, or throws a caller-visible error. */
export function requireClient(ctx: ToolContext) {
  if (!ctx.isAuthenticated()) {
    throw new ToolError("Not signed in. Connect this MCP server to your MiseOS account first.");
  }
  return supabaseForUser(ctx);
}

/** Resolves the organisation that owns a site the caller can access. */
export async function siteOrganisationId(
  client: ReturnType<typeof supabaseForUser>,
  siteId: string,
): Promise<string> {
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
