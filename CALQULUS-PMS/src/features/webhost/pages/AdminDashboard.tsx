import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { startOfMonth } from "date-fns";
import {
  Activity,
  Building2,
  CheckCircle2,
  ChevronRight,
  Globe,
  Layers,
  RefreshCw,
  Server,
  ShieldAlert,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthContext";
import WebhostLayout from "@/features/webhost/components/WebhostLayout";
import { useAdminHealthProbes, type ComponentProbe } from "@/features/webhost/hooks/useAdminHealthProbes";
import {
  INFRA_STATUS,
  countProbed,
  deriveSystemStatus,
  getApplicationFacts,
  probeToInfraStatus,
  type InfraStatus,
} from "@/features/webhost/lib/infrastructure";
import { StatusCell } from "@/features/webhost/components/operations/ServiceStatusCell";
import { groupSecurityEvents, withoutTenantEntities } from "@/features/webhost/lib/adminSecurity";
import { WEBHOST_OPS_ROUTES, WEBHOST_ROUTES } from "@/features/webhost/lib/webhostPaths";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

type ActivityRow = {
  id: string;
  action: string;
  actor_email: string | null;
  actor_role: string | null;
  entity_type: string | null;
  entity_label: string | null;
  created_at: string;
};

type UsersSlice = {
  managers: number;
  agencies: number;
  webhosts: number;
  landlords: number;
  submanagers: number;
  failedLogins: number;
  permissionEvents: number;
};

const timeFmt = new Intl.DateTimeFormat("en-KE", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
const dayFmt = new Intl.DateTimeFormat("en-KE", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });



function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{children}</h2>
      {aside}
    </div>
  );
}

export default function AdminDashboard() {
  const { data: probes = [], isLoading: healthLoading, dataUpdatedAt, refetch, isRefetching } = useAdminHealthProbes();
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null);

  const app = useMemo(
    () =>
      getApplicationFacts(
        { PROD: import.meta.env.PROD, VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL as string | undefined },
        window.location,
      ),
    [],
  );

  const systemStatus = deriveSystemStatus(probes);
  const probedCount = countProbed(probes);
  const lastProbe = refreshedAt ?? (dataUpdatedAt || null);

  const { data: users, isLoading: usersLoading } = useQuery<UsersSlice>({
    queryKey: ["platform-admin-infra-users"],
    queryFn: async () => {
      const [managers, agencies, webhosts, landlords, submanagers, securityRows] = await Promise.all([
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "manager"),
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "agency"),
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "webhost"),
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "landlord"),
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "submanager"),
        supabase.from("activity_logs").select("action, entity_type").order("created_at", { ascending: false }).limit(200),
      ]);
      const counts = securityRows.error
        ? { failedLogins: 0, permissionEvents: 0 }
        : groupSecurityEvents((securityRows.data ?? []) as { action: string; entity_type: string | null }[]).counts;
      return {
        managers: managers.count ?? 0,
        agencies: agencies.count ?? 0,
        webhosts: webhosts.count ?? 0,
        landlords: landlords.count ?? 0,
        submanagers: submanagers.count ?? 0,
        failedLogins: counts.failedLogins,
        permissionEvents: counts.permissionEvents,
      };
    },
    staleTime: 30_000,
  });

  const { data: alerts = [], isLoading: alertsLoading } = useQuery<ActivityRow[]>({
    queryKey: ["platform-admin-infra-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("id, action, actor_email, actor_role, entity_type, entity_label, created_at")
        .or("action.like.error:%,action.like.warning:%")
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return withoutTenantEntities((data ?? []) as ActivityRow[]);
    },
    staleTime: 30_000,
  });

  const { data: activity = [], isLoading: activityLoading } = useQuery<ActivityRow[]>({
    queryKey: ["platform-admin-infra-activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("id, action, actor_email, actor_role, entity_type, entity_label, created_at")
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return withoutTenantEntities((data ?? []) as ActivityRow[]).slice(0, 8);
    },
    staleTime: 30_000,
  });

  // ── Platform scale — real counts from existing tables (no tenant PII) ──
  const { data: scale, isLoading: scaleLoading } = useQuery({
    queryKey: ["platform-admin-infra-scale"],
    queryFn: async () => {
      const [orgRoles, properties, units] = await Promise.all([
        supabase
          .from("user_roles")
          .select("id", { count: "exact", head: true })
          .in("role", ["manager", "agency"]),
        supabase.from("properties").select("id", { count: "exact", head: true }),
        supabase.from("units").select("id", { count: "exact", head: true }),
      ]);
      return {
        organizations: orgRoles.count ?? 0,
        properties: properties.count ?? 0,
        units: units.count ?? 0,
      };
    },
    staleTime: 30_000,
  });

  // ── Commercial overview — real platform billing derived from existing invoices ──
  const { data: billing, isLoading: billingLoading } = useQuery<{
    revenueMTD: number;
    outstanding: number;
    collectionRate: number;
    activeSubs: number;
    billedCount: number;
    hasData: boolean;
  }>({
    queryKey: ["platform-admin-infra-commercial"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manager_invoices")
        .select("amount, status, invoice_type, due_date, paid_date, manager_user_id");
      if (error) throw error;
      const list = (data ?? []) as {
        amount: number;
        status: string;
        invoice_type: string | null;
        due_date: string;
        paid_date: string | null;
        manager_user_id: string | null;
      }[];
      const paid = list.filter((i) => i.status === "paid");
      const now = new Date();
      const mtdStart = startOfMonth(now);
      const inMonth = () =>
        paid
          .filter((i) => {
            const d = i.paid_date ? new Date(i.paid_date) : null;
            return d && d >= mtdStart && d <= now;
          })
          .reduce((s, i) => s + Number(i.amount), 0);
      const revenueMTD = inMonth();
      const totalPaid = paid.reduce((s, i) => s + Number(i.amount), 0);
      const totalBilled = list.reduce((s, i) => s + Number(i.amount), 0);
      const outstanding = list
        .filter((i) => i.status === "pending" || i.status === "overdue")
        .reduce((s, i) => s + Number(i.amount), 0);
      const activeSubs = new Set(paid.filter((i) => i.invoice_type === "subscription").map((i) => i.manager_user_id)).size;
      return {
        revenueMTD,
        outstanding,
        collectionRate: totalBilled > 0 ? (totalPaid / totalBilled) * 100 : 0,
        activeSubs,
        billedCount: list.length,
        hasData: list.length > 0,
      };
    },
    staleTime: 30_000,
  });

  const { user, platformAdminInfo, webhostPermissions, isSuperAdmin } = useAuth();
  const adminDisplayName = platformAdminInfo?.display_name || user?.email?.split("@")[0] || "administrator";
  const adminDisplay = (name: string) =>
    name
      .split(/[\s._-]+/)
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const todayFmt = new Intl.DateTimeFormat("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const totalUsers = (users?.managers ?? 0) + (users?.agencies ?? 0) + (users?.webhosts ?? 0) + (users?.landlords ?? 0) + (users?.submanagers ?? 0);
  const fmtKES = (n: number) => (n >= 1_000_000 ? `KSh ${(n / 1_000_000).toFixed(2)}M` : `KSh ${n.toLocaleString("en-KE")}`);

  const orgQuery = { organizations: scale?.organizations ?? 0, properties: scale?.properties ?? 0, units: scale?.units ?? 0 };

  return (
    <WebhostLayout
      title="Master platform control room"
      description="One command center for platform operations, users, access, public experience and commercial control — tenant records remain outside this desk."
    >
      <div className="space-y-6">
        {/* Executive page header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--portal-accent)]">Platform command center</p>
            <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              {greeting}, {adminDisplay(adminDisplayName)}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Platform health, scale, and commercial performance across every
              organization on CALQULUS.
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
              <Activity className="h-3.5 w-3.5 text-[var(--portal-accent)]" aria-hidden />
              {todayFmt.format(new Date())}
            </span>
            <span className="hidden italic text-xs text-muted-foreground sm:block">Executive view</span>
          </div>
        </header>

        {/* Admin authority — factual identity, never a fabricated permission summary. */}
        <section aria-label="Administrator authority" className="grid gap-3 sm:grid-cols-3">
          {[
            ["Account", platformAdminInfo?.admin_type ? adminDisplay(platformAdminInfo.admin_type) : "Platform administrator", platformAdminInfo?.suspended ? "Suspended" : "Active"],
            ["Access tier", webhostPermissions?.admin_level ? adminDisplay(webhostPermissions.admin_level) : "Not loaded", isSuperAdmin ? "Full platform authority" : "Scoped by permissions"],
            ["Operating posture", isSuperAdmin ? "Super admin control" : "Permission-led control", "Changes remain server-authorized"],
          ].map(([label, value, helper]) => (
            <div key={label} className="rounded-xl border border-border bg-card px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="truncate text-sm font-semibold">{value}</p>
                <span className="shrink-0 rounded-full border border-[var(--portal-accent)]/20 bg-[var(--portal-accent)]/5 px-2 py-0.5 text-[10px] font-semibold text-[var(--portal-accent)]">{helper}</span>
              </div>
            </div>
          ))}
        </section>

        {/* Platform scale — real counts, compact KPI cells */}
        <section aria-label="Platform scale" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            {
              label: "Organizations",
              value: scaleLoading ? "…" : String(orgQuery.organizations),
              helper: "Manager & agency workspaces",
              icon: Building2,
              href: WEBHOST_ROUTES.organizations,
            },
            {
              label: "Users",
              value: usersLoading ? "…" : String(totalUsers),
              helper: "Across all portal roles",
              icon: Users,
              href: WEBHOST_ROUTES.users,
            },
            {
              label: "Properties",
              value: scaleLoading ? "…" : String(orgQuery.properties),
              helper: "Buildings managed",
              icon: Layers,
              href: WEBHOST_OPS_ROUTES.properties,
            },
            {
              label: "Units",
              value: scaleLoading ? "…" : String(orgQuery.units),
              helper: "Across the platform",
              icon: Server,
              href: WEBHOST_ROUTES.subscriptions,
            },
          ].map(({ label, value, helper, icon: Icon, href }) => {
            const cell = (
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--portal-accent)]/10 text-[var(--portal-accent)]"
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
                  <p className="mt-0.5 font-heading text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{helper}</p>
                </div>
              </div>
            );
            return href ? (
              <Link
                key={label}
                to={href}
                className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-[var(--portal-accent)]/40 hover:bg-muted/30"
              >
                {cell}
              </Link>
            ) : (
              <div key={label} className="rounded-xl border border-border bg-card p-4">
                {cell}
              </div>
            );
          })}
        </section>

        {/* Commercial overview — real platform billing */}
        <section aria-label="Commercial overview" className="overflow-hidden rounded-xl border border-border bg-card">
          <SectionTitle
            aside={
              <Link
                to={WEBHOST_ROUTES.subscriptions}
                className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
              >
                Subscriptions <ChevronRight className="h-3 w-3" />
              </Link>
            }
          >
            Commercial overview
          </SectionTitle>
          <dl className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4">
            {[
              { label: "Received this month", value: billingLoading ? "…" : fmtKES(billing?.revenueMTD ?? 0) },
              { label: "Outstanding", value: billingLoading ? "…" : fmtKES(billing?.outstanding ?? 0) },
              { label: "Active subscriptions", value: billingLoading ? "…" : String(billing?.activeSubs ?? 0) },
              { label: "Collection rate", value: billingLoading ? "…" : `${Math.round(billing?.collectionRate ?? 0)}%` },
            ].map((item) => (
              <div key={item.label} className="px-4 py-3">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{item.label}</dt>
                <dd className="mt-0.5 font-heading text-lg font-semibold tabular-nums">{item.value}</dd>
              </div>
            ))}
          </dl>
          {!billingLoading && !billing?.hasData ? (
            <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
              No invoices billed yet. Revenue appears once subscriptions begin.
            </p>
          ) : null}
        </section>

        {/* Master control map — one place to reach every non-tenant platform domain */}
        <section aria-label="Master control map" className="overflow-hidden rounded-xl border border-border bg-card">
          <SectionTitle>Master control room</SectionTitle>
          <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
            {[
              { title: "People & organizations", body: "Manage every non-tenant account, organization and operating relationship.", href: WEBHOST_ROUTES.users, links: [["Users", WEBHOST_ROUTES.users], ["Organizations", WEBHOST_ROUTES.organizations]] },
              { title: "Platform operations", body: "Control applications, releases, runtime operations and platform-owned property records.", href: WEBHOST_ROUTES.operations, links: [["Applications", WEBHOST_ROUTES.applications], ["Deployments", WEBHOST_ROUTES.deployments], ["Operations", WEBHOST_ROUTES.operations]] },
              { title: "Commercial control", body: "Own subscriptions, tiers, billing rules, negotiated pricing and platform contracts.", href: WEBHOST_ROUTES.subscriptions, links: [["Subscriptions", WEBHOST_ROUTES.subscriptions], ["Billing rules", WEBHOST_OPS_ROUTES.billingRules], ["Custom pricing", WEBHOST_OPS_ROUTES.customPricing]] },
              { title: "Access & public experience", body: "Control public pages, brand presentation, security, audit and platform access policy.", href: WEBHOST_ROUTES.publicSite, links: [["Public Site", WEBHOST_ROUTES.publicSite], ["Brand Studio", WEBHOST_ROUTES.brand], ["Security", WEBHOST_ROUTES.security]] },
            ].map((group) => (
              <div key={group.title} className="p-4">
                <Link to={group.href} className="font-heading text-sm font-semibold tracking-tight hover:text-[var(--portal-accent)]">{group.title}</Link>
                <p className="mt-1.5 min-h-[42px] text-xs leading-5 text-muted-foreground">{group.body}</p>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
                  {group.links.map(([label, href]) => (
                    <Link key={href} to={href} className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline">
                      {label}<ChevronRight className="h-3 w-3" />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
            Tenant records are deliberately outside the master user registry and operational command surface. The only tenant-related exception is the restricted unattached-account queue.
          </p>
        </section>

        {/* System status band — deep navy is chrome, never a page fill */}
        <section
          aria-label="System status"
          className="overflow-hidden rounded-xl border border-navy-primary/20 bg-navy-primary text-white"
        >
          <div className="h-0.5 w-full bg-[var(--portal-accent)]" aria-hidden />
          <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex items-start gap-3">
              <span aria-hidden className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", INFRA_STATUS[systemStatus].dot)} />
              <div>
                <p className="flex items-center gap-2 font-heading text-base font-semibold">
                  <StatusCell status={systemStatus} className="h-4 w-4" />
                  {healthLoading ? "Probing services…" : `System ${INFRA_STATUS[systemStatus].label.toLowerCase()}`}
                </p>
                <p className="mt-0.5 text-xs text-white/70">
                  {healthLoading
                    ? "Checking database, API, and storage"
                    : `${probedCount.probed} of ${probedCount.total} services reporting · ${app.name} ${app.version} · ${app.environment}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-white/70">
              <span className="inline-flex items-center gap-1.5 font-mono">
                <Globe className="h-3.5 w-3.5" />
                {app.domain}
                <span className="text-white/45">· {app.protocol}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  void refetch().then(() => setRefreshedAt(Date.now()));
                }}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-white/20 px-2.5 font-medium text-white/90 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isRefetching && "animate-spin")} />
                Probe now
              </button>
            </div>
          </div>
          <p className="border-t border-white/10 px-4 py-2 text-[11px] text-white/50 sm:px-5">
            {lastProbe ? `Last probe ${timeFmt.format(lastProbe)} · refreshes every 60s` : "Awaiting first probe"}
            {" · "}Deployments, servers, DNS, and certificates are not instrumented on this desk.
          </p>
        </section>

        {/* Service health */}
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <SectionTitle
            aside={
              <span className="text-[11px] text-muted-foreground">
                Live probes · <span className="font-mono">60s</span> interval
              </span>
            }
          >
            Service health
          </SectionTitle>
          {healthLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9 rounded-md" />
              ))}
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Service</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="hidden px-4 py-2 font-medium sm:table-cell">Latency</th>
                  <th className="hidden px-4 py-2 font-medium md:table-cell">Detail</th>
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
                      <td className="hidden px-4 py-2.5 font-mono text-xs tabular-nums text-muted-foreground sm:table-cell">
                        {typeof probe.latencyMs === "number" ? `${Math.round(probe.latencyMs)}ms` : "—"}
                      </td>
                      <td className="hidden max-w-0 truncate px-4 py-2.5 text-xs text-muted-foreground md:table-cell">
                        {probe.detail}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Applications */}
          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <SectionTitle
              aside={<Server className="h-3.5 w-3.5 text-[var(--portal-accent)]" aria-hidden />}
            >
              Applications
            </SectionTitle>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Application</th>
                  <th className="px-4 py-2 font-medium">Environment</th>
                  <th className="hidden px-4 py-2 font-medium sm:table-cell">Domain</th>
                  <th className="px-4 py-2 font-medium">Backend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr className="align-middle">
                  <td className="px-4 py-2.5">
                    <p className="text-xs font-semibold">{app.name}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">v{app.version}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span aria-hidden className={cn("h-2 w-2 rounded-full", app.environment === "production" ? "bg-success" : "bg-warning")} />
                      {app.environment}
                    </span>
                  </td>
                  <td className="hidden px-4 py-2.5 font-mono text-xs text-muted-foreground sm:table-cell">
                    {app.domain} · {app.protocol}
                  </td>
                  <td className="max-w-0 truncate px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {app.backendProject}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
              One deployed application. Edge functions report through the API probe above.
            </p>
          </section>

          {/* Needs attention */}
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
              Needs attention
            </SectionTitle>
            {alertsLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 rounded-md" />
                ))}
              </div>
            ) : alerts.length === 0 ? (
              <p className="flex items-center gap-2 px-4 py-6 text-xs text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-success" />
                No error or warning events in the audit log.
              </p>
            ) : (
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-border">
                  {alerts.map((row) => {
                    const severity: InfraStatus = row.action.startsWith("error:") ? "down" : "warning";
                    return (
                      <tr key={row.id} className="align-middle">
                        <td className="w-28 px-4 py-2.5">
                          <StatusCell status={severity} />
                        </td>
                        <td className="max-w-0 truncate px-4 py-2.5 text-xs">
                          {row.action.replace(/^error:/, "").replace(/^warning:/, "")}
                          {row.entity_label ? <span className="text-muted-foreground"> · {row.entity_label}</span> : null}
                        </td>
                        <td className="w-32 px-4 py-2.5 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                          {dayFmt.format(new Date(row.created_at))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {!usersLoading && users ? (
              <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
                {users.failedLogins} failed logins · {users.permissionEvents} permission events · last 200 audit rows
                {" · "}
                <Link to={WEBHOST_ROUTES.security} className="font-medium text-primary hover:underline">
                  Security
                </Link>
              </p>
            ) : null}
          </section>
        </div>

        {/* Infrastructure activity */}
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <SectionTitle
            aside={
              <Link
                to={WEBHOST_ROUTES.audit}
                className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
              >
                Audit log <ChevronRight className="h-3 w-3" />
              </Link>
            }
          >
            Infrastructure activity
          </SectionTitle>
          {activityLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
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
                  <th className="hidden px-4 py-2 font-medium md:table-cell">Entity</th>
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
                      {row.actor_role ? <span className="text-muted-foreground"> · {row.actor_role}</span> : null}
                    </td>
                    <td className="max-w-0 truncate px-4 py-2.5 font-mono text-xs">{row.action}</td>
                    <td className="hidden max-w-0 truncate px-4 py-2.5 text-xs text-muted-foreground md:table-cell">
                      {row.entity_label ?? row.entity_type ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Users & access */}
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <SectionTitle
            aside={
              <Link
                to={WEBHOST_ROUTES.users}
                className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
              >
                Manage <ChevronRight className="h-3 w-3" />
              </Link>
            }
          >
            Users & access
          </SectionTitle>
          <dl className="grid grid-cols-3 divide-x divide-border sm:grid-cols-6">
            {[
              { label: "Managers", value: users?.managers },
              { label: "Agencies", value: users?.agencies },
              { label: "Webhosts", value: users?.webhosts },
              { label: "Landlords", value: users?.landlords },
              { label: "Submanagers", value: users?.submanagers },
              { label: "Failed logins", value: users?.failedLogins },
            ].map((item) => (
              <div key={item.label} className="px-4 py-3">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{item.label}</dt>
                <dd className="mt-0.5 font-heading text-base font-semibold tabular-nums">
                  {usersLoading ? "…" : (item.value ?? 0)}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--portal-accent)]" />
          Tenant identities, rent, and leases are not available on this desk. Deployments, servers, and DNS are
          managed outside CALQULUS and are not shown here.
        </p>
      </div>
    </WebhostLayout>
  );
}
