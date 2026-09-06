import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, FileCheck2, Link2, RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Textarea } from "@/shared/components/ui/textarea";
import { toast } from "sonner";

const severityVariant = (s: string) => s === "critical" ? "destructive" : s === "high" ? "destructive" : "outline" as any;
const typeLabel: Record<string,string> = {
  lease_invoice_gap: "Lease → invoice", invoice_payment_gap: "Invoice → payment", payment_allocation_gap: "Payment → allocation",
  bank_match_gap: "Bank → ledger", payout_settlement_gap: "Payout → settlement", close_readiness_gap: "Financial close",
  evidence_gap: "Evidence", work_item_gap: "Operations"
};

export function FinancialOperationalReconciliationCenter() {
  const { managerId } = useManagerScope();
  const queryClient = useQueryClient();
  const [note, setNote] = useState<Record<string,string>>({});
  const [statusFilter, setStatusFilter] = useState("active");
  const query = useQuery({
    queryKey: ["financial-operational-reconciliation", managerId, statusFilter], enabled: !!managerId,
    queryFn: async () => { const { data,error } = await supabase.rpc("get_manager_reconciliation_command_center" as any,{ p_manager_id:managerId,p_status:statusFilter }); if(error) throw error; return (data ?? {summary:{},cases:[]}) as any; }
  });
  const sync = useMutation({ mutationFn: async()=>{ const {data,error}=await supabase.rpc("sync_manager_reconciliation_command_center" as any,{p_manager_id:managerId}); if(error) throw error; return data; }, onSuccess:()=>{ toast.success("Reconciliation scan completed."); void queryClient.invalidateQueries({queryKey:["financial-operational-reconciliation",managerId]}); void queryClient.invalidateQueries({queryKey:["operation-work-queue"]}); }, onError:(e:Error)=>toast.error(e.message||"Reconciliation scan failed.") });
  const transition = useMutation({ mutationFn: async({id,status}:{id:string;status:string})=>{const {data,error}=await supabase.rpc("transition_reconciliation_case_atomic" as any,{p_case_id:id,p_target_status:status,p_resolution_note:note[id]||null});if(error)throw error;return data;},onSuccess:()=>{toast.success("Reconciliation case updated.");setNote({});void queryClient.invalidateQueries({queryKey:["financial-operational-reconciliation",managerId]});void queryClient.invalidateQueries({queryKey:["operation-work-queue"]});},onError:(e:Error)=>toast.error(e.message||"Could not update case.")});
  const summary=query.data?.summary??{}; const cases=query.data?.cases??[];
  return <Card className="border-border/80 shadow-[0_8px_28px_-22px_rgb(13_39_68/0.28)]">
    <CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-4 w-4"/>Financial & Operational Reconciliation</CardTitle><p className="mt-1 text-xs text-muted-foreground">One exception register across leases, billing, payments, banks, settlements, close and evidence.</p></div><Button variant="outline" size="icon" onClick={()=>sync.mutate()} disabled={sync.isPending||!managerId} aria-label="Run reconciliation scan"><RefreshCw className={sync.isPending?"h-4 w-4 animate-spin":"h-4 w-4"}/></Button></div></CardHeader>
    <CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{[["Active",summary.active??0],["Critical",summary.critical??0],["High",summary.high??0],["Medium",summary.medium??0],["Resolved 30d",summary.resolved_30d??0]].map(([label,value])=><div key={label as string} className="rounded-lg border border-border px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{value}</p></div>)}</div>
      <div className="flex flex-wrap gap-2">{["active","resolved","dismissed","all"].map(s=><Button key={s} size="sm" variant={statusFilter===s?"default":"outline"} onClick={()=>setStatusFilter(s)}>{s[0].toUpperCase()+s.slice(1)}</Button>)}</div>
      {query.isLoading?<div className="h-48 animate-pulse rounded-lg border border-border"/>:cases.length===0?<div className="rounded-lg border border-dashed p-6 text-center"><ShieldCheck className="mx-auto h-7 w-7 text-muted-foreground"/><p className="mt-2 text-sm font-medium">No reconciliation exceptions</p><p className="mt-1 text-xs text-muted-foreground">Run a scan after new financial or operational activity.</p></div>:<div className="space-y-2">{cases.slice(0,20).map((c:any)=><div key={c.id} className="rounded-lg border border-border p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{c.title}</p><Badge variant={severityVariant(c.severity)}>{c.severity}</Badge><Badge variant="outline">{typeLabel[c.issue_type]??c.issue_type}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{c.description}</p></div><Badge variant={c.status==="resolved"?"default":c.status==="dismissed"?"outline":"secondary"}>{c.status}</Badge></div><div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground"><span>{c.due_at?`Due ${new Date(c.due_at).toLocaleDateString()}`:"No due date"}</span>{c.work_item_id&&<span className="inline-flex items-center gap-1"><FileCheck2 className="h-3 w-3"/>Work item linked</span>}{c.evidence_document_id&&<span>Evidence linked</span>}</div>{c.status!=="resolved"&&c.status!=="dismissed"&&<div className="mt-3 space-y-2"><Textarea value={note[c.id]??""} onChange={e=>setNote(v=>({...v,[c.id]:e.target.value}))} placeholder="Resolution note (optional)" className="min-h-16 text-xs"/><div className="flex flex-wrap gap-2">{c.status==="open"&&<Button size="sm" variant="outline" onClick={()=>transition.mutate({id:c.id,status:"in_progress"})} disabled={transition.isPending}><AlertTriangle className="mr-1 h-3.5 w-3.5"/>Take ownership</Button>}{c.status==="in_progress"&&<Button size="sm" variant="outline" onClick={()=>transition.mutate({id:c.id,status:"open"})} disabled={transition.isPending}>Return to open</Button>}<Button size="sm" onClick={()=>transition.mutate({id:c.id,status:"resolved"})} disabled={transition.isPending}><CheckCircle2 className="mr-1 h-3.5 w-3.5"/>Resolve</Button><Button size="sm" variant="ghost" onClick={()=>transition.mutate({id:c.id,status:"dismissed"})} disabled={transition.isPending}>Dismiss</Button></div></div>}</div>)}</div>}
    </CardContent>
  </Card>;
}
