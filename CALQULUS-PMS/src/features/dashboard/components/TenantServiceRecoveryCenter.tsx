import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, Mail, MessageSquare, Phone, RefreshCw, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { toast } from "sonner";

export function TenantServiceRecoveryCenter() {
  const { managerId } = useManagerScope();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["tenant-service-recovery", managerId], enabled: !!managerId, staleTime: 45_000,
    queryFn: async () => { const { data, error } = await supabase.rpc("get_manager_tenant_service_recovery_dashboard" as any, { p_manager_id: managerId }); if (error) throw error; return (data ?? {}) as any; }
  });
  const syncCases = async () => { const { data, error } = await supabase.rpc("sync_tenant_service_recovery_cases_atomic" as any, { p_manager_id: managerId }); if (error) return toast.error(error.message); toast.success(`Opened ${Number((data as any)?.created ?? 0)} recovery case(s).`); queryClient.invalidateQueries({ queryKey: ["tenant-service-recovery", managerId] }); };
  const transition = async (id: string, status: string) => { const { error } = await supabase.rpc("transition_tenant_service_recovery_case_atomic" as any, { p_case_id: id, p_status: status }); if (error) return toast.error(error.message); queryClient.invalidateQueries({ queryKey: ["tenant-service-recovery", managerId] }); };
  if (isLoading) return <div className="h-64 rounded-xl border border-border bg-card animate-pulse" aria-busy="true" />;
  const s = data?.summary ?? {}; const cases = Array.isArray(data?.cases) ? data.cases : [];
  return <Card className="border-border/80 shadow-[0_8px_28px_-22px_rgb(13_39_68/0.28)]">
    <CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-base"><ShieldAlert className="h-4 w-4" />Tenant service recovery</CardTitle><p className="mt-1 text-xs text-muted-foreground">Close the loop on material service issues with an accountable case and follow-up trail.</p></div><Button variant="outline" size="sm" onClick={syncCases}><RefreshCw className="mr-2 h-3.5 w-3.5" />Sync cases</Button></div></CardHeader>
    <CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">{[["Open",s.open_cases,Clock3],["Critical",s.critical_cases,ShieldAlert],["High",s.high_cases,ShieldAlert],["Awaiting contact",s.awaiting_contact,MessageSquare],["Resolved 30d",s.resolved_30d,CheckCircle2]].map(([label,value,Icon])=><div key={label as string} className="rounded-lg border border-border px-3 py-2"><div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-3.5 w-3.5"/><span className="text-[10px] uppercase tracking-wide">{label as string}</span></div><p className="mt-1 text-lg font-semibold">{value as any}</p></div>)}</div>
      {cases.length===0 ? <div className="rounded-lg border border-dashed border-border p-5 text-center text-xs text-muted-foreground">No active recovery cases. Use Sync cases after reviewing tenant experience signals.</div> : <div className="space-y-2">{cases.filter((c:any)=>!['resolved','closed','cancelled'].includes(c.status)).slice(0,8).map((c:any)=><div key={c.id} className="rounded-lg border border-border p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-semibold">{c.tenant_name}</p><p className="truncate text-[11px] text-muted-foreground">{c.property_name}{c.unit_name?` · ${c.unit_name}`:""} · {c.driver}</p></div><Badge variant={c.priority==='critical'||c.priority==='high'?"destructive":"outline"}>{c.priority}</Badge></div><div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground"><span>{c.status}</span><span>{c.queued_communications} queued follow-up</span><span>{c.sent_communications} sent</span></div><div className="mt-2 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>transition(c.id,"in_progress")} disabled={c.status==='in_progress'}><Clock3 className="mr-1 h-3 w-3"/>Work case</Button><Button size="sm" variant="outline" onClick={()=>transition(c.id,"resolved")}><CheckCircle2 className="mr-1 h-3 w-3"/>Resolve</Button><Button size="sm" variant="ghost" onClick={()=>transition(c.id,"closed")}>Close</Button><Button size="sm" variant="ghost" onClick={async()=>{const body=`Hello ${c.tenant_name},\n\nWe are following up on your recent service experience. Please let us know if the issue has been resolved or if anything remains outstanding.\n\nThank you.`; const {error}=await supabase.rpc("queue_tenant_service_recovery_followup_atomic" as any,{p_case_id:c.id,p_channel:"in_app",p_subject:"Service follow-up",p_body:body,p_scheduled_at:new Date().toISOString()}); if(error) toast.error(error.message); else {toast.success("Follow-up queued");queryClient.invalidateQueries({queryKey:["tenant-service-recovery",managerId]});}}}><MessageSquare className="mr-1 h-3 w-3"/>Queue follow-up</Button></div></div>)}</div>}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground"><Mail className="h-3 w-3"/><Phone className="h-3 w-3"/>Follow-ups are recorded as queued communication actions; delivery depends on the configured notification channel.</div>
    </CardContent>
  </Card>;
}
