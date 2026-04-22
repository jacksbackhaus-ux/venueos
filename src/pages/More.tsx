import { Link } from "react-router-dom";
import {
  Calendar,
  Wheat,
  Truck,
  Bug,
  AlertTriangle,
  Package,
  FileBarChart,
  Building2,
  User,
  Settings as SettingsIcon,
  Shield,
  ChevronRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useRole } from "@/hooks/useRole";

type NavItem = { to: string; label: string; desc: string; icon: React.ElementType; requires?: 'reports' | 'settings' | 'billing' };

const items: NavItem[] = [
  { to: "/shifts", label: "Shifts", desc: "Assign staff & shift tasks", icon: Calendar },
  { to: "/allergens", label: "Allergens & Recipes", desc: "Recipes, ingredients, PPDS labels", icon: Wheat },
  { to: "/suppliers", label: "Suppliers & Deliveries", desc: "Approved suppliers and delivery logs", icon: Truck },
  { to: "/pest-maintenance", label: "Pest & Maintenance", desc: "Pest sightings and maintenance jobs", icon: Bug },
  { to: "/incidents", label: "Incidents", desc: "Report and investigate non-conformances", icon: AlertTriangle },
  { to: "/batches", label: "Batches", desc: "Production batch traceability", icon: Package },
  { to: "/reports", label: "Reports", desc: "Inspection-ready exports", icon: FileBarChart, requires: 'reports' },
];

const accountItems: NavItem[] = [
  { to: "/account", label: "Account", desc: "Subscription & billing", icon: User, requires: 'billing' },
  { to: "/settings", label: "Settings", desc: "Site, users, modules", icon: SettingsIcon, requires: 'settings' },
];

export default function More() {
  const { isHQ, orgRole } = useAuth();
  const { isSuperAdmin } = useSuperAdmin();
  const role = useRole();

  const allowed = (req?: NavItem['requires']) => {
    if (!req) return true;
    if (req === 'reports') return role.canViewReports;
    if (req === 'settings') return role.canViewSettings;
    if (req === 'billing') return role.canManageBilling;
    return false;
  };

  const visibleItems = items.filter((i) => allowed(i.requires));
  const visibleAccount = accountItems.filter((i) => allowed(i.requires));

  return (
    <div className="p-4 space-y-5 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-heading font-bold text-foreground">More</h1>
        <p className="text-sm text-muted-foreground">All modules and settings</p>
      </div>

      {visibleItems.length > 0 && <Section title="Modules" items={visibleItems} />}

      {(isHQ || orgRole) && role.isManager && (
        <Section
          title="Organisation"
          items={[{ to: "/hq", label: "HQ Dashboard", desc: "Multi-site overview", icon: Building2 }]}
        />
      )}

      {visibleAccount.length > 0 && <Section title="Account & Settings" items={visibleAccount} />}

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
  title,
  items,
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
