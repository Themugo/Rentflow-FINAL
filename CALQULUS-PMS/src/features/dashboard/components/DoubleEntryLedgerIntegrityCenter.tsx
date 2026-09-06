import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BookOpenCheck, CheckCircle2, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { toast } from "sonner";

const DoubleEntryLedgerIntegrityCenter = () => {
  const { managerId } = useManagerScope();
  const queryClient = useQueryClient();
  const [periodId, setPeriodId] = useState("");
  const [audit, setAudit] = useState<any>(null);

  const { data: periods = [] } = useQuery({
    queryKey: ["ledger-integrity-periods", managerId],
    enabled: !!managerId,
    queryFn: async () => {
      const { data, error } = await supabase.from("financial_close_periods").select("id,period_start,period_end,status").eq("manager_id", managerId!).order("period_end", { ascending: false }).limit(24);
      if (error) throw error;
      return data ?? [];
    },
  });

  const selected = periods.find((p: any) => p.id === periodId);

  const runAudit = useMutation({
    mutationFn: async () => {
      if (!selected || !managerId) throw new Error("Select a period first");
      const { data, error } = await supabase.rpc("audit_manager_ledger_integrity", { p_manager_id: managerId, p_period_start: selected.period_start, p_period_end: selected.period_end });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => setAudit(data),
    onError: (error: Error) => toast.error(error.message || "Ledger audit failed"),
  });

  const post = useMutation({
    mutationFn: async () => {
      if (!selected || !managerId) throw new Error("Select a period first");
      if (selected.status === "closed") throw new Error("Closed periods are immutable");
      const { data, error } = await supabase.rpc("post_manager_financial_ledger_atomic", { p_manager_id: managerId, p_period_start: selected.period_start, p_period_end: selected.period_end });
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => { toast.success(`Ledger posting complete: ${data?.posted ?? 0} entries`); await queryClient.invalidateQueries({ queryKey: ["ledger-integrity-periods", managerId] }); runAudit.mutate(); },
    onError: (error: Error) => toast.error(error.message || "Ledger posting failed"),
  });

  const sourceRows = audit?.sources ? Object.entries(audit.sources) : [];
  return (
    <Card className="enterprise-card">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="section-title flex items-center gap-2"><BookOpenCheck className="h-5 w-5" /> Double-Entry Ledger Integrity</CardTitle>
            <CardDescription>Controlled journal posting and completeness checks over the existing invoices, allocations, expenses and owner settlements.</CardDescription>
          </div>
          <Badge variant="outline" className="gap-1"><ShieldCheck className="h-3 w-3" /> Source-linked</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] items-end">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Accounting period</p>
            <Select value={periodId} onValueChange={setPeriodId}>
              <SelectTrigger><SelectValue placeholder="Select a period" /></SelectTrigger>
              <SelectContent>{periods.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.period_start} → {p.period_end} · {p.status}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => runAudit.mutate()} disabled={!selected || runAudit.isPending} className="gap-2"><RefreshCw className="h-4 w-4" /> Audit</Button>
          <Button onClick={() => post.mutate()} disabled={!selected || selected.status === "closed" || post.isPending} className="gap-2"><BookOpenCheck className="h-4 w-4" /> Post ledger</Button>
        </div>
        {selected?.status === "closed" && <p className="text-xs text-muted-foreground">This period is closed. The ledger is immutable; missing postings must be corrected through controlled reconciliation/reversal procedures.</p>}
        {audit && <div className="space-y-4 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">Ledger integrity</p><p className="text-xs text-muted-foreground">{audit.period?.start} → {audit.period?.end}</p></div><Badge variant={audit.complete ? "default" : "destructive"}>{audit.complete ? <><CheckCircle2 className="mr-1 h-3 w-3" /> Complete</> : <><TriangleAlert className="mr-1 h-3 w-3" /> Exceptions</>}</Badge></div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{sourceRows.map(([key, value]: any) => <div key={key} className="rounded-md border p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{key.replaceAll("_", " ")}</p><p className="mt-1 text-sm font-semibold">{value.count} source · {value.unposted} unposted</p></div>)}</div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3"><div><p className="text-xs text-muted-foreground">Debits</p><p className="font-semibold tabular-nums">{Number(audit.journal?.debits ?? 0).toLocaleString()}</p></div><div><p className="text-xs text-muted-foreground">Credits</p><p className="font-semibold tabular-nums">{Number(audit.journal?.credits ?? 0).toLocaleString()}</p></div><div><p className="text-xs text-muted-foreground">Unbalanced entries</p><p className="font-semibold">{audit.journal?.unbalanced_entries ?? 0}</p></div></div>
          <p className="text-xs text-muted-foreground">The journal is a controlled accounting representation; invoices, payments, allocations, expenditures and payouts remain the authoritative source records.</p>
        </div>}
      </CardContent>
    </Card>
  );
};
export default DoubleEntryLedgerIntegrityCenter;
