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
    <Card className={cn("border-dashed bg-muted/30 shadow-soft", className)}>
      <CardContent className="py-12 px-6 flex flex-col items-center text-center gap-4">
        {icon && (
          <div className="text-muted-foreground/80 rounded-full bg-muted/60 p-3">
            {icon}
          </div>
        )}
        <div className="space-y-1.5 max-w-sm">
          <div className="font-heading font-semibold text-lg">{title}</div>
          {description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
          )}
        </div>
        {action}
      </CardContent>
    </Card>
  );
}
