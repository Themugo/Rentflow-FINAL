import { useQuery } from "@tanstack/react-query";
import { BarChart3, CheckCircle2, Clock3, Home, TrendingUp, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { useCurrency } from "@/shared/hooks/useCurrency";

export function ManagementAnalyticsPanel() {
  const { managerId } = useManagerScope();
  const { formatCurrency } = useCurrency();
  const { data, isLoading } = useQuery({
    queryKey: ["manager-management-analytics", managerId],
    enabled: !!managerId,
    queryFn: async () => {
      const { data: result, error } = await supabase.rpc("get_manager_management_analytics" as any, { p_manager_id: managerId, p_months: 6 });
      if (error) throw error;
      return (result ?? {}) as any;
    },
    staleTime: 60_000,
  });

  if (isLoading) return <div className="h-72 rounded-xl border border-border bg-card animate-pulse" aria-busy="true" />;
  if (!data) return null;

  const portfolio = data.portfolio ?? {};
  const collections = data.collections ?? {};
  const operations = data.operations ?? {};
  const rate = Number(collections.billed) > 0 ? Math.min(100, Number(collections.collected) * 100 / Number(collections.billed)) : 0;
  const monthly = Array.isArray(data.monthly_collections) ? data.monthly_collections : [];
  const performance = Array.isArray(data.work_performance) ? data.work_performance : [];

  return (
    <Card className="border-border/80 shadow-[0_8px_28px_-22px_rgb(13_39_68/0.28)]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" />Management performance</CardTitle><p className="mt-1 text-xs text-muted-foreground">Six-month portfolio, collections and operational performance from authoritative records.</p></div>
          <Badge variant="outline">6 months</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
          {[
            ["Properties", portfolio.properties ?? 0, Home],
            ["Occupancy", `${portfolio.units ? Math.round(Number(portfolio.occupied_units) * 100 / Number(portfolio.units)) : 0}%`, Home],
            ["Collected", formatCurrency(Number(collections.collected ?? 0)), TrendingUp],
            ["Collection", `${rate.toFixed(1)}%`, CheckCircle2],
            ["Open work", operations.work_active ?? 0, Clock3],
            ["SLA breached", operations.work_sla_breached ?? 0, Wrench],
          ].map(([label, value, Icon]) => <div key={label as string} className="rounded-lg border border-border px-3 py-2"><div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-3.5 w-3.5" /><span className="text-[10px] uppercase tracking-wide">{label as string}</span></div><p className="mt-1 text-lg font-semibold">{value as any}</p></div>)}
        </div>
        {monthly.length > 0 && <div className="rounded-lg border border-border p-3"><div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold">Collections trend</p><p className="text-[11px] text-muted-foreground">Billed vs collected</p></div><div className="space-y-2">{monthly.map((m:any) => <div key={m.month} className="grid grid-cols-[52px_1fr_70px] items-center gap-2 text-xs"><span className="text-muted-foreground">{new Date(m.month).toLocaleDateString(undefined,{month:"short"})}</span><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-foreground/70" style={{width:`${Math.min(100,Number(m.collection_rate)||0)}%`}} /></div><span className="text-right font-medium">{Number(m.collection_rate || 0).toFixed(0)}%</span></div>)}</div></div>}
        {performance.length > 0 && <div className="rounded-lg border border-border p-3"><p className="mb-2 text-sm font-semibold">Team performance</p><div className="grid gap-2 md:grid-cols-3">{performance.map((m:any) => <div key={m.id} className="rounded-md bg-muted/40 px-3 py-2"><div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-medium">{m.name}</span><Badge variant="outline">{m.completed_30d ?? 0} done</Badge></div><p className="mt-1 text-[11px] text-muted-foreground">{m.active ?? 0} active · {m.breached ?? 0} breached · {m.avg_completion_days == null ? "No completed timing data" : `${m.avg_completion_days}d avg completion`}</p></div>)}</div></div>}
      </CardContent>
    </Card>
  );
}
