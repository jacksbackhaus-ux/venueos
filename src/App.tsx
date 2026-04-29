import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SiteProvider, useSite } from "@/contexts/SiteContext";
import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import Pricing from "./pages/Pricing";
import LockedAccount from "./pages/LockedAccount";
import Dashboard from "./pages/Dashboard";
import Shifts from "./pages/Shifts";
import ShiftHive from "./pages/ShiftHive";
import TemperatureTracking from "./pages/TemperatureTracking";
import DaySheet from "./pages/DaySheet";
import Cleaning from "./pages/Cleaning";
import WasteLog from "./pages/WasteLog";
import Allergens from "./pages/Allergens";
import Suppliers from "./pages/Suppliers";
import PestMaintenance from "./pages/PestMaintenance";
import Incidents from "./pages/Incidents";
import Reports from "./pages/Reports";
import Batches from "./pages/Batches";
import StaffTraining from "./pages/StaffTraining";
import Haccp from "./pages/Haccp";
import CostMargin from "./pages/CostMargin";
import Timesheets from "./pages/Timesheets";
import Messenger from "./pages/Messenger";
import TipTracker from "./pages/TipTracker";
import HQDashboard from "./pages/HQDashboard";
import Account from "./pages/Account";
import Admin from "./pages/Admin";
import Settings from "./pages/Settings";
import More from "./pages/More";
import SitePicker from "./pages/SitePicker";
import NotFound from "./pages/NotFound";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { RoleGuard } from "@/components/RoleGuard";
import { useOrgAccess } from "@/hooks/useOrgAccess";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { Card, CardContent } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { FullScreenLoader } from "@/components/FullScreenLoader";
import type { ModuleName } from "@/lib/plans";

const queryClient = new QueryClient();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user, appUser, staffSession } = useAuth();
  if (isLoading) return <FullScreenLoader />;
  if (staffSession) return <>{children}</>;
  if (user && !user.is_anonymous && !appUser) return <Navigate to="/onboarding" replace />;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

/** Trial expired & no paid plan → /locked. Pricing & locked are exempt. */
function AccessGuard({ children }: { children: React.ReactNode }) {
  const { staffSession } = useAuth();
  const { loading, hasAccess, trialActive, subscription, plan, isLocked } = useOrgAccess();

  if (staffSession) return <>{children}</>;
  if (loading) return null;
  if (!subscription) return <>{children}</>;
  if (isLocked) return <Navigate to="/locked" replace />;
  if (hasAccess) return <>{children}</>;

  // Trialing but no plan flags chosen → push to pricing.
  if (trialActive && !plan.hasAnyPlan) return <Navigate to="/pricing" replace />;

  return <Navigate to="/locked" replace />;
}

/** Module-based gate. Hides modules not active for the current site. */
function ModuleGuard({ module, children }: { module: ModuleName; children: React.ReactNode }) {
  const { loading, isActive } = useModuleAccess();
  if (loading) return null;
  if (isActive(module)) return <>{children}</>;
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
          <h2 className="font-heading font-semibold text-lg">Module not active</h2>
          <p className="text-sm text-muted-foreground">
            This module isn't enabled for your current site. Visit Account & Billing or Settings to enable it.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function RequireSite({ children }: { children: React.ReactNode }) {
  const { hasSelectedSite, isLoading, sites } = useSite();
  const { isHQ, staffSession } = useAuth();
  if (isLoading) return null;
  if (staffSession) return <>{children}</>;
  if (!hasSelectedSite && sites.length > 1) return <Navigate to="/select-site" replace />;
  if (isHQ && !hasSelectedSite) return <Navigate to="/hq" replace />;
  return <>{children}</>;
}

function AuthRedirect() {
  const { isAuthenticated, user, appUser, isLoading, staffSession } = useAuth();
  if (isLoading) return <FullScreenLoader />;
  if (staffSession) return <Navigate to="/" replace />;
  if (user && !user.is_anonymous && !appUser) return <Navigate to="/onboarding" replace />;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <Auth />;
}

function AppRoutes() {
  const { isLoading } = useAuth();
  if (isLoading) return <FullScreenLoader />;

  // Module-gated site route.
  const moduleRoute = (mod: ModuleName, el: React.ReactNode) => (
    <AuthGuard>
      <AccessGuard>
        <AppLayout>
          <RequireSite>
            <ModuleGuard module={mod}>{el}</ModuleGuard>
          </RequireSite>
        </AppLayout>
      </AccessGuard>
    </AuthGuard>
  );

  // Site route with no module gate (e.g. Dashboard — always available).
  const siteRoute = (el: React.ReactNode) => (
    <AuthGuard>
      <AccessGuard>
        <AppLayout>
          <RequireSite>{el}</RequireSite>
        </AppLayout>
      </AccessGuard>
    </AuthGuard>
  );

  return (
    <Routes>
      <Route path="/auth" element={<AuthRedirect />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/pricing" element={<AuthGuard><Pricing /></AuthGuard>} />
      <Route path="/locked" element={<AuthGuard><LockedAccount /></AuthGuard>} />
      <Route path="/select-site" element={<AuthGuard><AccessGuard><SitePicker /></AccessGuard></AuthGuard>} />

      <Route path="/" element={siteRoute(<Dashboard />)} />
      <Route path="/shifts" element={moduleRoute("shifts", <Shifts />)} />
      <Route path="/shift-hive" element={moduleRoute("shifts", <ShiftHive />)} />
      <Route path="/temperatures" element={moduleRoute("temperatures", <TemperatureTracking />)} />
      <Route path="/day-sheet" element={moduleRoute("day_sheet", <DaySheet />)} />
      <Route path="/cleaning" element={moduleRoute("cleaning", <Cleaning />)} />
      <Route path="/waste-log" element={moduleRoute("waste_log", <WasteLog />)} />
      <Route path="/allergens" element={moduleRoute("allergens", <Allergens />)} />
      <Route path="/suppliers" element={moduleRoute("suppliers", <Suppliers />)} />
      <Route path="/pest-maintenance" element={moduleRoute("pest_maintenance", <PestMaintenance />)} />
      <Route path="/incidents" element={moduleRoute("incidents", <Incidents />)} />
      <Route path="/reports" element={moduleRoute("reports", <RoleGuard require="viewReports" inline><Reports /></RoleGuard>)} />
      <Route path="/batches" element={moduleRoute("batch_tracking", <Batches />)} />
      <Route path="/staff-training" element={moduleRoute("staff_training", <StaffTraining />)} />
      <Route path="/haccp" element={moduleRoute("haccp", <Haccp />)} />
      <Route path="/cost-margin" element={moduleRoute("cost_margin", <CostMargin />)} />
      <Route path="/timesheets" element={moduleRoute("timesheets", <Timesheets />)} />
      <Route path="/messenger" element={moduleRoute("messenger", <Messenger />)} />
      <Route path="/tip-tracker" element={moduleRoute("tip_tracker", <TipTracker />)} />

      {/* HQ Dashboard, Account, Admin, Settings — always accessible to authorised roles, never module-gated */}
      <Route path="/hq" element={
        <AuthGuard><AccessGuard><AppLayout>
          <RoleGuard require="manager" inline><HQDashboard /></RoleGuard>
        </AppLayout></AccessGuard></AuthGuard>
      } />
      <Route path="/account" element={<AuthGuard><AppLayout><RoleGuard require="manageBilling" inline><Account /></RoleGuard></AppLayout></AuthGuard>} />
      <Route path="/admin" element={<AuthGuard><AppLayout><RoleGuard require="viewAdmin" inline><Admin /></RoleGuard></AppLayout></AuthGuard>} />
      <Route path="/settings" element={
        <AuthGuard><AccessGuard><AppLayout><RequireSite>
          <RoleGuard require="viewSettings" inline><Settings /></RoleGuard>
        </RequireSite></AppLayout></AccessGuard></AuthGuard>
      } />
      <Route path="/more" element={<AuthGuard><AppLayout><More /></AppLayout></AuthGuard>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <SiteProvider>
            <PaymentTestModeBanner />
            <Suspense fallback={<FullScreenLoader />}>
              <AppRoutes />
            </Suspense>
          </SiteProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
