import { Navigate } from 'react-router-dom';
import { useRole } from '@/hooks/useRole';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { Card } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';

type Capability =
  | 'viewSettings'
  | 'manageUsers'
  | 'manageBilling'
  | 'viewReports'
  | 'viewAdmin'
  | 'supervisorPlus'
  | 'manager';

interface RoleGuardProps {
  require: Capability;
  children: React.ReactNode;
  /** When true, render an "access denied" panel instead of redirecting. */
  inline?: boolean;
}

export function RoleGuard({ require, children, inline = false }: RoleGuardProps) {
  const r = useRole();
  const { isSuperAdmin } = useSuperAdmin();

  let allowed = false;
  switch (require) {
    case 'viewSettings':   allowed = r.canViewSettings; break;
    case 'manageUsers':    allowed = r.canManageUsers; break;
    case 'manageBilling':  allowed = r.canManageBilling; break;
    case 'viewReports':    allowed = r.canViewReports; break;
    case 'supervisorPlus': allowed = r.isSupervisorPlus; break;
    case 'manager':        allowed = r.isManager; break;
    case 'viewAdmin':      allowed = isSuperAdmin; break;
  }

  if (allowed) return <>{children}</>;

  if (inline) {
    return (
      <div className="p-6">
        <Card className="p-6 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-foreground">Access restricted</h3>
            <p className="text-sm text-muted-foreground">
              You don't have permission to view this section. Ask a manager if you need access.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return <Navigate to="/" replace />;
}
