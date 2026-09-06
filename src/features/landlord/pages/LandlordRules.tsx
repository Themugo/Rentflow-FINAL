import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import LandlordLayout from "@/features/landlord/components/LandlordLayout";
import ManagementConfigurationCenter from "@/features/shared/ManagementConfigurationCenter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";

export default function LandlordRules(){
 const [propertyId,setPropertyId]=useState("");
 const q=useQuery({queryKey:["landlord-rule-properties"],queryFn:async()=>{const {data,error}=await supabase.from("property_landlords").select("property_id,properties(name,address),manager_id").order("updated_at",{ascending:false});if(error)throw error;return (data??[]).map((r:any)=>({id:r.property_id,name:r.properties?.name??"Property",address:r.properties?.address??"",managed:Boolean(r.manager_id)}));}});
 if(q.isLoading)return <LandlordLayout title="Rules & configuration" description="Your effective property rules and authority."><Skeleton className="h-14 w-full"/></LandlordLayout>;
 return <LandlordLayout title="Rules & configuration" description="Independent landlords configure their own operating rules. Managed landlords see the rules established by their Agency or Property Manager."><div className="mb-5 max-w-xl"><Select value={propertyId} onValueChange={setPropertyId}><SelectTrigger><SelectValue placeholder="Select a property"/></SelectTrigger><SelectContent>{q.data?.map(p=><SelectItem key={p.id} value={p.id}>{p.name}{p.managed?" · Managed":" · Independent"}</SelectItem>)}</SelectContent></Select></div>{propertyId?<ManagementConfigurationCenter role="landlord" propertyId={propertyId}/>:null}</LandlordLayout>;
}
