import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Server, RefreshCw, CheckCircle2, AlertTriangle, Zap, MinusCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { checkHealth, type HealthStatus } from "@/shared/lib/observability";

// Edge functions known to be deployed in this project (from supabase/functions/).
// Runtime status is probed live; names are real, response times are NOT fabricated.
const DEPLOYED_EDGE_FUNCTIONS = [
  "send-tenant-invitation",
  "create-tenant-account",
  "notify-manager-tenant-signup",
  "health-check",
];

type EdgeProbeResult = {
  name: string;
  status: "healthy" | "unavailable";
  responseMs?: number;
  detail: string;
};

type HealthSummary = "healthy" | "degraded" | "unavailable";

function usePlatformTelemetry() {
  const health = useQuery<HealthStatus[]>({
    queryKey: ["admin-platform-health"],
    queryFn: () => checkHealth(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const edgeProbes = useQuery<EdgeProbeResult[]>({
    queryKey: ["admin-platform-edge-functions"],
    queryFn: async () => {
      const results = await Promise.all(
        DEPLOYED_EDGE_FUNCTIONS.map(async (name) => {
          const start = performance.now();
          try {
            const { data, error } = await supabase.functions.invoke(name);
            const elapsed = Math.round(performance.now() - start);
            if (error) {
              return { name, status: "unavailable" as const, detail: String(error.message || error) };
            }
            // A successful invoke (even with empty data) means the function is reachable.
            void data;
            return { name, status: "healthy" as const, responseMs: elapsed, detail: "Reachable" };
          } catch (e) {
            return { name, status: "unavailable" as const, detail: String(e) };
          }
        })
      );
      return results;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  return { health, edgeProbes };
}

const SUMMARY_COPY: Record<HealthSummary, { label: string; cls: string; dot: string }> = {
  healthy: { label: "Healthy", cls: "text-success", dot: "bg-success" },
  degraded: { label: "Degraded", cls: "text-warning", dot: "bg-warning" },
  unavailable: { label: "Unavailable", cls: "text-muted-foreground", dot: "bg-muted-foreground/50" },
};

export function SystemHealthMonitoring({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const { health, edgeProbes } = usePlatformTelemetry();

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-platform-health"] });
    queryClient.invalidateQueries({ queryKey: ["admin-platform-edge-functions"] });
  };

  // Derive an honest overall summary from the real probe only.
  const healthLoading = health.isLoading;
  const healthChecks = health.data ?? [];
  const hasUnhealthy = healthChecks.some((c) => c.status === "unhealthy");
  const hasDegraded = healthChecks.some((c) => c.status === "degraded");
  const supabaseCheck = healthChecks.find((c) => c.component === "supabase");
  const overall: HealthSummary = healthLoading
    ? "unavailable"
    : healthChecks.length === 0
      ? "unavailable"
      : hasUnhealthy
        ? "unavailable"
        : hasDegraded
          ? "degraded"
          : "healthy";
  const summaryCopy = SUMMARY_COPY[overall];

  const edgeLoading = edgeProbes.isLoading;
  const edgeResults = edgeProbes.data ?? [];
  const healthyEdgeCount = edgeResults.filter((e) => e.status === "healthy").length;

  return (
    <Card className={cn("border-border/80 bg-card shadow-sm", className)}>
      <CardHeader className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-bold text-foreground">Platform Health & Infrastructure Telemetry</CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Live platform connectivity and deployed edge-function reachability. Detailed APM metrics (P99 latency, DB pool, queue depth) require an external telemetry integration.
          </CardDescription>
        </div>

        <Button size="sm" variant="outline" onClick={refresh} className="h-8 text-xs font-semibold gap-1">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </CardHeader>

      <CardContent className="p-4 space-y-4 text-xs">
        {/* Overall status + real connectivity metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl border border-border/80 bg-card space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-[10px] font-bold uppercase">
              <span>Platform Status</span>
              <Activity className="h-3.5 w-3.5 text-primary" />
            </div>
            {healthLoading ? (
              <Skeleton className="h-5 w-20" />
            ) : (
              <strong className={cn("text-base font-extrabold flex items-center gap-1.5", summaryCopy.cls)}>
                <span className={cn("h-2 w-2 rounded-full", summaryCopy.dot)} />
                {summaryCopy.label}
              </strong>
            )}
            <span className="text-[10px] text-muted-foreground block">
              {healthChecks.length > 0 ? `${healthChecks.length} components probed` : "Probe unavailable"}
            </span>
          </div>

          <div className="p-3 rounded-xl border border-border/80 bg-card space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-[10px] font-bold uppercase">
              <span>API P99 Latency</span>
              <Zap className="h-3.5 w-3.5 text-warning" />
            </div>
            <strong className="text-base font-extrabold text-muted-foreground">—</strong>
            <span className="text-[10px] text-muted-foreground block">Requires APM integration</span>
          </div>

          <div className="p-3 rounded-xl border border-border/80 bg-card space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-[10px] font-bold uppercase">
              <span>DB Connection Pool</span>
              <Server className="h-3.5 w-3.5 text-primary" />
            </div>
            {healthLoading ? (
              <Skeleton className="h-5 w-16" />
            ) : supabaseCheck ? (
              <strong className={cn("text-base font-extrabold", supabaseCheck.status === "healthy" ? "text-success" : "text-warning")}>
                {supabaseCheck.status === "healthy" ? "Connected" : supabaseCheck.status}
              </strong>
            ) : (
              <strong className="text-base font-extrabold text-muted-foreground">—</strong>
            )}
            <span className="text-[10px] text-muted-foreground block">
              {supabaseCheck?.latency ? `${Math.round(supabaseCheck.latency)}ms probe` : "Pool depth not exposed"}
            </span>
          </div>

          <div className="p-3 rounded-xl border border-border/80 bg-card space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-[10px] font-bold uppercase">
              <span>Edge Functions</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            </div>
            {edgeLoading ? (
              <Skeleton className="h-5 w-20" />
            ) : edgeResults.length === 0 ? (
              <strong className="text-base font-extrabold text-muted-foreground">—</strong>
            ) : (
              <strong className={cn("text-base font-extrabold", healthyEdgeCount === edgeResults.length ? "text-success" : "text-warning")}>
                {healthyEdgeCount}/{edgeResults.length} reachable
              </strong>
            )}
            <span className="text-[10px] text-muted-foreground block">Queue depth not exposed</span>
          </div>
        </div>

        {/* Edge Function reachability breakdown — real probe, no fabricated response times */}
        <div className="border border-border/80 rounded-xl p-3 bg-muted/10 space-y-2">
          <h4 className="text-xs font-bold text-foreground">Deployed Edge Functions</h4>
          {edgeLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {DEPLOYED_EDGE_FUNCTIONS.map((name) => (
                <div key={name} className="p-2.5 rounded-lg border bg-card flex items-center justify-between">
                  <span className="font-bold text-foreground block">{name}</span>
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          ) : edgeResults.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">Health status unavailable.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {edgeResults.map((func) => (
                <div key={func.name} className="p-2.5 rounded-lg border bg-card flex items-center justify-between">
                  <div className="min-w-0">
                    <span className="font-bold text-foreground block truncate">{func.name}</span>
                    <span className={cn("text-[10px] font-semibold flex items-center gap-1", func.status === "healthy" ? "text-success" : "text-muted-foreground")}>
                      {func.status === "healthy" ? (
                        <><CheckCircle2 className="h-3 w-3" /> Reachable{func.responseMs ? ` · ${func.responseMs}ms` : ""}</>
                      ) : (
                        <><MinusCircle className="h-3 w-3" /> Health status unavailable</>
                      )}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-bold shrink-0",
                      func.status === "healthy"
                        ? "bg-success/10 text-success border-success/20"
                        : "bg-muted/30 text-muted-foreground border-border/80"
                    )}
                  >
                    {func.status === "healthy" ? "OK" : "N/A"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
          {health.isError && (
            <p className="text-[10px] text-warning flex items-center gap-1 pt-1">
              <AlertTriangle className="h-3 w-3" /> Platform connectivity probe failed — showing cached/unavailable state.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
