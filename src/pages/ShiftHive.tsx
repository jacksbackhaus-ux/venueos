import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSite } from "@/contexts/SiteContext";
import { useAuth } from "@/contexts/AuthContext";
import { MyShiftsDashboard } from "@/components/shifts/MyShiftsDashboard";
import { ManagerApprovalCenter } from "@/components/shifts/ManagerApprovalCenter";
import { ComplianceExport } from "@/components/shifts/ComplianceExport";
import { AvailabilityEditor } from "@/components/shifts/AvailabilityEditor";
import { ShiftHiveSettings } from "@/components/shifts/ShiftHiveSettings";

/**
 * Shift Hive — staff self-service + manager compliance surfaces.
 * Sits alongside the existing Rota page in the Shifts module.
 */
export default function ShiftHive() {
  const { currentMembership } = useSite();
  const { staffSession } = useAuth();
  const role = currentMembership?.site_role || staffSession?.site_role || "staff";
  const isManager = role === "owner" || role === "supervisor";

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-heading font-bold">Shift Hive</h1>
        <p className="text-sm text-muted-foreground">Self-service swaps, cover & compliance</p>
      </div>

      <Tabs defaultValue="my-shifts">
        <TabsList className="w-full overflow-x-auto flex-nowrap justify-start">
          <TabsTrigger value="my-shifts">My shifts</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          {isManager && <TabsTrigger value="approvals">Approvals</TabsTrigger>}
          {isManager && <TabsTrigger value="compensation">Compensation</TabsTrigger>}
          {isManager && <TabsTrigger value="settings">Settings</TabsTrigger>}
        </TabsList>

        <TabsContent value="my-shifts" className="mt-4"><MyShiftsDashboard /></TabsContent>
        <TabsContent value="availability" className="mt-4"><AvailabilityEditor /></TabsContent>
        {isManager && <TabsContent value="approvals" className="mt-4"><ManagerApprovalCenter /></TabsContent>}
        {isManager && <TabsContent value="compensation" className="mt-4"><ComplianceExport /></TabsContent>}
        {isManager && <TabsContent value="settings" className="mt-4"><ShiftHiveSettings /></TabsContent>}
      </Tabs>
    </div>
  );
}
