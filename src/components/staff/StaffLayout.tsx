import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, Building2, FileClock, Database, ArrowLeft, Wrench, ShieldCheck, LogOut, MessageSquareHeart,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { to: "/staff", end: true, label: "Dashboard", icon: LayoutDashboard },
  { to: "/staff/users", label: "Users", icon: Users },
  { to: "/staff/orgs", label: "Tenants", icon: Building2 },
  { to: "/staff/feedback", label: "Feedback", icon: MessageSquareHeart, showBadge: true },
  { to: "/staff/access", label: "Access", icon: ShieldCheck, requiresSuperAdmin: true },
  { to: "/staff/ops", label: "Ops Log", icon: FileClock, requiresSuperAdmin: true },
  { to: "/staff/migrations", label: "Migrations", icon: Database },
];

export function StaffLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isSuperAdmin } = useSuperAdmin();
  const { appUser } = useAuth();
  const hasCustomerProfile = !!appUser;
  const [newFeedback, setNewFeedback] = useState<number>(0);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { count } = await (supabase as any)
        .from("feedback")
        .select("id", { count: "exact", head: true })
        .eq("status", "new");
      if (!cancel) setNewFeedback(count || 0);
    })();
    return () => { cancel = true; };
  }, [pathname]);

  const handleExit = async () => {
    if (hasCustomerProfile) {
      navigate("/");
    } else {
      await supabase.auth.signOut();
      navigate("/auth", { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Top bar — visually distinct from customer app */}
      <header className="sticky top-0 z-30 bg-foreground text-background border-b border-foreground/40">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Wrench className="h-4 w-4" />
            <span className="font-heading font-semibold text-sm tracking-wide">
              MiseOS Staff Console
            </span>
            <span className="hidden sm:inline-flex items-center text-[10px] uppercase tracking-widest bg-warning/20 text-warning px-2 py-0.5 rounded">
              Internal
            </span>
          </div>
          <button
            type="button"
            onClick={handleExit}
            className="text-xs flex items-center gap-1 hover:underline opacity-80 hover:opacity-100"
          >
            {hasCustomerProfile ? <ArrowLeft className="h-3 w-3" /> : <LogOut className="h-3 w-3" />}
            {hasCustomerProfile ? "Exit to customer app" : "Sign out"}
          </button>
        </div>
        <nav className="max-w-7xl mx-auto px-2 flex gap-1 overflow-x-auto">
          {NAV.filter(item => !item.requiresSuperAdmin || isSuperAdmin).map(item => {
            const active = item.end ? pathname === item.to : pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap",
                  active
                    ? "border-background text-background"
                    : "border-transparent text-background/60 hover:text-background hover:border-background/30",
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
                {item.showBadge && newFeedback > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center rounded-full bg-amber-400 text-foreground text-[10px] font-bold h-4 min-w-4 px-1">
                    {newFeedback}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
