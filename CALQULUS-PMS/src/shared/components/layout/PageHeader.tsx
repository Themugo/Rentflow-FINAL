import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: ReactNode;
  actions?: ReactNode;
  status?: ReactNode;
  className?: string;
}

/**
 * Shared page chrome: title, description, optional breadcrumbs, actions, and status.
 * Layout, admin, and portal pages should use this instead of ad-hoc title rows.
 */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  status,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("border-b border-border/60 bg-background", className)}>
      <div className="max-w-[1800px] mx-auto space-y-3">
        {breadcrumbs ? <div className="min-w-0">{breadcrumbs}</div> : null}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="page-title text-foreground break-words">{title}</h1>
              {status}
            </div>
            {description ? <p className="supporting-text max-w-2xl break-words">{description}</p> : null}
          </div>
          {actions ? (
            <div className="flex min-w-0 w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{actions}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
