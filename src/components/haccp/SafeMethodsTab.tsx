/**
 * Food safety management system tab (inside the HACCP Plan module).
 *
 * Two valid routes: complete the SFBB safe methods in the app, or upload an
 * already-completed SFBB pack. A site can do both. Responses autosave.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen, Loader2, CheckCircle2, MinusCircle, Circle, Upload, FileText,
  ExternalLink, Trash2, ArrowLeft, ShieldCheck, Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Link } from "react-router-dom";
import { useSite } from "@/contexts/SiteContext";
import { useSafeMethods, useSfbbSystem, useSfbbDocuments, type SfbbDocumentRow } from "@/hooks/useSfbb";
import {
  SAFE_METHODS, SAFE_METHOD_CATEGORIES, SAFE_METHOD_CATEGORY_LABEL, SAFE_METHOD_CATEGORY_BLURB,
  PREMISES_HINT, isOptionalForPremises, orderMethods, normaliseStatus, methodProgress,
  methodFieldProgress, type SafeMethodDef, type SafeMethodStatus, type MethodResponses,
} from "@/lib/sfbbMethods";

const STATUS_META: Record<SafeMethodStatus, { label: string; icon: React.ElementType; tone: string }> = {
  completed:    { label: "Completed",    icon: CheckCircle2, tone: "text-success" },
  not_relevant: { label: "Not relevant", icon: MinusCircle,  tone: "text-muted-foreground" },
  to_do:        { label: "To do",        icon: Circle,       tone: "text-muted-foreground" },
};

export function SafeMethodsTab({ canEdit }: { canEdit: boolean }) {
  const { premisesType } = useSite();
  const { byKey, isLoading, save } = useSafeMethods();
  const { system, update } = useSfbbSystem();
  const { docs, upload, remove, signedUrl } = useSfbbDocuments();
  const [active, setActive] = useState<SafeMethodDef | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const route = system?.route ?? "undecided";
  const progress = useMemo(() => methodProgress(byKey), [byKey]);
  const hasUpload = docs.length > 0;

  // Record first-completed / route automatically as the operator works.
  useEffect(() => {
    if (!canEdit || !system) return;
    if (progress.pct === 100 && !system.first_completed_at) {
      update.mutate({ first_completed_at: new Date().toISOString().slice(0, 10) });
    }
  }, [progress.pct, system?.first_completed_at, canEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  function setRoute(next: "in_app" | "uploaded") {
    if (!canEdit) return;
    const merged = route === "undecided" || route === next ? next : "both";
    update.mutate({ route: merged });
  }

  async function openDoc(doc: SfbbDocumentRow) {
    const url = await signedUrl(doc.storage_path);
    if (url) window.open(url, "_blank", "noopener");
    else toast.error("Could not open that document.");
  }

  if (active) {
    return (
      <MethodDetail
        def={active}
        row={byKey[active.key]}
        canEdit={canEdit}
        onBack={() => setActive(null)}
        onSave={(status, responses, notes) =>
          save.mutateAsync({ method_key: active.key, category: active.category, status, responses, notes })
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Route chooser ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> Your food safety management system
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <p className="text-sm text-muted-foreground">
            You can complete the Safer Food, Better Business safe methods here in the app, or upload the
            pack you've already completed. Either satisfies the documented food safety management system
            requirement — and both go into your Inspection Pack.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              onClick={() => setRoute("in_app")}
              disabled={!canEdit}
              className={`text-left rounded-lg border p-3 transition-colors ${
                route === "in_app" || route === "both" ? "border-primary bg-primary/5" : "hover:bg-muted/40"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <BookOpen className="h-4 w-4 text-primary" /> Complete in the app
              </span>
              <span className="block text-xs text-muted-foreground mt-1">
                {progress.addressed} of {progress.total} safe methods addressed
              </span>
            </button>
            <button
              onClick={() => { setRoute("uploaded"); setUploadOpen(true); }}
              disabled={!canEdit}
              className={`text-left rounded-lg border p-3 transition-colors ${
                hasUpload ? "border-primary bg-primary/5" : "hover:bg-muted/40"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <Upload className="h-4 w-4 text-primary" /> Upload my completed SFBB pack
              </span>
              <span className="block text-xs text-muted-foreground mt-1">
                {hasUpload ? `${docs.length} document${docs.length === 1 ? "" : "s"} on file` : "PDF, JPG or PNG"}
              </span>
            </button>
          </div>

          {hasUpload && (
            <div className="rounded-lg border divide-y">
              {docs.map((d) => (
                <div key={d.id} className="p-3 flex items-center gap-3">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{d.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.date_completed && <>Completed {format(parseISO(d.date_completed), "d MMM yyyy")}</>}
                      {d.review_date && <> · Review {format(parseISO(d.review_date), "d MMM yyyy")}</>}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => openDoc(d)}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  {canEdit && (
                    <Button variant="ghost" size="sm" onClick={() => remove.mutate(d)}>
                      <Trash2 className="h-4 w-4 text-breach" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground">
            {system?.first_completed_at && (
              <span>First completed {format(parseISO(system.first_completed_at), "d MMM yyyy")}</span>
            )}
            {system?.last_reviewed_at && (
              <span>Last reviewed {format(parseISO(system.last_reviewed_at), "d MMM yyyy")}
                {system.reviewed_by_name ? ` by ${system.reviewed_by_name}` : ""}</span>
            )}
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => update.mutate({ markReviewed: true })}>
                Mark plan reviewed today
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Completion record ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" /> Safe method completion record
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="font-heading font-bold text-3xl tabular-nums">{progress.pct}%</span>
            <span className="text-sm text-muted-foreground">
              {progress.completed} completed · {progress.addressed} of {progress.total} addressed
            </span>
          </div>
          <Progress value={progress.pct} className="h-1.5" />
          <p className="text-xs text-muted-foreground">
            Write down how you actually do each thing. Anything that doesn't apply to your business can be
            marked "not relevant" — it won't count against you. Your answers save as you type.
          </p>
          {PREMISES_HINT[premisesType ?? "commercial"] && (
            <p className="text-xs text-muted-foreground flex gap-2">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {PREMISES_HINT[premisesType ?? "commercial"]}
            </p>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
      ) : (
        SAFE_METHOD_CATEGORIES.map((cat) => {
          const items = orderMethods(SAFE_METHODS.filter((m) => m.category === cat), premisesType);
          if (!items.length) return null;
          return (
            <div key={cat} className="space-y-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {SAFE_METHOD_CATEGORY_LABEL[cat]}
                </h3>
                <p className="text-xs text-muted-foreground">{SAFE_METHOD_CATEGORY_BLURB[cat]}</p>
              </div>
              <Card>
                <CardContent className="p-0">
                  <ul className="divide-y">
                    {items.map((m) => {
                      const row = byKey[m.key];
                      const status = normaliseStatus(row?.status);
                      const meta = STATUS_META[status];
                      const optional = isOptionalForPremises(m, premisesType);
                      return (
                        <li key={m.key}>
                          <button
                            onClick={() => setActive(m)}
                            className="w-full text-left p-3 hover:bg-muted/40 transition-colors flex items-center gap-3"
                          >
                            <meta.icon className={`h-4 w-4 shrink-0 ${meta.tone}`} />
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm font-medium truncate">{m.title}</span>
                              <span className="block text-xs text-muted-foreground truncate">
                                {status === "completed" && row?.completed_at
                                  ? `Completed ${format(parseISO(row.completed_at), "d MMM yyyy")}`
                                  : m.summary}
                              </span>
                            </span>
                            {optional && status === "to_do" && (
                              <Badge variant="outline" className="text-[10px] shrink-0">Optional</Badge>
                            )}
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
        })
      )}

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUpload={(v) => upload.mutateAsync(v)}
        pending={upload.isPending}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// One method per screen — reusable template
// ──────────────────────────────────────────────────────────────────

function MethodDetail({
  def, row, canEdit, onBack, onSave,
}: {
  def: SafeMethodDef;
  row?: { status: string; responses: Record<string, any> | null; notes: string | null };
  canEdit: boolean;
  onBack: () => void;
  onSave: (status: string, responses: MethodResponses, notes: string | null) => Promise<unknown>;
}) {
  const [responses, setResponses] = useState<MethodResponses>((row?.responses as MethodResponses) ?? {});
  const [notes, setNotes] = useState(row?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const status = normaliseStatus(row?.status);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // Autosave — this pack is long, never lose progress.
  function queueSave(next: MethodResponses, nextNotes: string) {
    if (!canEdit) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await onSave(status === "to_do" ? "to_do" : status, next, nextNotes || null);
      } finally {
        setSaving(false);
      }
    }, 800);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  function setField(key: string, value: any) {
    const next = { ...responses, [key]: value };
    setResponses(next);
    queueSave(next, notes);
  }

  async function mark(next: SafeMethodStatus) {
    clearTimeout(timer.current);
    setSaving(true);
    try {
      await onSave(next, responses, notes || null);
      toast.success(next === "completed" ? "Safe method completed." : "Saved.");
      onBack();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  const filled = methodFieldProgress(def, responses);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> All safe methods
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">
          {saving ? "Saving…" : `${filled}% filled in`}
        </span>
      </div>

      <div>
        <h2 className="font-heading text-2xl font-bold">{def.title}</h2>
        <p className="text-sm text-muted-foreground mt-1">{def.summary}</p>
      </div>

      <Card className="bg-muted/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Safety points</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <ul className="space-y-1.5">
            {def.safetyPoints.map((p, i) => (
              <li key={i} className="text-sm flex gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-1" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground border-t pt-2">
            <span className="font-medium text-foreground">Why: </span>{def.why}
          </p>
          {def.link && (
            <Button asChild variant="outline" size="sm">
              <Link to={def.link.href}>{def.link.label} <ExternalLink className="h-3.5 w-3.5 ml-1" /></Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-5">
          {def.fields.map((f) => {
            if (f.kind === "text") {
              return (
                <div key={f.key} className="space-y-1.5">
                  <Label className="text-sm">{f.label}</Label>
                  <Textarea
                    rows={f.rows ?? 3}
                    placeholder={f.placeholder}
                    disabled={!canEdit}
                    value={(responses[f.key] as string) ?? ""}
                    onChange={(e) => setField(f.key, e.target.value)}
                    className="text-sm"
                  />
                </div>
              );
            }
            if (f.kind === "yesno") {
              const v = (responses[f.key] as { value: "yes" | "no" | null; note?: string }) ?? { value: null };
              return (
                <div key={f.key} className="space-y-1.5">
                  <Label className="text-sm">{f.label}</Label>
                  <div className="flex gap-2">
                    {(["yes", "no"] as const).map((opt) => (
                      <Button
                        key={opt}
                        type="button"
                        size="sm"
                        variant={v.value === opt ? "default" : "outline"}
                        disabled={!canEdit}
                        onClick={() => setField(f.key, { ...v, value: opt })}
                      >
                        {opt === "yes" ? "Yes" : "No"}
                      </Button>
                    ))}
                  </div>
                  {v.value === "no" && f.ifNoLabel && (
                    <Textarea
                      rows={2}
                      placeholder={f.ifNoLabel}
                      disabled={!canEdit}
                      value={v.note ?? ""}
                      onChange={(e) => setField(f.key, { ...v, note: e.target.value })}
                      className="text-sm"
                    />
                  )}
                </div>
              );
            }
            const selected = (responses[f.key] as string[]) ?? [];
            return (
              <div key={f.key} className="space-y-2">
                <Label className="text-sm">{f.label}</Label>
                {f.options.map((o) => (
                  <label key={o.key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selected.includes(o.key)}
                      disabled={!canEdit}
                      onCheckedChange={(c) =>
                        setField(f.key, c ? [...selected, o.key] : selected.filter((k) => k !== o.key))
                      }
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            );
          })}

          <div className="space-y-1.5">
            <Label className="text-sm">Anything else worth recording?</Label>
            <Textarea
              rows={2}
              disabled={!canEdit}
              value={notes}
              onChange={(e) => { setNotes(e.target.value); queueSave(responses, e.target.value); }}
              className="text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {canEdit ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <Button className="flex-1" disabled={saving} onClick={() => mark("completed")}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Mark completed
          </Button>
          <Button variant="outline" className="flex-1" disabled={saving} onClick={() => mark("not_relevant")}>
            Not relevant to my business
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Only supervisors and owners can edit safe methods.</p>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Upload dialog
// ──────────────────────────────────────────────────────────────────

function UploadDialog({
  open, onOpenChange, onUpload, pending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onUpload: (v: { file: File; name: string; date_completed?: string | null; review_date?: string | null; notes?: string | null }) => Promise<unknown>;
  pending: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [dateCompleted, setDateCompleted] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [notes, setNotes] = useState("");

  async function submit() {
    if (!file) return;
    try {
      await onUpload({ file, name, date_completed: dateCompleted || null, review_date: reviewDate || null, notes });
      toast.success("SFBB pack uploaded.");
      onOpenChange(false);
      setFile(null); setName(""); setDateCompleted(""); setReviewDate(""); setNotes("");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not upload that file.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Upload your completed SFBB pack</DialogTitle>
          <DialogDescription>
            PDF, JPG or PNG. This becomes your documented food safety management system and is included
            in your Inspection Pack.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm">File</Label>
            <Input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f && !name) setName(f.name.replace(/\.[^.]+$/, ""));
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Document name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="SFBB pack — Caterers" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Date completed</Label>
              <Input type="date" value={dateCompleted} onChange={(e) => setDateCompleted(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Review date</Label>
              <Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={!file || pending}>
            {pending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
