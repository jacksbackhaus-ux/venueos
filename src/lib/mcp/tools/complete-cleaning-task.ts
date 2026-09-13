import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { guard, isoDate, ok, siteMeta, siteToday } from "../helpers";

export default defineTool({
  name: "complete_cleaning_task",
  title: "Complete a cleaning task",
  description:
    "Mark a cleaning task as completed for a given date. Use list_cleaning_tasks to find the task id. Completing a task for a past date is recorded as a retrospective entry.",
  inputSchema: {
    site_id: z.string().uuid().describe("Site id from list_sites."),
    task_id: z.string().uuid().describe("Cleaning task id from list_cleaning_tasks."),
    date: z.string().optional().describe("Date the cleaning was done (YYYY-MM-DD). Defaults to today."),
    note: z.string().optional().describe("Anything worth recording about the clean."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: guard<{ site_id: string; task_id: string; date?: string; note?: string }>({
    tool: "complete_cleaning_task",
    level: "write",
    site: (i) => i.site_id,
    run: async ({ client, input, actorId, actorName, organisationId }) => {
      const site = await siteMeta(client, input.site_id);
      const today = siteToday(site.timezone);
      const date = input.date ? isoDate(input.date) : today;
      if (date > today) throw new Error("Cleaning cannot be recorded for a future date.");

      const task = ok(
        await client
          .from("cleaning_tasks")
          .select("id, task, area, frequency")
          .eq("id", input.task_id)
          .eq("site_id", input.site_id)
          .maybeSingle(),
      );
      if (!task) throw new Error("Cleaning task not found for this site.");

      const isRetrospective = date < today;
      const completedAt = isRetrospective ? `${date}T12:00:00.000Z` : new Date().toISOString();

      const existing = ok(
        await client
          .from("cleaning_logs")
          .select("id")
          .eq("site_id", input.site_id)
          .eq("task_id", input.task_id)
          .eq("log_date", date)
          .maybeSingle(),
      );

      const payload = {
        done: true,
        completed_at: completedAt,
        completed_by_user_id: actorId,
        completed_by_name: actorName,
        is_retrospective: isRetrospective,
        note: input.note?.trim() || null,
      };

      const log = existing
        ? ok(
            await client
              .from("cleaning_logs")
              .update(payload)
              .eq("id", (existing as { id: string }).id)
              .select("id, log_date, done, completed_at, is_retrospective")
              .single(),
          )
        : ok(
            await client
              .from("cleaning_logs")
              .insert({
                site_id: input.site_id,
                organisation_id: organisationId,
                task_id: input.task_id,
                log_date: date,
                ...payload,
              })
              .select("id, log_date, done, completed_at, is_retrospective")
              .single(),
          );

      return { task, log, retrospective: isRetrospective };
    },
  }),
});
