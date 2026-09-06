import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, HeartHandshake, Home, ShieldAlert, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { useManagerScope } from "@/shared/hooks/useManagerScope";

export function TenantRetentionChurnIntelligence() {
  const { managerId } = useManagerScope();
  const { data, isLoading } = useQuery({
    queryKey: ["manager-tenant-retention-churn-intelligence", managerId],
    enabled: !!managerId,
    queryFn: async () => {
      const { data: result, error } = await supabase.rpc("get_manager_tenant_retention_intelligence" as any, { p_manager_id: managerId });
      if (error) throw error;
      return (result ?? {}) as any;
    },
    staleTime: 60_000,
  });

  if (isLoading) return <div className="h-72 rounded-xl border border-border bg-card animate-pulse" aria-busy="true" />;
  if (!data) return null;
  const summary = data.summary ?? {};
  const tenants = Array.isArray(data.tenants) ? data.tenants : [];
  const actions = Array.isArray(data.actions) ? data.actions : [];
  const priority = tenants.filter((t: any) => Number(t.churn_risk_score ?? 0) >= 40).slice(0, 8);
  const tone = (level: string) => level === "high" ? "destructive" : level === "medium" ? "outline" : "secondary";

  return <Card className="border-border/80 shadow-[0_8px_28px_-22px_rgb(13_39_68/0.28)]">
    <CardHeader className="pb-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><HeartHandshake className="h-4 w-4" />Tenant retention intelligence</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Explainable retention signals from arrears, service experience and renewal decisions.</p>
        </div>
        <Badge variant="outline">{summary.active_tenants ?? 0} active tenants</Badge>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {[['High risk', summary.high_risk ?? 0, ShieldAlert], ['Medium', summary.medium_risk ?? 0, AlertTriangle], ['Low', summary.low_risk ?? 0, CheckCircle2], ['Arrears', summary.overdue_tenants ?? 0, Home], ['Service issues', summary.service_issue_tenants ?? 0, Wrench]].map(([label,value,Icon]) =>
          <div key={label as string} className="rounded-lg border border-border px-3 py-2"><div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-3.5 w-3.5"/><span className="text-[10px] uppercase tracking-wide">{label as string}</span></div><p className="mt-1 text-lg font-semibold">{value as any}</p></div>
        )}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border p-3">
          <div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold">Priority tenants</p><span className="text-[11px] text-muted-foreground">Top retention signals</span></div>
          {priority.length === 0 ? <div className="flex items-center gap-2 rounded-md bg-success/10 p-3 text-xs text-success"><CheckCircle2 className="h-4 w-4"/>No material retention risk is currently flagged.</div> : <div className="space-y-2">{priority.map((t:any)=><div key={t.tenant_id} className="rounded-md border border-border px-3 py-2"><div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-semibold">{t.tenant_name}</p><p className="truncate text-[11px] text-muted-foreground">{t.property_name}{t.unit_name ? ` · ${t.unit_name}` : ""}</p></div><Badge variant={tone(t.risk_level)}>{t.risk_level} · {t.churn_risk_score}/100</Badge></div><p className="mt-1 text-[11px] text-muted-foreground">{t.recommended_action}</p></div>)}</div>}
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4"/><p className="text-sm font-semibold">Retention actions</p></div>
          {actions.length === 0 ? <div className="flex items-center gap-2 rounded-md bg-success/10 p-3 text-xs text-success"><CheckCircle2 className="h-4 w-4"/>No immediate retention actions.</div> : <div className="space-y-2">{actions.slice(0,8).map((a:any)=><div key={`${a.tenant_id}-${a.title}`} className="rounded-md border border-border px-3 py-2"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold">{a.tenant_name}</span><Badge variant="outline">{a.priority}</Badge></div><p className="mt-1 text-[11px] text-muted-foreground">{a.title}</p></div>)}</div>}
        </div>
      </div>
    </CardContent>
  </Card>;
}
