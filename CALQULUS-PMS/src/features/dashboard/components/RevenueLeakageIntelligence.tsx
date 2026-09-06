import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CircleDollarSign, CreditCard, FileWarning, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { useCurrency } from "@/shared/hooks/useCurrency";

export function RevenueLeakageIntelligence() {
  const { managerId } = useManagerScope();
  const { formatCurrency } = useCurrency();
  const { data, isLoading } = useQuery({
    queryKey: ["manager-revenue-leakage-intelligence", managerId],
    enabled: !!managerId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: result, error } = await supabase.rpc("get_manager_revenue_leakage_intelligence" as any, { p_manager_id: managerId, p_months: 6 });
      if (error) throw error;
      return (result ?? {}) as any;
    },
  });
  if (isLoading) return <div className="h-96 rounded-xl border border-border bg-card animate-pulse" aria-busy="true" />;
  if (!data) return null;
  const s = data.summary ?? {};
  const receivables = Array.isArray(data.receivables) ? data.receivables : [];
  const properties = Array.isArray(data.property_leakage) ? data.property_leakage : [];
  const actions = Array.isArray(data.actions) ? data.actions : [];
  const cards = [
    ["Overdue", formatCurrency(Number(s.overdue_due_balance ?? 0)), AlertTriangle],
    ["Unallocated", formatCurrency(Number(s.unallocated_completed_payments ?? 0)), CreditCard],
    ["60d+ arrears", formatCurrency(Number(s.persistent_60d_arrears ?? 0)), ShieldAlert],
    ["Payer concentration", `${Number(s.top_payer_share_pct ?? 0).toFixed(1)}%`, CircleDollarSign],
  ] as const;
  return <Card className="border-border/80 shadow-[0_8px_28px_-22px_rgb(13_39_68/0.28)]">
    <CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-base"><FileWarning className="h-4 w-4" />Revenue leakage & receivables intelligence</CardTitle><p className="mt-1 text-xs text-muted-foreground">Find overdue value, unallocated cash, persistent arrears and concentrated collection exposure.</p></div><Badge variant="outline">{receivables.length} priority receivables</Badge></div></CardHeader>
    <CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">{cards.map(([label,value,Icon]) => <div key={label} className="rounded-lg border border-border px-3 py-2"><div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-3.5 w-3.5"/><span className="text-[10px] uppercase tracking-wide">{label}</span></div><p className="mt-1 text-lg font-semibold">{value}</p></div>)}</div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border p-3"><p className="mb-3 text-sm font-semibold">Priority receivables</p><div className="max-h-64 space-y-2 overflow-auto">{receivables.length === 0 ? <p className="text-xs text-muted-foreground">No overdue receivables require attention.</p> : receivables.slice(0,10).map((r:any) => <div key={r.id} className="rounded-md border border-border px-3 py-2"><div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-medium">{r.invoice_number}</span><span className="text-xs font-semibold">{formatCurrency(Number(r.balance_due ?? 0))}</span></div><p className="mt-1 text-[10px] text-muted-foreground">{r.days_overdue ?? 0} days overdue · {r.ageing_band}</p></div>)}</div></div>
        <div className="rounded-lg border border-border p-3"><p className="mb-3 text-sm font-semibold">Property leakage</p><div className="max-h-64 space-y-2 overflow-auto">{properties.length === 0 ? <p className="text-xs text-muted-foreground">No active properties in scope.</p> : properties.map((p:any) => <div key={p.id} className="rounded-md border border-border px-3 py-2"><div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-medium">{p.name}</span><span className="text-xs font-semibold">{formatCurrency(Number(p.leakage ?? 0))}</span></div><p className="mt-1 text-[10px] text-muted-foreground">{p.open_receivables ?? 0} open receivables · {formatCurrency(Number(p.collected ?? 0))} collected in period</p></div>)}</div></div>
      </div>
      {actions.length > 0 && <div className="rounded-lg border border-border p-3"><p className="mb-3 text-sm font-semibold">Recovery priorities</p><div className="grid gap-2 md:grid-cols-2">{actions.map((a:any) => <div key={a.key} className="rounded-md bg-muted/40 p-2.5"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold">{a.title}</span><Badge variant="outline">{a.priority}</Badge></div><p className="mt-1 text-[11px] text-muted-foreground">{a.detail}</p></div>)}</div></div>}
    </CardContent>
  </Card>;
}
