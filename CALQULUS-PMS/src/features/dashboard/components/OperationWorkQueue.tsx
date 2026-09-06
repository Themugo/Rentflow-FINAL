import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, ListTodo, RefreshCw, UserRound, ArrowRight, AlertTriangle, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { toast } from "@/shared/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";

interface WorkItem { id:string; title:string; description:string; href:string|null; priority:string; status:string; assignee_name:string; due_at:string|null; sla_due_at:string|null; source_type:string; }

const priorityVariant = (p:string) => p === "critical" || p === "high" ? "destructive" : "outline";

export function OperationWorkQueue() {
  const { managerId } = useManagerScope();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ["operation-work-queue", managerId],
    enabled: !!managerId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_operation_work_queue" as any, { p_manager_id: managerId, p_status: "active" });
      if (error) throw error;
      return (data ?? []) as WorkItem[];
    }, staleTime: 30_000,
  });
  const { data: metrics = {} } = useQuery({ queryKey: ["operation-work-queue-metrics", managerId], enabled: !!managerId, queryFn: async () => { const { data, error } = await supabase.rpc("get_operation_work_queue_metrics" as any, { p_manager_id: managerId }); if (error) throw error; return (data ?? {}) as Record<string, number>; }, staleTime: 30_000 });
  const { data: team = { members: [], workload: [] } } = useQuery({ queryKey: ["operation-work-team", managerId], enabled: !!managerId, queryFn: async () => { const { data, error } = await supabase.rpc("get_operation_work_team" as any, { p_manager_id: managerId }); if (error) throw error; return (data ?? { members: [], workload: [] }) as { members: Array<{id:string;name:string;role:string}>; workload: Array<{id:string;name:string;role:string;active_count:number;breached_count:number;completed_30d:number;completion_rate:number}> }; }, staleTime: 30_000 });
  const assign = useMutation({ mutationFn: async ({ id, assignee }: { id:string; assignee:string }) => { const { error } = await supabase.rpc("assign_operation_work_item_atomic" as any, { p_item_id:id, p_assignee_id:assignee }); if (error) throw error; }, onSuccess: () => { toast({ title: "Work assigned" }); void queryClient.invalidateQueries({ queryKey: ["operation-work-queue", managerId] }); void queryClient.invalidateQueries({ queryKey: ["operation-work-team", managerId] }); }, onError: (error:any) => toast({ title:"Could not assign work", description:error?.message ?? "Please try again.", variant:"destructive" }) });
  const autoAssign = useMutation({ mutationFn: async (id:string) => { const { error } = await supabase.rpc("auto_assign_operation_work_item_atomic" as any, { p_item_id:id }); if (error) throw error; }, onSuccess: () => { toast({ title:"Work balanced", description:"The item was assigned to the least-loaded eligible team member." }); void queryClient.invalidateQueries({ queryKey: ["operation-work-queue", managerId] }); void queryClient.invalidateQueries({ queryKey: ["operation-work-team", managerId] }); }, onError:(error:any)=>toast({ title:"Could not auto-assign", description:error?.message ?? "Please try again.", variant:"destructive" }) });
  const escalate = useMutation({ mutationFn: async () => { const { data, error } = await supabase.rpc("escalate_overdue_operation_work_atomic" as any, { p_manager_id: managerId }); if (error) throw error; return data as { escalated:number }; }, onSuccess: (data) => { toast({ title: "SLA review complete", description: `${data?.escalated ?? 0} overdue item(s) escalated.` }); void queryClient.invalidateQueries({ queryKey: ["operation-work-queue", managerId] }); void queryClient.invalidateQueries({ queryKey: ["operation-work-queue-metrics", managerId] }); }, onError: (error:any) => toast({ title: "Could not escalate work", description: error?.message ?? "Please try again.", variant: "destructive" }) });
  const sync = useMutation({
    mutationFn: async () => { const { data, error } = await supabase.rpc("sync_operation_work_queue_atomic" as any, { p_manager_id: managerId }); if (error) throw error; return data as { created:number }; },
    onSuccess: (data) => { toast({ title: "Work queue synchronized", description: `${data?.created ?? 0} new item(s) added.` }); void queryClient.invalidateQueries({ queryKey: ["operation-work-queue", managerId] }); },
    onError: (error:any) => toast({ title: "Could not sync work queue", description: error?.message ?? "Please try again.", variant: "destructive" }),
  });
  const transition = useMutation({
    mutationFn: async ({ id, status }:{id:string;status:string}) => { const { error } = await supabase.rpc("transition_operation_work_item_atomic" as any, { p_item_id:id, p_status:status }); if (error) throw error; },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["operation-work-queue", managerId] }),
    onError: (error:any) => toast({ title: "Could not update work item", description: error?.message ?? "Please try again.", variant: "destructive" }),
  });

  return <Card className="border-border/80 shadow-[0_8px_28px_-22px_rgb(13_39_68/0.28)]">
    <CardHeader className="pb-3"><div className="flex items-center justify-between gap-3"><div><CardTitle className="text-base flex items-center gap-2"><ListTodo className="h-4 w-4" />Operational work queue</CardTitle><p className="mt-1 text-xs text-muted-foreground">Turn portfolio exceptions into owned work and close the loop.</p></div><Button variant="outline" size="sm" onClick={() => escalate.mutate()} disabled={escalate.isPending || !managerId}><AlertTriangle className="mr-1 h-3.5 w-3.5" />Escalate overdue</Button><Button variant="outline" size="sm" onClick={() => sync.mutate()} disabled={sync.isPending || !managerId}><RefreshCw className={`mr-1 h-3.5 w-3.5 ${sync.isPending ? "animate-spin" : ""}`} />Sync</Button></div></CardHeader>
    <CardContent>
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-6">{[["Active",metrics.active],["Unassigned",metrics.unassigned],["Due today",metrics.due_today],["SLA breached",metrics.sla_breached],["Critical",metrics.critical],["Escalated",metrics.escalated]].map(([label,value]) => <div key={label as string} className="rounded-lg border border-border px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold">{value ?? 0}</p></div>)}</div>
      {team.workload?.length > 0 && <div className="mb-4 rounded-lg border border-border p-3"><div className="mb-2 flex items-center gap-2"><Users className="h-4 w-4" /><p className="text-sm font-semibold">Team workload</p></div><div className="grid gap-2 md:grid-cols-3">{team.workload.map((m) => <div key={m.id} className="rounded-md bg-muted/40 px-3 py-2"><div className="flex items-center justify-between gap-2"><span className="text-xs font-medium truncate">{m.name}</span><Badge variant="outline">{m.active_count} active</Badge></div><p className="mt-1 text-[11px] text-muted-foreground">{m.breached_count} breached · {m.completed_30d} completed / 30d · {m.completion_rate}% throughput</p></div>)}</div></div>}
      {isLoading ? <div className="h-24 animate-pulse rounded-lg bg-muted" /> : items.length === 0 ? <div className="flex items-center gap-3 rounded-lg border border-success/20 bg-success/[0.035] px-4 py-3"><CheckCircle2 className="h-5 w-5 text-success" /><div><p className="text-sm font-semibold">No active work items</p><p className="text-xs text-muted-foreground">Sync the queue when you want current exceptions converted into trackable work.</p></div></div> : <div className="space-y-2">{items.slice(0,10).map(item => <div key={item.id} className="flex flex-col gap-3 rounded-lg border border-border p-3 md:flex-row md:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold truncate">{item.title}</p><Badge variant={priorityVariant(item.priority) as any}>{item.priority}</Badge>{item.status === "in_progress" && <Badge variant="outline">In progress</Badge>}</div><p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.description}</p><div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground"><span className="inline-flex items-center gap-1"><UserRound className="h-3 w-3" />{item.assignee_name || "Unassigned"}</span>{item.due_at && <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />Due {new Date(item.due_at).toLocaleDateString()}</span>}{item.sla_due_at && <span className={`inline-flex items-center gap-1 ${new Date(item.sla_due_at) < new Date() && item.status !== "completed" ? "font-semibold text-destructive" : ""}`}><AlertTriangle className="h-3 w-3" />SLA {new Date(item.sla_due_at).toLocaleString()}</span>}</div></div><div className="flex shrink-0 flex-wrap items-center justify-end gap-1"><Select value={item.assignee_name ? undefined : "unassigned"} onValueChange={(value) => value === "auto" ? autoAssign.mutate(item.id) : assign.mutate({id:item.id,assignee:value})}><SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder={item.assignee_name || "Assign"} /></SelectTrigger><SelectContent>{team.members?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}<SelectItem value="auto">Auto-balance</SelectItem></SelectContent></Select><Button size="sm" variant="ghost" onClick={() => item.href && navigate(item.href)} disabled={!item.href}>Open<ArrowRight className="ml-1 h-3 w-3" /></Button>{item.status === "open" ? <Button size="sm" variant="outline" onClick={() => transition.mutate({id:item.id,status:"in_progress"})}>Start</Button> : <Button size="sm" variant="outline" onClick={() => transition.mutate({id:item.id,status:"completed"})}>Complete</Button>}</div></div>)}</div>}
    </CardContent>
  </Card>;
}
