import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  /** One short sentence. Tell them why it's empty AND what to do. */
  description?: ReactNode;
  /** One primary action. Never two. */
  action?: ReactNode;
  className?: string;
}

/**
 * Canonical empty state. Used wherever a list/chart has no data yet.
 * Keep it calm — no illustrations, no clutter.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <Card className={cn("border-dashed", className)}>
      <CardContent className="py-10 flex flex-col items-center text-center gap-3">
        {icon && <div className="text-muted-foreground">{icon}</div>}
        <div className="space-y-1 max-w-sm">
          <div className="font-heading font-semibold text-base">{title}</div>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </CardContent>
    </Card>
  );
}
