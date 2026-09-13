import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  REVIEW_QUESTIONS,
  computeReviewCadence,
  emptyChecklist,
  type ReviewChecklist,
} from "../../sfbb";
import { addDaysISO, guard, ok, siteMeta, siteToday } from "../helpers";

export default defineTool({
  name: "complete_periodic_review",
  title: "Complete the periodic review",
  description:
    "Work through the Safer Food Better Business periodic review (the 4-weekly review on scheduled sites; measured in production days on on-demand sites). Managers and owners only. Call it with no answers first to get the questions and the current period, then call it again with the answers to record the review.",
  inputSchema: {
    site_id: z.string().uuid().describe("Site id from list_sites."),
    answers: z
      .record(z.enum(["yes", "no"]))
      .optional()
      .describe("Answers keyed by question key, e.g. { \"safe_methods_reviewed\": \"yes\" }."),
    problems_observed: z
      .boolean()
      .optional()
      .describe("Whether any food safety problem was observed during the period."),
    problems_detail: z.string().optional().describe("What the problems were."),
    action_taken: z.string().optional().describe("What was changed or done as a result."),
    complete: z
      .boolean()
      .optional()
      .describe("Set true to sign the review off. Every question must be answered first. Defaults to false."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: guard<{
    site_id: string;
    answers?: Record<string, "yes" | "no">;
    problems_observed?: boolean;
    problems_detail?: string;
    action_taken?: string;
    complete?: boolean;
  }>({
    tool: "complete_periodic_review",
    level: "manage",
    site: (i) => i.site_id,
    run: async ({ client, input, actorId, actorName, organisationId }) => {
      const site = await siteMeta(client, input.site_id);
      const todayISO = siteToday(site.timezone);
      const questions = REVIEW_QUESTIONS.map((q) => ({ key: q.key, question: q.label }));

      const reviewRows =
        (ok(
          await client
            .from("reviews")
            .select("id, status, period_start, period_end, checklist, problems_observed, problems_detail, action_taken")
            .eq("site_id", input.site_id)
            .order("period_end", { ascending: false })
            .limit(30),
        ) as Record<string, unknown>[] | null) ?? [];

      const lastComplete = reviewRows.find((r) => r.status === "complete") ?? null;
      let openReview = reviewRows.find((r) => r.status !== "complete") ?? null;

      const productionDates =
        site.operating_mode === "on_demand"
          ? ((ok(
              await client
                .from("production_days")
                .select("production_date")
                .eq("site_id", input.site_id),
            ) as { production_date: string }[] | null) ?? []).map((p) => p.production_date)
          : [];

      // The period starts the day after the last completed review, so an
      // existing customer is never handed retroactive work.
      const periodStart =
        (openReview?.period_start as string | undefined) ??
        (lastComplete ? addDaysISO(lastComplete.period_end as string, 1) : todayISO);

      const cadence = computeReviewCadence({
        mode: site.operating_mode,
        periodStartISO: periodStart,
        productionDates,
        todayISO,
      });

      const hasAnswers = !!input.answers && Object.keys(input.answers).length > 0;
      const wantsWrite =
        hasAnswers ||
        input.complete === true ||
        input.problems_observed !== undefined ||
        input.problems_detail !== undefined ||
        input.action_taken !== undefined;

      if (!wantsWrite) {
        return {
          review_label: cadence.reviewLabel,
          due: cadence.due,
          period: { start: cadence.periodStart, end: cadence.periodEnd, progress: cadence.progressLabel },
          in_progress_review: openReview
            ? { id: openReview.id, checklist: openReview.checklist }
            : null,
          last_completed: lastComplete
            ? { id: lastComplete.id, period_end: lastComplete.period_end }
            : null,
          questions,
          next_step:
            "Ask the user each question, then call this tool again with the answers and complete: true.",
        };
      }

      const unknownKeys = Object.keys(input.answers ?? {}).filter(
        (k) => !REVIEW_QUESTIONS.some((q) => q.key === k),
      );
      if (unknownKeys.length > 0) {
        throw new Error(`Unknown review question key(s): ${unknownKeys.join(", ")}`);
      }

      if (!openReview) {
        openReview = ok(
          await client
            .from("reviews")
            .insert({
              site_id: input.site_id,
              organisation_id: organisationId,
              period_start: cadence.periodStart,
              period_end: cadence.periodEnd,
              production_days_covered:
                site.operating_mode === "on_demand" ? cadence.productionDaysCovered : null,
              status: "in_progress",
              checklist: emptyChecklist(),
            })
            .select("id, status, period_start, period_end, checklist")
            .single(),
        ) as Record<string, unknown>;
      }

      const checklist: ReviewChecklist = {
        ...emptyChecklist(),
        ...((openReview.checklist as ReviewChecklist | null) ?? {}),
      };
      for (const [key, value] of Object.entries(input.answers ?? {})) {
        checklist[key] = { value };
      }

      const unanswered = REVIEW_QUESTIONS.filter((q) => !checklist[q.key]?.value).map((q) => q.key);
      if (input.complete === true && unanswered.length > 0) {
        throw new Error(
          `The review cannot be signed off until every question is answered. Still unanswered: ${unanswered.join(", ")}`,
        );
      }

      const patch: Record<string, unknown> = {
        checklist,
        period_end: todayISO,
        production_days_covered:
          site.operating_mode === "on_demand" ? cadence.productionDaysCovered : null,
      };
      if (input.problems_observed !== undefined) patch.problems_observed = input.problems_observed;
      if (input.problems_detail !== undefined) patch.problems_detail = input.problems_detail.trim() || null;
      if (input.action_taken !== undefined) patch.action_taken = input.action_taken.trim() || null;
      if (input.complete === true) {
        patch.status = "complete";
        patch.completed_at = new Date().toISOString();
        patch.completed_by = actorId;
        patch.completed_by_name = actorName;
      }

      const review = ok(
        await client
          .from("reviews")
          .update(patch)
          .eq("id", openReview.id as string)
          .eq("site_id", input.site_id)
          .select(
            "id, status, period_start, period_end, production_days_covered, problems_observed, problems_detail, action_taken, completed_at, completed_by_name",
          )
          .single(),
      );

      return {
        review,
        review_label: cadence.reviewLabel,
        completed: input.complete === true,
        unanswered,
        questions: unanswered.length > 0 ? questions.filter((q) => unanswered.includes(q.key)) : [],
      };
    },
  }),
});
