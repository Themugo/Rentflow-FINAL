import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { CalendarClock, RefreshCw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { formatDate } from "@/shared/lib/dateFormat";

const fmt=(v:unknown)=>Number(v??0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
const priorityVariant=(p:string)=>p==="urgent"||p==="high"?"destructive":p==="medium"?"secondary":"outline";

export default function PreventiveMaintenanceLifecycleCenter(){
  const {managerId}=useManagerScope();
  const q=useQuery({queryKey:["preventive-maintenance-control",managerId],enabled:!!managerId,queryFn:async()=>{
    const {data,error}=await supabase.rpc("get_manager_preventive_maintenance_control",{p_manager_id:managerId!,p_horizon_days:30});
    if(error) throw error; return data as any;
  }});
  const [name,setName]=useState(""); const [propertyName,setPropertyName]=useState(""); const [description,setDescription]=useState(""); const [frequencyDays,setFrequencyDays]=useState("30"); const [nextDueDate,setNextDueDate]=useState(new Date().toISOString().slice(0,10)); const [assetReference,setAssetReference]=useState(""); const [estimatedCost,setEstimatedCost]=useState(""); const [saving,setSaving]=useState(false);
  const generate=async()=>{if(!managerId)return; const {error}=await supabase.rpc("generate_due_preventive_maintenance_atomic",{p_manager_id:managerId,p_horizon_days:30}); if(error) throw error; await q.refetch();};
  const createPlan=async()=>{if(!managerId||!name.trim()||!propertyName.trim()||!description.trim())return; setSaving(true); try { const {error}=await supabase.rpc("create_maintenance_preventive_plan_atomic",{p_name:name.trim(),p_description:description.trim(),p_property_name:propertyName.trim(),p_frequency_days:Number(frequencyDays),p_next_due_date:nextDueDate,p_asset_reference:assetReference.trim()||null,p_estimated_cost:estimatedCost?Number(estimatedCost):null}); if(error) throw error; setName(""); setDescription(""); setAssetReference(""); setEstimatedCost(""); await q.refetch(); } finally { setSaving(false); }};
  const d=q.data as any; const plans=d?.plans??[];
  return <Card className="enterprise-card">
    <CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="section-title flex items-center gap-2"><CalendarClock className="h-5 w-5"/> Property Maintenance Lifecycle & Preventive Maintenance Control</CardTitle><CardDescription>Recurring maintenance schedules generate ordinary maintenance work orders, preserving the existing SLA, vendor, commitment, expenditure and ledger controls.</CardDescription></div><div className="flex gap-2"><Button variant="outline" onClick={generate} disabled={q.isFetching}>Generate due work</Button><Button variant="outline" size="icon" onClick={()=>q.refetch()} aria-label="Refresh preventive maintenance controls"><RefreshCw className="h-4 w-4"/></Button></div></div></CardHeader>
    <CardContent className="space-y-5">
      <div className="rounded-lg border p-4 space-y-3">
        <p className="font-medium">Create preventive schedule</p>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Input placeholder="Schedule name" value={name} onChange={e=>setName(e.target.value)} />
          <Input placeholder="Property name" value={propertyName} onChange={e=>setPropertyName(e.target.value)} />
          <Input placeholder="Asset / system reference" value={assetReference} onChange={e=>setAssetReference(e.target.value)} />
          <Input type="date" value={nextDueDate} onChange={e=>setNextDueDate(e.target.value)} />
          <Input type="number" min="1" placeholder="Frequency (days)" value={frequencyDays} onChange={e=>setFrequencyDays(e.target.value)} />
          <Input type="number" min="0" step="0.01" placeholder="Estimated cost" value={estimatedCost} onChange={e=>setEstimatedCost(e.target.value)} />
          <Input className="md:col-span-2" placeholder="What service should recur?" value={description} onChange={e=>setDescription(e.target.value)} />
        </div>
        <Button onClick={createPlan} disabled={saving||!name.trim()||!propertyName.trim()||!description.trim()}>Create schedule</Button>
      </div>
      {d&&<div className="grid gap-3 md:grid-cols-4"><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Active plans</p><p className="font-semibold">{d.active_plans}</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Due next 30 days</p><p className="font-semibold">{d.due_next_30d}</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Overdue plans</p><p className="font-semibold">{d.overdue_plans}</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Generated next horizon</p><p className="font-semibold">{d.generated_next_horizon}</p></div></div>}
      {plans.length===0?<p className="text-sm text-muted-foreground">No preventive maintenance schedules are configured.</p>:<div className="space-y-2">{plans.map((p:any)=><div key={p.id} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1fr_150px_150px_auto] md:items-center"><div className="min-w-0"><div className="flex items-center gap-2"><p className="font-medium truncate">{p.name}</p><Badge variant={priorityVariant(p.priority) as any}>{p.priority}</Badge></div><p className="text-xs text-muted-foreground truncate">{p.property_name}{p.unit_number?` · ${p.unit_number}`:""}{p.asset_reference?` · Asset ${p.asset_reference}`:""}</p><p className="text-xs mt-1">{p.vendor_name?`Vendor: ${p.vendor_name}`:"No governed vendor"}{p.contract_reference?` · ${p.contract_reference}`:""} · every {p.frequency_days} days</p></div><div><p className="text-xs text-muted-foreground">Next due</p><p className="text-sm">{formatDate(p.next_due_date)}</p><p className="text-xs text-muted-foreground">{p.days_to_due<0?`${Math.abs(p.days_to_due)} day(s) overdue`:p.days_to_due===0?"Due today":`${p.days_to_due} day(s)`}</p></div><div><p className="text-xs text-muted-foreground">Estimated cost</p><p className="text-sm tabular-nums">{p.estimated_cost!=null?fmt(p.estimated_cost):"—"}</p><p className="text-xs text-muted-foreground">{p.run_count} generated run(s)</p></div><Badge variant={p.days_to_due<0?"destructive":"outline"}>{p.days_to_due<0?"Action needed":"Scheduled"}</Badge></div>)}</div>}
      <div className="rounded-lg border p-4 text-xs text-muted-foreground"><ShieldCheck className="mr-1 inline h-3 w-3"/> Lifecycle control: preventive plan → scheduled run → existing maintenance work order → existing vendor/SLA assurance → existing commitment/expenditure → canonical accounting. Preventive schedules do not create a parallel work-order or financial ledger.</div>
    </CardContent>
  </Card>;
}
