import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Switch } from "@/shared/components/ui/switch";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ShieldCheck, Save, LockKeyhole } from "lucide-react";
import { toast } from "sonner";

const GROUPS = [
  ["management_modules", "Operations", ["property_operations","unit_operations","lease_operations","tenant_operations","maintenance_operations","caretaker_operations","inspection_operations","utility_operations","compliance_operations","vendor_operations"]],
  ["financial_modules", "Financials", ["track_expenses","break_down_charges","include_external_evidence","close_books","owner_statements","settlements","reconciliation"]],
  ["payment_rules", "Payments", ["allow_payment_arrangements","allow_partial_payments","auto_allocate_rent","allow_third_party_payers","require_evidence","allow_bank_transfer","allow_cash","allow_external_consolidation","manual_payment_review"]],
  ["billing_rules", "Billing", ["auto_generate_rent","late_fee_enabled","allow_metered_charges","allow_property_charges","allow_unit_charges"]],
  ["amenity_rules", "Amenities & services", ["allow_unit_amenities","allow_chargeable_amenities","tenant_visible","require_approval_for_new_charge"]],
  ["maintenance_rules", "Maintenance", ["require_work_order","vendor_assignment_requires_scope","completion_requires_evidence"]],
  ["vendor_rules", "Vendors", ["require_vendor_record","require_quote_for_major_work"]],
  ["document_rules", "Documents", ["require_signed_contract","preserve_versions","immutable_executed_documents"]],
  ["communication_rules", "Communications", ["notify_material_changes","allow_selected_reach","allow_global_reach"]],
  ["security_rules", "Security", ["deny_cross_scope_access","require_server_authority","protect_closed_periods","protect_paid_invoices"]],
] as const;
const label = (v:string) => v.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());
type Props = { role: "manager" | "landlord"; propertyId: string; readOnly?: boolean; title?: string; description?: string };
export default function ManagementConfigurationCenter({ role, propertyId, readOnly=false, title="Operating configuration", description="Configure the rules that govern this property without creating a second billing, tenant or financial system." }: Props) {
  const qc=useQueryClient(); const [draft,setDraft]=useState<Record<string,any>>({});
  const query=useQuery({queryKey:["effective-management-config",role,propertyId],queryFn:async()=>{const {data,error}=await supabase.rpc("get_effective_management_configuration" as never,{p_property_id:propertyId,p_unit_id:null});if(error)throw error;return data as any;},enabled:Boolean(propertyId)});
  useEffect(()=>{if(query.data?.config) setDraft(query.data.config);},[query.data]);
  const save=useMutation({mutationFn:async()=>{const {error}=await supabase.rpc("save_management_configuration_atomic" as never,{p_scope_type:role,p_property_id:propertyId,p_unit_id:null,p_config:draft,p_notes:null});if(error)throw error;},onSuccess:()=>{toast.success("Configuration saved");qc.invalidateQueries({queryKey:["effective-management-config",role,propertyId]});},onError:(e:Error)=>toast.error(e.message)});
  const source=query.data?.source; const editable=role==="manager" || (role==="landlord" && source!=="agency_client_contract" && source!=="manager_mandate"); const canEdit=!readOnly && editable;
  const set=(group:string,key:string,v:boolean)=>setDraft(d=>({...d,[group]:{...(d[group]??{}),[key]:v}}));
  return <div className="space-y-5"><Card><CardHeader><div className="flex items-start justify-between gap-4"><div><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></div><Badge variant="outline" className="gap-1.5"><ShieldCheck className="h-3.5 w-3.5"/>{canEdit?"Configurable":"Controlled by higher authority"}</Badge></div></CardHeader><CardContent>
    {query.isLoading?<Skeleton className="h-20 w-full"/>:null}{query.isError?<Alert variant="destructive"><AlertTitle>Configuration unavailable</AlertTitle><AlertDescription>The effective operating rules could not be loaded.</AlertDescription></Alert>:null}
    {!query.isLoading&&!query.isError?<div className="grid gap-4 md:grid-cols-2">{GROUPS.map(([group,heading,keys])=><Card key={group} className="border-border/70"><CardHeader className="pb-3"><CardTitle className="text-sm">{heading}</CardTitle><CardDescription className="text-xs">These controls use the effective authority for this property.</CardDescription></CardHeader><CardContent className="space-y-2">{keys.map(k=><div key={k} className="flex min-h-11 items-center justify-between gap-4 rounded-lg border px-3 py-2"><span className="text-sm">{label(k)}</span><Switch checked={draft[group]?.[k]??false} disabled={!canEdit} onCheckedChange={v=>set(group,k,v)}/></div>)}</CardContent></Card>)}</div>:null}
  </CardContent></Card><div className="flex items-center justify-between gap-3"><div className="text-xs text-muted-foreground">Source: <span className="font-medium">{label(source??"platform_defaults")}</span>{!canEdit?<span> · changes must be made by the controlling role.</span>:null}</div>{canEdit?<Button disabled={save.isPending} onClick={()=>save.mutate()}><Save className="mr-2 h-4 w-4"/>{save.isPending?"Saving…":"Save configuration"}</Button>:<Badge variant="secondary"><LockKeyhole className="mr-1.5 h-3.5 w-3.5"/>Read only</Badge>}</div></div>;
}
