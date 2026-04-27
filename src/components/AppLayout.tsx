import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, CalendarClock, MessageSquare, ShieldCheck,
  MoreHorizontal, MapPin, X, Wheat, Truck, Bug, AlertTriangle,
  Package, Calculator, PoundSterling, FileText, Settings,
  CreditCard, Building2, Clock, ClipboardList, Thermometer,
  SprayCan, Sparkles, ChevronRight, Plus, ChevronDown, Check,
} from "lucide-react";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { useRole } from "@/hooks/useRole";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ModuleName } from "@/lib/plans";

type NavLeaf = {
  title: string;
  url: string;
  icon: React.ElementType;
  mod?: ModuleName;
  desc?: string;
};

// ─── Nav data ─────────────────────────────────────────────────────────────────

const operationsItems: NavLeaf[] = [
  { title: "Shifts", url: "/shifts", icon: CalendarClock, mod: "shifts", desc: "Staff rota" },
  { title: "Shift Hive", url: "/shift-hive", icon: Sparkles, mod: "shifts", desc: "Swaps & cover" },
  { title: "Timesheets", url: "/timesheets", icon: Clock, mod: "timesheets", desc: "Hours & payroll" },
  { title: "Day Sheet", url: "/day-sheet", icon: ClipboardList, mod: "day_sheet", desc: "Opening & closing" },
  { title: "Temperatures", url: "/temperatures", icon: Thermometer, mod: "temperatures", desc: "Fridge/freezer logs" },
  { title: "Cleaning", url: "/cleaning", icon: SprayCan, mod: "cleaning", desc: "Cleaning schedule" },
];

const complianceItems: NavLeaf[] = [
  { title: "Allergens & Labels", url: "/allergens", icon: Wheat, mod: "allergens", desc: "Recipes & PPDS labels" },
  { title: "Suppliers", url: "/suppliers", icon: Truck, mod: "suppliers", desc: "Deliveries & suppliers" },
  { title: "Pest & Maintenance", url: "/pest-maintenance", icon: Bug, mod: "pest_maintenance", desc: "Sightings & jobs" },
  { title: "Incidents", url: "/incidents", icon: AlertTriangle, mod: "incidents", desc: "Non-conformances" },
  { title: "Batch Tracking", url: "/batches", icon: Package, mod: "batch_tracking", desc: "Production traceability" },
];

const businessItems: NavLeaf[] = [
  { title: "Cost & Margin", url: "/cost-margin", icon: Calculator, mod: "cost_margin", desc: "Recipe costing" },
  { title: "Tip Tracker", url: "/tip-tracker", icon: PoundSterling, mod: "tip_tracker", desc: "Staff tip distribution" },
  { title: "Reports", url: "/reports", icon: FileText, mod: "reports", desc: "EHO-ready exports" },
];

const quickActions = [
  { title: "Log a temp", url: "/temperatures", icon: Thermometer, color: "bg-blue-500" },
  { title: "Day sheet", url: "/day-sheet", icon: ClipboardList, color: "bg-green-500" },
  { title: "Report incident", url: "/incidents", icon: AlertTriangle, color: "bg-red-500" },
  { title: "Log delivery", url: "/suppliers", icon: Truck, color: "bg-orange-500" },
];

// ─── Site switcher bottom sheet ───────────────────────────────────────────────

function SiteSwitcherSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { sites, currentSite, setCurrentSiteId } = useSite();
  const navigate = useNavigate();

  const handleSelect = (siteId: string) => {
    setCurrentSiteId(siteId);
    navigate("/");
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50 md:hidden" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-[60] md:hidden bg-card rounded-t-2xl shadow-2xl">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <p className="font-heading font-bold text-base">Switch Site</p>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-full bg-muted text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-3 py-2 pb-10 max-h-[50vh] overflow-y-auto">
          {sites.map((site) => {
            const isSelected = site.id === currentSite?.id;
            return (
              <button
                key={site.id}
                onClick={() => handleSelect(site.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-left transition-colors mb-1",
                  isSelected ? "bg-primary/10" : "hover:bg-muted"
                )}
              >
                <div
                  className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                    isSelected ? "bg-primary/20" : "bg-muted"
                  )}
                >
                  <MapPin
                    className={cn(
                      "h-5 w-5",
                      isSelected ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      isSelected ? "text-primary" : "text-foreground"
                    )}
                  >
                    {site.name}
                  </p>
                  {site.address && (
                    <p className="text-xs text-muted-foreground truncate">
                      {site.address}
                    </p>
                  )}
                </div>
                {isSelected && (
                  <Check className="h-4 w-4 text-primary shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── Module bottom sheet ──────────────────────────────────────────────────────

function BottomSheet({
  open,
  onClose,
  title,
  items,
  extras,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  items: NavLeaf[];
  extras?: React.ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNav = (url: string) => {
    navigate(url);
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card rounded-t-2xl shadow-2xl">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <p className="font-heading font-bold text-base">{title}</p>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-full bg-muted text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-3 py-2 max-h-[60vh] overflow-y-auto pb-8">
          {items.map((item) => {
            const active =
              location.pathname === item.url ||
              location.pathname.startsWith(item.url + "/");
            return (
              <button
                key={item.url}
                onClick={() => handleNav(item.url)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors mb-1",
                  active ? "bg-primary/10 text-primary" : "hover:bg-muted"
                )}
              >
                <div
                  className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                    active ? "bg-primary/20" : "bg-muted"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5",
                      active ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      active ? "text-primary" : "text-foreground"
                    )}
                  >
                    {item.title}
                  </p>
                  {item.desc && (
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            );
          })}
          {extras}
        </div>
      </div>
    </>
  );
}

// ─── FAB ──────────────────────────────────────────────────────────────────────

function FAB() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleAction = (url: string) => {
    navigate(url);
    setOpen(false);
  };

  return (
    <>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 md:hidden"
            onClick={() => setOpen(false)}
          />
          <div className="fixed bottom-24 right-4 z-50 md:hidden space-y-2">
            {quickActions.map((action) => (
              <button
                key={action.url}
                onClick={() => handleAction(action.url)}
                className="flex items-center gap-3 bg-card border shadow-lg rounded-2xl px-4 py-2.5 w-48 ml-auto"
              >
                <div
                  className={cn(
                    "h-8 w-8 rounded-xl flex items-center justify-center shrink-0",
                    action.color
                  )}
                >
                  <action.icon className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-medium">{action.title}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "fixed bottom-20 right-4 z-50 md:hidden h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200",
          open ? "bg-muted rotate-45" : "bg-primary"
        )}
        aria-label="Quick actions"
      >
        <Plus
          className={cn(
            "h-6 w-6 transition-colors",
            open ? "text-foreground" : "text-primary-foreground"
          )}
        />
      </button>
    </>
  );
}

// ─── More sheet extras ────────────────────────────────────────────────────────

function MoreSheetExtras({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { isHQ, orgRole } = useAuth();
  const role = useRole();
  const { isSuperAdmin } = useSuperAdmin();
  const { hasSelectedSite } = useSite();

  const isOrgOwner = orgRole?.org_role === "org_owner";

  const orgItems: NavLeaf[] = [
    ...(isHQ && role.isManager
      ? [{ title: "HQ Dashboard", url: "/hq", icon: Building2, desc: "Multi-site overview" }]
      : []),
    ...(isOrgOwner
      ? [{ title: "Account & Billing", url: "/account", icon: CreditCard, desc: "Subscription & invoices" }]
      : []),
    ...(role.canViewSettings && hasSelectedSite
      ? [{ title: "Settings", url: "/settings", icon: Settings, desc: "Site, users, modules" }]
      : []),
  ];

  if (orgItems.length === 0 && !isSuperAdmin) return null;

  return (
    <div className="mt-2 border-t pt-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 mb-2">
        Organisation
      </p>
      {orgItems.map((item) => (
        <button
          key={item.url}
          onClick={() => {
            navigate(item.url);
            onClose();
          }}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left hover:bg-muted transition-colors mb-1"
        >
          <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
            <item.icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{item.title}</p>
            {item.desc && (
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      ))}
    </div>
  );
}

// ─── Main layout ──────────────────────────────────────────────────────────────

type Sheet = "ops" | "compliance" | "more" | "sites" | null;

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sheet, setSheet] = useState<Sheet>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { currentSite, hasSelectedSite, sites } = useSite();
  const { isHQ } = useAuth();
  const { isActive: isModuleActive } = useModuleAccess();

  const showSiteIndicator = hasSelectedSite && currentSite;
  const isMultiSite = sites.length > 1;

  const filterMods = (items: NavLeaf[]) =>
    items.filter((i) => !i.mod || isModuleActive(i.mod));

  const visibleOps = hasSelectedSite ? filterMods(operationsItems) : [];
  const visibleCompliance = hasSelectedSite ? filterMods(complianceItems) : [];
  const visibleBusiness = filterMods(businessItems);

  const complianceUrls = complianceItems.map((i) => i.url);
  const opsUrls = operationsItems.map((i) => i.url);
  const businessUrls = businessItems.map((i) => i.url);
  const moreUrls = ["/account", "/settings", "/hq", "/admin"];

  const isComplianceActive = complianceUrls.some((u) =>
    location.pathname.startsWith(u)
  );
  const isOpsActive = opsUrls.some(
    (u) =>
      location.pathname === u || location.pathname.startsWith(u + "/")
  );
  const isChatActive = location.pathname.startsWith("/messenger");
  const isMoreActive = [...businessUrls, ...moreUrls].some((u) =>
    location.pathname.startsWith(u)
  );
  const isHomeActive =
    location.pathname === "/" &&
    !isComplianceActive &&
    !isOpsActive &&
    !isChatActive &&
    !isMoreActive;

  const tabClass = (active: boolean) =>
    cn(
      "flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-colors",
      active ? "text-primary" : "text-muted-foreground"
    );

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
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <ShieldCheck className="h-4 w-4 text-primary-foreground" />
            </div>
            <h1 className="font-heading font-semibold text-sm text-foreground">
              MiseOS
            </h1>

            {/* Site badge — tappable for multi-site, static for single */}
            {showSiteIndicator && (
              isMultiSite ? (
                <button
                  onClick={() => setSheet("sites")}
                  className="ml-auto flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 max-w-[50%]"
                >
                  <MapPin className="h-3 w-3 text-primary shrink-0" />
                  <span className="text-xs font-medium truncate text-foreground">
                    {currentSite.name}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                </button>
              ) : (
                <Badge
                  variant="outline"
                  className="ml-auto gap-1 border-primary/30 bg-primary/5 text-foreground max-w-[45%]"
                >
                  <MapPin className="h-3 w-3 text-primary shrink-0" />
                  <span className="font-medium truncate">{currentSite.name}</span>
                </Badge>
              )
            )}
          </header>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
            {children}
          </main>

          {/* FAB */}
          <FAB />

          {/* Mobile bottom nav */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-40 flex">
            <button
              className={tabClass(isHomeActive)}
              onClick={() => { setSheet(null); navigate("/"); }}
            >
              <LayoutDashboard className="h-5 w-5" />
              <span className="text-[10px] font-medium">Home</span>
            </button>

            <button
              className={tabClass(isOpsActive || sheet === "ops")}
              onClick={() => setSheet(sheet === "ops" ? null : "ops")}
            >
              <CalendarClock className="h-5 w-5" />
              <span className="text-[10px] font-medium">Shifts</span>
            </button>

            <button
              className={tabClass(isChatActive)}
              onClick={() => { setSheet(null); navigate("/messenger"); }}
            >
              <MessageSquare className="h-5 w-5" />
              <span className="text-[10px] font-medium">Chat</span>
            </button>

            <button
              className={tabClass(isComplianceActive || sheet === "compliance")}
              onClick={() =>
                setSheet(sheet === "compliance" ? null : "compliance")
              }
            >
              <ShieldCheck className="h-5 w-5" />
              <span className="text-[10px] font-medium">Compliance</span>
            </button>

            <button
              className={tabClass(isMoreActive || sheet === "more")}
              onClick={() => setSheet(sheet === "more" ? null : "more")}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-[10px] font-medium">More</span>
            </button>
          </nav>

          {/* Site switcher sheet */}
          <SiteSwitcherSheet
            open={sheet === "sites"}
            onClose={() => setSheet(null)}
          />

          {/* Operations sheet */}
          <BottomSheet
            open={sheet === "ops"}
            onClose={() => setSheet(null)}
            title="Daily Operations"
            items={visibleOps}
          />

          {/* Compliance sheet */}
          <BottomSheet
            open={sheet === "compliance"}
            onClose={() => setSheet(null)}
            title="Compliance"
            items={visibleCompliance}
          />

          {/* More sheet */}
          <BottomSheet
            open={sheet === "more"}
            onClose={() => setSheet(null)}
            title="More"
            items={visibleBusiness}
            extras={<MoreSheetExtras onClose={() => setSheet(null)} />}
          />
        </div>
      </div>
    </SidebarProvider>
  );
}
