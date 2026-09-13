import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { guard, isoDate, ok, siteMeta, siteToday } from "../helpers";

export default defineTool({
  name: "list_cleaning_tasks",
  title: "List cleaning tasks",
  description:
    "List the cleaning schedule for a site, with each task's area, frequency and whether it has been completed on a given date.",
  inputSchema: {
    site_id: z.string().uuid().describe("Site id from list_sites."),
    date: z.string().optional().describe("Date to check completion against (YYYY-MM-DD). Defaults to today."),
    frequency: z.string().optional().describe("Filter by frequency: daily, weekly or monthly."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: guard<{ site_id: string; date?: string; frequency?: string }>({
    tool: "list_cleaning_tasks",
    level: "read",
    site: (i) => i.site_id,
    run: async ({ client, input }) => {
      const site = await siteMeta(client, input.site_id);
      const date = input.date ? isoDate(input.date) : siteToday(site.timezone);

      let taskQuery = client
        .from("cleaning_tasks")
        .select("id, task, area, frequency, due_time, assigned_to_name")
        .eq("site_id", input.site_id)
        .eq("active", true)
        .order("sort_order");
      if (input.frequency) taskQuery = taskQuery.eq("frequency", input.frequency.toLowerCase());

      const [tasks, logs] = await Promise.all([
        taskQuery,
        client
          .from("cleaning_logs")
          .select("task_id, done, completed_by_name, completed_at")
          .eq("site_id", input.site_id)
          .eq("log_date", date),
      ]);

      const logRows = (ok(logs as never) as Record<string, unknown>[] | null) ?? [];
      const byTask = new Map(logRows.map((l) => [l.task_id as string, l]));

      return {
        date,
        tasks: ((ok(tasks as never) as Record<string, unknown>[] | null) ?? []).map((t) => {
          const log = byTask.get(t.id as string);
          return {
            ...t,
            done: log?.done === true,
            completed_by: (log?.completed_by_name as string) ?? null,
            completed_at: (log?.completed_at as string) ?? null,
          };
        }),
      };
    },
  }),
});
