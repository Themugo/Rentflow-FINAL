import React from "react";
import { AlertTriangle, TrendingDown, DollarSign, ShieldAlert, CheckCircle2, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

export interface AnalyticsAlert {
  id: string;
  title: string;
  severity: "critical" | "warning" | "informational";
  metric: string;
  currentValue: string;
  threshold: string;
  timestamp: string;
  propertyName?: string;
}

const SAMPLE_ALERTS: AnalyticsAlert[] = [
  { id: "alt-01", title: "Rent Collection Below Target", severity: "critical", metric: "Collection Efficiency", currentValue: "82.4%", threshold: "95.0%", timestamp: "2 hours ago", propertyName: "Sunset Heights Towers" },
  { id: "alt-02", title: "Maintenance Expense Spike", severity: "warning", metric: "Monthly Repair Budget", currentValue: "KES 145,000", threshold: "KES 100,000", timestamp: "5 hours ago", propertyName: "Parkview Executive Apartments" },
  { id: "alt-03", title: "Occupancy Rate Drop Warning", severity: "warning", metric: "Occupancy Rate", currentValue: "78.0%", threshold: "85.0%", timestamp: "1 day ago", propertyName: "Kilimani Crest Plaza" },
];

export function AnalyticsAlertPanel({ className }: { className?: string }) {
  return (
    <Card className={cn("border-border/80 bg-card shadow-sm", className)}>
      <CardHeader className="p-4 border-b bg-muted/20 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-warning" />
          <CardTitle className="text-sm font-bold text-foreground">Operational Analytics Alerts</CardTitle>
        </div>
        <Badge variant="outline" className="text-xs font-bold bg-warning/10 text-warning border-warning/20">
          {SAMPLE_ALERTS.length} Active Triggers
        </Badge>
      </CardHeader>

      <CardContent className="p-4 space-y-2.5">
        {SAMPLE_ALERTS.map((alt) => (
          <div
            key={alt.id}
            className={cn(
              "p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs",
              alt.severity === "critical" && "bg-red-500/5 border-red-500/20",
              alt.severity === "warning" && "bg-warning/5 border-warning/20",
              alt.severity === "informational" && "bg-primary/5 border-primary/20"
            )}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className={cn("h-4 w-4 shrink-0", alt.severity === "critical" ? "text-red-500" : "text-warning")} />
                <span className="font-bold text-foreground">{alt.title}</span>
                {alt.propertyName && (
                  <span className="text-muted-foreground text-[11px]">• {alt.propertyName}</span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground pl-6">
                Current {alt.metric}: <strong className="text-foreground">{alt.currentValue}</strong> (Target Threshold: {alt.threshold})
              </p>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0">
              <span className="text-[10px] text-muted-foreground">{alt.timestamp}</span>
              <Button size="sm" variant="ghost" className="h-7 text-xs font-bold gap-1 text-primary hover:bg-primary/10">
                Investigate <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
