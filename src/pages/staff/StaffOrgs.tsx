import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Eye, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

interface OrgRow {
  id: string;
  name: string;
  slug: string | null;
  created_at: string;
}

export default function StaffOrgs() {
  const { isSuperAdmin } = useSuperAdmin();
  const { startImpersonation, isImpersonating } = useImpersonation();
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [impersonateOrg, setImpersonateOrg] = useState<OrgRow | null>(null);
  const [impersonateReason, setImpersonateReason] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data, error } = await sb
        .from("organisations")
        .select("id, name, slug, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) toast.error(error.message);
      setOrgs((data ?? []) as OrgRow[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter(o =>
      o.name.toLowerCase().includes(q) ||
      (o.slug ?? "").toLowerCase().includes(q) ||
      o.id.toLowerCase().includes(q)
    );
  }, [orgs, filter]);

  const start = async () => {
    if (!impersonateOrg) return;
    if (impersonateReason.trim().length < 5) {
      toast.error("Reason required (min 5 chars).");
      return;
    }
    setStarting(true);
    const res = await startImpersonation({
      organisationId: impersonateOrg.id,
      reason: impersonateReason.trim(),
    });
    setStarting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Impersonating ${impersonateOrg.name}.`);
    setImpersonateOrg(null);
    setImpersonateReason("");
    // Send the user into the customer app where they'll see the impersonation banner.
    window.location.assign("/");
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-bold">Organisations</h1>
        <p className="text-sm text-muted-foreground">
          {isSuperAdmin
            ? "Browse all customer organisations. Use impersonation for support work."
            : "Read-only directory. Sensitive actions require super admin."}
        </p>
      </div>

      <Card>
        <CardContent className="py-4">
          <Input placeholder="Filter by name, slug, or ID…" value={filter} onChange={e => setFilter(e.target.value)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{filtered.length} organisation{filtered.length === 1 ? "" : "s"}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
          ) : (
            <div className="divide-y">
              {filtered.map(o => (
                <div key={o.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{o.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {o.slug && <code className="mr-2">/{o.slug}</code>}
                      Created {format(new Date(o.created_at), "PP")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isSuperAdmin && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isImpersonating}
                          onClick={() => setImpersonateOrg(o)}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1.5" /> Impersonate
                        </Button>
                        <Link to="/admin">
                          <Button variant="ghost" size="sm">
                            Open in Admin <ArrowRight className="h-3.5 w-3.5 ml-1" />
                          </Button>
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground p-6 text-center">No organisations match.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!impersonateOrg} onOpenChange={o => !o && setImpersonateOrg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Impersonate {impersonateOrg?.name}</DialogTitle>
            <DialogDescription>
              You'll be signed in as this organisation's primary manager.
              Read-only — all writes are blocked. Auto-expires after 60 minutes.
              This action is logged.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason (required, min 5 chars) — e.g. 'Investigating ticket #1234 — cannot save recipes'"
            value={impersonateReason}
            onChange={e => setImpersonateReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setImpersonateOrg(null)}>Cancel</Button>
            <Button onClick={() => void start()} disabled={starting}>
              {starting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Start impersonation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
