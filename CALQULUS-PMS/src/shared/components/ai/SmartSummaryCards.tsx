import React from "react";
import { Sparkles, TrendingUp, AlertTriangle, ShieldCheck, FileText, Wrench, CheckCircle2, ArrowUpRight, Zap } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

export interface SummaryCardProps {
  type: "dashboard" | "lease" | "maintenance" | "anomaly" | "prediction";
  title: string;
  badgeLabel: string;
  summaryText: string;
  keyInsights: string[];
  recommendedAction?: string;
  riskLevel?: "low" | "medium" | "high";
  className?: string;
}

export function SmartSummaryCard({
  type,
  title,
  badgeLabel,
  summaryText,
  keyInsights,
  recommendedAction,
  riskLevel = "low",
  className,
}: SummaryCardProps) {
  return (
    <Card
      className={cn(
        "border-border/80 bg-card shadow-sm hover:border-primary/40 transition-all text-xs space-y-3 p-4",
        riskLevel === "high" && "border-warning/30 bg-warning/5",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <h4 className="font-bold text-foreground text-xs">{title}</h4>
        </div>

        <Badge
          variant="outline"
          className={cn(
            "text-[9px] font-bold uppercase",
            riskLevel === "high" && "bg-warning/10 text-warning border-warning/20",
            riskLevel === "medium" && "bg-blue-500/10 text-blue-600 border-blue-500/20",
            riskLevel === "low" && "bg-success/10 text-success border-success/20"
          )}
        >
          {badgeLabel}
        </Badge>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">{summaryText}</p>

      {/* Bullet Insights */}
      <div className="space-y-1.5 pt-1 border-t border-border/50">
        <span className="text-[10px] font-bold text-foreground uppercase tracking-wider block">Key AI Insights:</span>
        <ul className="space-y-1 text-[11px] text-muted-foreground">
          {keyInsights.map((insight, idx) => (
            <li key={idx} className="flex items-start gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              <span>{insight}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Recommended Action */}
      {recommendedAction && (
        <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold text-foreground">Action: {recommendedAction}</span>
          <Button size="sm" variant="outline" className="h-6 text-[10px] font-bold gap-1 px-2 border-primary/30 text-primary">
            Execute <ArrowUpRight className="h-3 w-3" />
          </Button>
        </div>
      )}
    </Card>
  );
}

export function SmartSummaryGrid({ className }: { className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", className)}>
      <SmartSummaryCard
        type="dashboard"
        title="Portfolio health intelligence"
        badgeLabel="Live data"
        summaryText="Portfolio health is calculated from the live management analytics and executive intelligence layers rather than hard-coded sample metrics."
        keyInsights={[
          "Use the executive portfolio intelligence panel for explainable health and risk drivers",
          "Use portfolio financial intelligence for current cash, collection and arrears measures",
        ]}
      />

      <SmartSummaryCard
        type="anomaly"
        title="Tenant retention signals"
        badgeLabel="Explainable"
        riskLevel="medium"
        summaryText="Tenant retention monitoring uses observable operational signals and does not claim a predictive renewal probability."
        keyInsights={[
          "Payment stress, service experience and renewal-window signals are surfaced separately",
          "Recommended actions are grounded in the current tenant record and workflow state",
        ]}
      />

      <SmartSummaryCard
        type="maintenance"
        title="Service recovery loop"
        badgeLabel="Actionable"
        summaryText="Material tenant-experience issues can be converted into accountable recovery cases, tracked through resolution and linked follow-up communications."
        keyInsights={[
          "Service-quality issues can become owned recovery work",
          "Follow-up communications remain auditable and channel-aware",
        ]}
      />
    </div>
  );
}
