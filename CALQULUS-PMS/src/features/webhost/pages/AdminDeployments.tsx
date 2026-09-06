import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, CircleAlert, GitCommitHorizontal, XCircle } from "lucide-react";
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



export default function AdminDeployments() {
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
      title="Deployments"
      description="Deployment state for applications on this platform. Only the current live build is observable."
    >
      <div className="space-y-6">
        <section className="rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Deployment</th>
                <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Application</th>
                <th className="px-4 py-2.5 font-medium">Environment</th>
                <th className="px-4 py-2.5 font-medium">Version</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">Started</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">Completed</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
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
                <tr className="align-middle">
                  <td className="px-4 py-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold">
                      <GitCommitHorizontal className="h-3.5 w-3.5 text-[var(--portal-accent)]" />
                      Current live build
                    </p>
                    <Link
                      to={webhostApplicationPath(app.id)}
                      className="font-mono text-[11px] text-primary hover:underline"
                    >
                      {app.id}
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 text-xs sm:table-cell">{app.name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span
                        aria-hidden
                        className={cn("h-2 w-2 rounded-full", app.environment === "production" ? "bg-success" : "bg-warning")}
                      />
                      {app.environment}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">v{app.version}</td>
                  <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">Not recorded</td>
                  <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">Not recorded</td>
                  <td className="px-4 py-3">
                    <StatusCell status="operational" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </section>

        <section
          aria-label="Deployment instrumentation"
          className="rounded-xl border border-border bg-card px-4 py-3"
        >
          <p className="text-xs text-muted-foreground">
            {DEPLOYMENTS_NOT_INSTRUMENTED} The single row above is the build serving this session — it is serving
            traffic right now, so it is <span className={cn("font-semibold", INFRA_STATUS.operational.text)}>Operational</span>.
            No prior or in-progress deployments are shown because none are exposed to the runtime.
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Health of the live build:{" "}
            {isLoading ? "…" : (
              <span className={cn("font-semibold", INFRA_STATUS[app.health].text)}>
                {INFRA_STATUS[app.health].label}
              </span>
            )}
            {" · "}
            <Link to={WEBHOST_ROUTES.dashboard} className="font-medium text-primary hover:underline">
              Control center
            </Link>
          </p>
        </section>
      </div>
    </WebhostLayout>
  );
}
