import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useInternalStaff } from "@/hooks/useInternalStaff";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Building2, FileClock, Database, ShieldCheck, Loader2, ArrowRight, Search, X } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

interface Stats {
  totalOrgs: number;
  trialing: number;
  paying: number;
  comped: number;
  newSignups30d: number;
}

interface AssignedOrg {
  organisation_id: string;
  name: string;
  slug: string | null;
  access_level: string;
  is_super_admin_view: boolean;
}

export default function StaffDashboard() {
  const { appUser, user } = useAuth();
  const { isSuperAdmin } = useSuperAdmin();
  const { roles } = useInternalStaff();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [assigned, setAssigned] = useState<AssignedOrg[]>([]);
  const [assignedLoading, setAssignedLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");

  // Distinct access levels present in the user's assigned list (for the filter dropdown).
  const availableLevels = useMemo(() => {
    const set = new Set(assigned.map(o => (o.is_super_admin_view ? "super_admin" : o.access_level)));
    return Array.from(set).sort();
  }, [assigned]);

  // Filter by name / slug / ID and by access level.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assigned.filter(o => {
      if (levelFilter !== "all") {
        const lvl = o.is_super_admin_view ? "super_admin" : o.access_level;
        if (lvl !== levelFilter) return false;
      }
      if (!q) return true;
      return (
        o.name.toLowerCase().includes(q) ||
        (o.slug ?? "").toLowerCase().includes(q) ||
        o.organisation_id.toLowerCase().includes(q)
      );
    });
  }, [assigned, query, levelFilter]);

  useEffect(() => {
    void (async () => {
      // Always fetch assigned orgs — this is the staff home view.
      const { data: orgs, error: orgsErr } = await sb.rpc("staff_list_assigned_orgs");
      if (!orgsErr) setAssigned((orgs ?? []) as AssignedOrg[]);
      setAssignedLoading(false);

      if (!isSuperAdmin) {
        setLoading(false);
        return;
      }
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const [orgsRes, subsRes, recentRes] = await Promise.all([
        sb.from("organisations").select("id", { count: "exact", head: true }),
        sb.from("subscriptions").select("status, is_comped"),
        sb.from("organisations").select("id", { count: "exact", head: true }).gte("created_at", since),
      ]);
      const subs = (subsRes.data ?? []) as { status: string; is_comped: boolean }[];
      setStats({
        totalOrgs: orgsRes.count ?? 0,
        trialing: subs.filter(s => s.status === "trialing").length,
        paying: subs.filter(s => s.status === "active" && !s.is_comped).length,
        comped: subs.filter(s => s.is_comped).length,
        newSignups30d: recentRes.count ?? 0,
      });
      setLoading(false);
    })();
  }, [isSuperAdmin]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Welcome, {appUser?.display_name ?? "Staff"}</h1>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {isSuperAdmin && (
            <Badge variant="secondary" className="gap-1">
              <ShieldCheck className="h-3 w-3" /> Platform Super Admin
            </Badge>
          )}
          {roles.map(r => (
            <Badge key={r.role} variant="outline" className="capitalize">
              Internal: {r.role}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Signed in as <code>{user?.email ?? user?.id}</code>
        </p>
      </div>

      {isSuperAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Total orgs" value={stats?.totalOrgs} loading={loading} />
          <StatCard label="Trialing" value={stats?.trialing} loading={loading} />
          <StatCard label="Paying" value={stats?.paying} loading={loading} />
          <StatCard label="Comped" value={stats?.comped} loading={loading} />
          <StatCard label="New (30d)" value={stats?.newSignups30d} loading={loading} />
        </div>
      )}

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            {isSuperAdmin ? "All organisations" : "Your assigned organisations"}
            {!assignedLoading && (
              <span className="text-xs font-normal text-muted-foreground">({assigned.length})</span>
            )}
          </CardTitle>
          <Link to="/staff/orgs">
            <Button variant="ghost" size="sm" className="text-xs">
              View all <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {assignedLoading ? (
            <div className="p-6 text-center"><Loader2 className="h-5 w-5 animate-spin inline text-muted-foreground" /></div>
          ) : assigned.length === 0 ? (
            <div className="p-6 text-center space-y-1">
              <p className="text-sm font-medium">No organisations assigned yet</p>
              <p className="text-xs text-muted-foreground">
                Ask a platform super admin to grant you access to specific organisations.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {assigned.slice(0, 8).map(o => (
                <Link key={o.organisation_id} to={`/staff/org/${o.organisation_id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{o.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {o.slug && <code className="mr-2">/{o.slug}</code>}
                      <Badge variant={o.is_super_admin_view ? "outline" : "secondary"} className="text-[10px]">
                        {o.is_super_admin_view ? "super admin" : o.access_level}
                      </Badge>
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              ))}
              {assigned.length > 8 && (
                <Link to="/staff/orgs" className="block text-center py-2 text-xs text-primary hover:underline">
                  + {assigned.length - 8} more
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <ToolCard to="/staff/users" icon={Users} title="Users tool"
          desc="Search users by email or name. View profiles, memberships, and trigger password reset links." />
        <ToolCard to="/staff/orgs" icon={Building2} title="Organisations tool"
          desc="Browse organisations you're assigned to and (super admin) start impersonation." />
        {isSuperAdmin && (
          <ToolCard to="/staff/ops" icon={FileClock} title="Ops audit log"
            desc="Every privileged staff action with reason, actor, and target." />
        )}
        <ToolCard to="/staff/migrations" icon={Database} title="Migrations status"
          desc="Read-only view of applied database migrations. No execution from this UI." />
      </div>
    </div>
  );
}

function StatCard({ label, value, loading }: { label: string; value?: number; loading: boolean }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="font-heading text-2xl font-bold mt-1">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (value ?? "—")}
        </p>
      </CardContent>
    </Card>
  );
}

function ToolCard({ to, icon: Icon, title, desc }: { to: string; icon: React.ElementType; title: string; desc: string }) {
  return (
    <Link to={to}>
      <Card className="hover:border-primary/40 transition-colors h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" /> {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{desc}</CardContent>
      </Card>
    </Link>
  );
}
