/**
 * SFBB periodic review — lives inside Stay Compliant (Compliance Overview).
 * No new nav item; a card plus a sheet.
 *
 * Cadence adapts to operating mode: 4 calendar weeks for scheduled sites,
 * 20 production days (or 3 months) for on-demand home / mobile sites.
 */

import { useEffect, useState } from "react";
import { ClipboardCheck, Loader2, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useSite } from "@/contexts/SiteContext";
import { useReviews, type ReviewRow } from "@/hooks/useSfbb";
import { REVIEW_QUESTIONS, checklistAnswered, emptyChecklist, type ReviewChecklist } from "@/lib/sfbb";

export function ReviewsCard() {
  const { operatingMode } = useSite();
  const { reviews, isLoading, openReview, lastComplete, cadence, isDue, startReview, saveReview } = useReviews();
  const [sheetReview, setSheetReview] = useState<ReviewRow | null>(null);

  const label = cadence.reviewLabel;
  const completed = reviews.filter((r) => r.status === "complete");

  async function openOrStart() {
    if (openReview) { setSheetReview(openReview); return; }
    try {
      const row = await startReview.mutateAsync();
      setSheetReview(row as ReviewRow);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start the review.");
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              Reviews
            </CardTitle>
            {isDue ? (
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">Due now</Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">{cadence.progressLabel}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <p className="text-sm text-muted-foreground">
            Your {label} shows an inspector you check your own system — even when nothing has gone wrong.
            {operatingMode === "on_demand"
              ? " Measured in production days, so quiet weeks never count against you."
              : " Runs every 4 weeks."}
          </p>

          <Button onClick={openOrStart} disabled={startReview.isPending} className="w-full sm:w-auto">
            {startReview.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {openReview ? `Continue ${label}` : `Start ${label}`}
          </Button>

          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : completed.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No completed reviews yet. {lastComplete ? "" : "Your first period starts today."}
            </p>
          ) : (
            <ul className="divide-y border rounded-lg">
              {completed.slice(0, 6).map((r) => (
                <li key={r.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  <span className="flex-1 min-w-0 truncate">
                    {r.period_start} → {r.period_end}
                    {r.production_days_covered != null && ` · ${r.production_days_covered} production days`}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {r.completed_by_name ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ReviewSheet
        review={sheetReview}
        label={label}
        onClose={() => setSheetReview(null)}
        onSave={async (vars) => {
          await saveReview.mutateAsync(vars);
          toast.success(vars.complete ? "Review completed and filed." : "Progress saved.");
          if (vars.complete) setSheetReview(null);
        }}
        saving={saveReview.isPending}
      />
    </>
  );
}

interface SheetProps {
  review: ReviewRow | null;
  label: string;
  saving: boolean;
  onClose: () => void;
  onSave: (vars: {
    id: string; checklist: ReviewChecklist; problems_observed: boolean;
    problems_detail?: string | null; action_taken?: string | null; complete?: boolean;
  }) => Promise<void>;
}

function ReviewSheet({ review, label, saving, onClose, onSave }: SheetProps) {
  const [checklist, setChecklist] = useState<ReviewChecklist>(emptyChecklist());
  const [problems, setProblems] = useState(false);
  const [detail, setDetail] = useState("");
  const [action, setAction] = useState("");

  useEffect(() => {
    if (!review) return;
    setChecklist({ ...emptyChecklist(), ...(review.checklist ?? {}) });
    setProblems(review.problems_observed);
    setDetail(review.problems_detail ?? "");
    setAction(review.action_taken ?? "");
  }, [review]);

  if (!review) return null;
  const answered = checklistAnswered(checklist);
  const total = REVIEW_QUESTIONS.length;

  function setAnswer(key: string, value: "yes" | "no") {
    setChecklist((c) => ({ ...c, [key]: { ...c[key], value } }));
  }
  function setNote(key: string, note: string) {
    setChecklist((c) => ({ ...c, [key]: { ...c[key], note } }));
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="h-[92vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="font-heading capitalize">{label}</SheetTitle>
          <SheetDescription>
            {review.period_start} → {review.period_end} · {answered} of {total} answered.
            You can complete this even if nothing went wrong.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4 max-w-2xl">
          {REVIEW_QUESTIONS.map((q) => {
            const a = checklist[q.key];
            return (
              <div key={q.key} className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-medium leading-snug">{q.label}</p>
                <div className="flex gap-2">
                  <Button
                    type="button" size="sm"
                    variant={a?.value === "yes" ? "default" : "outline"}
                    onClick={() => setAnswer(q.key, "yes")}
                  >Yes</Button>
                  <Button
                    type="button" size="sm"
                    variant={a?.value === "no" ? "default" : "outline"}
                    onClick={() => setAnswer(q.key, "no")}
                  >No</Button>
                </div>
                <Input
                  placeholder="Note (optional)"
                  value={a?.note ?? ""}
                  onChange={(e) => setNote(q.key, e.target.value)}
                  className="text-sm"
                />
              </div>
            );
          })}

          <div className="rounded-lg border p-3 space-y-3">
            <p className="text-sm font-medium">Were any problems observed this period?</p>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={problems ? "default" : "outline"} onClick={() => setProblems(true)}>Yes</Button>
              <Button type="button" size="sm" variant={!problems ? "default" : "outline"} onClick={() => setProblems(false)}>No</Button>
            </div>
            {problems && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">What happened?</Label>
                  <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">What did you change or do about it?</Label>
                  <Textarea value={action} onChange={(e) => setAction(e.target.value)} className="text-sm" />
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pb-6">
            <Button
              variant="outline" className="flex-1" disabled={saving}
              onClick={() => onSave({ id: review.id, checklist, problems_observed: problems, problems_detail: detail, action_taken: action })}
            >Save progress</Button>
            <Button
              className="flex-1" disabled={saving}
              onClick={() => onSave({ id: review.id, checklist, problems_observed: problems, problems_detail: detail, action_taken: action, complete: true })}
            >
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Complete review
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
