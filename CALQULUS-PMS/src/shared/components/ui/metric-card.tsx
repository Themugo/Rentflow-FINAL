import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  detail?: ReactNode;
  valueClassName?: string;
  className?: string;
}

/** Shared compact KPI surface for portfolio and operational summaries. */
export function MetricCard({ label, value, icon: Icon, detail, valueClassName, className }: MetricCardProps) {
  return (
    <div className={cn("min-w-0 rounded-xl border border-border bg-card px-4 py-3 card-shadow", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        {Icon ? <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
      </div>
      <p className={cn("mt-1 truncate text-lg font-semibold tracking-tight text-foreground tabular-nums", valueClassName)}>{value}</p>
      {detail ? <div className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</div> : null}
    </div>
  );
}
