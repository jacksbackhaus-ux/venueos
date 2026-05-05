import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Search, KeyRound, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

interface UserRow {
  id: string;
  auth_user_id: string | null;
  organisation_id: string;
  display_name: string;
  email: string | null;
  auth_type: string;
  status: string;
  last_login_at: string | null;
  created_at: string;
  organisation?: { name: string; slug: string | null } | null;
}

export default function StaffUsers() {
  const { isSuperAdmin } = useSuperAdmin();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetReason, setResetReason] = useState("");
  const [resetting, setResetting] = useState(false);

  const search = async () => {
    setLoading(true);
    const q = query.trim();
    let req = sb
      .from("users")
      .select("id, auth_user_id, organisation_id, display_name, email, auth_type, status, last_login_at, created_at, organisation:organisations(name, slug)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (q.length) {
      // ilike OR
      req = req.or(`email.ilike.%${q}%,display_name.ilike.%${q}%,id.eq.${isUuid(q) ? q : "00000000-0000-0000-0000-000000000000"}`);
    }
    const { data, error } = await req;
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setUsers((data ?? []) as UserRow[]);
  };

  useEffect(() => {
    void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendPasswordReset = async () => {
    if (!selected) return;
    if (resetReason.trim().length < 5) {
      toast.error("Please provide a reason (min 5 chars).");
      return;
    }
    if (!selected.email) {
      toast.error("This user has no email (staff-code-only). Use a different recovery method.");
      return;
    }
    setResetting(true);
    const { data, error } = await supabase.functions.invoke("staff-admin-action", {
      body: {
        action: "send_password_reset",
        target_user_id: selected.id,
        reason: resetReason.trim(),
      },
    });
    setResetting(false);
    if (error || (data && (data as { error?: string }).error)) {
      toast.error(error?.message || (data as { error?: string }).error || "Failed to send reset link.");
      return;
    }
    toast.success("Password reset link sent.");
    setResetOpen(false);
    setResetReason("");
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-bold">Users</h1>
        <p className="text-sm text-muted-foreground">Search by email, display name, or user_id (UUID).</p>
      </div>

      <Card>
        <CardContent className="py-4 flex gap-2">
          <Input
            placeholder="Search users…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") void search(); }}
          />
          <Button onClick={() => void search()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">Search</span>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{users.length} result{users.length === 1 ? "" : "s"}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {users.map(u => (
              <button
                key={u.id}
                onClick={() => setSelected(u)}
                className="w-full text-left px-4 py-3 hover:bg-muted/50 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{u.display_name || "(no name)"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {u.email || `staff code · ${u.auth_type}`} · {u.organisation?.name ?? "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={u.status === "active" ? "secondary" : "destructive"}>{u.status}</Badge>
                  <Badge variant="outline">{u.auth_type}</Badge>
                </div>
              </button>
            ))}
            {!loading && users.length === 0 && (
              <p className="text-sm text-muted-foreground p-6 text-center">No users found.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">{selected?.display_name}</DialogTitle>
            <DialogDescription>{selected?.email ?? "Staff code account"}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <Row label="User ID" value={selected.id} mono />
              <Row label="Auth user ID" value={selected.auth_user_id ?? "—"} mono />
              <Row label="Organisation" value={selected.organisation?.name ?? "—"} />
              <Row label="Auth type" value={selected.auth_type} />
              <Row label="Status" value={selected.status} />
              <Row label="Last login" value={selected.last_login_at ? format(new Date(selected.last_login_at), "PPp") : "Never"} />
              <Row label="Created" value={format(new Date(selected.created_at), "PPp")} />

              <div className="pt-3 border-t flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setResetOpen(true)}
                  disabled={!selected.email}
                >
                  <KeyRound className="h-3.5 w-3.5 mr-2" />
                  Send password reset link
                </Button>
                {!isSuperAdmin && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" />
                    Some destructive actions require super admin.
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send password reset link</DialogTitle>
            <DialogDescription>
              An email will be sent to <code>{selected?.email}</code>. This action is logged.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason (required, min 5 chars) — e.g. 'Customer requested via support ticket #1234'"
            value={resetReason}
            onChange={e => setResetReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button onClick={() => void sendPasswordReset()} disabled={resetting}>
              {resetting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Send reset link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`col-span-2 text-sm break-all ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
