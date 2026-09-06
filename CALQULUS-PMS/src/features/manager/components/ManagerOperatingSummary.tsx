import { Link } from "react-router-dom";
import { ArrowRight, Banknote, ClipboardCheck, ShieldCheck, UsersRound, Wrench } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Badge } from "@/shared/components/ui/badge";

interface MandateRow {
  property_id: string;
  owner_user_id: string;
  owner_controls_collections: boolean;
  owner_controls_financials: boolean;
  owner_controls_distributions: boolean;
  manager_can_collect: boolean;
  manager_can_manage_maintenance: boolean;
  manager_can_manage_tenants: boolean;
  reporting_frequency: string;
}

export default function ManagerOperatingSummary() {
  const { managerId } = useManagerScope();
  const { data, isLoading } = useQuery({
    queryKey: ["manager-operating-summary", managerId],
    queryFn: async () => {
      if (!managerId) return [] as MandateRow[];
      const { data, error } = await supabase
        .from("manager_management_mandates" as never)
        .select("property_id,owner_user_id,owner_controls_collections,owner_controls_financials,owner_controls_distributions,manager_can_collect,manager_can_manage_maintenance,manager_can_manage_tenants,reporting_frequency")
        .eq("manager_id", managerId)
        .eq("mandate_status", "active");
      if (error) throw error;
      return (data ?? []) as MandateRow[];
    },
    enabled: !!managerId,
    staleTime: 60_000,
  });

  const mandates = data ?? [];
  const ownerControlledFinance = mandates.filter((m) => m.owner_controls_collections || m.owner_controls_financials || m.owner_controls_distributions).length;
  const managerCollections = mandates.filter((m) => m.manager_can_collect).length;
  const reportingConfigured = mandates.filter((m) => m.reporting_frequency !== "none").length;

  return (
    <section aria-labelledby="manager-operating-model" className="mb-6 rounded-2xl border border-primary/15 bg-card shadow-[0_8px_28px_-22px_rgb(13_39_68/0.28)]">
      <div className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Management mandate</p>
          <h2 id="manager-operating-model" className="mt-1 font-heading text-lg font-semibold">Run the property. Respect the owner’s authority.</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Your portfolio can mix owners who retain collections and financial control with clients who delegate more. Configure that relationship per managed property.
          </p>
        </div>
        <Link to="/management-control" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-primary/20 px-3 text-sm font-medium hover:bg-primary/5">
          Configure mandates <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-5">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />) : (
          <>
            <Metric icon={<ShieldCheck className="h-4 w-4" />} label="Owner-controlled finance" value={ownerControlledFinance} hint="active mandates" />
            <Metric icon={<Banknote className="h-4 w-4" />} label="Manager collections" value={managerCollections} hint="explicitly delegated" />
            <Metric icon={<Wrench className="h-4 w-4" />} label="Operational authority" value={mandates.filter((m) => m.manager_can_manage_maintenance).length} hint="maintenance-enabled mandates" />
            <Metric icon={<ClipboardCheck className="h-4 w-4" />} label="Owner reporting" value={reportingConfigured} hint="reporting schedules active" />
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3 text-xs text-muted-foreground sm:px-6">
        <UsersRound className="h-3.5 w-3.5" />
        <span>Tenants remain the manager’s operational relationship; owners receive only the visibility and approvals assigned in their mandate.</span>
        <Badge variant="outline" className="ml-auto">Per-property control</Badge>
      </div>
    </section>
  );
}

function Metric({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: number; hint: string }) {
  return <div className="rounded-xl border border-border bg-muted/20 p-4">
    <div className="flex items-center gap-2 text-muted-foreground">{icon}<span className="text-xs font-medium">{label}</span></div>
    <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
    <p className="text-xs text-muted-foreground">{hint}</p>
  </div>;
}
