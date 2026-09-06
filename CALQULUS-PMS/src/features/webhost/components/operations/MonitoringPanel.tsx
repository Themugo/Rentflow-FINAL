import { Activity } from "lucide-react";
import { useAdminHealthProbes, type ComponentProbe } from "@/features/webhost/hooks/useAdminHealthProbes";
import { INFRA_STATUS, deriveSystemStatus, type InfraStatus } from "@/features/webhost/lib/infrastructure";
import { StatusCell } from "@/features/webhost/components/operations/ServiceStatusCell";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

const ORDER: InfraStatus[] = ["operational", "warning", "degraded", "down"];

function countBy(probes: ComponentProbe[]): Record<InfraStatus, number> {
  const out: Record<InfraStatus, number> = { operational: 0, warning: 0, degraded: 0, down: 0 };
  for (const probe of probes) {
    const mapped =
      probe.status === "healthy"
        ? "operational"
        : probe.status === "degraded"
          ? "degraded"
          : probe.status === "unhealthy"
            ? "down"
            : "warning";
    out[mapped] += 1;
  }
  return out;
}

export function MonitoringPanel() {
  const { data: probes = [], isLoading } = useAdminHealthProbes();
  const overall = deriveSystemStatus(probes);
  const counts = countBy(probes);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Monitoring</h2>
        <Activity className="h-3.5 w-3.5 text-[var(--portal-accent)]" aria-hidden />
      </div>
      {isLoading ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-10 rounded-md" />
          <Skeleton className="h-6 rounded-md" />
        </div>
      ) : (
        <>
          <div className="border-b border-border px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Overall</p>
            <div className="mt-1.5">
              <StatusCell status={overall} />
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4">
            {ORDER.map((status) => (
              <div key={status} className="px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {INFRA_STATUS[status].label}
                </p>
                <p className={cn("mt-0.5 font-heading text-lg font-semibold tabular-nums", INFRA_STATUS[status].text)}>
                  {counts[status]}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
      <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
        Derived from the same live probes above — no telemetry is fabricated.
      </p>
    </section>
  );
}
