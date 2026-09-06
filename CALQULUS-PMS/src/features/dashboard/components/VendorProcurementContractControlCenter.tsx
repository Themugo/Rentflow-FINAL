import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { Building2, FileText, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const fmt=(v:unknown)=>Number(v??0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
export default function VendorProcurementContractControlCenter(){
  const {managerId}=useManagerScope();
  const [name,setName]=useState(""); const [category,setCategory]=useState("");
  const q=useQuery({queryKey:["vendor-procurement-control",managerId],enabled:!!managerId,queryFn:async()=>{const {data,error}=await supabase.rpc("get_manager_vendor_procurement_control",{p_manager_id:managerId!,p_as_of_date:new Date().toISOString().slice(0,10)});if(error)throw error;return data as any;}});
  const create=useMutation({mutationFn:async()=>{const {error}=await supabase.rpc("create_management_vendor_atomic",{p_manager_id:managerId!,p_name:name,p_service_category:category});if(error)throw error;},onSuccess:()=>{toast.success("Vendor saved");setName("");setCategory("");q.refetch();},onError:(e:any)=>toast.error(e.message||"Could not save vendor")});
  const rows=q.data?.vendors??[];
  return <Card className="enterprise-card"><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="section-title flex items-center gap-2"><Building2 className="h-5 w-5"/> Vendor Procurement, Contract & Performance Control</CardTitle><CardDescription>Govern vendors and contracts around existing approved commitments. Financial actuals remain in the canonical expenditure and double-entry ledger.</CardDescription></div><Button variant="outline" size="icon" onClick={()=>q.refetch()} aria-label="Refresh vendor controls"><RefreshCw className="h-4 w-4"/></Button></div></CardHeader><CardContent className="space-y-5">
    <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"><Input placeholder="Vendor name" value={name} onChange={e=>setName(e.target.value)}/><Input placeholder="Service category" value={category} onChange={e=>setCategory(e.target.value)}/><Button onClick={()=>create.mutate()} disabled={create.isPending||!managerId||!name||!category}>Add vendor</Button></div>
    {q.data&&<div className="grid gap-3 md:grid-cols-4"><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Active vendors</p><p className="font-semibold">{q.data.vendor_count}</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Active contracts</p><p className="font-semibold">{q.data.active_contracts}</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Contracts expiring ≤90d</p><p className="font-semibold">{q.data.contracts_expiring_90d}</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Unlinked approved commitments</p><p className="font-semibold">{q.data.unlinked_approved_commitments}</p></div></div>}
    <div className="space-y-2">{rows.length===0?<p className="text-sm text-muted-foreground">No managed vendors yet.</p>:rows.map((r:any)=><div key={r.id} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_130px_130px_auto] md:items-center"><div><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.service_category} · {r.active_contracts} active contract(s)</p></div><p className="text-right text-sm tabular-nums">{fmt(r.approved_commitments)} committed</p><Badge variant={r.status==="active"?"default":"outline"}>{r.latest_review?`Review ${r.latest_review.overall_score}/100`:"Not reviewed"}</Badge><div className="flex items-center justify-end gap-2 text-xs text-muted-foreground"><FileText className="h-3 w-3"/>{r.active_contracts} contract(s)</div></div>)}</div>
    <div className="rounded-lg border p-4 text-xs text-muted-foreground"><ShieldCheck className="mr-1 inline h-3 w-3"/> Vendor governance is deliberately separated from financial posting: contracts and performance inform procurement decisions, while actual cash and accounting remain controlled by existing commitments, expenditures and the double-entry ledger.</div>
  </CardContent></Card>;
}
