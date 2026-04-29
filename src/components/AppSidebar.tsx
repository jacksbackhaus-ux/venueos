import {
  LayoutDashboard, CalendarClock, Thermometer, ClipboardList, SprayCan,
  Wheat, Truck, Bug, AlertTriangle, FileText, Settings, ShieldCheck,
  Package, Building2, CreditCard, MapPin, Calculator, Clock, MessageSquare,
  PoundSterling, Sparkles, Trash2, GraduationCap,
} from "lucide-react";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useRole } from "@/hooks/useRole";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import type { ModuleName } from "@/lib/plans";

type NavLeaf = { title: string; url: string; icon: React.ElementType; mod?: ModuleName };

// Daily Operations: Dashboard always visible; module-gated items follow
const dailyOpsAll: NavLeaf[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard }, // always visible
  { title: "Shifts", url: "/shifts", icon: CalendarClock, mod: "shifts" },
  { title: "Shift Hive", url: "/shift-hive", icon: Sparkles, mod: "shifts" },
  { title: "Timesheets", url: "/timesheets", icon: Clock, mod: "timesheets" },
  { title: "Messenger", url: "/messenger", icon: MessageSquare, mod: "messenger" },
  { title: "Day Sheet", url: "/day-sheet", icon: ClipboardList, mod: "day_sheet" },
  { title: "Temperatures", url: "/temperatures", icon: Thermometer, mod: "temperatures" },
  { title: "Cleaning", url: "/cleaning", icon: SprayCan, mod: "cleaning" },
  { title: "Waste Log", url: "/waste-log", icon: Trash2, mod: "waste_log" },
];

const complianceAll: NavLeaf[] = [
  { title: "Allergens & Labels", url: "/allergens", icon: Wheat, mod: "allergens" },
  { title: "Suppliers", url: "/suppliers", icon: Truck, mod: "suppliers" },
  { title: "Pest & Maintenance", url: "/pest-maintenance", icon: Bug, mod: "pest_maintenance" },
  { title: "Incidents", url: "/incidents", icon: AlertTriangle, mod: "incidents" },
  { title: "Batch Tracking", url: "/batches", icon: Package, mod: "batch_tracking" },
  { title: "Staff Training", url: "/staff-training", icon: GraduationCap, mod: "staff_training" },
];

const businessAll: NavLeaf[] = [
  { title: "Cost & Margin", url: "/cost-margin", icon: Calculator, mod: "cost_margin" },
  { title: "Tip Tracker", url: "/tip-tracker", icon: PoundSterling, mod: "tip_tracker" },
  { title: "Reports", url: "/reports", icon: FileText, mod: "reports" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { isHQ, orgRole, appUser } = useAuth();
  const { isSuperAdmin } = useSuperAdmin();
  const role = useRole();
  const { currentSite, hasSelectedSite, clearSelectedSite } = useSite();
  const { isActive: isModuleActive } = useModuleAccess();

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  // Filter helper — module items only render if active for current site.
  const visible = (items: NavLeaf[]) => items.filter(i => !i.mod || isModuleActive(i.mod));

  // Always-visible items for org_owner / hq_admin
  const isOrgManager = orgRole?.org_role === "org_owner" || orgRole?.org_role === "hq_admin";
  const isOrgOwner = orgRole?.org_role === "org_owner";

  const orgNav: NavLeaf[] = [
    ...(isHQ && role.isManager ? [{ title: "All Sites Overview", url: "/hq", icon: Building2 }] : []),
    ...(isOrgOwner ? [{ title: "Account & Billing", url: "/account", icon: CreditCard }] : []),
    ...(role.canViewSettings ? [{ title: "Settings", url: "/settings", icon: Settings }] : []),
    ...(isSuperAdmin ? [{ title: "Super Admin", url: "/admin", icon: ShieldCheck }] : []),
  ];

  const dailyOps = hasSelectedSite ? visible(dailyOpsAll) : [];
  const compliance = hasSelectedSite ? visible(complianceAll) : [];
  const business = hasSelectedSite ? visible(businessAll) : [];

  const userInitials = appUser?.display_name?.trim().slice(0, 2).toUpperCase() || "MG";

  const renderItems = (items: NavLeaf[]) =>
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
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <ShieldCheck className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h2 className="font-heading font-bold text-sm text-sidebar-foreground truncate">MiseOS</h2>
              <p className="text-[10px] text-muted-foreground truncate">Food Safety Platform</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {hasSelectedSite && currentSite && !collapsed && (
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

        {dailyOps.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Daily Operations</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{renderItems(dailyOps)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {compliance.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Compliance</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{renderItems(compliance)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {business.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Business</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{renderItems(business)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {orgNav.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Organisation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{renderItems(orgNav)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {!hasSelectedSite && isHQ && (
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
