import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

interface DashboardSectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  id?: string;
}

/** Shared dashboard hierarchy: quiet eyebrow, decisive title, optional action. */
export function DashboardSectionHeader({
  eyebrow,
  title,
  description,
  action,
  className,
  id,
}: DashboardSectionHeaderProps) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
            {eyebrow}
          </p>
        ) : null}
        <h2 id={id} className="section-title">{title}</h2>
        {description ? <p className="supporting-text mt-0.5 hidden sm:block">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
