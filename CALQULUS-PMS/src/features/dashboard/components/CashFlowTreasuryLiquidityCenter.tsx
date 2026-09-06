import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowDown, ArrowUp, ShieldCheck, WalletCards } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { toast } from "sonner";

const fmt = (v: unknown) => Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CashFlowTreasuryLiquidityCenter = () => {
  const { managerId } = useManagerScope();
  const [buffer, setBuffer] = useState("0");
  const [horizon, setHorizon] = useState("90");
  const { data: report, isLoading, refetch } = useQuery({
    queryKey: ["treasury-control", managerId, horizon], enabled: !!managerId,
    queryFn: async () => { const { data, error } = await supabase.rpc("get_manager_treasury_control", { p_manager_id: managerId!, p_as_of_date: new Date().toISOString().slice(0,10), p_horizon_days: Number(horizon) }); if (error) throw error; return data as any; },
  });
  useEffect(() => { if (report?.settings) { setBuffer(String(report.settings.minimum_cash_buffer ?? 0)); setHorizon(String(report.settings.forecast_horizon_days ?? horizon)); } }, [report]);
  const save = useMutation({ mutationFn: async () => { const { error } = await supabase.rpc("upsert_treasury_control_settings", { p_manager_id: managerId!, p_minimum_cash_buffer: Number(buffer), p_forecast_horizon_days: Number(horizon) }); if (error) throw error; }, onSuccess: () => { toast.success("Treasury controls saved"); refetch(); }, onError: (e:any) => toast.error(e.message || "Could not save treasury controls") });
  const status = report?.status;
  const tone = status === "healthy" ? "default" : "destructive";
  const forecast = report?.forecast ?? [];
  const checkpoints = forecast.filter((_: any, i: number) => i === 0 || i === 29 || i === 59 || i === forecast.length - 1);
  return <Card className="enterprise-card"><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="section-title flex items-center gap-2"><WalletCards className="h-5 w-5"/> Cash Flow, Treasury & Liquidity Control</CardTitle><CardDescription>Forward liquidity from posted cash, outstanding invoices, approved owner payouts and approved budgets — never a second cash ledger.</CardDescription></div><Badge variant={tone} className="gap-1">{status === "healthy" ? <ShieldCheck className="h-3 w-3"/> : <AlertTriangle className="h-3 w-3"/>}{status === "healthy" ? "Buffer protected" : status === "negative" ? "Projected negative" : "Below buffer"}</Badge></div></CardHeader><CardContent className="space-y-5">
    <div className="grid gap-3 md:grid-cols-[1fr_140px_140px_auto]"><div><p className="mb-1 text-xs text-muted-foreground">Minimum cash buffer</p><Input type="number" min="0" value={buffer} onChange={e=>setBuffer(e.target.value)}/></div><div><p className="mb-1 text-xs text-muted-foreground">Horizon (days)</p><Input type="number" min="30" max="365" value={horizon} onChange={e=>setHorizon(e.target.value)}/></div><div className="flex items-end"><Button onClick={()=>save.mutate()} disabled={save.isPending || !managerId}>Save controls</Button></div><div className="flex items-end justify-end text-xs text-muted-foreground">{isLoading ? "Refreshing…" : report ? `${report.as_of_date} → ${report.end_date}` : "No treasury snapshot"}</div></div>
    {report && <><div className="grid gap-3 md:grid-cols-4"><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Current cash / bank</p><p className="font-semibold tabular-nums">{fmt(report.current_cash)}</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Receivables in horizon</p><p className="font-semibold tabular-nums">{fmt(report.outstanding_receivables)}</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Approved owner payouts</p><p className="font-semibold tabular-nums">{fmt(report.approved_owner_payouts)}</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Projected cash floor</p><p className="font-semibold tabular-nums">{fmt(report.projected_cash_floor)}</p></div></div>
      <div className="grid gap-4 lg:grid-cols-2"><div className="rounded-lg border p-4"><p className="mb-3 font-semibold">Liquidity guardrail</p><p className="text-sm">Minimum buffer <span className="float-right tabular-nums">{fmt(report.minimum_cash_buffer)}</span></p><p className="text-sm">Projected shortfall <span className="float-right tabular-nums">{fmt(report.buffer_shortfall)}</span></p><p className="mt-2 border-t pt-2 text-xs text-muted-foreground">Collections assume outstanding invoiced receivables are collected by their invoice due dates. Budget revenue is shown separately and is not counted as cash.</p></div><div className="rounded-lg border p-4"><p className="mb-3 font-semibold">Approved budget scenario</p><p className="text-sm">Budgeted revenue <span className="float-right tabular-nums">{fmt(report.approved_budget_revenue)}</span></p><p className="text-sm">Budgeted expenses <span className="float-right tabular-nums">{fmt(report.approved_budget_expenses)}</span></p><p className="mt-2 border-t pt-2 text-xs text-muted-foreground">Budgeted expenses are included in the conservative projected cash floor; approved owner payouts are shown separately to keep the drivers visible.</p></div></div>
      <div className="rounded-lg border p-4"><div className="mb-3 flex items-center gap-2 font-semibold"><ArrowUp className="h-4 w-4"/> Liquidity checkpoints</div><div className="space-y-2">{checkpoints.map((r:any)=><div key={r.day} className="grid grid-cols-[1fr_120px_120px_120px] gap-2 border-b py-2 text-xs last:border-0"><span>{r.day}</span><span className="text-right"><ArrowUp className="mr-1 inline h-3 w-3"/>{fmt(r.expected_collections)}</span><span className="text-right"><ArrowDown className="mr-1 inline h-3 w-3"/>{fmt(Number(r.approved_owner_payouts)+Number(r.budgeted_expenses))}</span><span className="text-right font-semibold">{fmt(r.projected_cash)}</span></div>)}</div><p className="mt-2 text-xs text-muted-foreground">Forecast is a management control, not a guarantee. It uses only traceable source records and approved planning data.</p></div>
    </>}
  </CardContent></Card>;
};
export default CashFlowTreasuryLiquidityCenter;
