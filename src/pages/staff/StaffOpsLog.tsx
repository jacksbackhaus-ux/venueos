import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert } from "lucide-react";
import { format } from "date-fns";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

interface LogRow {
  id: string;
  performed_by: string;
  action_type: string;
  target_user_id: string | null;
  target_organisation_id: string | null;
  reason: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export default function StaffOpsLog() {
  const { isSuperAdmin, loading: roleLoading } = useSuperAdmin();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!isSuperAdmin) { setLoading(false); return; }
    void (async () => {
      const { data } = await sb
        .from("admin_actions_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      setRows((data ?? []) as LogRow[]);
      setLoading(false);
    })();
  }, [isSuperAdmin]);

  if (roleLoading) return <Loader2 className="h-5 w-5 animate-spin" />;

  if (!isSuperAdmin) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-2">
          <ShieldAlert className="h-6 w-6 mx-auto text-warning" />
          <p className="text-sm">The ops audit log is restricted to platform super admins.</p>
        </CardContent>
      </Card>
    );
  }

  const filtered = filter.trim()
    ? rows.filter(r =>
        r.action_type.toLowerCase().includes(filter.toLowerCase()) ||
        r.reason.toLowerCase().includes(filter.toLowerCase()) ||
        (r.target_user_id ?? "").includes(filter) ||
        (r.target_organisation_id ?? "").includes(filter)
      )
    : rows;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-bold">Ops audit log</h1>
        <p className="text-sm text-muted-foreground">Last 200 privileged staff actions.</p>
      </div>

      <Card>
        <CardContent className="py-4">
          <Input placeholder="Filter by action, reason, or target ID…" value={filter} onChange={e => setFilter(e.target.value)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">{filtered.length} entries</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
          ) : (
            <div className="divide-y">
              {filtered.map(r => (
                <div key={r.id} className="px-4 py-3 space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Badge variant="secondary">{r.action_type}</Badge>
                    <span className="text-xs text-muted-foreground">{format(new Date(r.created_at), "PPp")}</span>
                  </div>
                  <p className="text-sm">{r.reason}</p>
                  <div className="text-[11px] text-muted-foreground font-mono space-y-0.5">
                    <div>by: {r.performed_by}</div>
                    {r.target_user_id && <div>→ user: {r.target_user_id}</div>}
                    {r.target_organisation_id && <div>→ org: {r.target_organisation_id}</div>}
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground p-6 text-center">No entries.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
