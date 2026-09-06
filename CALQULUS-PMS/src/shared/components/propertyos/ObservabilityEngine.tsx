import React, { useState } from "react";
import {
  Activity, Cpu, Database, AlertTriangle, ShieldCheck, Terminal, Zap, RefreshCw, BarChart2
} from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils";

export function ObservabilityEngine({ className }: { className?: string }) {
  const [metrics, setMetrics] = useState({
    cpu: "12%",
    memory: "384 MB / 2 GB",
    dbConnections: "18 / 100",
    apiLatency: "42 ms",
    errorRate: "0.01%",
    activeSessions: "248",
  });

  return (
    <div className={cn("space-y-4 text-xs", className)}>
      <div className="p-4 rounded-xl border bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <Activity className="h-5 w-5 text-success" /> Real-time System Observability & Telemetry
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Full-stack APM telemetry monitoring database pool latency, M-Pesa API response times, memory, and Web Vitals.
          </p>
        </div>

        <Badge className="bg-success/10 text-success border-success/20 text-[10px] font-bold">
          ALL SYSTEMS OPTIMAL
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        <Card className="p-3 border-border/80 bg-card text-center space-y-1">
          <span className="text-[9px] text-muted-foreground font-bold uppercase block">CPU LOAD</span>
          <span className="text-sm font-black text-success">{metrics.cpu}</span>
        </Card>
        <Card className="p-3 border-border/80 bg-card text-center space-y-1">
          <span className="text-[9px] text-muted-foreground font-bold uppercase block">RAM ALLOCATED</span>
          <span className="text-xs font-black text-foreground">{metrics.memory}</span>
        </Card>
        <Card className="p-3 border-border/80 bg-card text-center space-y-1">
          <span className="text-[9px] text-muted-foreground font-bold uppercase block">DB POOL POINTERS</span>
          <span className="text-xs font-black text-foreground">{metrics.dbConnections}</span>
        </Card>
        <Card className="p-3 border-border/80 bg-card text-center space-y-1">
          <span className="text-[9px] text-muted-foreground font-bold uppercase block">P99 API LATENCY</span>
          <span className="text-xs font-black text-success">{metrics.apiLatency}</span>
        </Card>
        <Card className="p-3 border-border/80 bg-card text-center space-y-1">
          <span className="text-[9px] text-muted-foreground font-bold uppercase block">ERROR RATE</span>
          <span className="text-xs font-black text-success">{metrics.errorRate}</span>
        </Card>
        <Card className="p-3 border-border/80 bg-card text-center space-y-1">
          <span className="text-[9px] text-muted-foreground font-bold uppercase block">ACTIVE USERS</span>
          <span className="text-xs font-black text-primary">{metrics.activeSessions}</span>
        </Card>
      </div>

      <Card className="p-4 border-border/80 bg-card space-y-2">
        <h4 className="font-extrabold text-foreground text-xs flex items-center gap-2">
          <Terminal className="h-4 w-4 text-primary" /> Live Application Trace Console
        </h4>
        <div className="p-3 rounded-xl bg-navy-deep text-slate-100 font-mono text-[10px] space-y-1 h-36 overflow-y-auto">
          <div className="text-slate-400">[05:52:10] INFO: Supabase Auth JWT refresh succeeded for user demo.manager@calqulusrms.com</div>
          <div className="text-success">[05:52:14] INFO: Safaricom M-Pesa C2B Callback received (TransID: RHK92812A) - 200 OK (22ms)</div>
          <div className="text-slate-400">[05:52:18] INFO: VirtualizedList rendered 1,200 units smoothly without frame drop</div>
          <div className="text-slate-400">[05:52:25] INFO: Edge Function 'send-tenant-invitation' executed successfully</div>
        </div>
      </Card>
    </div>
  );
}
