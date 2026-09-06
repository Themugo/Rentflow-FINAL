import React, { useState } from "react";
import {
  TrendingUp, Target, DollarSign, Calendar, CheckCircle2, UserCheck, Play, ArrowRight, Building2, Filter
} from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils";

export interface DealStage {
  id: string;
  leadName: string;
  company: string;
  stage: "Discovery" | "Demo Completed" | "Proposal Sent" | "Procurement" | "Closed Won";
  arrValue: string;
  unitsCount: number;
}

const SAMPLE_DEALS: DealStage[] = [
  {
    id: "deal-1",
    leadName: "James Kamau",
    company: "Gigiri Executive Estates",
    stage: "Procurement",
    arrValue: "KES 1,200,000",
    unitsCount: 350,
  },
  {
    id: "deal-2",
    leadName: "Sarah Omolo",
    company: "Mombasa Coastal Properties",
    stage: "Proposal Sent",
    arrValue: "KES 850,000",
    unitsCount: 220,
  },
  {
    id: "deal-3",
    leadName: "David Njuguna",
    company: "Upperhill Commercial Towers",
    stage: "Demo Completed",
    arrValue: "KES 2,400,000",
    unitsCount: 600,
  },
];

export function GtmSalesWorkspace({ className }: { className?: string }) {
  const [deals] = useState<DealStage[]>(SAMPLE_DEALS);

  return (
    <div className={cn("space-y-4 text-xs", className)}>
      <div className="p-4 rounded-xl border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
              <Target className="h-5 w-5 text-success" /> Go-To-Market & Sales Pipeline Command Workspace
            </h3>
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-[10px] font-bold">
              DEMO / LAB ENVIRONMENT
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Enterprise sales funnel tracking, self-serve demo environment launcher, trial conversion SLA, and procurement enablement.
          </p>
        </div>

        <Button size="sm" className="h-8 text-xs font-bold gap-1 bg-primary text-primary-foreground">
          <Play className="h-3.5 w-3.5" /> Launch Guided Interactive Demo
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 border rounded-xl bg-card space-y-1">
          <span className="text-[10px] text-muted-foreground font-bold uppercase block">Pipeline ARR</span>
          <strong className="text-lg font-black text-foreground">KES 14.8M</strong>
          <span className="text-[9px] text-success font-bold block">18 Active Opportunities</span>
        </Card>

        <Card className="p-3 border rounded-xl bg-card space-y-1">
          <span className="text-[10px] text-muted-foreground font-bold uppercase block">Trial Conversion</span>
          <strong className="text-lg font-black text-success">34.2%</strong>
          <span className="text-[9px] text-success font-bold block">+4.1% MoM Improvement</span>
        </Card>

        <Card className="p-3 border rounded-xl bg-card space-y-1">
          <span className="text-[10px] text-muted-foreground font-bold uppercase block">Avg Deal Size</span>
          <strong className="text-lg font-black text-blue-600">KES 1.1M ARR</strong>
          <span className="text-[9px] text-muted-foreground block">Enterprise Tier</span>
        </Card>

        <Card className="p-3 border rounded-xl bg-card space-y-1">
          <span className="text-[10px] text-muted-foreground font-bold uppercase block">Sales Cycle Duration</span>
          <strong className="text-lg font-black text-foreground">14 Days</strong>
          <span className="text-[9px] text-success font-bold block">Fast Frictionless Closure</span>
        </Card>
      </div>

      <div className="space-y-3">
        {deals.map((d) => (
          <Card key={d.id} className="border-border/80 bg-card p-4 space-y-2">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="space-y-0.5">
                <span className="font-extrabold text-foreground text-xs block">{d.company}</span>
                <span className="text-[10px] text-muted-foreground">Lead Contact: {d.leadName}</span>
              </div>
              <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] font-bold">
                {d.stage}
              </Badge>
            </div>

            <div className="flex justify-between items-center text-[11px] pt-1">
              <span className="text-muted-foreground">Managed Portfolio Size: <strong className="text-foreground">{d.unitsCount} Units</strong></span>
              <span className="font-bold text-success">{d.arrValue} ARR</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
