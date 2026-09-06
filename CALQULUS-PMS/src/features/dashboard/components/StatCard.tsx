import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  iconColor?: "neutral" | "primary" | "accent" | "success" | "warning" | "destructive";
  progressValue?: number;
  /** Counts per bar rendered as a mini sparkline bar chart */
  sparkData?: number[];
  /** Labels per bar for tooltip (e.g. ["Mon","Tue",...] or ["Wk 1","Wk 2",...]) */
  sparkLabels?: string[];
  /** Noun appended to count in bar tooltip, e.g. "lease" → "3 leases expiring" */
  sparkUnit?: string;
  /** Label shown below the sparkline (default: "7-day trend") */
  sparkCaption?: string;
  /** Smaller value type for restrained KPI rows */
  compact?: boolean;
}

const iconColorMap = {
  neutral: { icon: "text-muted-foreground", progress: "bg-primary", spark: "bg-primary", sparkMuted: "bg-muted-foreground/25" },
  primary: { icon: "text-primary", progress: "bg-primary", spark: "bg-primary", sparkMuted: "bg-primary/25" },
  accent: { icon: "text-primary", progress: "bg-primary", spark: "bg-primary", sparkMuted: "bg-primary/25" },
  success: { icon: "text-success", progress: "bg-success", spark: "bg-success", sparkMuted: "bg-success/25" },
  warning: { icon: "text-warning", progress: "bg-warning", spark: "bg-warning", sparkMuted: "bg-warning/25" },
  destructive: { icon: "text-destructive", progress: "bg-destructive", spark: "bg-destructive", sparkMuted: "bg-destructive/25" },
};

export function StatCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  iconColor = "neutral",
  progressValue,
  sparkData,
  sparkLabels,
  sparkUnit = "item",
  sparkCaption = "7-day trend",
  compact = false,
}: StatCardProps) {
  const colors = iconColorMap[iconColor];

  const TrendIcon =
    changeType === "positive"
      ? TrendingUp
      : changeType === "negative"
        ? TrendingDown
        : Minus;

  const sparkMax = sparkData ? Math.max(...sparkData, 1) : 1;

  return (
    <div className={cn("border border-border bg-card card-shadow", compact ? "rounded-xl p-3.5" : "rounded-lg p-4")}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0 flex-1">
          <p className="meta-text uppercase tracking-wider truncate">{title}</p>
          <p className={cn("truncate tracking-tight text-foreground", compact ? "text-xl font-semibold" : "metric-value")}>{value}</p>
          {change && (
            <div className="flex items-center gap-1.5">
              <TrendIcon
                className={cn(
                  "h-3 w-3 flex-shrink-0",
                  changeType === "positive" && "text-success",
                  changeType === "negative" && "text-destructive",
                  changeType === "neutral" && "text-muted-foreground",
                )}
              />
              <span
                className={cn(
                  "supporting-text font-medium",
                  changeType === "positive" && "text-success",
                  changeType === "negative" && "text-destructive",
                  changeType === "neutral" && "text-muted-foreground",
                )}
              >
                {change}
              </span>
            </div>
          )}
        </div>
        <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", colors.icon)} aria-hidden />
      </div>

      {sparkData && sparkData.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-end gap-0.5 h-7">
            {sparkData.map((v, i) => {
              const isLast = i === sparkData.length - 1;
              const heightPct = sparkMax > 0 ? Math.max(8, Math.round((v / sparkMax) * 100)) : 8;
              const label = sparkLabels?.[i];
              const plural = v !== 1 ? "s" : "";
              const tooltipText = label
                ? `${label}: ${v} ${sparkUnit}${plural}`
                : `${v} ${sparkUnit}${plural}`;
              return (
                <div
                  key={i}
                  className="relative flex-1 flex flex-col items-center justify-end h-full"
                  title={tooltipText}
                >
                  <div
                    className={cn("w-full rounded-sm", isLast ? colors.spark : colors.sparkMuted)}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
              );
            })}
          </div>
          <p className="meta-text mt-1 text-right">{sparkCaption}</p>
        </div>
      )}

      {progressValue !== undefined && !sparkData && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full", colors.progress)}
              style={{ width: `${Math.min(100, Math.max(0, progressValue))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
