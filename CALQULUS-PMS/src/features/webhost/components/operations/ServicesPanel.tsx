import { Server } from "lucide-react";
import { useAdminHealthProbes, type ComponentProbe } from "@/features/webhost/hooks/useAdminHealthProbes";
import { INFRA_STATUS, probeToInfraStatus, type InfraStatus } from "@/features/webhost/lib/infrastructure";
import { StatusCell } from "@/features/webhost/components/operations/ServiceStatusCell";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";


export function ServicesPanel({ environment }: { environment: string }) {
  const { data: probes = [], isLoading, dataUpdatedAt } = useAdminHealthProbes();
  const checkedAt = dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : null;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Services</h2>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Server className="h-3.5 w-3.5 text-[var(--portal-accent)]" aria-hidden />
          Live probes · 60s
        </span>
      </div>
      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 rounded-md" />
          ))}
        </div>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Service</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Environment</th>
              <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Version</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">Last check</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {probes.map((probe: ComponentProbe) => {
              const status = probeToInfraStatus(probe.status);
              return (
                <tr key={probe.id} className="align-middle">
                  <td className="px-4 py-2.5 text-xs font-semibold">{probe.label}</td>
                  <td className="px-4 py-2.5">
                    <StatusCell status={status} />
                  </td>
                  <td className="hidden px-4 py-2.5 text-xs text-muted-foreground sm:table-cell">{environment}</td>
                  <td className="hidden px-4 py-2.5 text-xs text-muted-foreground sm:table-cell">Not probed</td>
                  <td className="hidden px-4 py-2.5 font-mono text-[11px] tabular-nums text-muted-foreground md:table-cell">
                    {checkedAt ? checkedAt.slice(0, 19).replace("T", " ") + " UTC" : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
