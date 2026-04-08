import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import ShiftAssignment from "./pages/ShiftAssignment";
import TemperatureTracking from "./pages/TemperatureTracking";
import DaySheet from "./pages/DaySheet";
import Cleaning from "./pages/Cleaning";
import Allergens from "./pages/Allergens";
import Suppliers from "./pages/Suppliers";
import PestMaintenance from "./pages/PestMaintenance";
import Incidents from "./pages/Incidents";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/shifts" element={<ShiftAssignment />} />
            <Route path="/temperatures" element={<TemperatureTracking />} />
            <Route path="/day-sheet" element={<DaySheet />} />
            <Route path="/cleaning" element={<Cleaning />} />
            <Route path="/allergens" element={<Allergens />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/pest-maintenance" element={<PestMaintenance />} />
            <Route path="/incidents" element={<Incidents />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
