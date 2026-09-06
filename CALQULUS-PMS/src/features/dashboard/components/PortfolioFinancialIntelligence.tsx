import { useQuery } from "@tanstack/react-query";
import { Banknote, TrendingDown, TrendingUp, Wallet, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { useCurrency } from "@/shared/hooks/useCurrency";

export function PortfolioFinancialIntelligence() {
  const { managerId } = useManagerScope();
  const { formatCurrency } = useCurrency();
  const { data, isLoading } = useQuery({
    queryKey: ["manager-portfolio-financial-intelligence", managerId], enabled: !!managerId, staleTime: 60_000,
    queryFn: async () => { const { data: result, error } = await supabase.rpc("get_manager_portfolio_financial_intelligence" as any, { p_manager_id: managerId, p_months: 6 }); if (error) throw error; return (result ?? {}) as any; },
  });
  if (isLoading) return <div className="h-80 rounded-xl border border-border bg-card animate-pulse" aria-busy="true" />;
  if (!data) return null;
  const s = data.summary ?? {}, a = data.arrears_aging ?? {}, properties = Array.isArray(data.property_performance) ? data.property_performance : [];
  const cards = [["Collected", formatCurrency(Number(s.collected ?? 0)), TrendingUp], ["Net cash", formatCurrency(Number(s.net_cash ?? 0)), Wallet], ["Overdue", formatCurrency(Number(s.overdue_balance ?? 0)), AlertTriangle], ["3-month forecast", formatCurrency(Number(s.forecast_3m_net ?? 0)), TrendingDown]] as const;
  return <Card className="border-border/80 shadow-[0_8px_28px_-22px_rgb(13_39_68/0.28)]">
    <CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-base"><Banknote className="h-4 w-4" />Portfolio financial intelligence</CardTitle><p className="mt-1 text-xs text-muted-foreground">Cash performance, arrears ageing, property economics and a transparent near-term forecast.</p></div><Badge variant="outline">{Number(s.collection_rate ?? 0).toFixed(1)}% collection · {Number(s.expense_ratio ?? 0).toFixed(1)}% expense ratio</Badge></div></CardHeader>
    <CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">{cards.map(([label,value,Icon]) => <div key={label} className="rounded-lg border border-border px-3 py-2"><div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-3.5 w-3.5"/><span className="text-[10px] uppercase tracking-wide">{label}</span></div><p className="mt-1 text-lg font-semibold">{value}</p></div>)}</div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border p-3"><p className="mb-3 text-sm font-semibold">Arrears ageing</p><div className="space-y-2">{[["0–30 days",a["0_30"]],["31–60 days",a["31_60"]],["61–90 days",a["61_90"]],["90+ days",a["90_plus"]]].map(([label,value]) => <div key={label as string} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-xs"><span>{label}</span><span className="font-semibold">{formatCurrency(Number(value ?? 0))}</span></div>)}</div></div>
        <div className="rounded-lg border border-border p-3"><p className="mb-3 text-sm font-semibold">Property cash performance</p><div className="max-h-52 space-y-2 overflow-auto">{properties.length === 0 ? <p className="text-xs text-muted-foreground">No active properties in scope.</p> : properties.map((p:any) => <div key={p.id} className="rounded-md border border-border px-3 py-2"><div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-medium">{p.name}</span><span className="text-xs font-semibold">{formatCurrency(Number(p.net_cash ?? (Number(p.collected ?? 0)-Number(p.expenses ?? 0))))}</span></div><p className="mt-1 text-[10px] text-muted-foreground">Collected {formatCurrency(Number(p.collected ?? 0))} · Expenses {formatCurrency(Number(p.expenses ?? 0))}</p></div>)}</div></div>
      </div>
    </CardContent>
  </Card>;
}
