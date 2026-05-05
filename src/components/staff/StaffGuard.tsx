import { Navigate } from "react-router-dom";
import { useInternalStaff } from "@/hooks/useInternalStaff";
import { FullScreenLoader } from "@/components/FullScreenLoader";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

/**
 * Gate for /staff/*. Allows ONLY users in internal_staff_roles.
 * Customers — including platform super admins who are not also staff —
 * are denied. We render an explicit denial card rather than redirecting
 * silently, so accidental access by a known internal email is obvious.
 */
export function StaffGuard({ children }: { children: React.ReactNode }) {
  const { isInternalStaff, loading } = useInternalStaff();

  if (loading) return <FullScreenLoader />;
  if (isInternalStaff) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="max-w-md w-full">
        <CardContent className="py-10 text-center space-y-3">
          <ShieldAlert className="h-10 w-10 mx-auto text-warning" />
          <h1 className="font-heading font-semibold text-lg">Access denied</h1>
          <p className="text-sm text-muted-foreground">
            The MiseOS Staff Console is reserved for internal team members.
            If you believe you should have access, contact engineering.
          </p>
          <Navigate to="/" replace />
        </CardContent>
      </Card>
    </div>
  );
}
