import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle2, Clock3, Gauge, Home, ShieldAlert, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { useCurrency } from "@/shared/hooks/useCurrency";

export function ExecutivePortfolioIntelligence() {
  const { managerId } = useManagerScope();
  const { formatCurrency } = useCurrency();
  const { data, isLoading } = useQuery({
    queryKey: ["manager-executive-portfolio-intelligence", managerId],
    enabled: !!managerId,
    queryFn: async () => {
      const { data: result, error } = await supabase.rpc("get_manager_executive_portfolio_intelligence" as any, { p_manager_id: managerId });
      if (error) throw error;
      return (result ?? {}) as any;
    },
    staleTime: 60_000,
  });

  if (isLoading) return <div className="h-80 rounded-xl border border-border bg-card animate-pulse" aria-busy="true" />;
  if (!data) return null;

  const metrics = data.metrics ?? {};
  const drivers = Array.isArray(data.drivers) ? data.drivers : [];
  const actions = Array.isArray(data.actions) ? data.actions : [];
  const level = data.risk_level ?? "low";
  const score = Number(data.health_score ?? 100);

  return (
    <Card className="border-border/80 shadow-[0_8px_28px_-22px_rgb(13_39_68/0.28)]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><Gauge className="h-4 w-4" />Executive portfolio intelligence</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Explainable portfolio health and the decisions requiring management attention.</p>
          </div>
          <Badge variant="outline" className={level === "high" ? "border-destructive/40 text-destructive" : level === "medium" ? "border-warning/40 text-warning" : "border-success/40 text-success"}>
            {level} risk · {score}/100 health
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
          {[
            ["Health", `${score}/100`, Gauge],
            ["Vacancy", `${Number(metrics.vacancy_rate ?? 0).toFixed(1)}%`, Home],
            ["Collections", `${Number(metrics.collection_rate ?? 0).toFixed(1)}%`, CheckCircle2],
            ["Overdue", formatCurrency(Number(metrics.overdue_balance ?? 0)), ShieldAlert],
            ["SLA breach", metrics.sla_breached ?? 0, Clock3],
            ["Urgent repair", metrics.urgent_maintenance ?? 0, Wrench],
          ].map(([label, value, Icon]) => (
            <div key={label as string} className="rounded-lg border border-border px-3 py-2">
              <div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-3.5 w-3.5" /><span className="text-[10px] uppercase tracking-wide">{label as string}</span></div>
              <p className="mt-1 text-lg font-semibold">{value as any}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-border p-3">
            <div className="mb-3 flex items-center gap-2"><Activity className="h-4 w-4" /><p className="text-sm font-semibold">Risk drivers</p></div>
            <div className="space-y-2">
              {drivers.map((driver: any) => (
                <div key={driver.key} className="rounded-md bg-muted/40 p-2.5">
                  <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium">{driver.label}</span><span className="text-xs font-semibold">{Number(driver.score ?? 0).toFixed(0)}/100</span></div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{driver.detail}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-foreground/70" style={{ width: `${Math.min(100, Math.max(0, Number(driver.score ?? 0)))}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /><p className="text-sm font-semibold">Management actions</p></div>
            {actions.length === 0 ? <div className="flex items-center gap-2 rounded-md bg-success/10 p-3 text-xs text-success"><CheckCircle2 className="h-4 w-4" />No material portfolio action is currently flagged.</div> : <div className="space-y-2">{actions.map((action: any, index: number) => <div key={`${action.title}-${index}`} className="rounded-md border border-border px-3 py-2"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold">{action.title}</span><Badge variant="outline">{action.priority}</Badge></div><p className="mt-1 text-[11px] text-muted-foreground">{action.detail}</p></div>)}</div>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
