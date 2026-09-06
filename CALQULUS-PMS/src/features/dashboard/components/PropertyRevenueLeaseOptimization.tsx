import { useQuery } from "@tanstack/react-query";
import { Building2, CalendarClock, TrendingUp, WalletCards } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { useCurrency } from "@/shared/hooks/useCurrency";

export function PropertyRevenueLeaseOptimization() {
  const { managerId } = useManagerScope();
  const { formatCurrency } = useCurrency();
  const { data, isLoading } = useQuery({
    queryKey: ["manager-property-revenue-lease-optimization", managerId], enabled: !!managerId, staleTime: 60_000,
    queryFn: async () => { const { data: result, error } = await supabase.rpc("get_manager_property_revenue_lease_optimization" as any, { p_manager_id: managerId }); if (error) throw error; return (result ?? {}) as any; },
  });
  if (isLoading) return <div className="h-96 rounded-xl border border-border bg-card animate-pulse" aria-busy="true" />;
  if (!data) return null;
  const s = data.summary ?? {}, units = Array.isArray(data.unit_opportunities) ? data.unit_opportunities : [], properties = Array.isArray(data.property_opportunities) ? data.property_opportunities : [], actions = Array.isArray(data.actions) ? data.actions : [];
  const cards = [["Vacant", `${Number(s.vacant_units ?? 0)}`, Building2], ["Renewals · 90d", `${Number(s.leases_expiring_90d ?? 0)}`, CalendarClock], ["Rent gap / month", formatCurrency(Number(s.under_rent_monthly_gap ?? 0)), TrendingUp], ["Opportunity / month", formatCurrency(Number(s.total_monthly_opportunity ?? 0)), WalletCards]] as const;
  return <Card className="border-border/80 shadow-[0_8px_28px_-22px_rgb(13_39_68/0.28)]">
    <CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4" />Property revenue & lease optimization</CardTitle><p className="mt-1 text-xs text-muted-foreground">Explainable opportunities from vacancy, upcoming renewals and configured unit-rent alignment.</p></div><Badge variant="outline">No speculative market pricing</Badge></div></CardHeader>
    <CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">{cards.map(([label,value,Icon]) => <div key={label} className="rounded-lg border border-border px-3 py-2"><div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-3.5 w-3.5"/><span className="text-[10px] uppercase tracking-wide">{label}</span></div><p className="mt-1 text-lg font-semibold">{value}</p></div>)}</div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border p-3"><p className="mb-3 text-sm font-semibold">Priority unit opportunities</p><div className="max-h-64 space-y-2 overflow-auto">{units.length===0 ? <p className="text-xs text-muted-foreground">No immediate revenue or renewal opportunities detected.</p> : units.slice(0,12).map((u:any)=><div key={u.id} className="rounded-md border border-border px-3 py-2"><div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-medium">{u.property_name} · {u.unit_number}</span><span className="text-xs font-semibold">{formatCurrency(Number(u.opportunity ?? 0))}/mo</span></div><p className="mt-1 text-[10px] text-muted-foreground">{u.opportunity_type} · {u.unit_status}{u.end_date ? ` · lease ends ${u.end_date}` : ""}</p></div>)}</div></div>
        <div className="rounded-lg border border-border p-3"><p className="mb-3 text-sm font-semibold">Property opportunity ranking</p><div className="max-h-64 space-y-2 overflow-auto">{properties.length===0 ? <p className="text-xs text-muted-foreground">No active property opportunities.</p> : properties.map((p:any)=><div key={p.id} className="rounded-md border border-border px-3 py-2"><div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-medium">{p.property_name}</span><span className="text-xs font-semibold">{formatCurrency(Number(p.monthly_opportunity ?? 0))}/mo</span></div><p className="mt-1 text-[10px] text-muted-foreground">{p.vacant_units ?? 0} vacant · {p.renewals_90d ?? 0} renewals in 90d</p></div>)}</div></div>
      </div>
      {actions.length>0 && <div className="rounded-lg border border-border p-3"><p className="mb-3 text-sm font-semibold">Optimization priorities</p><div className="grid gap-2 md:grid-cols-3">{actions.map((a:any)=><div key={a.key} className="rounded-md bg-muted/40 p-2.5"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold">{a.title}</span><Badge variant="outline">{a.priority}</Badge></div><p className="mt-1 text-[11px] text-muted-foreground">{a.detail}</p></div>)}</div></div>}
    </CardContent>
  </Card>;
}
