import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, CheckCircle2, Clock3, ShieldAlert, HandCoins, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { useCurrency } from "@/shared/hooks/useCurrency";

export function CollectionsRecoveryAutomation() {
  const { managerId } = useManagerScope();
  const { formatCurrency } = useCurrency();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["collection-recovery-dashboard", managerId], enabled: !!managerId, staleTime: 30_000,
    queryFn: async () => { const { data, error } = await supabase.rpc("get_collection_recovery_dashboard" as any, { p_manager_id: managerId }); if (error) throw error; return (data ?? {}) as any; },
  });
  if (isLoading) return <div className="h-80 rounded-xl border border-border bg-card animate-pulse" aria-busy="true" />;
  if (!data) return null;
  const s = data.summary ?? {}; const cases = Array.isArray(data.cases) ? data.cases : [];
  const sync = async () => { if (!managerId) return; setBusy(true); try { const { error } = await supabase.rpc("sync_collection_recovery_cases_atomic" as any, { p_manager_id: managerId }); if (error) throw error; await qc.invalidateQueries({ queryKey: ["collection-recovery-dashboard", managerId] }); } finally { setBusy(false); } };
  const advance = async (id: string, stage: string) => { setBusy(true); try { const { error } = await supabase.rpc("advance_collection_recovery_stage_atomic" as any, { p_case_id: id, p_stage: stage }); if (error) throw error; await qc.invalidateQueries({ queryKey: ["collection-recovery-dashboard", managerId] }); } finally { setBusy(false); } };
  return <Card className="border-border/80 shadow-[0_8px_28px_-22px_rgb(13_39_68/0.28)]">
    <CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-base"><BellRing className="h-4 w-4" />Collections recovery automation</CardTitle><p className="mt-1 text-xs text-muted-foreground">Turn overdue receivables into staged follow-up, escalation and promise-to-pay workflows.</p></div><Button size="sm" variant="outline" onClick={sync} disabled={busy}><RefreshCw className={busy ? "mr-2 h-3.5 w-3.5 animate-spin" : "mr-2 h-3.5 w-3.5"}/>Sync cases</Button></div></CardHeader>
    <CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[["Active",s.active_cases,Clock3],["Due today",s.due_today,BellRing],["Escalated",s.escalated,ShieldAlert],["Promises",s.promised,HandCoins]].map(([label,value,Icon]:any)=><div key={label} className="rounded-lg border border-border px-3 py-2"><div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-3.5 w-3.5"/><span className="text-[10px] uppercase tracking-wide">{label}</span></div><p className="mt-1 text-lg font-semibold">{value ?? 0}</p></div>)}
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2"><span className="text-xs text-muted-foreground">Promised value currently tracked</span><span className="text-sm font-semibold">{formatCurrency(Number(s.promised_value ?? 0))}</span></div>
      <div className="max-h-80 space-y-2 overflow-auto">{cases.length===0 ? <p className="text-xs text-muted-foreground">No active recovery cases. Sync the queue when overdue invoices need follow-up.</p> : cases.slice(0,12).map((c:any)=><div key={c.id} className="rounded-md border border-border p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-semibold">{c.invoice_number}</p><p className="mt-1 text-[10px] text-muted-foreground">{c.days_overdue} days overdue · {formatCurrency(Number(c.balance_due ?? 0))}</p></div><Badge variant="outline">{String(c.stage).replace(/_/g, " ")}</Badge></div><div className="mt-2 flex flex-wrap gap-1.5"><Button size="sm" variant="outline" disabled={busy} onClick={()=>advance(c.id,"follow_up")}><BellRing className="mr-1 h-3 w-3"/>Follow up</Button><Button size="sm" variant="outline" disabled={busy} onClick={()=>advance(c.id,"escalated")}><ShieldAlert className="mr-1 h-3 w-3"/>Escalate</Button><Button size="sm" variant="outline" disabled={busy} onClick={()=>advance(c.id,"resolved")}><CheckCircle2 className="mr-1 h-3 w-3"/>Resolve</Button></div></div>)}</div>
    </CardContent>
  </Card>;
}
