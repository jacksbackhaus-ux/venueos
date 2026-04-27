import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Thermometer, ClipboardList, SprayCan,
  MapPin, Menu, X, CalendarClock, Clock, MessageSquare,
  Wheat, Truck, Bug, AlertTriangle, Package, FileText,
  Calculator, PoundSterling, Settings, CreditCard,
  Building2, ShieldCheck, ChevronRight, Sparkles,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { useRole } from "@/hooks/useRole";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Badge } from "@/components/ui/badge";
import type { ModuleName } from "@/lib/plans";

type NavLeaf = { title: string; url: string; icon: React.ElementType; mod?: ModuleName };

const dailyOpsAll: NavLeaf[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Shifts", url: "/shifts", icon: CalendarClock, mod: "shifts" },
  { title: "Shift Hive", url: "/shift-hive", icon: Sparkles, mod: "shifts" },
  { title: "Timesheets", url: "/timesheets", icon: Clock, mod: "timesheets" },
  { title: "Messenger", url: "/messenger", icon: MessageSquare, mod: "messenger" },
  { title: "Day Sheet", url: "/day-sheet", icon: ClipboardList, mod: "day_sheet" },
  { title: "Temperatures", url: "/temperatures", icon: Thermometer, mod: "temperatures" },
  { title: "Cleaning", url: "/cleaning", icon: SprayCan, mod: "cleaning" },
];

const complianceAll: NavLeaf[] = [
  { title: "Allergens & Labels", url: "/allergens", icon: Wheat, mod: "allergens" },
  { title: "Suppliers", url: "/suppliers", icon: Truck, mod: "suppliers" },
  { title: "Pest & Maintenance", url: "/pest-maintenance", icon: Bug, mod: "pest_maintenance" },
  { title: "Incidents", url: "/incidents", icon: AlertTriangle, mod: "incidents" },
  { title: "Batch Tracking", url: "/batches", icon: Package, mod: "batch_tracking" },
];

const businessAll: NavLeaf[] = [
  { title: "Cost & Margin", url: "/cost-margin", icon: Calculator, mod: "cost_margin" },
  { title: "Tip Tracker", url: "/tip-tracker", icon: PoundSterling, mod: "tip_tracker" },
  { title: "Reports", url: "/reports", icon: FileText, mod: "reports" },
];

function MobileDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isHQ, orgRole, appUser } = useAuth();
  const { isSuperAdmin } = useSuperAdmin();
  const role = useRole();
  const { currentSite, hasSelectedSite, clearSelectedSite } = useSite();
  const { isActive: isModuleActive } = useModuleAccess();

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const visible = (items: NavLeaf[]) =>
    items.filter((i) => !i.mod || isModuleActive(i.mod));

  const isOrgOwner = orgRole?.org_role === "org_owner";

  const orgNav: NavLeaf[] = [
    ...(isHQ && role.isManager ? [{ title: "HQ Dashboard", url: "/hq", icon: Building2 }] : []),
    ...(isOrgOwner ? [{ title: "Account & Billing", url: "/account", icon: CreditCard }] : []),
    ...(role.canViewSettings ? [{ title: "Settings", url: "/settings", icon: Settings }] : []),
    ...(isSuperAdmin ? [{ title: "Super Admin", url: "/admin", icon: ShieldCheck }] : []),
  ];

  const dailyOps = hasSelectedSite ? visible(dailyOpsAll) : [];
  const compliance = hasSelectedSite ? visible(complianceAll) : [];
  const business = hasSelectedSite ? visible(businessAll) : [];

  const userInitials =
    appUser?.display_name?.trim().slice(0, 2).toUpperCase() || "MG";

  const handleNav = (url: string) => {
    navigate(url);
    onClose();
  };

  const renderGroup = (label: string, items: NavLeaf[]) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 mb-1">
          {label}
        </p>
        {items.map((item) => {
          const active = isActive(item.url);
          return (
            <button
              key={item.title}
              onClick={() => handleNav(item.url)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors mb-0.5 ${
                active
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">{item.title}</span>
              {active && <ChevronRight className="h-3 w-3 opacity-50" />}
            </button>
          );
        })}
      </div>
    );
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 left-0 bottom-0 w-72 bg-card border-r z-50 md:hidden flex flex-col overflow-hidden">
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 h-14 border-b shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-heading font-bold text-sm">MiseOS</span>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Site indicator */}
        {hasSelectedSite && currentSite && (
          <div className="px-3 pt-3 pb-1 shrink-0">
            <div className="rounded-md border border-primary/20 bg-primary/5 p-2 flex items-start gap-2">
              <MapPin className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate">{currentSite.name}</p>
                {isHQ && (
                  <button
                    onClick={() => { clearSelectedSite(); onClose(); }}
                    className="text-[10px] text-muted-foreground hover:text-foreground underline"
                  >
                    Switch site
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Nav groups */}
        <div className="flex-1 overflow-y-auto px-2 py-3">
          {renderGroup("Daily Operations", dailyOps)}
          {renderGroup("Compliance", compliance)}
          {renderGroup("Business", business)}
          {renderGroup("Organisation", orgNav)}

          {!hasSelectedSite && isHQ && (
            <p className="text-xs text-muted-foreground px-3 py-2 leading-relaxed">
              Select a site from the HQ Dashboard to view daily operations and compliance.
            </p>
          )}
        </div>

        {/* User footer */}
        <div className="border-t p-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
              {userInitials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">
                {appUser?.display_name || "Manager"}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {orgRole?.org_role === "org_owner"
                  ? "Manager"
                  : orgRole?.org_role === "hq_admin"
                  ? "HQ Admin"
                  : orgRole?.org_role === "hq_auditor"
                  ? "HQ Auditor"
                  : "Site Manager"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { currentSite, hasSelectedSite } = useSite();
  const { isHQ } = useAuth();
  const { isActive: isModuleActive } = useModuleAccess();

  const showSiteIndicator = hasSelectedSite && currentSite;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <AppSidebar />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          {/* Desktop header */}
          <header className="hidden md:flex h-12 items-center border-b bg-card px-4 shrink-0 gap-3">
            <SidebarTrigger />
            <h1 className="font-heading font-semibold text-sm text-foreground">
              MiseOS
            </h1>
            {showSiteIndicator && (
              <Badge
                variant="outline"
                className="ml-auto gap-1.5 border-primary/30 bg-primary/5 text-foreground"
              >
                <MapPin className="h-3 w-3 text-primary" />
                <span className="font-medium">{currentSite.name}</span>
                {isHQ && (
                  <span className="text-[10px] text-muted-foreground ml-1">
                    HQ view
                  </span>
                )}
              </Badge>
            )}
          </header>

          {/* Mobile header */}
          <header className="md:hidden flex h-14 items-center border-b bg-card px-4 shrink-0 gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground shrink-0"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-primary-foreground">
                V
              </span>
            </div>
            <h1 className="font-heading font-semibold text-sm text-foreground">
              MiseOS
            </h1>
            {showSiteIndicator && (
              <Badge
                variant="outline"
                className="ml-auto gap-1 border-primary/30 bg-primary/5 text-foreground max-w-[45%]"
              >
                <MapPin className="h-3 w-3 text-primary shrink-0" />
                <span className="font-medium truncate">{currentSite.name}</span>
              </Badge>
            )}
          </header>

          {/* Mobile slide-out drawer */}
          <MobileDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
          />

          {/* Main content — no bottom padding needed now */}
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
