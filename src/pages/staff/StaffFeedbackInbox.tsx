import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowLeft, MessageSquareHeart, Search, ExternalLink, RefreshCw } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

type Status = "new" | "in_review" | "planned" | "done" | "closed";
type Type = "feedback" | "bug" | "feature" | "other";

interface FeedbackRow {
  id: string;
  organisation_id: string;
  user_id: string | null;
  type: Type;
  title: string;
  description: string;
  page: string | null;
  browser_info: string | null;
  screenshot_url: string | null;
  status: Status;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  organisation?: { id: string; name: string | null } | null;
  user?: { id: string; display_name: string | null; email: string | null } | null;
}

const STATUSES: Status[] = ["new", "in_review", "planned", "done", "closed"];
const TYPES: Type[] = ["feedback", "bug", "feature", "other"];

const typeBadge: Record<Type, string> = {
  feedback: "bg-blue-100 text-blue-800",
  bug: "bg-red-100 text-red-800",
  feature: "bg-purple-100 text-purple-800",
  other: "bg-muted text-foreground",
};
const statusBadge: Record<Status, string> = {
  new: "bg-amber-100 text-amber-900",
  in_review: "bg-blue-100 text-blue-800",
  planned: "bg-violet-100 text-violet-800",
  done: "bg-emerald-100 text-emerald-800",
  closed: "bg-muted text-muted-foreground",
};

const labelStatus = (s: Status) =>
  ({ new: "New", in_review: "In review", planned: "Planned", done: "Done", closed: "Closed" } as const)[s];

async function fetchFeedback(filter: { status?: Status | "all"; type?: Type | "all"; orgId?: string; q?: string }) {
  let q = sb
    .from("feedback")
    .select(
      "id, organisation_id, user_id, type, title, description, page, browser_info, screenshot_url, status, internal_notes, created_at, updated_at, organisations:organisation_id (id, name), users:user_id (id, display_name, email)"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (filter.status && filter.status !== "all") q = q.eq("status", filter.status);
  if (filter.type && filter.type !== "all") q = q.eq("type", filter.type);
  if (filter.orgId) q = q.eq("organisation_id", filter.orgId);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    ...r,
    organisation: r.organisations ?? null,
    user: r.users ?? null,
  })) as FeedbackRow[];
}

async function signedScreenshot(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = await sb.storage.from("feedback-screenshots").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

// ───────────────────────────────────────────────────────────────────────────
// List page
// ───────────────────────────────────────────────────────────────────────────

export default function StaffFeedbackInbox() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status | "all">("all");
  const [type, setType] = useState<Type | "all">("all");
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      setRows(await fetchFeedback({ status, type }));
    } catch (e: any) {
      toast.error(e?.message || "Failed to load feedback");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [status, type]);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const needle = q.toLowerCase();
    return rows.filter(
      (r) =>
        r.title.toLowerCase().includes(needle) ||
        r.description.toLowerCase().includes(needle) ||
        (r.organisation?.name || "").toLowerCase().includes(needle) ||
        (r.user?.display_name || "").toLowerCase().includes(needle) ||
        (r.user?.email || "").toLowerCase().includes(needle)
    );
  }, [rows, q]);

  const newCount = rows.filter((r) => r.status === "new").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold flex items-center gap-2">
            <MessageSquareHeart className="h-5 w-5" /> Feedback
            {newCount > 0 && (
              <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">{newCount} new</Badge>
            )}
          </h1>
          <p className="text-xs text-muted-foreground">Customer-submitted feedback, bugs and feature requests.</p>
        </div>
        <Button size="sm" variant="outline" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-3 grid grid-cols-1 sm:grid-cols-4 gap-2">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, description, org, user…"
              className="pl-8 h-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{labelStatus(s)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={(v) => setType(v as any)}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground p-8 text-center">No feedback matches your filters.</p>
          ) : (
            <div className="divide-y">
              {filtered.map((r) => (
                <Link
                  key={r.id}
                  to={`/staff/feedback/${r.id}`}
                  className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-muted/40 transition-colors"
                >
                  <div className="col-span-12 sm:col-span-3 min-w-0">
                    <p className="text-sm font-medium truncate">{r.organisation?.name || "—"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{r.user?.display_name || r.user?.email || "Unknown user"}</p>
                  </div>
                  <div className="col-span-6 sm:col-span-5 min-w-0">
                    <p className="text-sm font-medium truncate">{r.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{r.description}</p>
                  </div>
                  <div className="col-span-3 sm:col-span-1">
                    <Badge className={typeBadge[r.type] + " hover:" + typeBadge[r.type]}>{r.type}</Badge>
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <Badge className={statusBadge[r.status] + " hover:" + statusBadge[r.status]}>{labelStatus(r.status)}</Badge>
                  </div>
                  <div className="hidden sm:block col-span-1 text-[11px] text-muted-foreground text-right whitespace-nowrap">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Detail page
// ───────────────────────────────────────────────────────────────────────────

export function StaffFeedbackDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [row, setRow] = useState<FeedbackRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<Status>("new");
  const [saving, setSaving] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await sb
      .from("feedback")
      .select(
        "id, organisation_id, user_id, type, title, description, page, browser_info, screenshot_url, status, internal_notes, created_at, updated_at, organisations:organisation_id (id, name), users:user_id (id, display_name, email)"
      )
      .eq("id", id)
      .maybeSingle();
    if (error) { toast.error(error.message); setLoading(false); return; }
    const r = data
      ? ({ ...(data as any), organisation: (data as any).organisations ?? null, user: (data as any).users ?? null } as FeedbackRow)
      : null;
    setRow(r);
    if (r) {
      setNotes(r.internal_notes || "");
      setStatus(r.status);
      signedScreenshot(r.screenshot_url).then(setScreenshot);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [id]);

  const save = async () => {
    if (!row) return;
    setSaving(true);
    const { error } = await sb
      .from("feedback")
      .update({ internal_notes: notes, status })
      .eq("id", row.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Saved"); void load(); }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!row) return <p className="text-sm text-muted-foreground p-6">Not found.</p>;

  return (
    <div className="space-y-4 max-w-3xl">
      <Button size="sm" variant="ghost" onClick={() => navigate("/staff/feedback")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to inbox
      </Button>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={typeBadge[row.type] + " hover:" + typeBadge[row.type]}>{row.type}</Badge>
              <Badge className={statusBadge[row.status] + " hover:" + statusBadge[row.status]}>{labelStatus(row.status)}</Badge>
              <span className="text-[11px] text-muted-foreground">{format(new Date(row.created_at), "d MMM yyyy HH:mm")}</span>
            </div>
            {row.organisation && (
              <Link
                to={`/staff/org/${row.organisation_id}`}
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                {row.organisation.name} <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
          <CardTitle className="text-lg mt-2">{row.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm whitespace-pre-wrap text-foreground">{row.description}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <p className="uppercase tracking-wide text-muted-foreground text-[10px] font-semibold">Submitted by</p>
              <p>{row.user?.display_name || "—"}</p>
              <p className="text-muted-foreground">{row.user?.email || "—"}</p>
            </div>
            <div>
              <p className="uppercase tracking-wide text-muted-foreground text-[10px] font-semibold">Page</p>
              <p className="font-mono break-all">{row.page || "—"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="uppercase tracking-wide text-muted-foreground text-[10px] font-semibold">Browser</p>
              <p className="text-muted-foreground break-all">{row.browser_info || "—"}</p>
            </div>
          </div>

          {screenshot && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Screenshot</p>
              <a href={screenshot} target="_blank" rel="noreferrer">
                <img src={screenshot} alt="Feedback screenshot" className="rounded-lg border max-h-96 object-contain" />
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Triage</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Status</p>
            <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
              <SelectTrigger className="h-9 w-full sm:w-60"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{labelStatus(s)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">Internal notes (staff only)</p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              placeholder="Triage notes, links, follow-ups…"
            />
          </div>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Customer 360 tab — list of an org's feedback
// ───────────────────────────────────────────────────────────────────────────

export function OrgFeedbackList({ orgId }: { orgId: string }) {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const r = await fetchFeedback({ orgId });
        if (!cancel) setRows(r);
      } catch (e: any) {
        if (!cancel) toast.error(e?.message || "Failed to load");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [orgId]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquareHeart className="h-4 w-4" /> Feedback ({rows.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground p-6 text-center">No feedback submitted yet.</p>
        ) : (
          <div className="divide-y">
            {rows.map((r) => (
              <Link
                key={r.id}
                to={`/staff/feedback/${r.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
              >
                <Badge className={typeBadge[r.type] + " hover:" + typeBadge[r.type]}>{r.type}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{r.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {r.user?.display_name || r.user?.email || "Unknown"} · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </p>
                </div>
                <Badge className={statusBadge[r.status] + " hover:" + statusBadge[r.status]}>{labelStatus(r.status)}</Badge>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
