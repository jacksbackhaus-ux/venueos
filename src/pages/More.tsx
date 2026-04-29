import { Link } from "react-router-dom";
import {
  Calendar, Wheat, Truck, Bug, AlertTriangle, Package, FileBarChart,
  Calculator, Building2, User, Settings as SettingsIcon, Shield,
  ChevronRight, Clock, MessageSquare, Thermometer, ClipboardList,
  SprayCan, PoundSterling, Trash2, GraduationCap, BookCheck,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useSite } from "@/contexts/SiteContext";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useRole } from "@/hooks/useRole";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import type { ModuleName } from "@/lib/plans";

type NavItem = { to: string; label: string; desc: string; icon: React.ElementType; mod?: ModuleName };

const dailyOps: NavItem[] = [
  { to: "/shifts", label: "Shifts", desc: "Assign staff & shift tasks", icon: Calendar, mod: "shifts" },
  { to: "/timesheets", label: "Timesheets", desc: "Hours & payroll prep", icon: Clock, mod: "timesheets" },
  { to: "/messenger", label: "Messenger", desc: "Team chat", icon: MessageSquare, mod: "messenger" },
  { to: "/day-sheet", label: "Day Sheet", desc: "Opening & closing checks", icon: ClipboardList, mod: "day_sheet" },
  { to: "/temperatures", label: "Temperatures", desc: "Fridge/freezer logs", icon: Thermometer, mod: "temperatures" },
  { to: "/cleaning", label: "Cleaning", desc: "Daily cleaning schedule", icon: SprayCan, mod: "cleaning" },
  { to: "/waste-log", label: "Waste Log", desc: "Track food waste & cost", icon: Trash2, mod: "waste_log" },
];

const compliance: NavItem[] = [
  { to: "/allergens", label: "Allergens & Labels", desc: "Recipes, ingredients, PPDS labels", icon: Wheat, mod: "allergens" },
  { to: "/suppliers", label: "Suppliers & Deliveries", desc: "Approved suppliers and delivery logs", icon: Truck, mod: "suppliers" },
  { to: "/pest-maintenance", label: "Pest & Maintenance", desc: "Pest sightings and maintenance jobs", icon: Bug, mod: "pest_maintenance" },
  { to: "/incidents", label: "Incidents", desc: "Report and investigate non-conformances", icon: AlertTriangle, mod: "incidents" },
  { to: "/batches", label: "Batch Tracking", desc: "Production batch traceability", icon: Package, mod: "batch_tracking" },
  { to: "/staff-training", label: "Staff Training", desc: "Records, certificates & expiries", icon: GraduationCap, mod: "staff_training" },
  { to: "/haccp", label: "HACCP Plan", desc: "Build and publish HACCP plans", icon: BookCheck, mod: "haccp" },
];

const business: NavItem[] = [
  { to: "/cost-margin", label: "Cost & Margin", desc: "Recipe costing and margin analysis", icon: Calculator, mod: "cost_margin" },
  { to: "/tip-tracker", label: "Tip Tracker", desc: "Track and split staff tips", icon: PoundSterling, mod: "tip_tracker" },
  { to: "/reports", label: "Reports", desc: "Inspection-ready exports", icon: FileBarChart, mod: "reports" },
];

export default function More() {
  const { isHQ, orgRole } = useAuth();
  const { hasSelectedSite } = useSite();
  const { isSuperAdmin } = useSuperAdmin();
  const role = useRole();
  const { isActive: isModuleActive } = useModuleAccess();

  const filterByModule = (items: NavItem[]) =>
    items.filter(i => !i.mod || isModuleActive(i.mod));

  const visibleDaily = hasSelectedSite ? filterByModule(dailyOps) : [];
  const visibleCompliance = hasSelectedSite ? filterByModule(compliance) : [];
  const visibleBusiness = hasSelectedSite ? filterByModule(business) : [];

  const isOrgOwner = orgRole?.org_role === "org_owner";
  const orgItems: NavItem[] = [
    ...((isHQ && role.isManager)
      ? [{ to: "/hq", label: "All Sites Overview", desc: "Compliance across all locations", icon: Building2 }]
      : []),
    ...(isOrgOwner
      ? [{ to: "/account", label: "Account & Billing", desc: "Subscription & invoices", icon: User }]
      : []),
    ...(role.canViewSettings && hasSelectedSite
      ? [{ to: "/settings", label: "Settings", desc: "Site, users, modules", icon: SettingsIcon }]
      : []),
  ];

  return (
    <div className="p-4 space-y-5 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-heading font-bold text-foreground">More</h1>
        <p className="text-sm text-muted-foreground">All modules and settings</p>
      </div>

      {visibleDaily.length > 0 && <Section title="Daily Operations" items={visibleDaily} />}
      {visibleCompliance.length > 0 && <Section title="Compliance" items={visibleCompliance} />}
      {visibleBusiness.length > 0 && <Section title="Business" items={visibleBusiness} />}
      {orgItems.length > 0 && <Section title="Organisation" items={orgItems} />}

      {isSuperAdmin && (
        <Section
          title="Super admin"
          items={[{ to: "/admin", label: "Admin", desc: "Platform administration", icon: Shield }]}
        />
      )}
    </div>
  );
}

function Section({
  title, items,
}: {
  title: string;
  items: { to: string; label: string; desc: string; icon: React.ElementType }[];
}) {
  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">{title}</h2>
      <div className="space-y-2">
        {items.map((item) => (
          <Link key={item.to} to={item.to}>
            <Card className="p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors active:scale-[0.99]">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
