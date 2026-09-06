import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { Users, ArrowRight, Home, Mail } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { logError } from "@/shared/lib/errorLogger";
import { useEffect, useState } from "react";
import { dashboardDataKeys } from "@/features/dashboard/hooks/useDashboardData";

interface Tenant { id: string; name: string; email: string; phone: string | null; property: string | null; property_id?: string | null; unit: string | null; status: string; photo_url: string | null; }
const statusStyles: Record<string,string> = { active:"bg-success/10 text-success border-success/30", pending:"bg-warning/10 text-warning border-warning/30", inactive:"bg-muted text-muted-foreground border-border" };

export function TenantsOverview() {
  const { managerId, restrictToAssignedProperties, assignedPropertyIds } = useManagerScope();
  const assignedKey = assignedPropertyIds.join(",");
  const [signedUrls, setSignedUrls] = useState<Record<string,string>>({});
  const { data: tenants = [], isLoading: loading } = useQuery<Tenant[]>({
    queryKey: [...dashboardDataKeys.tenantsOverview(managerId ?? "", assignedKey), assignedKey],
    enabled: !!managerId && (!restrictToAssignedProperties || assignedPropertyIds.length > 0),
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data: rpcData, error: rpcError } = await supabase.rpc("get_tenants_with_properties", { p_manager_id: managerId });
      if (!rpcError && rpcData) {
        let filtered = rpcData.map((t:any) => ({ id:t.id, name:t.name, email:t.email, phone:t.phone, property:t.property_name, property_id:t.property_id, unit:t.unit_label, status:t.status, photo_url:null }));
        if (restrictToAssignedProperties) filtered = filtered.filter((t:any) => t.property_id && assignedPropertyIds.includes(t.property_id));
        return filtered.slice(0,5);
      }
      let query = supabase.from("tenants").select("id,name,email,phone,unit,property_id,status,photo_url").eq("manager_id", managerId).order("created_at", { ascending:false }).limit(5);
      if (restrictToAssignedProperties) query = query.in("property_id", assignedPropertyIds);
      const { data, error } = await query;
      if (error) { logError("TenantsOverview.fetchTenants", error); throw error; }
      return (data ?? []).map((t:any) => ({...t, property:null}));
    },
  });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const pairs = await Promise.all(tenants.filter(t => t.photo_url).map(async tenant => {
        let path = tenant.photo_url!;
        if (path.includes("/tenant-photos/")) path = path.split("/tenant-photos/").pop() || path;
        const { data, error } = await supabase.storage.from("tenant-photos").createSignedUrl(path, 3600);
        return data && !error ? [tenant.id, data.signedUrl] as const : null;
      }));
      if (!cancelled) setSignedUrls(Object.fromEntries(pairs.filter(Boolean) as [string,string][]));
    };
    void run();
    return () => { cancelled = true; };
  }, [tenants]);

  const getInitials = (name:string) => name.split(" ").map(n=>n[0]).join("").toUpperCase().slice(0,2);
  if (loading) return <div className="rounded-lg border border-border bg-card p-4 sm:p-6"><div className="flex items-center justify-between mb-4"><Skeleton className="h-6 w-36"/><Skeleton className="h-8 w-24"/></div><div className="space-y-3">{[1,2,3,4].map(i=><div key={i} className="flex items-center gap-3 p-3"><Skeleton className="h-12 w-12 rounded-full"/><div className="flex-1"><Skeleton className="h-4 w-28 mb-2"/><Skeleton className="h-3.5 w-36"/></div></div>)}</div></div>;
  return <div className="rounded-lg border border-border bg-card p-4 sm:p-6"><div className="flex items-center justify-between mb-4"><h3 className="type-card-title flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground"/>Recent Tenants</h3><Link to="/tenants"><Button variant="ghost" size="sm">View All<ArrowRight className="h-3.5 w-3.5 ml-1"/></Button></Link></div>{tenants.length===0?<div className="text-center py-8"><p className="text-muted-foreground text-sm mb-3">No tenants yet</p><Link to="/tenants"><Button variant="outline" size="sm">Add Tenant</Button></Link></div>:<div className="space-y-2">{tenants.map(tenant=><Link key={tenant.id} to="/tenants" className="group flex items-center gap-3 p-3 rounded-md bg-muted/40 hover:bg-muted border border-border"><Avatar className="h-10 w-10 border border-border"><AvatarImage src={signedUrls[tenant.id]} alt={tenant.name}/><AvatarFallback className="bg-muted text-muted-foreground text-sm font-semibold">{getInitials(tenant.name)}</AvatarFallback></Avatar><div className="flex-1 min-w-0 space-y-1"><p className="font-semibold text-sm sm:text-base text-card-foreground truncate">{tenant.name}</p><div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">{tenant.property?<span className="flex items-center gap-1.5 truncate"><Home className="h-3.5 w-3.5 flex-shrink-0"/><span className="truncate">{tenant.property}{tenant.unit&&` - ${tenant.unit}`}</span></span>:<span className="flex items-center gap-1.5 truncate"><Mail className="h-3.5 w-3.5 flex-shrink-0"/><span className="truncate">{tenant.email}</span></span>}</div></div><Badge variant="outline" className={cn("text-[10px] sm:text-xs px-2 py-0.5 rounded-lg font-semibold border-2 capitalize", statusStyles[tenant.status]||statusStyles.inactive)}>{tenant.status}</Badge></Link>)}</div>}</div>;
}
