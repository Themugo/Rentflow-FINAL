import React from "react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Progress } from "@/shared/components/ui/progress";
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export interface DashboardKPIProps {
  title: string;
  value: string | number;
  change?: string | number;
  changeType?: "increase" | "decrease" | "neutral";
  periodLabel?: string;
  icon?: React.ElementType;
  color?: "primary" | "success" | "warning" | "danger" | "info" | "navy";
  progress?: number;
  subtitle?: string;
  onClick?: () => void;
  className?: string;
}

export function DashboardKPI({
  title,
  value,
  change,
  changeType = "neutral",
  periodLabel = "vs last month",
  icon: Icon,
  color = "primary",
  progress,
  subtitle,
  onClick,
  className,
}: DashboardKPIProps) {
  const colorStyles = {
    primary: {
      bg: "bg-primary/5",
      border: "border-primary/20",
      iconBg: "bg-primary/10 text-primary",
      badge: "bg-primary/10 text-primary border-primary/20",
    },
    success: {
      bg: "bg-success/5",
      border: "border-success/20",
      iconBg: "bg-success/10 text-success",
      badge: "bg-success/10 text-success border-success/20",
    },
    warning: {
      bg: "bg-warning/5",
      border: "border-warning/20",
      iconBg: "bg-warning/10 text-warning",
      badge: "bg-warning/10 text-warning border-warning/20",
    },
    danger: {
      bg: "bg-destructive/5",
      border: "border-destructive/20",
      iconBg: "bg-destructive/10 text-destructive",
      badge: "bg-destructive/10 text-destructive border-destructive/20",
    },
    info: {
      bg: "bg-primary/5",
      border: "border-primary/20",
      iconBg: "bg-primary/10 text-primary",
      badge: "bg-primary/10 text-primary border-primary/20",
    },
    navy: {
      bg: "bg-navy-mid/5",
      border: "border-navy-mid/20",
      iconBg: "bg-navy-mid/10 text-navy-mid",
      badge: "bg-navy-mid/10 text-navy-mid border-navy-mid/20",
    },
  };

  const style = colorStyles[color];

  return (
    <Card
      onClick={onClick}
      className={cn(
        "border bg-card",
        onClick && "cursor-pointer hover:border-primary/40",
        style.border,
        className
      )}
    >
      <CardContent className="p-4 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
          {Icon && (
            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", style.iconBg)}>
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>

        <div>
          <h3 className="text-2xl font-semibold text-foreground tracking-tight">{value}</h3>
          {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>

        {progress !== undefined && (
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
              <span>Target Progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        )}

        {change !== undefined && (
          <div className="flex items-center gap-1.5 pt-1 text-[11px]">
            <Badge
              variant="outline"
              className={cn(
                "h-5 px-1.5 gap-0.5 text-[10px] font-bold border",
                changeType === "increase"
                  ? "bg-success/10 text-success border-success/30"
                  : changeType === "decrease"
                  ? "bg-destructive/10 text-destructive border-destructive/30"
                  : "bg-muted text-muted-foreground border-border"
              )}
            >
              {changeType === "increase" && <ArrowUpRight className="h-3 w-3" />}
              {changeType === "decrease" && <ArrowDownRight className="h-3 w-3" />}
              {changeType === "neutral" && <Minus className="h-3 w-3" />}
              {change}
            </Badge>
            <span className="text-muted-foreground truncate">{periodLabel}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
