/**
 * Documented safe methods — SFBB "how do you do this?" records, shown as a
 * tab inside the HACCP Plan module. Not a new nav item.
 *
 * Each method can be Documented, Not relevant, or To do. The completion
 * overview mirrors SFBB's Safe Method Completion Record. Nothing is forced:
 * methods that don't apply are marked not relevant, not failed.
 */

import { useMemo, useState } from "react";
import { BookOpen, Loader2, CheckCircle2, MinusCircle, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useSite } from "@/contexts/SiteContext";
import { useSafeMethods } from "@/hooks/useSfbb";
import {
  SAFE_METHODS, SAFE_METHOD_CATEGORIES, SAFE_METHOD_CATEGORY_LABEL,
  isSuggestedForPremises, type SafeMethodDef, type SafeMethodStatus,
} from "@/lib/sfbb";

const STATUS_META: Record<SafeMethodStatus, { label: string; icon: React.ElementType; tone: string }> = {
  documented:   { label: "Documented",   icon: CheckCircle2, tone: "text-success" },
  not_relevant: { label: "Not relevant", icon: MinusCircle,  tone: "text-muted-foreground" },
  to_do:        { label: "To do",        icon: Circle,       tone: "text-muted-foreground" },
};

export function SafeMethodsTab({ canEdit }: { canEdit: boolean }) {
  const { premisesType } = useSite();
  const { byKey, isLoading, save } = useSafeMethods();
  const [active, setActive] = useState<SafeMethodDef | null>(null);
  const [how, setHow] = useState("");

  // Suggested set first — a home baker sees a leaner list, but everything
  // stays available under "Also available".
  const suggested = useMemo(
    () => SAFE_METHODS.filter((m) => isSuggestedForPremises(m, premisesType)),
    [premisesType],
  );
  const other = useMemo(
    () => SAFE_METHODS.filter((m) => !isSuggestedForPremises(m, premisesType)),
    [premisesType],
  );

  const relevant = suggested.filter((m) => byKey[m.key]?.status !== "not_relevant");
  const done = relevant.filter((m) => byKey[m.key]?.status === "documented").length;
  const pct = relevant.length ? Math.round((done / relevant.length) * 100) : 0;

  function open(m: SafeMethodDef) {
    setActive(m);
    setHow(byKey[m.key]?.how_text ?? "");
  }

  async function persist(status: SafeMethodStatus) {
    if (!active) return;
    try {
      await save.mutateAsync({
        method_key: active.key,
        category: active.category,
        status,
        how_text: status === "documented" ? how : byKey[active.key]?.how_text ?? null,
      });
      toast.success(status === "documented" ? "Safe method documented." : "Saved.");
      setActive(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save the safe method.");
    }
  }

  function renderList(list: readonly SafeMethodDef[]) {
    return SAFE_METHOD_CATEGORIES.map((cat) => {
      const items = list.filter((m) => m.category === cat);
      if (items.length === 0) return null;
      return (
        <div key={cat} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {SAFE_METHOD_CATEGORY_LABEL[cat]}
          </h3>
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y">
                {items.map((m) => {
                  const row = byKey[m.key];
                  const meta = STATUS_META[row?.status ?? "to_do"];
                  return (
                    <li key={m.key}>
                      <button
                        onClick={() => open(m)}
                        className="w-full text-left p-3 hover:bg-muted/40 transition-colors flex items-center gap-3"
                      >
                        <meta.icon className={`h-4 w-4 shrink-0 ${meta.tone}`} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium truncate">{m.title}</span>
                          {row?.how_text && (
                            <span className="block text-xs text-muted-foreground truncate">{row.how_text}</span>
                          )}
                        </span>
                        <Badge variant="outline" className="text-[10px] shrink-0">{meta.label}</Badge>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      );
    });
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" /> Safe method completion record
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="font-heading font-bold text-3xl tabular-nums">{pct}%</span>
            <span className="text-sm text-muted-foreground">{done} of {relevant.length} documented</span>
          </div>
          <Progress value={pct} className="h-1.5" />
          <p className="text-xs text-muted-foreground">
            Write down how you actually do each thing. Anything that doesn't apply to your business
            can be marked "not relevant" — it won't count against you.
          </p>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
      ) : (
        <>
          {renderList(suggested)}
          {other.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Also available
              </h3>
              {renderList(other)}
            </div>
          )}
        </>
      )}

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">{active?.title}</DialogTitle>
            <DialogDescription>{active?.prompt}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={how}
              onChange={(e) => setHow(e.target.value)}
              placeholder="How do you do this?"
              rows={6}
              className="text-sm"
              disabled={!canEdit}
            />
            {canEdit ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <Button className="flex-1" disabled={!how.trim() || save.isPending} onClick={() => persist("documented")}>
                  {save.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Mark documented
                </Button>
                <Button variant="outline" className="flex-1" disabled={save.isPending} onClick={() => persist("not_relevant")}>
                  Not relevant
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Only supervisors and owners can edit safe methods.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
