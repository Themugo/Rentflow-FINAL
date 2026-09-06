import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Bell, Mail, MessageSquare, AlertTriangle, Send, RefreshCw, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { toast } from "@/shared/hooks/use-toast";

export function CollectionsCommunicationsMonitoring() {
  const { managerId } = useManagerScope();
  const { formatCurrency } = useCurrency();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["collection-recovery-communications", managerId], enabled: !!managerId, staleTime: 30_000,
    queryFn: async () => { const { data, error } = await supabase.rpc("get_collection_recovery_communications" as any, { p_manager_id: managerId }); if (error) throw error; return (data ?? {}) as any; },
  });
  const monitor = useMutation({ mutationFn: async () => { const { data, error } = await supabase.rpc("mark_missed_collection_promises_atomic" as any, { p_manager_id: managerId }); if (error) throw error; return data as { escalated:number }; }, onSuccess: (d) => { toast({ title:"Promise monitoring complete", description:`${d?.escalated ?? 0} missed promise(s) escalated.` }); void qc.invalidateQueries({ queryKey:["collection-recovery-communications", managerId] }); void qc.invalidateQueries({ queryKey:["collection-recovery-dashboard", managerId] }); void qc.invalidateQueries({ queryKey:["operation-work-queue", managerId] }); }, onError:(e:any)=>toast({ title:"Promise monitoring failed", description:e?.message ?? "Please try again.", variant:"destructive" }) });
  const queue = useMutation({ mutationFn: async ({caseId,channel}:{caseId:string;channel:"sms"|"email"}) => { const { error } = await supabase.rpc("queue_collection_recovery_communication_atomic" as any, { p_case_id:caseId, p_channel:channel }); if (error) throw error; }, onSuccess:(_,vars)=>{ toast({ title:`${vars.channel.toUpperCase()} reminder queued` }); void qc.invalidateQueries({ queryKey:["collection-recovery-communications", managerId] }); }, onError:(e:any)=>toast({ title:"Could not queue reminder", description:e?.message ?? "Please try again.", variant:"destructive" }) });
  if (isLoading) return <div className="h-80 rounded-xl border border-border bg-card animate-pulse" aria-busy="true" />;
  if (!data) return null;
  const s=data.summary ?? {}; const items=Array.isArray(data.queue)?data.queue:[]; const missed=Array.isArray(data.missed)?data.missed:[];
  return <Card className="border-border/80 shadow-[0_8px_28px_-22px_rgb(13_39_68/0.28)]">
    <CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4"/>Collections communications & promise monitoring</CardTitle><p className="mt-1 text-xs text-muted-foreground">Queue controlled reminders and automatically surface missed payment promises.</p></div><Button size="sm" variant="outline" onClick={()=>monitor.mutate()} disabled={monitor.isPending || !managerId}><AlertTriangle className="mr-2 h-3.5 w-3.5"/>Monitor promises</Button></div></CardHeader>
    <CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">{[["Queued",s.queued,Bell],["Failed",s.failed,AlertTriangle],["Sent 24h",s.sent_24h,CheckCircle2],["Missed promises",s.missed_promises,AlertTriangle]].map(([label,value,Icon]:any)=><div key={label} className="rounded-lg border border-border px-3 py-2"><div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-3.5 w-3.5"/><span className="text-[10px] uppercase tracking-wide">{label}</span></div><p className="mt-1 text-lg font-semibold">{value ?? 0}</p></div>)}</div>
      {missed.length>0 && <div className="rounded-lg border border-destructive/30 bg-destructive/[0.035] p-3"><p className="mb-2 text-sm font-semibold">Missed promises requiring escalation</p><div className="space-y-2">{missed.slice(0,8).map((m:any)=><div key={m.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2"><div><p className="text-xs font-medium">{m.invoice_number}</p><p className="text-[10px] text-muted-foreground">{m.days_late} day(s) late · balance {formatCurrency(Number(m.balance_due ?? 0))}</p></div><Badge variant="destructive">Escalated</Badge></div>)}</div></div>}
      <div className="space-y-2">{items.length===0 ? <p className="text-xs text-muted-foreground">No queued or failed communications. Use the recovery workflow to queue a reminder.</p> : items.slice(0,10).map((c:any)=><div key={c.id} className="rounded-md border border-border p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-semibold">{c.invoice_number} · {c.recipient_name || c.recipient}</p><p className="mt-1 text-[10px] text-muted-foreground">{c.channel} · scheduled {new Date(c.scheduled_at).toLocaleString()} · {formatCurrency(Number(c.balance_due ?? 0))}</p></div><Badge variant={c.status==='failed'?"destructive":"outline"}>{c.status}</Badge></div><p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">{c.message}</p></div>)}</div>
      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground"><span className="inline-flex items-center gap-1"><Send className="h-3 w-3"/>Messages are queued, not silently sent.</span><span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3"/>SMS requires tenant phone.</span><span className="inline-flex items-center gap-1"><Mail className="h-3 w-3"/>Email requires tenant email.</span><Button size="sm" variant="ghost" className="ml-auto" onClick={()=>void qc.invalidateQueries({queryKey:["collection-recovery-communications",managerId]})}><RefreshCw className="mr-1 h-3 w-3"/>Refresh</Button></div>
    </CardContent>
  </Card>;
}
