import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Loader2, Building2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

interface AssignedOrg {
  organisation_id: string;
  name: string;
  slug: string | null;
  access_level: string;
  granted_at: string | null;
  expires_at: string | null;
  is_super_admin_view: boolean;
}

/**
 * Lists organisations the current internal staff member is assigned to.
 * - Super admins: all orgs (server-side bypass via has_staff_access_to_org).
 * - Regular internal staff: only orgs with an active staff_org_access row.
 *
 * Uses the SECURITY DEFINER RPC `staff_list_assigned_orgs()` so we don't
 * have to widen RLS on the organisations table.
 */
export default function StaffOrgs() {
  const { isSuperAdmin } = useSuperAdmin();
  const [orgs, setOrgs] = useState<AssignedOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data, error } = await sb.rpc("staff_list_assigned_orgs");
      if (error) {
        toast.error(error.message);
        setOrgs([]);
      } else {
        setOrgs((data ?? []) as AssignedOrg[]);
      }
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter(o =>
      o.name.toLowerCase().includes(q) ||
      (o.slug ?? "").toLowerCase().includes(q) ||
      o.organisation_id.toLowerCase().includes(q)
    );
  }, [orgs, filter]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-bold">Assigned Tenants</h1>
        <p className="text-sm text-muted-foreground">
          You can only access tenants you've been explicitly assigned to.
          {isSuperAdmin
            ? " As a super admin you can self-assign on the Access page."
            : " Ask a super admin to grant you access on the Access page."}
        </p>
      </div>

      <Card>
        <CardContent className="py-4">
          <Input
            placeholder="Filter tenants by name, slug, or ID…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            {filtered.length} tenant{filtered.length === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center">
              <Loader2 className="h-5 w-5 animate-spin inline" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <Building2 className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm font-medium">No tenants assigned</p>
              <p className="text-xs text-muted-foreground">
                A super admin needs to grant you access to specific tenants on the Access page.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map(o => (
                <div key={o.organisation_id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{o.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {o.slug && <code className="mr-2">/{o.slug}</code>}
                      {o.is_super_admin_view ? (
                        <Badge variant="outline" className="ml-1 text-[10px]">
                          <ShieldCheck className="h-2.5 w-2.5 mr-1" /> super admin
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="ml-1 text-[10px]">
                          {o.access_level}
                        </Badge>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link to={`/staff/org/${o.organisation_id}`}>
                      <Button variant="outline" size="sm">
                        Open <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
