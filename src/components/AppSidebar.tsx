import {
  LayoutDashboard, CalendarClock, Thermometer, ClipboardList, SprayCan,
  Wheat, Truck, Bug, AlertTriangle, FileText, Settings, ShieldCheck,
  Package, Building2, CreditCard,
} from "lucide-react";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useRole } from "@/hooks/useRole";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const mainNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Shifts & Tasks", url: "/shifts", icon: CalendarClock },
  { title: "Temperatures", url: "/temperatures", icon: Thermometer },
  { title: "Day Sheet", url: "/day-sheet", icon: ClipboardList },
  { title: "Cleaning", url: "/cleaning", icon: SprayCan },
];

const complianceNavAll: { title: string; url: string; icon: React.ElementType; requiresReports?: boolean }[] = [
  { title: "Allergens & Labels", url: "/allergens", icon: Wheat },
  { title: "Suppliers", url: "/suppliers", icon: Truck },
  { title: "Pest & Maintenance", url: "/pest-maintenance", icon: Bug },
  { title: "Incidents", url: "/incidents", icon: AlertTriangle },
  { title: "Batch Tracking", url: "/batches", icon: Package },
  { title: "Reports", url: "/reports", icon: FileText, requiresReports: true },
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

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const hqNav = [
    ...(isHQ && role.isManager ? [{ title: "HQ Dashboard", url: "/hq", icon: Building2 }] : []),
    ...(orgRole?.org_role === 'org_owner' ? [{ title: "Account & Billing", url: "/account", icon: CreditCard }] : []),
    ...(isSuperAdmin ? [{ title: "Super Admin", url: "/admin", icon: ShieldCheck }] : []),
  ];

  const complianceNav = complianceNavAll.filter(
    (item) => !item.requiresReports || role.canViewReports
  );

  const visibleSettingsNav = role.canViewSettings ? settingsNav : [];

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
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
              {appUser?.display_name?.substring(0, 2).toUpperCase() || 'MG'}
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
