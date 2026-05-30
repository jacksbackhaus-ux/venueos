import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Primary action (single button). Keep it to ONE per screen. */
  action?: ReactNode;
  className?: string;
}

/**
 * Single canonical page header used across modules.
 * Mobile-first: title is text-2xl on every breakpoint so the visual
 * weight is identical across the product.
 */
export function PageHeader({ icon, title, subtitle, action, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h1 className="font-heading font-bold text-2xl tracking-tight flex items-center gap-2">
          {icon && <span className="text-primary shrink-0">{icon}</span>}
          <span className="truncate">{title}</span>
        </h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
