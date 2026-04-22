import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SiteProvider } from "@/contexts/SiteContext";
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

  return (
    <Routes>
      <Route path="/auth" element={<AuthRedirect />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/" element={<AuthGuard><AppLayout><Dashboard /></AppLayout></AuthGuard>} />
      <Route path="/shifts" element={<AuthGuard><AppLayout><Shifts /></AppLayout></AuthGuard>} />
      <Route path="/temperatures" element={<AuthGuard><AppLayout><TemperatureTracking /></AppLayout></AuthGuard>} />
      <Route path="/day-sheet" element={<AuthGuard><AppLayout><DaySheet /></AppLayout></AuthGuard>} />
      <Route path="/cleaning" element={<AuthGuard><AppLayout><Cleaning /></AppLayout></AuthGuard>} />
      <Route path="/allergens" element={<AuthGuard><AppLayout><Allergens /></AppLayout></AuthGuard>} />
      <Route path="/suppliers" element={<AuthGuard><AppLayout><Suppliers /></AppLayout></AuthGuard>} />
      <Route path="/pest-maintenance" element={<AuthGuard><AppLayout><PestMaintenance /></AppLayout></AuthGuard>} />
      <Route path="/incidents" element={<AuthGuard><AppLayout><Incidents /></AppLayout></AuthGuard>} />
      <Route path="/reports" element={<AuthGuard><AppLayout><Reports /></AppLayout></AuthGuard>} />
      <Route path="/batches" element={<AuthGuard><AppLayout><Batches /></AppLayout></AuthGuard>} />
      <Route path="/hq" element={<AuthGuard><AppLayout><HQDashboard /></AppLayout></AuthGuard>} />
      <Route path="/account" element={<AuthGuard><AppLayout><Account /></AppLayout></AuthGuard>} />
      <Route path="/admin" element={<AuthGuard><AppLayout><Admin /></AppLayout></AuthGuard>} />
      <Route path="/settings" element={<AuthGuard><AppLayout><Settings /></AppLayout></AuthGuard>} />
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
      <PaymentTestModeBanner />
      <BrowserRouter>
        <AuthProvider>
          <SiteProvider>
            <AppRoutes />
          </SiteProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
