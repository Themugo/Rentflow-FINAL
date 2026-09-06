import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ChevronRight, CircleAlert, Globe, RefreshCw, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import WebhostLayout from "@/features/webhost/components/WebhostLayout";
import { useAdminHealthProbes, type ComponentProbe } from "@/features/webhost/hooks/useAdminHealthProbes";
import {
  INFRA_STATUS,
  DEPLOYMENTS_NOT_INSTRUMENTED,
  getApplicationFacts,
  getApplicationRuntime,
  getNonSecretConfig,
  probeToInfraStatus,
  type InfraStatus,
} from "@/features/webhost/lib/infrastructure";
import { StatusCell } from "@/features/webhost/components/operations/ServiceStatusCell";
import { withoutTenantEntities } from "@/features/webhost/lib/adminSecurity";
import { WEBHOST_ROUTES, WEBHOST_OPS_ROUTES } from "@/features/webhost/lib/webhostPaths";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

type ActivityRow = {
  id: string;
  action: string;
  actor_email: string | null;
  entity_type: string | null;
  entity_label: string | null;
  created_at: string;
};

const dayFmt = new Intl.DateTimeFormat("en-KE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
const timeFmt = new Intl.DateTimeFormat("en-KE", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });



function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{children}</h2>
      {aside}
    </div>
  );
}

export default function AdminApplicationDetail() {
  const { appId = "calqulus-pms" } = useParams<{ appId: string }>();
  const { data: probes = [], isLoading: healthLoading, dataUpdatedAt, refetch, isRefetching } = useAdminHealthProbes();
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null);

  const facts = useMemo(
    () =>
      getApplicationFacts(
        { PROD: import.meta.env.PROD, VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL as string | undefined },
        window.location,
      ),
    [],
  );

  const app = useMemo(() => getApplicationRuntime(probes, facts), [probes, facts]);
  const config = useMemo(() => getNonSecretConfig(facts), [facts]);
  const lastProbe = refreshedAt ?? (dataUpdatedAt || null);

  const { data: activity = [], isLoading: activityLoading } = useQuery<ActivityRow[]>({
    queryKey: ["platform-admin-app-activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("id, action, actor_email, entity_type, entity_label, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return withoutTenantEntities((data ?? []) as ActivityRow[]).slice(0, 6);
    },
    staleTime: 30_000,
  });

  if (appId !== "calqulus-pms") {
    return <Navigate to={WEBHOST_ROUTES.applications} replace />;
  }

  return (
    <WebhostLayout
      title={app.name}
      description={`${app.environment} · ${app.domain} · v${app.version}`}
      actions={
        <button
          type="button"
          onClick={() => {
            void refetch().then(() => setRefreshedAt(Date.now()));
          }}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isRefetching && "animate-spin")} />
          Probe now
        </button>
      }
    >
      <div className="space-y-6">
        <p className="text-xs text-muted-foreground">
          <Link to={WEBHOST_ROUTES.applications} className="font-medium text-primary hover:underline">
            Applications
          </Link>{" "}
          / {app.id}
        </p>

        {/* Overview */}
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <SectionTitle
            aside={
              <span className="text-[11px] text-muted-foreground">
                {lastProbe ? `Last probe ${timeFmt.format(lastProbe)}` : "Awaiting first probe"}
              </span>
            }
          >
            Overview
          </SectionTitle>
          <dl className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4">
            {[
              { label: "Environment", value: app.environment },
              { label: "Version", value: `v${app.version}` },
              { label: "Services reporting", value: healthLoading ? "…" : `${app.servicesReporting}/${app.servicesTotal}` },
              { label: "Overall health", value: null },
            ].map((item) => (
              <div key={item.label} className="px-4 py-3">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{item.label}</dt>
                <dd className="mt-1">
                  {item.label === "Overall health" ? (
                    healthLoading ? (
                      <Skeleton className="h-5 w-20 rounded" />
                    ) : (
                      <StatusCell status={app.health} />
                    )
                  ) : (
                    <span className="font-heading text-base font-semibold">{item.value}</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
            Only the build serving this session is running in this environment — no environment selector exists
            because this desk observes exactly one deployed runtime.
          </p>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Health */}
          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <SectionTitle>Health</SectionTitle>
            {healthLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 rounded-md" />
                ))}
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-border">
                  {probes.map((probe: ComponentProbe) => {
                    const status = probeToInfraStatus(probe.status);
                    return (
                      <tr key={probe.id} className="align-middle">
                        <td className="px-4 py-2.5 text-xs font-semibold">{probe.label}</td>
                        <td className="px-4 py-2.5">
                          <StatusCell status={status} />
                        </td>
                        <td className="w-20 px-4 py-2.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                          {typeof probe.latencyMs === "number" ? `${Math.round(probe.latencyMs)}ms` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
              Live probes every 60s ·{" "}
              <Link to={WEBHOST_ROUTES.dashboard} className="font-medium text-primary hover:underline">
                Control center
              </Link>
            </p>
          </section>

          {/* Deployments */}
          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <SectionTitle
              aside={
                <Link
                  to={WEBHOST_ROUTES.deployments}
                  className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
                >
                  Deployments <ChevronRight className="h-3 w-3" />
                </Link>
              }
            >
              Deployments
            </SectionTitle>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Deployment</th>
                  <th className="px-4 py-2 font-medium">Version</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr className="align-middle">
                  <td className="px-4 py-2.5 text-xs">
                    <p className="font-semibold">Current live build</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{app.domain}</p>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">v{app.version}</td>
                  <td className="px-4 py-2.5">
                    <StatusCell status="operational" />
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
              {DEPLOYMENTS_NOT_INSTRUMENTED}
            </p>
          </section>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Domains */}
          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <SectionTitle aside={<Globe className="h-3.5 w-3.5 text-[var(--portal-accent)]" aria-hidden />}>
              Domains
            </SectionTitle>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Domain</th>
                  <th className="px-4 py-2 font-medium">Protocol</th>
                  <th className="px-4 py-2 font-medium">Served by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr className="align-middle">
                  <td className="px-4 py-2.5 font-mono text-xs">{app.domain}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{app.protocol}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">This application build</td>
                </tr>
              </tbody>
            </table>
            <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
              DNS and certificate records are managed outside CALQULUS and are not instrumented on this desk.
            </p>
          </section>

          {/* Environment / configuration */}
          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <SectionTitle>Environment / configuration</SectionTitle>
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-border">
                {config.map((entry) => (
                  <tr key={entry.key} className="align-middle">
                    <td className="w-44 px-4 py-2.5 text-xs font-medium text-muted-foreground">{entry.key}</td>
                    <td className="max-w-0 truncate px-4 py-2.5 font-mono text-xs">{entry.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
              Keys, tokens, and secrets are never displayed on this desk.
            </p>
          </section>
        </div>

        {/* Logs */}
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <SectionTitle
            aside={
              <Link
                to={WEBHOST_OPS_ROUTES.issues}
                className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
              >
                All issues <ChevronRight className="h-3 w-3" />
              </Link>
            }
          >
            Logs
          </SectionTitle>
          {activityLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 rounded-md" />
              ))}
            </div>
          ) : activity.length === 0 ? (
            <p className="px-4 py-6 text-xs text-muted-foreground">No recorded activity yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Time</th>
                  <th className="hidden px-4 py-2 font-medium sm:table-cell">Actor</th>
                  <th className="px-4 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activity.map((row) => (
                  <tr key={row.id} className="align-middle">
                    <td className="w-32 px-4 py-2.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                      {dayFmt.format(new Date(row.created_at))}
                    </td>
                    <td className="hidden max-w-0 truncate px-4 py-2.5 text-xs sm:table-cell">
                      {row.actor_email ?? "system"}
                    </td>
                    <td className="max-w-0 truncate px-4 py-2.5 font-mono text-xs">{row.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </WebhostLayout>
  );
}
