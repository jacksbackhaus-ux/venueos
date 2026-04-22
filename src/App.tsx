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
import TemperatureTracking from "./pages/TemperatureTracking";
import DaySheet from "./pages/DaySheet";
import Cleaning from "./pages/Cleaning";
import Allergens from "./pages/Allergens";
import Suppliers from "./pages/Suppliers";
import PestMaintenance from "./pages/PestMaintenance";
import Incidents from "./pages/Incidents";
import Reports from "./pages/Reports";
import Batches from "./pages/Batches";
import HQDashboard from "./pages/HQDashboard";
import Account from "./pages/Account";
import Admin from "./pages/Admin";
import Settings from "./pages/Settings";
import More from "./pages/More";
import NotFound from "./pages/NotFound";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { RoleGuard } from "@/components/RoleGuard";
import { useOrgAccess } from "@/hooks/useOrgAccess";
import { TIERS } from "@/lib/tiers";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Lock } from "lucide-react";

const queryClient = new QueryClient();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user, appUser, staffSession } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (staffSession) return <>{children}</>;

  if (user && !user.is_anonymous && !appUser) {
    return <Navigate to="/onboarding" replace />;
  }

  if (!isAuthenticated) return <Navigate to="/auth" replace />;

  return <>{children}</>;
}

/**
 * Blocks site-scoped routes when the trial has ended without a paid plan.
 * Owner is sent to /locked (which links to /pricing); others see /locked too.
 * Account, pricing, and locked pages are exempt.
 */
function AccessGuard({ children }: { children: React.ReactNode }) {
  const { staffSession } = useAuth();
  const { loading, hasAccess, trialActive, subscription } = useOrgAccess();

  if (staffSession) return <>{children}</>;
  if (loading) return null;

  // No subscription row yet (just signing up) — let them through; pricing page handles next step.
  if (!subscription) return <>{children}</>;

  // Active access (paid, trialing, or comped) — allow.
  if (hasAccess) return <>{children}</>;

  // Trial active with no tier picked — push to pricing.
  if (trialActive && !subscription.tier) {
    return <Navigate to="/pricing" replace />;
  }

  // Otherwise: locked.
  return <Navigate to="/locked" replace />;
}

/**
 * Tier-based gate. Hides modules the user's plan doesn't include.
 */
function TierGuard({ module, children }: { module: string; children: React.ReactNode }) {
  const { tier } = useOrgAccess();
  const { staffSession } = useAuth();
  if (staffSession) return <>{children}</>;
  // No tier yet (still trialing without selection) → allow everything.
  if (!tier) return <>{children}</>;
  if (TIERS[tier].allowedModules.has(module)) return <>{children}</>;
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
          <h2 className="font-heading font-semibold text-lg">Not included in your plan</h2>
          <p className="text-sm text-muted-foreground">
            This feature isn't included in the {TIERS[tier].name} plan. Upgrade to unlock it.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function RequireSite({ children }: { children: React.ReactNode }) {
  const { hasSelectedSite, isLoading } = useSite();
  const { isHQ } = useAuth();
  if (isLoading) return null;
  if (isHQ && !hasSelectedSite) return <Navigate to="/hq" replace />;
  return <>{children}</>;
}

function AuthRedirect() {
  const { isAuthenticated, user, appUser, isLoading, staffSession } = useAuth();
  if (isLoading) return null;
  if (staffSession) return <Navigate to="/" replace />;
  if (user && !user.is_anonymous && !appUser) return <Navigate to="/onboarding" replace />;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <Auth />;
}

function AppRoutes() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Wraps a site-scoped page with auth + access (trial/sub) + site selection + tier check.
  const siteRoute = (mod: string, el: React.ReactNode) => (
    <AuthGuard>
      <AccessGuard>
        <AppLayout>
          <RequireSite>
            <TierGuard module={mod}>{el}</TierGuard>
          </RequireSite>
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

      <Route path="/" element={siteRoute("dashboard", <Dashboard />)} />
      <Route path="/shifts" element={siteRoute("shifts", <Shifts />)} />
      <Route path="/temperatures" element={siteRoute("temperatures", <TemperatureTracking />)} />
      <Route path="/day-sheet" element={siteRoute("day-sheet", <DaySheet />)} />
      <Route path="/cleaning" element={siteRoute("cleaning", <Cleaning />)} />
      <Route path="/allergens" element={siteRoute("allergens", <Allergens />)} />
      <Route path="/suppliers" element={siteRoute("suppliers", <Suppliers />)} />
      <Route path="/pest-maintenance" element={siteRoute("pest-maintenance", <PestMaintenance />)} />
      <Route path="/incidents" element={siteRoute("incidents", <Incidents />)} />
      <Route path="/reports" element={siteRoute("reports", <RoleGuard require="viewReports" inline><Reports /></RoleGuard>)} />
      <Route path="/batches" element={siteRoute("batches", <Batches />)} />

      <Route path="/hq" element={
        <AuthGuard><AccessGuard><AppLayout>
          <TierGuard module="hq">
            <RoleGuard require="manager" inline><HQDashboard /></RoleGuard>
          </TierGuard>
        </AppLayout></AccessGuard></AuthGuard>
      } />
      {/* Account is always accessible — never blocked by access/tier guard */}
      <Route path="/account" element={<AuthGuard><AppLayout><RoleGuard require="manageBilling" inline><Account /></RoleGuard></AppLayout></AuthGuard>} />
      <Route path="/admin" element={<AuthGuard><AppLayout><RoleGuard require="viewAdmin" inline><Admin /></RoleGuard></AppLayout></AuthGuard>} />
      <Route path="/settings" element={siteRoute("settings", <RoleGuard require="viewSettings" inline><Settings /></RoleGuard>)} />
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
            <AppRoutes />
          </SiteProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
