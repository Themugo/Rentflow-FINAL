import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, LockKeyhole, RefreshCw, Unlock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { toast } from "sonner";

const monthBounds = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  const start = `${value}-01`;
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return { start, end };
};

export function FinancialCloseControlCenter() {
  const { managerId } = useManagerScope();
  const { formatCurrency } = useCurrency();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const bounds = useMemo(() => monthBounds(period), [period]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["financial-close-control", managerId, bounds.start, bounds.end],
    enabled: !!managerId,
    queryFn: async () => {
      const { data: result, error } = await supabase.rpc("get_manager_financial_close" as any, {
        p_manager_id: managerId,
        p_period_start: bounds.start,
        p_period_end: bounds.end,
      });
      if (error) throw error;
      return (result ?? {}) as any;
    },
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      const { data: result, error } = await supabase.rpc("close_manager_financial_period_atomic" as any, {
        p_manager_id: managerId,
        p_period_start: bounds.start,
        p_period_end: bounds.end,
      });
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast.success("Financial period closed and snapshot recorded.");
      queryClient.invalidateQueries({ queryKey: ["financial-close-control", managerId] });
    },
    onError: (error: Error) => toast.error(error.message || "Period could not be closed."),
  });

  const checks = data?.checks ?? {};
  const ready = !!data?.ready_to_close;
  const closed = data?.status === "closed";

  if (isLoading) return <div className="h-72 rounded-xl border border-border bg-card animate-pulse" aria-busy="true" />;

  return (
    <Card className="border-border/80 shadow-[0_8px_28px_-22px_rgb(13_39_68/0.28)]">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><LockKeyhole className="h-4 w-4" />Financial Close Control Center</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Reconcile the period before locking the owner-statement snapshot.</p>
          </div>
          <div className="flex items-end gap-2">
            <div><Label htmlFor="close-period" className="text-[10px] uppercase tracking-wide text-muted-foreground">Period</Label><Input id="close-period" type="month" value={period} onChange={e => setPeriod(e.target.value)} className="mt-1 w-36" /></div>
            <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching} aria-label="Refresh financial close"><RefreshCw className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {[["Invoiced", formatCurrency(Number(data?.invoiced_amount ?? 0))], ["Collected", formatCurrency(Number(data?.collected_amount ?? 0))], ["Expenses", formatCurrency(Number(data?.expenses ?? 0))], ["Net cash", formatCurrency(Number(data?.net_cash_movement ?? 0))]].map(([label,value]) => <div key={label} className="rounded-lg border border-border px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{value}</p></div>)}
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {[ ["Unmatched bank transactions", Number(checks.unmatched_bank_transactions ?? 0)], ["Pending payments", Number(checks.pending_payment_transactions ?? 0)], ["Pending owner payouts", Number(checks.pending_owner_payouts ?? 0)] ].map(([label,count]) => <div key={label as string} className="flex items-center justify-between rounded-lg border border-border px-3 py-2"><div className="flex items-center gap-2 text-xs"><AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />{label}</div><Badge variant={Number(count) === 0 ? "outline" : "destructive"}>{String(count)}</Badge></div>)}
        </div>
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm">{closed ? <CheckCircle2 className="h-4 w-4 text-success" /> : ready ? <CheckCircle2 className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-warning" />}<span>{closed ? "Period locked with an auditable snapshot." : ready ? "All close checks passed. Period is ready to lock." : "Resolve all reconciliation checks before closing."}</span></div>
          <Button onClick={() => closeMutation.mutate()} disabled={!ready || closed || closeMutation.isPending} className="gap-2"><LockKeyhole className="h-4 w-4" />{closeMutation.isPending ? "Closing…" : closed ? "Period Closed" : "Close Period"}</Button>
        </div>
        {data?.closed_at && <p className="text-[11px] text-muted-foreground">Closed {new Date(data.closed_at).toLocaleString()}</p>}
      </CardContent>
    </Card>
  );
}
