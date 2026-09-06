import React, { useState } from "react";
import {
  Activity, Rocket, ShieldAlert, BarChart3, Layers, CheckCircle2, RefreshCw, Zap
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { SystemMetricsDashboard } from "./SystemMetricsDashboard";
import { DeploymentReleaseManager } from "./DeploymentReleaseManager";
import { IncidentStatusCenter } from "./IncidentStatusCenter";
import { cn } from "@/shared/lib/utils";

export function OperationalExcellenceHub({ className }: { className?: string }) {
  const [activeTab, setActiveTab] = useState("metrics");

  return (
    <div className={cn("space-y-4", className)}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="h-9 p-1 bg-muted/40 border">
          <TabsTrigger value="metrics" className="text-xs font-bold gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Performance & Vitals
          </TabsTrigger>
          <TabsTrigger value="deployments" className="text-xs font-bold gap-1.5">
            <Rocket className="h-3.5 w-3.5" /> Deployments & Rollouts
          </TabsTrigger>
          <TabsTrigger value="incidents" className="text-xs font-bold gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5" /> Incidents & Status Page
          </TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="m-0">
          <SystemMetricsDashboard />
        </TabsContent>

        <TabsContent value="deployments" className="m-0">
          <DeploymentReleaseManager />
        </TabsContent>

        <TabsContent value="incidents" className="m-0">
          <IncidentStatusCenter />
        </TabsContent>
      </Tabs>
    </div>
  );
}
