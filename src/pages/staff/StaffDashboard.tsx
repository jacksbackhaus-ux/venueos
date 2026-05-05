import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useInternalStaff } from "@/hooks/useInternalStaff";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Building2, FileClock, Database, ShieldCheck, Loader2 } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

interface Stats {
  totalOrgs: number;
  trialing: number;
  paying: number;
  comped: number;
  newSignups30d: number;
}

export default function StaffDashboard() {
  const { appUser, user } = useAuth();
  const { isSuperAdmin } = useSuperAdmin();
  const { roles } = useInternalStaff();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      // Stats only available to super admins (RLS on subscriptions/organisations).
      // Non-super-admin staff see a slimmed-down dashboard.
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

      <div className="grid md:grid-cols-2 gap-4">
        <ToolCard to="/staff/users" icon={Users} title="Users tool"
          desc="Search users by email or name. View profiles, memberships, and trigger password reset links." />
        <ToolCard to="/staff/orgs" icon={Building2} title="Organisations tool"
          desc="Browse all organisations, open detail pages, and (super admin) start impersonation." />
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
