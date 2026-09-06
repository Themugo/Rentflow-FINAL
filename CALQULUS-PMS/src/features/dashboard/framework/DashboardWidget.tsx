import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { RotateCw, ChevronDown, ChevronUp, ExternalLink, MoreVertical, Maximize2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export interface DashboardWidgetProps {
  title: string;
  description?: string;
  icon?: React.ElementType;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  accentColor?: "primary" | "emerald" | "amber" | "red" | "sky" | "purple";
  headerActions?: React.ReactNode;
  footerActions?: React.ReactNode;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  children: React.ReactNode;
  className?: string;
  collapsible?: boolean;
  colSpan?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
}

export function DashboardWidget({
  title,
  description,
  icon: Icon,
  badge,
  badgeVariant = "secondary",
  accentColor = "primary",
  headerActions,
  footerActions,
  onRefresh,
  isRefreshing = false,
  children,
  className,
  collapsible = false,
  colSpan,
}: DashboardWidgetProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const colSpanClasses = {
    1: "lg:col-span-1",
    2: "lg:col-span-2",
    3: "lg:col-span-3",
    4: "lg:col-span-4",
    5: "lg:col-span-5",
    6: "lg:col-span-6",
    7: "lg:col-span-7",
    8: "lg:col-span-8",
    9: "lg:col-span-9",
    10: "lg:col-span-10",
    11: "lg:col-span-11",
    12: "lg:col-span-12",
  };

  const accentBorderClasses = {
    primary: "border-l-4 border-l-primary",
    emerald: "border-l-4 border-l-success",
    amber: "border-l-4 border-l-warning",
    red: "border-l-4 border-l-destructive",
    sky: "border-l-4 border-l-primary",
    purple: "border-l-4 border-l-navy-mid",
  };

  const iconColorClasses = {
    primary: "text-primary bg-primary/10",
    emerald: "text-success bg-success/10",
    amber: "text-warning bg-warning/10",
    red: "text-destructive bg-destructive/10",
    sky: "text-primary bg-primary/10",
    purple: "text-navy-mid bg-navy-mid/10",
  };

  return (
    <Card
      className={cn(
        "border border-border bg-card hover:border-border/90 hover:shadow-2xs transition-all duration-200 overflow-hidden",
        colSpan ? colSpanClasses[colSpan] : "",
        className
      )}
    >
      <CardHeader className="p-3.5 sm:p-4 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0", iconColorClasses[accentColor])}>
              <Icon className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-bold text-foreground truncate">{title}</CardTitle>
              {badge && (
                <Badge variant={badgeVariant} className="text-[10px] h-4 px-1.5 font-bold shrink-0">
                  {badge}
                </Badge>
              )}
            </div>
            {description && (
              <CardDescription className="text-[11px] text-muted-foreground truncate mt-0.5">
                {description}
              </CardDescription>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {headerActions}

          {onRefresh && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={onRefresh}
              title="Refresh widget"
            >
              <RotateCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin text-primary")} />
            </Button>
          )}

          {collapsible && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={isCollapsed ? "Expand widget" : "Collapse widget"}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            </Button>
          )}
        </div>
      </CardHeader>

      {!isCollapsed && <CardContent className="p-4">{children}</CardContent>}

      {!isCollapsed && footerActions && (
        <CardFooter className="p-3 px-4 border-t border-border/50 bg-muted/10 flex items-center justify-between text-xs">
          {footerActions}
        </CardFooter>
      )}
    </Card>
  );
}
