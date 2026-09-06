import { useQuery } from "@tanstack/react-query";
import { BarChart3, CheckCircle2, Clock3, Home, TrendingUp, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { useCurrency } from "@/shared/hooks/useCurrency";

interface ManagementAnalytics {
  period_months?: number;
  portfolio?: { properties?: number; units?: number; occupied_units?: number; vacant_units?: number };
  collections?: { billed?: number; collected?: number; overdue_balance?: number };
  operations?: { maintenance_open?: number; maintenance_urgent?: number; leases_expiring_30d?: number; work_active?: number; work_sla_breached?: number; work_completed_30d?: number };
  monthly_collections?: Array<{ month: string; billed: number; collected: number; collection_rate: number }>;
  work_performance?: Array<{ id: string; name: string; role: string; active: number; breached: number; completed_30d: number; avg_completion_days: number | null }>;
}

const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;

export function ExecutiveAnalyticsWorkspace() {
  const { managerId } = useManagerScope();
  const { formatCurrency } = useCurrency();
  const { data, isLoading, error } = useQuery({
    queryKey: ["manager-executive-analytics", managerId],
    enabled: !!managerId,
    queryFn: async () => {
      const { data: result, error: rpcError } = await supabase.rpc("get_manager_management_analytics" as any, {
        p_manager_id: managerId,
        p_months: 6,
      });
      if (rpcError) throw rpcError;
      return (result ?? {}) as ManagementAnalytics;
    },
    staleTime: 60_000,
  });

  if (isLoading) return <div className="h-72 rounded-xl border border-border bg-card animate-pulse" aria-busy="true" />;
  if (error) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Executive analytics could not be loaded.</CardContent></Card>;
  if (!data) return null;

  const portfolio = data.portfolio ?? {};
  const collections = data.collections ?? {};
  const operations = data.operations ?? {};
  const monthly = Array.isArray(data.monthly_collections) ? data.monthly_collections : [];
  const performance = Array.isArray(data.work_performance) ? data.work_performance : [];
  const billed = number(collections.billed);
  const collected = number(collections.collected);
  const collectionRate = billed > 0 ? Math.min(100, (collected * 100) / billed) : 0;
  const units = number(portfolio.units);
  const occupied = number(portfolio.occupied_units);
  const occupancy = units > 0 ? Math.min(100, (occupied * 100) / units) : 0;

  return (
    <div className="space-y-6">
      <Card className="border-border/80 shadow-[0_8px_28px_-22px_rgb(13_39_68/0.28)]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" />Executive portfolio analytics</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Live portfolio, collections and operational measures from authoritative records. No fabricated forecasts or probabilities.</p>
            </div>
            <Badge variant="outline">{number(data.period_months) || 6} months</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
            {[
              ["Properties", number(portfolio.properties), Home],
              ["Occupancy", `${occupancy.toFixed(1)}%`, Home],
              ["Collected", formatCurrency(collected), TrendingUp],
              ["Collection", `${collectionRate.toFixed(1)}%`, CheckCircle2],
              ["Open work", number(operations.work_active), Clock3],
              ["SLA breached", number(operations.work_sla_breached), Wrench],
            ].map(([label, value, Icon]) => {
              const MetricIcon = Icon as typeof Home;
              return (
                <div key={String(label)} className="rounded-lg border border-border px-3 py-2">
                  <div className="flex items-center gap-2 text-muted-foreground"><MetricIcon className="h-3.5 w-3.5" /><span className="text-[10px] uppercase tracking-wide">{String(label)}</span></div>
                  <p className="mt-1 text-lg font-semibold">{String(value)}</p>
                </div>
              );
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-border p-3">
              <div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold">Collections trend</p><p className="text-[11px] text-muted-foreground">Billed vs collected</p></div>
              {monthly.length === 0 ? <p className="text-xs text-muted-foreground">No collection history is available for this period.</p> : (
                <div className="space-y-3">
                  {monthly.map((item) => (
                    <div key={item.month} className="space-y-1">
                      <div className="flex justify-between text-[11px]"><span>{new Date(item.month).toLocaleDateString(undefined, { month: "short", year: "2-digit" })}</span><span className="font-medium">{number(item.collection_rate).toFixed(1)}%</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-foreground/70" style={{ width: `${Math.min(100, Math.max(0, number(item.collection_rate)))}%` }} /></div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border p-3">
              <div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold">Operational position</p><p className="text-[11px] text-muted-foreground">Current records</p></div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Open maintenance", number(operations.maintenance_open)],
                  ["Urgent maintenance", number(operations.maintenance_urgent)],
                  ["Leases expiring 30d", number(operations.leases_expiring_30d)],
                  ["Completed work 30d", number(operations.work_completed_30d)],
                  ["Vacant units", number(portfolio.vacant_units)],
                  ["Overdue balance", formatCurrency(number(collections.overdue_balance))],
                ].map(([label, value]) => <div key={String(label)} className="rounded-md bg-muted/40 px-3 py-2"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">{String(label)}</span><p className="mt-1 font-semibold">{String(value)}</p></div>)}
              </div>
            </div>
          </div>

          {performance.length > 0 && <div className="rounded-lg border border-border p-3"><p className="mb-2 text-sm font-semibold">Team performance</p><div className="grid gap-2 md:grid-cols-3">{performance.map((member) => <div key={member.id} className="rounded-md bg-muted/40 px-3 py-2"><div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-medium">{member.name}</span><Badge variant="outline">{number(member.completed_30d)} done</Badge></div><p className="mt-1 text-[11px] text-muted-foreground">{number(member.active)} active · {number(member.breached)} breached · {member.avg_completion_days == null ? "No completed timing data" : `${number(member.avg_completion_days).toFixed(1)}d avg completion`}</p></div>)}</div></div>}
        </CardContent>
      </Card>
    </div>
  );
}
