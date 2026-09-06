import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ChevronRight, CircleAlert, XCircle } from "lucide-react";
import WebhostLayout from "@/features/webhost/components/WebhostLayout";
import { useAdminHealthProbes } from "@/features/webhost/hooks/useAdminHealthProbes";
import {
  INFRA_STATUS,
  DEPLOYMENTS_NOT_INSTRUMENTED,
  getApplicationFacts,
  getApplicationRuntime,
  type InfraStatus,
} from "@/features/webhost/lib/infrastructure";
import { StatusCell } from "@/features/webhost/components/operations/ServiceStatusCell";
import { WEBHOST_ROUTES, webhostApplicationPath } from "@/features/webhost/lib/webhostPaths";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";



export default function AdminApplications() {
  const { data: probes = [], isLoading } = useAdminHealthProbes();

  const facts = useMemo(
    () =>
      getApplicationFacts(
        { PROD: import.meta.env.PROD, VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL as string | undefined },
        window.location,
      ),
    [],
  );

  const app = useMemo(() => getApplicationRuntime(probes, facts), [probes, facts]);

  return (
    <WebhostLayout
      title="Applications"
      description="Deployed applications on this platform. One application is served by this desk."
    >
      <div className="space-y-6">
        <section className="rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Application</th>
                <th className="px-4 py-2.5 font-medium">Environment</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">Domain</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">Version</th>
                <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Health</th>
                <th className="px-4 py-2.5 font-medium">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-3">
                    <Skeleton className="h-9 rounded-md" />
                  </td>
                </tr>
              ) : (
                <tr className="align-middle transition-colors hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <p className="text-xs font-semibold">{app.name}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{app.id}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span
                        aria-hidden
                        className={cn("h-2 w-2 rounded-full", app.environment === "production" ? "bg-success" : "bg-warning")}
                      />
                      {app.environment}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusCell status={app.health} />
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground md:table-cell">
                    {app.domain} · {app.protocol}
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground md:table-cell">
                    v{app.version}
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-xs tabular-nums text-muted-foreground sm:table-cell">
                    {app.servicesReporting}/{app.servicesTotal} services
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={webhostApplicationPath(app.id)}
                      aria-label={`Open ${app.name}`}
                      className="inline-flex min-h-9 items-center gap-0.5 rounded-md px-2 text-xs font-medium text-primary hover:bg-primary/10"
                    >
                      View <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </section>

        <p className="text-xs text-muted-foreground">
          {DEPLOYMENTS_NOT_INSTRUMENTED} The{" "}
          <Link to={WEBHOST_ROUTES.deployments} className="font-medium text-primary hover:underline">
            Deployments
          </Link>{" "}
          view shows the current live build only.
        </p>
      </div>
    </WebhostLayout>
  );
}
