import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { guard, ok } from "../helpers";

/** memberships still stores "supervisor" for what the app now labels Manager. */
function roleLabel(siteRole: string): string {
  switch (siteRole) {
    case "owner":
    case "supervisor":
      return "Manager";
    case "staff":
      return "Staff";
    case "read_only":
      return "Read-only";
    default:
      return siteRole;
  }
}

export default defineTool({
  name: "list_staff",
  title: "List staff at a site",
  description:
    "List the people with access to a site and their role. Managers and owners only. Use the user ids with add_training_record and record_fitness_to_work.",
  inputSchema: { site_id: z.string().uuid().describe("Site id from list_sites.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: guard<{ site_id: string }>({
    tool: "list_staff",
    level: "manage",
    site: (i) => i.site_id,
    run: async ({ client, input }) => {
      const memberships =
        (ok(
          await client
            .from("memberships")
            .select("site_role, users(id, display_name, email, status)")
            .eq("site_id", input.site_id)
            .eq("active", true),
        ) as Record<string, unknown>[] | null) ?? [];

      const staff = memberships
        .map((m) => {
          const user = m.users as Record<string, unknown> | null;
          if (!user) return null;
          return {
            user_id: user.id as string,
            name: user.display_name as string,
            email: (user.email as string) ?? null,
            role: roleLabel(m.site_role as string),
            site_role: m.site_role as string,
            active: user.status === "active",
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .sort((a, b) => a.name.localeCompare(b.name));

      return { staff };
    },
  }),
});
