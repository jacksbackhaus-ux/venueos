import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SiteProvider, useSite } from "@/contexts/SiteContext";
import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
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
import { Loader2 } from "lucide-react";

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

  // Staff kiosk session → always allowed, never sent to onboarding
  if (staffSession) {
    return <>{children}</>;
  }

  // Email-authenticated user with no app profile row yet → finish setup
  // (Anonymous sessions used for staff PIN login are excluded above.)
  if (user && !user.is_anonymous && !appUser) {
    return <Navigate to="/onboarding" replace />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

/**
 * For HQ users (org_owner / hq_admin / hq_auditor) without an explicitly
 * selected site, redirect site-scoped routes to the HQ Dashboard.
 */
function RequireSite({ children }: { children: React.ReactNode }) {
  const { hasSelectedSite, isLoading } = useSite();
  const { isHQ } = useAuth();
  if (isLoading) return null;
  if (isHQ && !hasSelectedSite) {
    return <Navigate to="/hq" replace />;
  }
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
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const siteRoute = (el: React.ReactNode) => (
    <AuthGuard><AppLayout><RequireSite>{el}</RequireSite></AppLayout></AuthGuard>
  );

  return (
    <Routes>
      <Route path="/auth" element={<AuthRedirect />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/" element={siteRoute(<Dashboard />)} />
      <Route path="/shifts" element={siteRoute(<Shifts />)} />
      <Route path="/temperatures" element={siteRoute(<TemperatureTracking />)} />
      <Route path="/day-sheet" element={siteRoute(<DaySheet />)} />
      <Route path="/cleaning" element={siteRoute(<Cleaning />)} />
      <Route path="/allergens" element={siteRoute(<Allergens />)} />
      <Route path="/suppliers" element={siteRoute(<Suppliers />)} />
      <Route path="/pest-maintenance" element={siteRoute(<PestMaintenance />)} />
      <Route path="/incidents" element={siteRoute(<Incidents />)} />
      <Route path="/reports" element={siteRoute(<RoleGuard require="viewReports" inline><Reports /></RoleGuard>)} />
      <Route path="/batches" element={siteRoute(<Batches />)} />
      <Route path="/hq" element={<AuthGuard><AppLayout><RoleGuard require="manager" inline><HQDashboard /></RoleGuard></AppLayout></AuthGuard>} />
      <Route path="/account" element={<AuthGuard><AppLayout><RoleGuard require="manageBilling" inline><Account /></RoleGuard></AppLayout></AuthGuard>} />
      <Route path="/admin" element={<AuthGuard><AppLayout><RoleGuard require="viewAdmin" inline><Admin /></RoleGuard></AppLayout></AuthGuard>} />
      <Route path="/settings" element={siteRoute(<RoleGuard require="viewSettings" inline><Settings /></RoleGuard>)} />
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
