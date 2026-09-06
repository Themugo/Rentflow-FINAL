import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ManagerLayout from "@/features/manager/components/ManagerLayout";
import ManagementConfigurationCenter from "@/features/shared/ManagementConfigurationCenter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useState } from "react";

export default function ManagementRules(){
 const [propertyId,setPropertyId]=useState("");
 const q=useQuery({queryKey:["manager-rule-properties"],queryFn:async()=>{const {data,error}=await supabase.from("properties").select("id,name,address").order("name");if(error)throw error;return data??[];}});
 if(q.isLoading)return <ManagerLayout title="Operating rules" description="One configuration surface for the rules you have authority to set."><Skeleton className="h-14 w-full"/></ManagerLayout>;
 return <ManagerLayout title="Operating rules" description="Configure the operational rules that apply to properties you manage. Existing billing, tenant, maintenance, vendor and financial engines remain the system of record."><div className="mb-5 max-w-xl"><Select value={propertyId} onValueChange={setPropertyId}><SelectTrigger><SelectValue placeholder="Select a managed property"/></SelectTrigger><SelectContent>{q.data?.map(p=><SelectItem key={p.id} value={p.id}>{p.name}{p.address?` · ${p.address}`:""}</SelectItem>)}</SelectContent></Select></div>{propertyId?<ManagementConfigurationCenter role="manager" propertyId={propertyId}/>:null}</ManagerLayout>;
}
