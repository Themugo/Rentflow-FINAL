import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { RefreshCw, Wrench, ShieldCheck, CircleDollarSign } from "lucide-react";
import { formatDate } from "@/shared/lib/dateFormat";

const fmt=(v:unknown)=>Number(v??0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
const priorityVariant=(p:string)=>p==="urgent"||p==="high"?"destructive":p==="medium"?"secondary":"outline";

export default function MaintenanceProcurementCostControlCenter(){
  const {managerId}=useManagerScope();
  const q=useQuery({queryKey:["maintenance-procurement-cost-control",managerId],enabled:!!managerId,queryFn:async()=>{
    const {data,error}=await supabase.rpc("get_manager_maintenance_procurement_cost_control",{p_manager_id:managerId!,p_as_of_date:new Date().toISOString().slice(0,10)});
    if(error) throw error; return data as any;
  }});
  const d=q.data as any;
  const rows=d?.work_orders??[];
  return <Card className="enterprise-card">
    <CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="section-title flex items-center gap-2"><Wrench className="h-5 w-5"/> Maintenance Procurement & Work-Order Cost Control</CardTitle><CardDescription>Connect maintenance requests to governed vendors, contracts, approved commitments and actual expenditures without creating a second financial ledger.</CardDescription></div><Button variant="outline" size="icon" onClick={()=>q.refetch()} aria-label="Refresh maintenance procurement controls"><RefreshCw className="h-4 w-4"/></Button></div></CardHeader>
    <CardContent className="space-y-5">
      {d&&<div className="grid gap-3 md:grid-cols-5"><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Open work orders</p><p className="font-semibold">{d.open_work_orders}</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Vendor assigned</p><p className="font-semibold">{d.vendor_assigned}</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Need vendor</p><p className="font-semibold">{d.without_vendor}</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Approved commitments</p><p className="font-semibold tabular-nums">{fmt(d.approved_maintenance_commitments)}</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Actual maintenance spend</p><p className="font-semibold tabular-nums">{fmt(d.actual_maintenance_spend)}</p></div></div>}
      {rows.length===0?<p className="text-sm text-muted-foreground">No maintenance work orders are available for procurement control.</p>:<div className="space-y-2">{rows.map((r:any)=><div key={r.id} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_150px_150px_auto] md:items-center"><div className="min-w-0"><div className="flex items-center gap-2"><p className="font-medium truncate">{r.title}</p><Badge variant={priorityVariant(r.priority) as any}>{r.priority}</Badge></div><p className="text-xs text-muted-foreground truncate">{r.property_name}{r.unit_number?` · ${r.unit_number}`:""} · requested {formatDate(r.requested_date)}</p><p className="text-xs mt-1">{r.vendor_name?`Vendor: ${r.vendor_name}`:"Vendor not assigned"}{r.contract_reference?` · Contract ${r.contract_reference}`:""}</p></div><div><p className="text-xs text-muted-foreground">Commitment</p><p className="text-sm tabular-nums">{r.commitment_amount?fmt(r.commitment_amount):"—"}</p><p className="text-xs text-muted-foreground">{r.commitment_status??"Not created"}</p></div><div><p className="text-xs text-muted-foreground">Actual spend</p><p className="text-sm tabular-nums flex items-center gap-1"><CircleDollarSign className="h-3 w-3"/>{fmt(r.actual_spend)}</p><p className="text-xs text-muted-foreground">{r.expenditure_count} expenditure(s)</p></div><Badge variant={r.vendor_name?"default":"outline"}>{r.vendor_name?"Governed":"Action needed"}</Badge></div>)}</div>}
      <div className="rounded-lg border p-4 text-xs text-muted-foreground"><ShieldCheck className="mr-1 inline h-3 w-3"/> Control chain: maintenance request → governed vendor/contract → approved expense commitment → completed work → actual expenditure. Financial posting remains exclusively in the existing accounting and ledger ecosystem.</div>
    </CardContent>
  </Card>;
}
