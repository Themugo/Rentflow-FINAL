// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { useDashboardTenantIds } from "@/features/dashboard/hooks/useDashboardData";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { logError } from "@/shared/lib/errorLogger";
import { cn } from "@/shared/lib/utils";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Card, CardContent } from "@/shared/components/ui/card";
import { ErrorState } from "@/shared/components/ui/error-state";
import { CheckCircle2, AlertTriangle, Flame, ArrowRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useNavigate } from "react-router-dom";

interface PropertyArrears {
  propertyId: string | null;
  propertyName: string;
  totalArrears: number;
  overdueCount: number;
}

interface RawInvoice {
  balance_due: number;
  leases: {
    property: string | null;
    property_id: string | null;
  } | null;
}

function heatLevel(amount: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (max === 0 || amount === 0) return 0;
  const ratio = amount / max;
  if (ratio < 0.25) return 1;
  if (ratio < 0.50) return 2;
  if (ratio < 0.75) return 3;
  return 4;
}

const heatStyles: Record<0 | 1 | 2 | 3 | 4, { tile: string; badge: string; label: string; bar: string }> = {
  0: {
    tile:  "bg-success/8 border-success/20 hover:border-success/40",
    badge: "bg-success/15 text-success",
    label: "Clear",
    bar: "bg-success/40",
  },
  1: {
    tile:  "bg-warning/10 border-warning/30 hover:border-warning/60",
    badge: "bg-warning/20 text-warning",
    label: "Low",
    bar: "bg-warning/70",
  },
  2: {
    tile:  "bg-warning/15 border-warning/40 hover:border-warning/70",
    badge: "bg-warning/25 text-warning",
    label: "Medium",
    bar: "bg-warning",
  },
  3: {
    tile:  "bg-destructive/15 border-destructive/40 hover:border-destructive/70",
    badge: "bg-destructive/20 text-destructive",
    label: "High",
    bar: "bg-destructive",
  },
  4: {
    tile:  "bg-destructive/20 border-destructive/50 hover:border-destructive/80",
    badge: "bg-destructive/25 text-destructive font-bold",
    label: "Critical",
    bar: "bg-destructive",
  },
};

export function ArrearsHeatMap() {
  const { managerId, restrictToAssignedProperties, assignedPropertyIds } = useManagerScope();
  const assignedKey = assignedPropertyIds.join(",");
  const { formatCurrency } = useCurrency();
  const navigate = useNavigate();
  const { data: scopedTenantIds = [], isPending: tenantIdsLoading } = useDashboardTenantIds();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["arrears-heatmap", managerId, assignedKey],
    queryFn: async (): Promise<PropertyArrears[]> => {
      if (!managerId) return [];
      if (restrictToAssignedProperties && scopedTenantIds.length === 0) return [];

      let query = supabase
        .from("invoices")
        .select("amount, leases(property, property_id)")
        .eq("manager_id", managerId)
        .eq("status", "overdue");

      if (restrictToAssignedProperties) {
        query = query.in("tenant_id", scopedTenantIds);
      }

      const { data: rows, error } = await query;

      if (error) throw error;

      const byProperty = new Map<string, PropertyArrears>();
      for (const row of (rows ?? []) as Array<RawInvoice & { amount?: number }>) {
        const name = row.leases?.property ?? "Unknown Property";
        const pid  = row.leases?.property_id ?? name;
        if (restrictToAssignedProperties && row.leases?.property_id && !assignedPropertyIds.includes(row.leases.property_id)) {
          continue;
        }
        const outstanding = Number(row.balance_due ?? row.amount ?? 0);
        const existing = byProperty.get(pid);
        if (existing) {
          existing.totalArrears += outstanding;
          existing.overdueCount += 1;
        } else {
          byProperty.set(pid, {
            propertyId:   pid,
            propertyName: name,
            totalArrears: outstanding,
            overdueCount: 1,
          });
        }
      }

      return Array.from(byProperty.values()).sort(
        (a, b) => b.totalArrears - a.totalArrears
      );
    },
    enabled: !!managerId && !tenantIdsLoading,
    staleTime: 5 * 60 * 1000,
    throwOnError: (err) => {
      logError("ArrearsHeatMap", err);
      return false;
    },
  });

  const maxArrears = data ? Math.max(...data.map((p) => p.totalArrears), 1) : 1;
  const totalArrears  = data?.reduce((s, p) => s + p.totalArrears, 0) ?? 0;
  const totalOverdue  = data?.reduce((s, p) => s + p.overdueCount, 0) ?? 0;
  const criticalCount = data?.filter((p) => heatLevel(p.totalArrears, maxArrears) >= 3).length ?? 0;

  return (
    <Card className="overflow-hidden border-border">
      <CardContent className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-center">
              <Flame className="h-3.5 w-3.5 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">Overdue by property</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Live overdue invoices</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isLoading && criticalCount > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-destructive bg-destructive/10 border border-destructive/20 rounded-full px-2 py-0.5">
                <AlertTriangle className="h-3 w-3" />
                {criticalCount} critical
              </span>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-muted-foreground h-7 gap-1 hover:text-foreground"
              onClick={() => navigate("/billing?filter=overdue")}
            >
              View all <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        )}

        {isError && !isLoading && (
          <ErrorState
            title="Couldn't load overdue balances"
            onRetry={() => { void refetch(); }}
          />
        )}

        {/* All-clear state */}
        {!isLoading && !isError && (!data || data.length === 0) && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="h-12 w-12 rounded-full bg-success/10 border border-success/20 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">All properties clear</p>
              <p className="text-xs text-muted-foreground mt-0.5">No overdue invoices across your portfolio</p>
            </div>
          </div>
        )}

        {/* Heat map grid */}
        {!isLoading && !isError && data && data.length > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-3">
              {data.map((prop) => {
                const level  = heatLevel(prop.totalArrears, maxArrears);
                const styles = heatStyles[level];
                return (
                  <button
                    key={prop.propertyId}
                    onClick={() => navigate(`/billing?filter=overdue&property=${encodeURIComponent(prop.propertyName)}`)}
                    className={cn(
                      "group relative text-left rounded-xl border p-3 transition-all duration-200",
                      "hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97] touch-manipulation",
                      styles.tile,
                      "animate-fade-in"
                    )}
                  >
                    {/* Heat intensity bar along top edge */}
                    <div
                      className={cn(
                        "absolute top-0 inset-x-0 h-0.5 rounded-t-xl transition-opacity duration-300",
                        styles.bar,
                      )}
                      style={{
                        width: level === 0
                          ? "100%"
                          : `${Math.max(20, Math.round((prop.totalArrears / maxArrears) * 100))}%`,
                      }}
                    />

                    {/* Badge */}
                    <span className={cn("inline-flex text-[10px] font-semibold rounded-full px-1.5 py-0.5 mb-2", styles.badge)}>
                      {styles.label}
                    </span>

                    {/* Property name */}
                    <p className="text-xs font-semibold text-foreground leading-tight line-clamp-2 mb-1.5 min-h-[2rem]">
                      {prop.propertyName}
                    </p>

                    {/* Arrears amount */}
                    <p className={cn(
                      "text-sm font-bold tracking-tight",
                      level >= 3 ? "text-destructive" : "text-foreground"
                    )}>
                      {formatCurrency(prop.totalArrears)}
                    </p>

                    {/* Overdue count */}
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {prop.overdueCount} invoice{prop.overdueCount !== 1 ? "s" : ""} overdue
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Footer summary */}
            <div className="mt-4 pt-3 border-t border-border/40 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-semibold">Total Arrears</p>
                  <p className="text-sm font-bold text-destructive">{formatCurrency(totalArrears)}</p>
                </div>
                <div className="h-6 w-px bg-border/60" />
                <div>
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-semibold">Overdue Invoices</p>
                  <p className="text-sm font-bold text-foreground">{totalOverdue}</p>
                </div>
                <div className="h-6 w-px bg-border/60" />
                <div>
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-semibold">Properties Affected</p>
                  <p className="text-sm font-bold text-foreground">{data.length}</p>
                </div>
              </div>
              {/* Heat scale legend */}
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground/60 mr-1">Heat:</span>
                {([0, 1, 2, 3, 4] as const).map((lvl) => (
                  <span key={lvl} className={cn("text-[10px] font-semibold rounded-full px-2 py-0.5", heatStyles[lvl].badge)}>
                    {heatStyles[lvl].label}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
