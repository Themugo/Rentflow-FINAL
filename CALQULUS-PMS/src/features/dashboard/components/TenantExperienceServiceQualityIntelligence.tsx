import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock3, MessageSquare, Star, Wrench, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { toast } from "sonner";

export function TenantExperienceServiceQualityIntelligence() {
  const { managerId } = useManagerScope();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["manager-tenant-experience-service-quality", managerId],
    enabled: !!managerId,
    queryFn: async () => {
      const { data: result, error } = await supabase.rpc("get_manager_tenant_experience_intelligence" as any, { p_manager_id: managerId });
      if (error) throw error;
      return (result ?? {}) as any;
    },
    staleTime: 60_000,
  });

  const createWorkItems = async () => {
    const { data: result, error } = await supabase.rpc("sync_tenant_experience_work_items_atomic" as any, { p_manager_id: managerId });
    if (error) { toast.error(error.message); return; }
    toast.success(`Created ${Number((result as any)?.created ?? 0)} service-quality work item(s).`);
    await queryClient.invalidateQueries({ queryKey: ["operation-work-queue"] });
  };

  if (isLoading) return <div className="h-72 rounded-xl border border-border bg-card animate-pulse" aria-busy="true" />;
  if (!data) return null;
  const summary = data.summary ?? {};
  const tenants = Array.isArray(data.tenants) ? data.tenants : [];
  const priority = tenants.filter((t: any) => Number(t.service_quality_score ?? 100) < 75).slice(0, 8);
  const tone = (level: string) => level === "poor" ? "destructive" : level === "watch" ? "outline" : "secondary";

  return <Card className="border-border/80 shadow-[0_8px_28px_-22px_rgb(13_39_68/0.28)]">
    <CardHeader className="pb-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><Zap className="h-4 w-4" />Tenant experience & service quality</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Explainable service signals from maintenance, ratings, communication, notices and payment friction.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{summary.active_tenants ?? 0} active tenants</Badge>
          <Button variant="outline" size="sm" onClick={createWorkItems} disabled={!managerId || priority.length === 0}>Create work items</Button>
        </div>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        {[
          ["Poor", summary.poor_experience ?? 0, AlertTriangle],
          ["Watch", summary.watch_experience ?? 0, Zap],
          ["Open maintenance", summary.open_maintenance_tenants ?? 0, Wrench],
          ["Aged 7d+", summary.aged_maintenance_tenants ?? 0, Clock3],
          ["Unread messages", summary.unread_communication_tenants ?? 0, MessageSquare],
          ["Avg rating", summary.avg_tenant_rating ?? 0, Star],
        ].map(([label, value, Icon]) => <div key={label as string} className="rounded-lg border border-border px-3 py-2">
          <div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-3.5 w-3.5" /><span className="text-[10px] uppercase tracking-wide">{label as string}</span></div>
          <p className="mt-1 text-lg font-semibold">{value as any}</p>
        </div>)}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border p-3">
          <div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold">Tenants needing attention</p><span className="text-[11px] text-muted-foreground">Service score / 100</span></div>
          {priority.length === 0 ? <div className="flex items-center gap-2 rounded-md bg-success/10 p-3 text-xs text-success"><CheckCircle2 className="h-4 w-4" />No material service-quality issue is currently flagged.</div> : <div className="space-y-2">{priority.map((t: any) => <div key={t.tenant_id} className="rounded-md border border-border px-3 py-2">
            <div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-semibold">{t.tenant_name}</p><p className="truncate text-[11px] text-muted-foreground">{t.property_name}{t.unit_name ? ` · ${t.unit_name}` : ""}</p></div><Badge variant={tone(t.service_level)}>{t.service_level} · {t.service_quality_score}/100</Badge></div>
            <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-muted-foreground"><span>{t.primary_driver}</span><span>{t.open_maintenance} open maintenance</span><span>{t.unread_tenant_messages} unread</span></div>
            <p className="mt-1 text-[11px] text-muted-foreground">{t.recommended_action}</p>
          </div>)}</div>}
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><Star className="h-4 w-4" /><p className="text-sm font-semibold">Service health</p></div><span className="text-[11px] text-muted-foreground">90-day operational view</span></div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md bg-muted/40 p-3"><p className="text-muted-foreground">Avg resolution</p><p className="mt-1 text-lg font-semibold">{summary.avg_resolution_days ?? 0}d</p></div>
            <div className="rounded-md bg-muted/40 p-3"><p className="text-muted-foreground">Low ratings</p><p className="mt-1 text-lg font-semibold">{summary.low_rating_tenants ?? 0}</p></div>
            <div className="rounded-md bg-muted/40 p-3"><p className="text-muted-foreground">Healthy tenants</p><p className="mt-1 text-lg font-semibold">{summary.healthy_experience ?? 0}</p></div>
            <div className="rounded-md bg-muted/40 p-3"><p className="text-muted-foreground">Overdue tenants</p><p className="mt-1 text-lg font-semibold">{summary.overdue_tenants ?? 0}</p></div>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">This is an explainable service-quality score, not a prediction of churn or renewal probability.</p>
        </div>
      </div>
    </CardContent>
  </Card>;
}
