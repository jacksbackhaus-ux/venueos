import { Suspense, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SiteProvider, useSite } from "@/contexts/SiteContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";
import StaffLogin from "./pages/StaffLogin";
import OrgLogin from "./pages/OrgLogin";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import Pricing from "./pages/Pricing";
import LockedAccount from "./pages/LockedAccount";
import Dashboard from "./pages/Dashboard";
import Shifts from "./pages/Shifts";

import TemperatureTracking from "./pages/TemperatureTracking";
import DaySheet from "./pages/DaySheet";
import Cleaning from "./pages/Cleaning";
import WasteLog from "./pages/WasteLog";
import CustomerFeedback from "./pages/CustomerFeedback";
import PPMSchedule from "./pages/PPMSchedule";
import Allergens from "./pages/Allergens";
import Suppliers from "./pages/Suppliers";
import PestMaintenance from "./pages/PestMaintenance";
import Incidents from "./pages/Incidents";
import Reports from "./pages/Reports";
import Batches from "./pages/Batches";
import StaffTraining from "./pages/StaffTraining";
import Haccp from "./pages/Haccp";
import CostMargin from "./pages/CostMargin";
import Compliance from "./pages/Compliance";
import Sales from "./pages/Sales";
import Timesheets from "./pages/Timesheets";
import Messenger from "./pages/Messenger";
import TipTracker from "./pages/TipTracker";
import HQDashboard from "./pages/HQDashboard";
import Account from "./pages/Account";
import SubscriptionDiagnostics from "./pages/SubscriptionDiagnostics";
import Admin from "./pages/Admin";
import Settings from "./pages/Settings";
import More from "./pages/More";
import StaffDashboard from "./pages/staff/StaffDashboard";
import StaffUsers from "./pages/staff/StaffUsers";
import StaffOrgs from "./pages/staff/StaffOrgs";
import StaffOrgDetail from "./pages/staff/StaffOrgDetail";
import StaffOpsLog from "./pages/staff/StaffOpsLog";
import StaffMigrations from "./pages/staff/StaffMigrations";
import StaffAccess from "./pages/staff/StaffAccess";
import StaffFeedbackInbox, { StaffFeedbackDetail } from "./pages/staff/StaffFeedbackInbox";
import { StaffGuard } from "./components/staff/StaffGuard";

import { StaffLayout } from "./components/staff/StaffLayout";
import SitePicker from "./pages/SitePicker";
import NotFound from "./pages/NotFound";
import Landing from "./pages/Landing";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { RoleGuard } from "@/components/RoleGuard";
import { useOrgAccess } from "@/hooks/useOrgAccess";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { Card, CardContent } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { FullScreenLoader } from "@/components/FullScreenLoader";
import type { ModuleName } from "@/lib/plans";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/**
 * Safety net before sending an authenticated email/password user to /onboarding.
 * Onboarding is for TRULY NEW accounts only. If the user already has a
 * customer row OR any accessible memberships/sites, we route them to the
 * dashboard instead. This prevents existing customers (e.g. with a row whose
 * auth_type ≠ 'email') from accidentally re-onboarding and overwriting tenancy.
 */
function OnboardingFallback({ authUserId, reason }: { authUserId: string; reason: string }) {
  const [decision, setDecision] = useState<"loading" | "onboarding" | "dashboard">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 1) Re-check users table without auth_type filter
        const { data: userRow } = await supabase
          .from("users")
          .select("id, organisation_id")
          .eq("auth_user_id", authUserId)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();

        let hasMembership = !!userRow?.organisation_id;
        let sitesCount = 0;

        if (userRow?.id) {
          const { count } = await supabase
            .from("memberships")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userRow.id)
            .eq("active", true);
          sitesCount = count ?? 0;
        }

        // eslint-disable-next-line no-console
        console.warn("[AuthRedirect] onboarding gate", {
          authUserId,
          reason,
          appUserFound: !!userRow,
          organisation_id: userRow?.organisation_id ?? null,
          sitesCount,
        });

        if (cancelled) return;
        if (hasMembership || sitesCount > 0) setDecision("dashboard");
        else setDecision("onboarding");
      } catch (err) {
        console.error("[AuthRedirect] onboarding gate failed, defaulting to dashboard", err);
        if (!cancelled) setDecision("dashboard");
      }
    })();
    return () => { cancelled = true; };
  }, [authUserId, reason]);

  if (decision === "loading") return <FullScreenLoader />;
  if (decision === "onboarding") return <Navigate to="/onboarding" replace />;
  // Force a session refresh — the hydration race is the most common cause.
  return <Navigate to="/" replace />;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { isAuthenticated, isLoading, user, appUser, staffSession } = useAuth();
  if (isLoading) return <FullScreenLoader />;
  if (staffSession) return <>{children}</>;
  if (user && !user.is_anonymous && !appUser) {
    // Internal /staff is reached explicitly; StaffGuard handles its own gating.
    if (location.pathname.startsWith("/staff")) return <>{children}</>;
    return <OnboardingFallback authUserId={user.id} reason="AuthGuard:no-appUser" />;
  }
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
  const { hasSelectedSite, isLoading, hasHydrated, sites, memberships } = useSite();
  const { isHQ, orgRole, staffSession, isLoading: authLoading } = useAuth();
  // Wait for BOTH auth and site context to fully hydrate before deciding
  // where to send the user. Prevents a slow-network flash of /select-site.
  if (authLoading || isLoading || !hasHydrated) return <FullScreenLoader />;
  if (staffSession) return <>{children}</>;
  if (isHQ && !hasSelectedSite) return <Navigate to="/hq" replace />;
  if (!hasSelectedSite && sites.length > 1) {
    const isOrgManager =
      orgRole?.org_role === "org_owner" ||
      orgRole?.org_role === "hq_admin" ||
      orgRole?.org_role === "hq_auditor";
    const hasManagerMembership = memberships.some(
      (m) => m.site_role === "owner" || m.site_role === "supervisor",
    );
    if (isOrgManager || hasManagerMembership) return <Navigate to="/hq" replace />;
    return <Navigate to="/select-site" replace />;
  }
  return <>{children}</>;
}

function AuthRedirect() {
  const { isAuthenticated, user, appUser, isLoading, staffSession } = useAuth();
  if (isLoading) return <FullScreenLoader />;
  if (staffSession) return <Navigate to="/" replace />;
  if (user && !user.is_anonymous && !appUser) {
    return <OnboardingFallback authUserId={user.id} reason="AuthRedirect:no-appUser" />;
  }
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <Auth />;
}


/** Root path: show Landing for unauthenticated visitors, Dashboard for signed-in users. */
function RootRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, staffSession } = useAuth();
  if (isLoading) return <FullScreenLoader />;
  if (!isAuthenticated && !staffSession) return <Landing />;
  return <>{children}</>;
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
      <Route path="/staff-login" element={<StaffLogin />} />
      {/* Alias — internal MiseOS employees only. Same component as /staff-login. */}
      <Route path="/internal-login" element={<StaffLogin />} />
      <Route path="/landing" element={<Landing />} />
      <Route path="/login/:slug" element={<OrgLogin />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/pricing" element={<AuthGuard><Pricing /></AuthGuard>} />
      <Route path="/locked" element={<AuthGuard><LockedAccount /></AuthGuard>} />
      <Route path="/select-site" element={<AuthGuard><AccessGuard><SitePicker /></AccessGuard></AuthGuard>} />

      <Route path="/" element={<RootRoute>{siteRoute(<Dashboard />)}</RootRoute>} />
      <Route path="/shifts" element={moduleRoute("shifts", <Shifts />)} />
      
      <Route path="/temperatures" element={moduleRoute("temperatures", <TemperatureTracking />)} />
      <Route path="/day-sheet" element={moduleRoute("day_sheet", <DaySheet />)} />
      <Route path="/cleaning" element={moduleRoute("cleaning", <Cleaning />)} />
      <Route path="/waste-log" element={moduleRoute("waste_log", <WasteLog />)} />
      <Route path="/customer-feedback" element={moduleRoute("customer_feedback", <CustomerFeedback />)} />
      <Route path="/ppm-schedule" element={moduleRoute("ppm_schedule", <RoleGuard require="supervisorPlus" inline><PPMSchedule /></RoleGuard>)} />
      <Route path="/allergens" element={moduleRoute("allergens", <RoleGuard require="supervisorPlus" inline><Allergens /></RoleGuard>)} />
      <Route path="/suppliers" element={moduleRoute("suppliers", <RoleGuard require="supervisorPlus" inline><Suppliers /></RoleGuard>)} />
      <Route path="/pest-maintenance" element={moduleRoute("pest_maintenance", <RoleGuard require="supervisorPlus" inline><PestMaintenance /></RoleGuard>)} />
      <Route path="/incidents" element={moduleRoute("incidents", <Incidents />)} />
      <Route path="/compliance" element={siteRoute(<Compliance />)} />
      <Route path="/reports" element={moduleRoute("reports", <RoleGuard require="viewReports" inline><Reports /></RoleGuard>)} />
      <Route path="/batches" element={moduleRoute("batch_tracking", <Batches />)} />
      <Route path="/staff-training" element={moduleRoute("staff_training", <StaffTraining />)} />
      <Route path="/haccp" element={moduleRoute("haccp", <RoleGuard require="supervisorPlus" inline><Haccp /></RoleGuard>)} />
      <Route path="/cost-margin" element={moduleRoute("cost_margin", <CostMargin />)} />
      <Route path="/sales" element={moduleRoute("cost_margin", <Sales />)} />
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
      <Route path="/account/diagnostics" element={<AuthGuard><AppLayout><RoleGuard require="manageBilling" inline><SubscriptionDiagnostics /></RoleGuard></AppLayout></AuthGuard>} />
      <Route path="/admin" element={<AuthGuard><AppLayout><RoleGuard require="viewAdmin" inline><Admin /></RoleGuard></AppLayout></AuthGuard>} />
      <Route path="/settings" element={
        <AuthGuard><AccessGuard><AppLayout><RequireSite>
          <RoleGuard require="viewSettings" inline><Settings /></RoleGuard>
        </RequireSite></AppLayout></AccessGuard></AuthGuard>
      } />
      <Route path="/more" element={<AuthGuard><AppLayout><More /></AppLayout></AuthGuard>} />

      {/* Staff-only internal console — gated by internal_staff_roles, NOT by super_admin */}
      <Route path="/staff" element={<AuthGuard><StaffGuard><StaffLayout><StaffDashboard /></StaffLayout></StaffGuard></AuthGuard>} />
      <Route path="/staff/users" element={<AuthGuard><StaffGuard><StaffLayout><StaffUsers /></StaffLayout></StaffGuard></AuthGuard>} />
      <Route path="/staff/orgs" element={<AuthGuard><StaffGuard><StaffLayout><StaffOrgs /></StaffLayout></StaffGuard></AuthGuard>} />
      <Route path="/staff/org/:orgId" element={<AuthGuard><StaffGuard><StaffLayout><StaffOrgDetail /></StaffLayout></StaffGuard></AuthGuard>} />
      <Route path="/staff/access" element={<AuthGuard><StaffGuard><StaffLayout><StaffAccess /></StaffLayout></StaffGuard></AuthGuard>} />
      <Route path="/staff/ops" element={<AuthGuard><StaffGuard><StaffLayout><StaffOpsLog /></StaffLayout></StaffGuard></AuthGuard>} />
      <Route path="/staff/migrations" element={<AuthGuard><StaffGuard><StaffLayout><StaffMigrations /></StaffLayout></StaffGuard></AuthGuard>} />
      <Route path="/staff/feedback" element={<AuthGuard><StaffGuard><StaffLayout><StaffFeedbackInbox /></StaffLayout></StaffGuard></AuthGuard>} />
      <Route path="/staff/feedback/:id" element={<AuthGuard><StaffGuard><StaffLayout><StaffFeedbackDetail /></StaffLayout></StaffGuard></AuthGuard>} />

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
        <ImpersonationProvider>
          <AuthProvider>
            <SiteProvider>
              <BrandingProvider>
                <ImpersonationBanner />
                <PaymentTestModeBanner />
                <Suspense fallback={<FullScreenLoader />}>
                  <AppRoutes />
                </Suspense>
              </BrandingProvider>
            </SiteProvider>
          </AuthProvider>
        </ImpersonationProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
