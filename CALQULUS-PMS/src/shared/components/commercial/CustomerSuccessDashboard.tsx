import React, { useState } from "react";
import {
  Users, HeartPulse, TrendingUp, AlertTriangle, CheckCircle2, ShieldCheck, HelpCircle, GraduationCap, BarChart3, Star
} from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Progress } from "@/shared/components/ui/progress";
import { cn } from "@/shared/lib/utils";

export interface CustomerHealthItem {
  id: string;
  accountName: string;
  plan: "Enterprise" | "Pro" | "Lite";
  healthScore: number;
  nrr: string;
  riskStatus: "Low Risk" | "Medium Risk" | "At Risk";
  activeUnits: number;
  onboardingProgress: number;
}

const SAMPLE_CUSTOMERS: CustomerHealthItem[] = [
  {
    id: "cust-1",
    accountName: "Kilimani Heights Property Management Ltd",
    plan: "Enterprise",
    healthScore: 94,
    nrr: "128%",
    riskStatus: "Low Risk",
    activeUnits: 240,
    onboardingProgress: 100,
  },
  {
    id: "cust-2",
    accountName: "Westlands Commercial Agencies",
    plan: "Enterprise",
    healthScore: 88,
    nrr: "115%",
    riskStatus: "Low Risk",
    activeUnits: 180,
    onboardingProgress: 100,
  },
  {
    id: "cust-3",
    accountName: "Lavington Executive Properties",
    plan: "Pro",
    healthScore: 62,
    nrr: "92%",
    riskStatus: "Medium Risk",
    activeUnits: 45,
    onboardingProgress: 75,
  },
  {
    id: "cust-4",
    accountName: "Karen Haven Residences",
    plan: "Pro",
    healthScore: 38,
    nrr: "80%",
    riskStatus: "At Risk",
    activeUnits: 28,
    onboardingProgress: 40,
  },
];

export function CustomerSuccessDashboard({ className }: { className?: string }) {
  const [customers] = useState<CustomerHealthItem[]>(SAMPLE_CUSTOMERS);

  return (
    <div className={cn("space-y-4 text-xs", className)}>
      <div className="p-4 rounded-xl border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
              <HeartPulse className="h-5 w-5 text-success" /> Customer Success & Health Scoring Command Center
            </h3>
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-[10px] font-bold">
              DEMO / LAB ENVIRONMENT
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitor client adoption metrics, account expansion NRR, risk alerts, feature utilization, and renewal health.
          </p>
        </div>

        <Badge className="bg-success/10 text-success border-success/20 text-[10px] font-bold">
          HEALTH INDEX: 84/100 (LOW CHURN)
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 border rounded-xl bg-card space-y-1">
          <span className="text-[10px] text-muted-foreground font-bold uppercase block">Net Revenue Retention</span>
          <strong className="text-lg font-black text-success">118% NRR</strong>
          <span className="text-[9px] text-success font-bold block">+12% Expansion ARR</span>
        </Card>

        <Card className="p-3 border rounded-xl bg-card space-y-1">
          <span className="text-[10px] text-muted-foreground font-bold uppercase block">Customer Churn Rate</span>
          <strong className="text-lg font-black text-foreground">0.8% / mo</strong>
          <span className="text-[9px] text-success font-bold block">Top Quartile Benchmark</span>
        </Card>

        <Card className="p-3 border rounded-xl bg-card space-y-1">
          <span className="text-[10px] text-muted-foreground font-bold uppercase block">Avg Time to Value</span>
          <strong className="text-lg font-black text-blue-600">4.2 Days</strong>
          <span className="text-[9px] text-muted-foreground block">Onboarding SLA</span>
        </Card>

        <Card className="p-3 border rounded-xl bg-card space-y-1">
          <span className="text-[10px] text-muted-foreground font-bold uppercase block">Accounts at Risk</span>
          <strong className="text-lg font-black text-warning">1 Account</strong>
          <span className="text-[9px] text-warning font-bold block">Action Plan Assigned</span>
        </Card>
      </div>

      <div className="space-y-3">
        {customers.map((c) => (
          <Card key={c.id} className="border-border/80 bg-card p-4 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[9px] font-bold">
                  {c.plan}
                </Badge>
                <span className="font-extrabold text-foreground text-xs">{c.accountName}</span>
              </div>
              <Badge
                className={cn(
                  "text-[9px] font-bold uppercase border-none",
                  c.riskStatus === "Low Risk" ? "bg-success/10 text-success" :
                  c.riskStatus === "Medium Risk" ? "bg-warning/10 text-warning" : "bg-rose-500/10 text-rose-600"
                )}
              >
                {c.riskStatus}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
              <div>
                <span className="text-muted-foreground block">Health Score Index:</span>
                <strong className="text-foreground font-bold">{c.healthScore} / 100</strong>
                <Progress value={c.healthScore} className="h-1.5 mt-1" />
              </div>

              <div>
                <span className="text-muted-foreground block">Managed Units:</span>
                <strong className="text-foreground font-bold">{c.activeUnits} Units</strong>
              </div>

              <div>
                <span className="text-muted-foreground block">Expansion Metric:</span>
                <strong className="text-success font-bold">{c.nrr} NRR</strong>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
