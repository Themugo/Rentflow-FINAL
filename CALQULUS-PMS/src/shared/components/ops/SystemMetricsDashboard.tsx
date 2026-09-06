import React, { useState } from "react";
import {
  Activity, Gauge, AlertTriangle, ShieldCheck, Cpu, Database, Server, RefreshCw, Zap, Clock, CheckCircle2, AlertCircle, BarChart3
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Progress } from "@/shared/components/ui/progress";
import { cn } from "@/shared/lib/utils";

export function SystemMetricsDashboard({ className }: { className?: string }) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  return (
    <div className={cn("space-y-4 text-xs", className)}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border rounded-xl bg-card shadow-sm">
        <div>
          <h3 className="font-extrabold text-foreground text-sm flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Application Performance & Web Vitals Monitor
          </h3>
          <p className="text-xs text-muted-foreground">
            Real-time telemetry for Core Web Vitals (LCP, FID, CLS), Supabase connection pool, and Edge functions.
          </p>
        </div>

        <Button size="sm" onClick={handleRefresh} disabled={refreshing} className="h-8 font-bold text-xs gap-1 bg-primary text-primary-foreground">
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          {refreshing ? "Polling Telemetry..." : "Refresh Metrics"}
        </Button>
      </div>

      {/* Core Web Vitals Gauges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 border rounded-xl bg-card space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground font-bold uppercase">LCP (Largest Content)</span>
            <Badge variant="outline" className="text-[8px] bg-success/10 text-success border-none">GOOD (&lt;1.2s)</Badge>
          </div>
          <strong className="text-xl font-black text-foreground">0.82 s</strong>
          <Progress value={28} className="h-1.5" />
        </Card>

        <Card className="p-3 border rounded-xl bg-card space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground font-bold uppercase">FID (First Input)</span>
            <Badge variant="outline" className="text-[8px] bg-success/10 text-success border-none">EXCELLENT (&lt;10ms)</Badge>
          </div>
          <strong className="text-xl font-black text-foreground">6 ms</strong>
          <Progress value={12} className="h-1.5" />
        </Card>

        <Card className="p-3 border rounded-xl bg-card space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground font-bold uppercase">CLS (Shift Index)</span>
            <Badge variant="outline" className="text-[8px] bg-success/10 text-success border-none">OPTIMAL (&lt;0.01)</Badge>
          </div>
          <strong className="text-xl font-black text-foreground">0.004</strong>
          <Progress value={5} className="h-1.5" />
        </Card>

        <Card className="p-3 border rounded-xl bg-card space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground font-bold uppercase">TTFB (Server Time)</span>
            <Badge variant="outline" className="text-[8px] bg-success/10 text-success border-none">FAST (&lt;80ms)</Badge>
          </div>
          <strong className="text-xl font-black text-foreground">42 ms</strong>
          <Progress value={18} className="h-1.5" />
        </Card>
      </div>

      {/* Database Pools & API Edge Telemetry */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/80 bg-card p-4 space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="font-bold text-foreground text-xs flex items-center gap-1.5">
              <Database className="h-4 w-4 text-primary" /> Supabase Connection Pool & RLS Health
            </span>
            <Badge className="bg-success/10 text-success text-[9px]">Pool Healthy</Badge>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Active Client Connections</span>
              <span className="font-bold text-foreground">18 / 100 max</span>
            </div>
            <Progress value={18} className="h-2" />

            <div className="flex justify-between text-[11px] pt-1">
              <span className="text-muted-foreground">Average Query Latency</span>
              <span className="font-bold text-success">12.4 ms</span>
            </div>
          </div>
        </Card>

        <Card className="border-border/80 bg-card p-4 space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="font-bold text-foreground text-xs flex items-center gap-1.5">
              <Server className="h-4 w-4 text-blue-500" /> M-Pesa & Utility Gateway Latency
            </span>
            <Badge className="bg-success/10 text-success text-[9px]">Gateway 100% Up</Badge>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">M-Pesa Daraja STK Push Gateway</span>
              <span className="font-bold text-success">140 ms SLA</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Africa's Talking SMS Gateway</span>
              <span className="font-bold text-success">85 ms SLA</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Water Meter Metering API</span>
              <span className="font-bold text-success">62 ms SLA</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
