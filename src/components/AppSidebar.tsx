import {
  LayoutDashboard, CalendarClock, Thermometer, ClipboardList, SprayCan,
  Wheat, Truck, Bug, AlertTriangle, FileText, Settings, ShieldCheck,
  Package, Building2, CreditCard, MapPin, Calculator,
} from "lucide-react";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useRole } from "@/hooks/useRole";
import { useOrgAccess } from "@/hooks/useOrgAccess";
import { TIERS } from "@/lib/tiers";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import { Button } from "@/components/ui/button";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const mainNavAll = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, mod: "dashboard" },
  { title: "Shifts & Tasks", url: "/shifts", icon: CalendarClock, mod: "shifts" },
  { title: "Temperatures", url: "/temperatures", icon: Thermometer, mod: "temperatures" },
  { title: "Day Sheet", url: "/day-sheet", icon: ClipboardList, mod: "day-sheet" },
  { title: "Cleaning", url: "/cleaning", icon: SprayCan, mod: "cleaning" },
];

const complianceNavAll: { title: string; url: string; icon: React.ElementType; mod: string; requiresReports?: boolean; managerOnly?: boolean }[] = [
  { title: "Allergens & Labels", url: "/allergens", icon: Wheat, mod: "allergens" },
  { title: "Suppliers", url: "/suppliers", icon: Truck, mod: "suppliers" },
  { title: "Pest & Maintenance", url: "/pest-maintenance", icon: Bug, mod: "pest-maintenance" },
  { title: "Incidents", url: "/incidents", icon: AlertTriangle, mod: "incidents" },
  { title: "Batch Tracking", url: "/batches", icon: Package, mod: "batches" },
  { title: "Reports", url: "/reports", icon: FileText, mod: "reports", requiresReports: true },
];

const settingsNav = [
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { isHQ, orgRole, appUser } = useAuth();
  const { isSuperAdmin } = useSuperAdmin();
  const role = useRole();
  const { currentSite, hasSelectedSite, clearSelectedSite } = useSite();
  const { tier } = useOrgAccess();

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  // Hide nav items the current tier doesn't include. (No tier yet during trial = show all.)
  const allowed = (mod: string) => !tier || TIERS[tier].allowedModules.has(mod);

  const mainNav = mainNavAll.filter((i) => allowed(i.mod));

  const isManager = orgRole?.org_role === 'org_owner' || orgRole?.org_role === 'hq_admin';

  const hqNav = [
    ...(isHQ && role.isManager && allowed("hq") ? [{ title: "HQ Dashboard", url: "/hq", icon: Building2 }] : []),
    ...(isManager && allowed("cost-margin") ? [{ title: "Cost & Margin", url: "/cost-margin", icon: Calculator }] : []),
    ...(orgRole?.org_role === 'org_owner' ? [{ title: "Account & Billing", url: "/account", icon: CreditCard }] : []),
    ...(isSuperAdmin ? [{ title: "Super Admin", url: "/admin", icon: ShieldCheck }] : []),
  ];

  const isManager = orgRole?.org_role === 'org_owner' || orgRole?.org_role === 'hq_admin';
  const complianceNav = complianceNavAll
    .filter((item) => !item.requiresReports || role.canViewReports)
    .filter((item) => !item.managerOnly || isManager)
    .filter((item) => allowed(item.mod));

  const visibleSettingsNav = role.canViewSettings ? settingsNav : [];
  const userInitials = appUser?.display_name?.trim().slice(0, 2).toUpperCase() || "MG";

  // HQ users without an explicitly selected site only see HQ Dashboard + Account.
  const showSiteSections = hasSelectedSite;

  const renderItems = (items: { title: string; url: string; icon: React.ElementType }[]) =>
    items.map((item) => (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild isActive={isActive(item.url)}>
          <NavLink
            to={item.url}
            end={item.url === "/"}
            className="hover:bg-sidebar-accent/50"
            activeClassName="bg-sidebar-accent text-primary font-semibold"
          >
            <item.icon className="mr-2 h-4 w-4 shrink-0" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <ShieldCheck className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h2 className="font-heading font-bold text-sm text-sidebar-foreground truncate">
                VenueOS
              </h2>
              <p className="text-[10px] text-muted-foreground truncate">Food Safety Platform</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {hqNav.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Organisation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{renderItems(hqNav)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {showSiteSections && currentSite && !collapsed && (
          <SidebarGroup>
            <SidebarGroupLabel>Viewing Site</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="mx-2 rounded-md border border-primary/20 bg-primary/5 p-2 flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground truncate">{currentSite.name}</p>
                  {isHQ && (
                    <button
                      onClick={clearSelectedSite}
                      className="text-[10px] text-muted-foreground hover:text-foreground underline mt-0.5"
                    >
                      Switch site
                    </button>
                  )}
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {showSiteSections && (
          <>
            <SidebarGroup>
              <SidebarGroupLabel>Daily Operations</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>{renderItems(mainNav)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Compliance</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>{renderItems(complianceNav)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {visibleSettingsNav.length > 0 && (
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>{renderItems(visibleSettingsNav)}</SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </>
        )}

        {!showSiteSections && isHQ && (
          <SidebarGroup>
            <SidebarGroupContent>
              <p className="text-[11px] text-muted-foreground px-3 py-2 leading-relaxed">
                Select a site from the HQ Dashboard to view daily operations and compliance.
              </p>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
              {userInitials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground truncate">
                {appUser?.display_name || 'Manager'}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {orgRole?.org_role === 'org_owner' ? 'Manager' :
                 orgRole?.org_role === 'hq_admin' ? 'HQ Admin' :
                 orgRole?.org_role === 'hq_auditor' ? 'HQ Auditor' : 'Site Manager'}
              </p>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
