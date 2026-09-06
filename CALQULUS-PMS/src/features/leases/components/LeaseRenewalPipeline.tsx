// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, Loader2, MessageSquare, Send, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/shared/hooks/use-toast";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { formatDate } from "@/shared/lib/dateFormat";

const statusLabel = { draft:"Draft", sent:"Offer sent", negotiating:"Follow-up", accepted:"Accepted", declined:"Declined", notice_to_vacate:"Notice to vacate", withdrawn:"Withdrawn" };
const statusTone = { draft:"secondary", sent:"outline", negotiating:"secondary", accepted:"default", declined:"destructive", notice_to_vacate:"destructive", withdrawn:"outline" };

export function LeaseRenewalPipeline() {
  const { managerId } = useManagerScope();
  const { toast } = useToast();
  const [rows,setRows] = useState<any[]>([]);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState<string|null>(null);
  const [selected,setSelected] = useState<any|null>(null);
  const [rent,setRent] = useState("");
  const [endDate,setEndDate] = useState("");
  const [followUp,setFollowUp] = useState("");
  const [notes,setNotes] = useState("");

  const load = useCallback(async()=>{
    if(!managerId) return;
    setLoading(true);
    const { data,error } = await supabase.rpc("get_manager_lease_renewal_pipeline");
    if(error) toast({title:"Could not load renewal pipeline",description:error.message,variant:"destructive"});
    else setRows(Array.isArray(data)?data:[]);
    setLoading(false);
  },[managerId,toast]);
  useEffect(()=>{load();},[load]);

  const stats=useMemo(()=>({
    due30:rows.filter(r=>r.days_to_expiry>=0&&r.days_to_expiry<=30&&!["accepted","declined","withdrawn"].includes(r.status)).length,
    awaiting:rows.filter(r=>["sent","negotiating"].includes(r.status)).length,
    accepted:rows.filter(r=>r.status==="accepted").length,
    followups:rows.filter(r=>r.follow_up_at&&new Date(r.follow_up_at)<new Date()&&!r.tenant_decision).length,
  }),[rows]);

  const openCreate=(row:any)=>{setSelected(row);setRent(String(row.proposed_rent??row.monthly_rent??""));setEndDate(row.proposed_end_date??"");setFollowUp("");setNotes("");};
  const create=async()=>{
    if(!selected||!rent||!endDate) return;
    setBusy(selected.lease_id);
    const {error}=await supabase.rpc("create_lease_renewal_case_atomic",{p_lease_id:selected.lease_id,p_proposed_rent:Number(rent),p_proposed_end_date:endDate,p_follow_up_at:followUp?new Date(followUp).toISOString():null,p_manager_notes:notes||null});
    setBusy(null);
    if(error) toast({title:"Renewal proposal failed",description:error.message,variant:"destructive"}); else {toast({title:"Renewal proposal saved"});setSelected(null);await load();}
  };
  const send=async(id:string)=>{setBusy(id);const {error}=await supabase.rpc("send_lease_renewal_case_atomic",{p_case_id:id});setBusy(null);if(error)toast({title:"Could not send renewal",description:error.message,variant:"destructive"});else{toast({title:"Renewal offer sent to tenant"});await load();}};
  const update=async(id:string,status:string)=>{setBusy(id);const {error}=await supabase.rpc("update_lease_renewal_case_atomic",{p_case_id:id,p_status:status,p_follow_up_at:null,p_manager_notes:null});setBusy(null);if(error)toast({title:"Could not update renewal",description:error.message,variant:"destructive"});else await load();};

  if(!managerId) return null;
  return <section className="space-y-4" aria-label="Lease renewal and retention pipeline">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[['Renewals due 30d',stats.due30,CalendarClock],['Awaiting tenant',stats.awaiting,MessageSquare],['Accepted',stats.accepted,CheckCircle2],['Follow-ups due',stats.followups,AlertTriangle]].map(([label,value,Icon])=><Card key={label as string}><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></div><Icon className="h-5 w-5 text-muted-foreground"/></div></CardContent></Card>)}
    </div>
    <Card><CardHeader className="pb-3"><CardTitle className="text-base">Renewal pipeline</CardTitle></CardHeader><CardContent className="space-y-3">
      {loading?<div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin"/></div>:rows.length===0?<p className="text-sm text-muted-foreground py-6 text-center">No renewal cases yet. Expiring leases can be opened below to create a proposal.</p>:rows.map(r=><div key={r.id} className="rounded-lg border p-3 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-medium">{r.tenant_name} · {r.property_name} · {r.unit}</div><div className="text-xs text-muted-foreground">Expires {formatDate(r.end_date)} · {r.days_to_expiry} days · {r.monthly_rent?.toLocaleString()} current rent</div></div><Badge variant={statusTone[r.status]||"outline"}>{statusLabel[r.status]||r.status}</Badge></div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">{r.proposed_rent&&<span>Proposal: {Number(r.proposed_rent).toLocaleString()}</span>}{r.tenant_decision&&<span>Tenant: {r.tenant_decision}</span>}{r.follow_up_at&&<span>Follow-up: {formatDate(r.follow_up_at)}</span>}</div>
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>openCreate(r)} disabled={busy===r.lease_id}><UserCheck className="h-4 w-4 mr-1"/>Proposal</Button>{r.status==="draft"&&<Button size="sm" onClick={()=>send(r.id)} disabled={busy===r.id}>{busy===r.id?<Loader2 className="h-4 w-4 mr-1 animate-spin"/>:<Send className="h-4 w-4 mr-1"/>}Send</Button>}{["sent","negotiating"].includes(r.status)&&<><Button size="sm" variant="outline" onClick={()=>update(r.id,"accepted")}><CheckCircle2 className="h-4 w-4 mr-1"/>Mark accepted</Button><Button size="sm" variant="outline" onClick={()=>update(r.id,"declined")}><Clock3 className="h-4 w-4 mr-1"/>Close as declined</Button></>}</div>
      </div>)}
    </CardContent></Card>
    <Dialog open={!!selected} onOpenChange={(v)=>!v&&setSelected(null)}><DialogContent><DialogHeader><DialogTitle>Renewal proposal</DialogTitle></DialogHeader><div className="space-y-4"><div><Label>Proposed monthly rent</Label><Input type="number" min="1" value={rent} onChange={e=>setRent(e.target.value)}/></div><div><Label>Proposed new end date</Label><Input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}/></div><div><Label>Follow-up</Label><Input type="datetime-local" value={followUp} onChange={e=>setFollowUp(e.target.value)}/></div><div><Label>Manager notes</Label><Textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Negotiation notes, retention considerations, or next action"/></div></div><DialogFooter><Button variant="outline" onClick={()=>setSelected(null)}>Cancel</Button><Button onClick={create} disabled={!rent||!endDate||busy===selected?.lease_id}>Save proposal</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}
