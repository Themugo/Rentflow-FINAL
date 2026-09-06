import React, { useState } from "react";
import {
  TrendingUp, DollarSign, Users, Clock, HeartPulse, Sparkles, BarChart2, ShieldCheck
} from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils";

export function CommercialKpiDashboard({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4 text-xs", className)}>
      <div className="p-4 rounded-xl border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-success" /> Executive Commercial KPI & Financial Growth Metrics
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time tracking of Annual Recurring Revenue (ARR), Monthly Active Users (MAU), NRR, CAC Payback, LTV, and CSAT.
          </p>
        </div>

        <Badge className="bg-success/10 text-success border-success/20 text-[10px] font-bold">
          ARR: KES 48.6M (+38% YoY)
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 border rounded-xl bg-card space-y-1">
          <span className="text-[10px] text-muted-foreground font-bold uppercase block">Annual Recurring Revenue</span>
          <strong className="text-lg font-black text-success">KES 48.6M</strong>
          <span className="text-[9px] text-success font-bold block">+3.8M New ARR this Quarter</span>
        </Card>

        <Card className="p-3 border rounded-xl bg-card space-y-1">
          <span className="text-[10px] text-muted-foreground font-bold uppercase block">Monthly Active Tenants</span>
          <strong className="text-lg font-black text-foreground">18,420 MAU</strong>
          <span className="text-[9px] text-success font-bold block">94.8% Engagement Rate</span>
        </Card>

        <Card className="p-3 border rounded-xl bg-card space-y-1">
          <span className="text-[10px] text-muted-foreground font-bold uppercase block">Customer Acquisition Cost</span>
          <strong className="text-lg font-black text-blue-600">KES 12,400</strong>
          <span className="text-[9px] text-success font-bold block">3.1 Months Payback</span>
        </Card>

        <Card className="p-3 border rounded-xl bg-card space-y-1">
          <span className="text-[10px] text-muted-foreground font-bold uppercase block">Customer Satisfaction (CSAT)</span>
          <strong className="text-lg font-black text-warning">4.9 / 5.0</strong>
          <span className="text-[9px] text-success font-bold block">98% First Contact Resolution</span>
        </Card>
      </div>
    </div>
  );
}
