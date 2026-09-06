import {
  FileText, UserPlus, AlertTriangle, Clock, LucideIcon, Home, Wrench, Receipt,
  UserCheck, LogOut, RefreshCw, Bell, CheckCircle, XCircle, Building2, Key
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { logError } from "@/shared/lib/errorLogger";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/shared/components/ui/badge";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { useQuery } from "@tanstack/react-query";
import { dashboardDataKeys, useDashboardTenantIds } from "@/features/dashboard/hooks/useDashboardData";

interface Activity { id: string; action: string; description: string; created_at: string; tenant_name?: string; category?: string; }

const getActivityIcon = (action: string): { icon: LucideIcon; iconBg: string; category: string } => {
  const a = action.toLowerCase();
  if (a.includes("payment received") || a.includes("paid")) return { icon: CheckCircle, iconBg: "bg-success/10 text-success", category: "Payment" };
  if (a.includes("payment") && a.includes("fail")) return { icon: XCircle, iconBg: "bg-destructive/10 text-destructive", category: "Payment" };
  if (a.includes("invoice created") || a.includes("invoice generated") || a.includes("invoice")) return { icon: FileText, iconBg: "bg-[hsl(214_73%_48%/0.1)] text-[hsl(214_73%_48%)]", category: "Invoice" };
  if (a.includes("lease created") || a.includes("lease signed")) return { icon: Key, iconBg: "bg-[hsl(38_52%_42%/0.1)] text-[hsl(38_52%_42%)]", category: "Lease" };
  if (a.includes("lease")) return { icon: FileText, iconBg: "bg-[hsl(38_52%_42%/0.1)] text-[hsl(38_52%_42%)]", category: "Lease" };
  if (a.includes("account created") || a.includes("credentials")) return { icon: UserCheck, iconBg: "bg-primary/10 text-primary", category: "Account" };
  if (a.includes("created") && a.includes("tenant")) return { icon: UserPlus, iconBg: "bg-amber-400/12 text-warning", category: "Tenant" };
  if (a.includes("move out") || a.includes("vacated")) return { icon: LogOut, iconBg: "bg-orange-500/10 text-orange-500", category: "Tenant" };
  if (a.includes("tenant") || a.includes("move in")) return { icon: UserPlus, iconBg: "bg-amber-400/12 text-warning", category: "Tenant" };
  if (a.includes("property")) return { icon: Building2, iconBg: "bg-[hsl(218_58%_40%/0.1)] text-[hsl(218_58%_40%)]", category: "Property" };
  if (a.includes("unit")) return { icon: Home, iconBg: "bg-[hsl(218_58%_40%/0.1)] text-[hsl(218_58%_40%)]", category: "Property" };
  if (a.includes("maintenance") || a.includes("repair")) return { icon: Wrench, iconBg: "bg-warning/10 text-warning", category: "Maintenance" };
  if (a.includes("overdue") || a.includes("alert") || a.includes("warning")) return { icon: AlertTriangle, iconBg: "bg-destructive/10 text-destructive", category: "Alert" };
  if (a.includes("reminder") || a.includes("notification")) return { icon: Bell, iconBg: "bg-warning/10 text-warning", category: "Notification" };
  if (a.includes("updated") || a.includes("renewed")) return { icon: RefreshCw, iconBg: "bg-[hsl(195_60%_42%/0.1)] text-[hsl(195_60%_42%)]", category: "Update" };
  return { icon: Clock, iconBg: "bg-muted text-muted-foreground", category: "Activity" };
};

export function RecentActivity({ showHeader = true }: { showHeader?: boolean }) {
  const { managerId, restrictToAssignedProperties, assignedPropertyIds } = useManagerScope();
  const assignedKey = assignedPropertyIds.join(",");
  const { data: tenantIds = [], isLoading: tenantIdsLoading } = useDashboardTenantIds();

  const { data: activities = [], isLoading: activityLoading } = useQuery<Activity[]>({
    queryKey: [...dashboardDataKeys.recentActivity(managerId ?? "", assignedKey), assignedKey],
    enabled: !!managerId && (!restrictToAssignedProperties || assignedPropertyIds.length > 0) && tenantIds.length > 0,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data: tenants, error: tenantError } = await supabase.from("tenants").select("id, name").in("id", tenantIds);
      if (tenantError) { logError("RecentActivity.fetchTenants", tenantError); throw tenantError; }
      const tenantMap = new Map((tenants ?? []).map(t => [t.id, t.name]));
      const { data, error } = await supabase.from("tenant_history")
        .select("id, action, description, created_at, tenant_id")
        .in("tenant_id", tenantIds).order("created_at", { ascending: false }).limit(8);
      if (error) { logError("RecentActivity.fetchActivities", error); throw error; }
      return (data ?? []).map(item => ({ ...item, tenant_name: tenantMap.get(item.tenant_id) ?? undefined, category: getActivityIcon(item.action).category }));
    },
  });

  const loading = tenantIdsLoading || activityLoading;
  const renderedActivities = useMemo(() => activities, [activities]);
  const formatTime = (dateStr: string) => formatDistanceToNow(new Date(dateStr), { addSuffix: true });

  if (loading) return <div className="rounded-xl border border-border bg-card p-4 sm:p-6 card-shadow"><Skeleton className="h-5 w-32 mb-4" /><div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="flex items-start gap-3"><Skeleton className="h-9 w-9 rounded-lg" /><div className="flex-1"><Skeleton className="h-4 w-32 mb-2" /><Skeleton className="h-3 w-48" /></div></div>)}</div></div>;

  return <div className="rounded-xl border border-border bg-card p-4 sm:p-6 card-shadow animate-fade-in">
    {showHeader && <div className="flex items-center justify-between mb-4"><h3 className="font-heading text-base sm:text-lg font-semibold text-card-foreground">Recent Activity</h3><Badge variant="outline" className="text-xs">{renderedActivities.length} updates</Badge></div>}
    <div className="space-y-3">{renderedActivities.length === 0 ? <div className="text-center py-8"><Clock className="h-10 w-10 text-muted-foreground/50 mx-auto mb-2" /><p className="text-sm text-muted-foreground">No recent activity</p></div> : renderedActivities.map((activity, index) => { const { icon: Icon, iconBg, category } = getActivityIcon(activity.action); return <div key={activity.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors animate-slide-in" style={{ animationDelay: `${index * 50}ms` }}><div className={cn("rounded-lg p-2 flex-shrink-0", iconBg)}><Icon className="h-4 w-4" /></div><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><p className="text-sm font-medium text-card-foreground truncate">{activity.action}</p><Badge variant={category === "Payment" ? "default" : category === "Alert" ? "destructive" : "secondary"} className="hidden sm:inline-flex text-[10px]">{category}</Badge></div><p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{activity.description}</p>{activity.tenant_name && <p className="text-[11px] text-muted-foreground/80 mt-1">{activity.tenant_name}</p>}</div><span className="text-[11px] text-muted-foreground whitespace-nowrap">{formatTime(activity.created_at)}</span></div>; })}</div>
  </div>;
}
