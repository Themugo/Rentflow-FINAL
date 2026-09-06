import React, { useState } from "react";
import {
  Zap, Play, Plus, Clock, Bell, CheckCircle2, AlertCircle, ArrowRight, CornerDownRight, RefreshCw, Layers
} from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Switch } from "@/shared/components/ui/switch";
import { cn } from "@/shared/lib/utils";

export interface WorkflowRule {
  id: string;
  name: string;
  trigger: string;
  condition: string;
  action: string;
  enabled: boolean;
  lastExecuted: string;
}

const SAMPLE_WORKFLOWS: WorkflowRule[] = [
  {
    id: "wf-1",
    name: "Automated Lease Escalation & Notice",
    trigger: "On Date = Lease Expiry - 60 Days",
    condition: "Tenant Occupancy Status == Active",
    action: "Generate Renewal PDF & Send WhatsApp + Email",
    enabled: true,
    lastExecuted: "Today at 04:15 AM",
  },
  {
    id: "wf-2",
    name: "M-Pesa STK Push Overdue Rent Collector",
    trigger: "On Date = 5th of Month & Rent Unpaid",
    condition: "Tenant Outstanding Balance > KES 0",
    action: "Trigger M-Pesa STK Push Prompt to Tenant Phone",
    enabled: true,
    lastExecuted: "Jul 28, 2026",
  },
  {
    id: "wf-3",
    name: "Emergency Water Leak Vendor Dispatch",
    trigger: "IoT Water Meter Flow Rate > 30 m³/hr",
    condition: "Duration > 15 minutes",
    action: "Close Smart Valve & Dispatch HydroPlumb Vendor",
    enabled: true,
    lastExecuted: "Jul 18, 2026",
  },
];

export function AutomationStudio({ className }: { className?: string }) {
  const [workflows, setWorkflows] = useState<WorkflowRule[]>(SAMPLE_WORKFLOWS);
  const [testedId, setTestedId] = useState<string | null>(null);

  const toggleWorkflow = (id: string) => {
    setWorkflows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w))
    );
  };

  const handleTestWorkflow = (id: string) => {
    setTestedId(id);
    setTimeout(() => setTestedId(null), 2000);
  };

  return (
    <div className={cn("space-y-4 text-xs", className)}>
      <div className="p-4 rounded-xl border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
              <Zap className="h-5 w-5 text-warning" /> Visual Property Automation Studio
            </h3>
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-[10px] font-bold">
              DEMO / LAB ENVIRONMENT
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure visual event-driven workflows, multi-step triggers, conditions, automated approvals, and notification loops.
          </p>
        </div>

        <Button size="sm" className="h-8 text-xs font-bold gap-1 bg-primary text-primary-foreground">
          <Plus className="h-3.5 w-3.5" /> Create Visual Automation Flow
        </Button>
      </div>

      <div className="space-y-3">
        {workflows.map((wf) => (
          <Card key={wf.id} className="border-border/80 bg-card p-4 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="font-extrabold text-foreground text-xs">{wf.name}</span>
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTestWorkflow(wf.id)}
                  className="h-7 text-[10px] font-bold gap-1"
                >
                  <Play className="h-3 w-3 text-success" />
                  {testedId === wf.id ? "Test Execution OK!" : "Dry Run Test"}
                </Button>
                <Switch checked={wf.enabled} onCheckedChange={() => toggleWorkflow(wf.id)} className="scale-75" />
              </div>
            </div>

            {/* Visual Canvas Representation */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 p-2.5 rounded-xl bg-muted/30 border text-[11px]">
              <div className="space-y-0.5 border-r pr-2">
                <span className="text-[9px] text-muted-foreground font-bold uppercase block">1. TRIGGER</span>
                <span className="font-bold text-primary">{wf.trigger}</span>
              </div>
              <div className="space-y-0.5 border-r pr-2">
                <span className="text-[9px] text-muted-foreground font-bold uppercase block">2. CONDITION</span>
                <span className="font-bold text-warning">{wf.condition}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[9px] text-muted-foreground font-bold uppercase block">3. AUTOMATED ACTION</span>
                <span className="font-bold text-success">{wf.action}</span>
              </div>
            </div>

            <div className="flex justify-between items-center text-[10px] text-muted-foreground">
              <span>Execution Engine: PropertyOS Event Bus v3.2</span>
              <span>Last Executed: <strong className="text-foreground">{wf.lastExecuted}</strong></span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
