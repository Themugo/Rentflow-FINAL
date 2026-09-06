import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, RefreshCw, Receipt, WalletCards, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { useToast } from "@/shared/hooks/use-toast";
import { useCurrency } from "@/shared/hooks/useCurrency";

type ExceptionRow = { id: string; amount: number; status?: string; created_at?: string; updated_at?: string; reference?: string; allocated_amount?: number; difference?: number };
type ExceptionData = { stale_pending: ExceptionRow[]; allocation_mismatches: ExceptionRow[]; receipt_recovery: ExceptionRow[]; failed_24h: ExceptionRow[] };

const groups = [
  ["stale_pending", "Stale pending", "Payments waiting beyond the recovery window", "warning", RefreshCw],
  ["allocation_mismatches", "Allocation mismatches", "Completed money not fully reconciled to invoices", "danger", WalletCards],
  ["receipt_recovery", "Receipt recovery", "Completed payments without an issued receipt", "warning", Receipt],
  ["failed_24h", "Failed · 24h", "Payment attempts that failed recently", "danger", XCircle],
] as const;

export default function PaymentExceptionControlCenter() {
  const { formatCurrency } = useCurrency();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery<ExceptionData>({
    queryKey: ["payment-exception-control-center"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_payment_exception_control_center" as any);
      if (error) throw error;
      return (data ?? { stale_pending: [], allocation_mismatches: [], receipt_recovery: [], failed_24h: [] }) as ExceptionData;
    },
    refetchInterval: 60_000,
  });

  const recovery = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("complete_payment_recovery_atomic" as any, { p_transaction_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast({ title: "Payment recovered", description: "The issued receipt is now available to recipients." }); qc.invalidateQueries({ queryKey: ["payment-exception-control-center"] }); qc.invalidateQueries({ queryKey: ["notification-failures"] }); },
    onError: (e: any) => toast({ title: "Recovery failed", description: e?.message ?? "Try again later.", variant: "destructive" }),
  });

  const total = groups.reduce((sum, [key]) => sum + ((data?.[key] ?? []) as ExceptionRow[]).length, 0);
  return <div className="space-y-5">
    <div className="flex items-center justify-between gap-3">
      <div><h2 className="text-lg font-semibold">Payment control centre</h2><p className="text-sm text-muted-foreground">Exceptions that can leave money, allocations or receipts out of sync.</p></div>
      <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isLoading}><RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /></Button>
    </div>
    {isLoading ? <div className="py-10 text-center text-muted-foreground">Checking payment exceptions…</div> : total === 0 ? <Card><CardContent className="py-10 text-center"><CheckCircle2 className="mx-auto mb-2 h-9 w-9 text-success" /><p className="font-medium">Payment operations are clear</p><p className="text-sm text-muted-foreground">No stale, failed, mismatched or receipt-recovery exceptions are currently visible.</p></CardContent></Card> : <div className="grid gap-4 lg:grid-cols-2">{groups.map(([key,title,desc,tone,Icon]) => { const rows = data?.[key] ?? []; return <Card key={key} className={rows.length ? "border-warning/30" : ""}><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><Icon className="h-4 w-4" />{title}<Badge variant="outline" className="ml-auto">{rows.length}</Badge></CardTitle><CardDescription>{desc}</CardDescription></CardHeader><CardContent>{rows.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : <div className="space-y-2">{rows.slice(0,6).map(row => <div key={row.id} className="flex items-center gap-3 rounded-lg border border-border p-3"><div className="min-w-0 flex-1"><p className="font-medium">{formatCurrency(Number(row.amount || 0))}</p><p className="truncate font-mono text-xs text-muted-foreground">{row.reference ?? row.id.slice(0,8)}</p>{row.difference != null && <p className="text-xs text-destructive">Unallocated difference: {formatCurrency(Number(row.difference))}</p>}</div>{key === "receipt_recovery" && <Button size="sm" onClick={() => recovery.mutate(row.id)} disabled={recovery.isPending}>Recover</Button>}</div>)}</div>}</CardContent></Card>; })}</div>}
  </div>;
}
