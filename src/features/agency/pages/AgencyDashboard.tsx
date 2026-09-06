import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  CreditCard,
  DoorOpen,
  FileChartColumn,
  Handshake,
  Home,
  UserPlus,
  Wrench,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AgencyLayout from "@/features/agency/components/AgencyLayout";
import { useAgencyPortfolio } from "@/features/agency/lib/useAgencyPortfolio";
import { AGENCY_OPS_ROUTES, AGENCY_ROUTES, agencyClientPath, agencyPropertyPath } from "@/features/agency/lib/agencyPaths";
import {
  AGENCY_TREND_COLORS,
  agencyClientStatus,
  agencyClientStatusChipClass,
  agencyClientStatusLabel,
  buildAgencyAttentionItems,
} from "@/features/agency/lib/agencyPortfolio";
import { AGENCY_CARD } from "@/features/agency/theme";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthContext";
import ManagerActivityLog from "@/features/dashboard/components/ManagerActivityLog";
import { DashboardSectionHeader } from "@/features/dashboard/components/DashboardSectionHeader";
import { StatCard } from "@/features/dashboard/components/StatCard";
import { formatKes } from "@/features/landlord/lib/formatKes";
import { AGENCY_SERVICE_MODELS, AGENCY_SERVICE_MODEL_SHORT_LABELS } from "@/shared/constants/authorityModels";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ErrorState } from "@/shared/components/ui/error-state";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { occupancyRateColor } from "@/shared/lib/statusBadge";
import { cn } from "@/shared/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";

const fmtCompact = (n: number) =>
  new Intl.NumberFormat("en-KE", { notation: "compact", maximumFractionDigits: 1 }).format(n);

const ATTENTION_ICON: Record<string, typeof CreditCard> = {
  Arrears: CreditCard,
  Leases: FileChartColumn,
  "Unlinked buildings": Building2,
};

export default function AgencyDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useAgencyPortfolio();

  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  const attention = data
    ? buildAgencyAttentionItems({
        outstanding: data.outstanding,
        overdueInvoices: data.overdueInvoices,
        expiringLeases: data.expiringLeases,
        unlinkedCount: data.unlinkedCount,
        formatAmount: formatKes,
        hrefs: { billing: AGENCY_ROUTES.billing, leases: AGENCY_OPS_ROUTES.leases, clients: AGENCY_ROUTES.clients },
      })
    : [];

  const { data: openMaintenance = 0 } = useQuery({
    queryKey: ["agency-dashboard-open-maintenance", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("maintenance_requests")
        .select("id", { count: "exact", head: true })
        .eq("manager_id", user!.id)
        // Matches the Manager dashboard's definition (dashboardStats.ts) —
        // new requests are created with status "open" (never "pending" per
        // the maintenance lifecycle RPC), so omitting it undercounted the
        // real open-maintenance backlog.
        .in("status", ["open", "pending", "in_progress"]);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const hasNothingToShow = !isLoading && data && data.clientCount === 0 && data.totalProperties === 0;
  const hasSeriesActivity = (data?.series ?? []).some((point) => point.paid > 0 || point.pending > 0);
  const attentionCount = attention.length + (openMaintenance > 0 ? 1 : 0);

  return (
    <AgencyLayout
      title="Your agency at a glance."
      description="Clients are landlords you serve. Collections track rent recorded across the book; service mix shows where the agency collects versus where owners collect directly."
      actions={<p className="type-meta whitespace-nowrap text-muted-foreground">Today · {dateLabel}</p>}
    >
      {isError ? <ErrorState title="Couldn't load the agency book" onRetry={() => void refetch()} className="mb-6" /> : null}

      {hasNothingToShow ? (
        <section
          aria-label="Agency setup progress"
          className="mb-6 flex flex-col gap-3 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center card-shadow"
        >
          <Handshake className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 className="type-card-title">Finish setting up your agency</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Profile, portfolio defaults, first client, and first property — a few minutes.
            </p>
          </div>
          <Button size="sm" className="min-h-11 shrink-0" asChild>
            <Link to="/agency/onboarding">
              Continue setup
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden />
            </Link>
          </Button>
        </section>
      ) : null}

      {/* Executive KPI row — one unified metric system, live values only */}
      <section className="mb-6 min-w-0" aria-labelledby="agency-dashboard-kpi">
        <DashboardSectionHeader
          id="agency-dashboard-kpi"
          eyebrow="At a glance"
          title="Portfolio"
          description="Clients, properties, units, occupancy, and collections from live records"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {isLoading || !data
            ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[5.5rem] rounded-xl" />)
            : (
              <>
                <StatCard
                  compact
                  title="Clients"
                  value={String(data.clientCount)}
                  change={data.unlinkedCount > 0 ? `${data.unlinkedCount} unlinked` : "All linked"}
                  changeType={data.unlinkedCount > 0 ? "negative" : "neutral"}
                  icon={Handshake}
                  iconColor="primary"
                />
                <StatCard
                  compact
                  title="Properties"
                  value={String(data.totalProperties)}
                  change="Buildings on the book"
                  changeType="neutral"
                  icon={Building2}
                  iconColor="primary"
                />
                <StatCard
                  compact
                  title="Units"
                  value={String(data.totalUnits)}
                  change={`${data.totalOccupied} occupied`}
                  changeType="neutral"
                  icon={DoorOpen}
                  iconColor="primary"
                />
                <StatCard
                  compact
                  title="Occupancy"
                  value={`${data.occupancyRate}%`}
                  changeType={data.occupancyRate >= 70 ? "neutral" : "negative"}
                  icon={Home}
                  iconColor={data.occupancyRate >= 70 ? "primary" : "warning"}
                  progressValue={data.occupancyRate}
                />
                <StatCard
                  compact
                  title="Collections recorded"
                  value={formatKes(data.collectedMtd)}
                  change="Rent recorded this month"
                  changeType="neutral"
                  icon={CreditCard}
                  iconColor="primary"
                />
              </>
            )}
        </div>
      </section>

      {/* Portfolio performance + snapshot */}
      <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-12">
        <section className={cn(AGENCY_CARD.panel, "xl:col-span-7")} aria-labelledby="agency-dashboard-performance">
          <DashboardSectionHeader
            id="agency-dashboard-performance"
            eyebrow="Cash flow"
            title="Portfolio performance"
            description="Collected versus outstanding invoices over six months"
            className="mb-4"
          />
          {isLoading ? (
            <Skeleton className="h-[230px] w-full rounded-lg" />
          ) : !hasSeriesActivity ? (
            <EmptyState
              icon={CreditCard}
              title="No billing activity yet"
              description="Once invoices are raised and collected across your client portfolios, the six-month trend appears here."
              className="min-h-[230px] py-6"
            />
          ) : (
            <div className="chart-frame h-[230px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.series ?? []} margin={{ top: 10, right: 5, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={fmtCompact} width={44} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    formatter={(value, name) => [formatKes(Number(value ?? 0)), name === "paid" ? "Collected" : "Outstanding"]}
                  />
                  <Area type="monotone" dataKey="paid" stroke={AGENCY_TREND_COLORS.collected} strokeWidth={2} fill="transparent" />
                  <Area type="monotone" dataKey="pending" stroke={AGENCY_TREND_COLORS.outstanding} strokeWidth={2} fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: AGENCY_TREND_COLORS.collected }} /> Collected
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: AGENCY_TREND_COLORS.outstanding }} /> Outstanding
            </span>
          </div>
        </section>

        <section className={cn(AGENCY_CARD.panel, "xl:col-span-5")} aria-labelledby="agency-dashboard-snapshot">
          <DashboardSectionHeader id="agency-dashboard-snapshot" title="Portfolio snapshot" className="mb-1" />
          {isLoading || !data ? (
            <div className="space-y-2.5 pt-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : (
            <>
              {[
                { label: "Properties", value: String(data.totalProperties) },
                { label: "Units", value: String(data.totalUnits) },
                { label: "Occupancy", value: `${data.occupancyRate}%` },
                { label: "Collected", value: formatKes(data.collectedMtd) },
                {
                  label: "Outstanding",
                  value: formatKes(data.outstanding),
                  className: data.outstanding > 0 ? "text-destructive" : "text-foreground",
                },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 border-b border-border/60 py-2.5 last:border-0">
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span className={cn("text-sm font-semibold", row.className ?? "text-foreground")}>{row.value}</span>
                </div>
              ))}
              <div className="mt-3" role="img" aria-label={`Occupancy ${data.occupancyRate}%`}>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, Math.max(0, data.occupancyRate))}%` }}
                  />
                </div>
              </div>
              <div className="mt-4 border-t border-border/60 pt-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground">Service playbook</span>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">Run each client mandate from the same operating model.</p>
                  </div>
                  <Link to={AGENCY_ROUTES.portfolio} className="text-xs font-medium text-primary hover:underline">Open portfolio</Link>
                </div>
                <div className="mt-2 grid gap-2">
                  {[
                    ["full_management", data.serviceMix.fullManagement],
                    ["managed_direct_landlord_collection", data.serviceMix.managedDirectCollection],
                    ["collections_enforcement_only", data.serviceMix.collectionsEnforcementOnly],
                  ].map(([id, count]) => {
                    const model = AGENCY_SERVICE_MODELS.find((entry) => entry.id === id);
                    if (!model) return null;
                    return (
                      <div key={id as string} className="min-w-0 rounded-lg border border-border/70 bg-muted/20 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[11px] font-semibold text-foreground">{AGENCY_SERVICE_MODEL_SHORT_LABELS[id as keyof typeof AGENCY_SERVICE_MODEL_SHORT_LABELS]}</span>
                          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{count as number}</span>
                        </div>
                        <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{model.description}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-background px-2 py-1 text-[9px] font-medium text-muted-foreground">Operate · {model.operates}</span>
                          <span className="rounded-full bg-background px-2 py-1 text-[9px] font-medium text-muted-foreground">Collect · {model.collects}</span>
                          <span className="rounded-full bg-background px-2 py-1 text-[9px] font-medium text-muted-foreground">Maintain · {model.maintenance}</span>
                        </div>
                      </div>
                    );
                  })}
                  {data.serviceMix.unconfigured > 0 ? (
                    <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-dashed border-warning/40 bg-warning/5 px-2.5 py-2">
                      <span className="text-[10px] font-medium text-warning">{data.serviceMix.unconfigured} mandate{data.serviceMix.unconfigured === 1 ? "" : "s"} not configured</span>
                      <Link to={AGENCY_ROUTES.portfolio} className="text-[10px] font-semibold text-warning hover:underline">Configure</Link>
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Needs attention — live exceptions, ranked arrears → leases → unlinked → maintenance */}
      <section className="mb-6 min-w-0" aria-labelledby="agency-dashboard-attention">
        <DashboardSectionHeader
          id="agency-dashboard-attention"
          eyebrow="Action queue"
          title="Needs attention"
          description="Items across your client portfolios that need a decision"
        />
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
        ) : attentionCount === 0 ? (
          <EmptyState
            icon={Home}
            title="All caught up"
            description="No overdue invoices, expiring leases, unlinked buildings, or open maintenance right now."
            className="min-h-0 py-6"
          />
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border bg-card card-shadow">
            {attention.map((item) => {
              const Icon = ATTENTION_ICON[item.label] ?? FileChartColumn;
              return (
                <div key={item.label} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                  <Icon className="hidden h-4 w-4 shrink-0 text-primary sm:block" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{item.value}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                  <Button size="sm" variant="outline" className="min-h-11 shrink-0" asChild>
                    <Link to={item.href}>
                      Open {item.label.toLowerCase()}
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </Button>
                </div>
              );
            })}
            {openMaintenance > 0 ? (
              <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                <Wrench className="hidden h-4 w-4 shrink-0 text-primary sm:block" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{openMaintenance} open</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Maintenance requests across client buildings</p>
                </div>
                <Button size="sm" variant="outline" className="min-h-11 shrink-0" asChild>
                  <Link to={AGENCY_OPS_ROUTES.maintenance}>
                    <Wrench className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                    Open maintenance
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {/* Client portfolio performance */}
      <section className={cn(AGENCY_CARD.panel, "mb-6")} aria-labelledby="agency-dashboard-clients">
        <div className="mb-3 flex items-start justify-between gap-2">
          <DashboardSectionHeader
            id="agency-dashboard-clients"
            eyebrow="Client book"
            title="Client portfolio performance"
            description="See how each landlord portfolio is performing this month"
            className="mb-0"
          />
          <Button variant="ghost" size="sm" className="shrink-0" asChild>
            <Link to={AGENCY_ROUTES.clients}>
              Clients
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden />
            </Link>
          </Button>
        </div>
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
        ) : (data?.clients.length ?? 0) === 0 ? (
          <EmptyState
            icon={Handshake}
            title="No clients linked yet"
            description="Link a landlord to a building to start tracking their portfolio here."
            actionLabel="Link a client"
            onAction={() => navigate(AGENCY_ROUTES.clients)}
            className="min-h-0 py-8"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Properties</TableHead>
                <TableHead className="hidden text-right md:table-cell">Units</TableHead>
                <TableHead className="text-right">Occ.</TableHead>
                <TableHead className="text-right">Collected</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Outstanding</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data!.clients.slice(0, 6).map((client) => {
                const status = agencyClientStatus(client);
                return (
                  <TableRow key={client.id}>
                    <TableCell>
                      <Link to={agencyClientPath(client.id)} className="block truncate font-medium hover:underline">
                        {client.name}
                      </Link>
                      <p className="text-xs text-muted-foreground sm:hidden">
                        {client.propertyCount} propert{client.propertyCount === 1 ? "y" : "ies"}
                      </p>
                    </TableCell>
                    <TableCell className="hidden text-right text-sm sm:table-cell">{client.propertyCount}</TableCell>
                    <TableCell className="hidden text-right text-sm md:table-cell">{client.occupied}/{client.units}</TableCell>
                    <TableCell className={cn("text-right text-sm", occupancyRateColor(client.occupancyRate))}>{client.occupancyRate}%</TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatKes(client.collectedMtd)}</TableCell>
                    <TableCell className={cn("hidden text-right text-sm sm:table-cell", client.outstanding > 0 ? "text-destructive" : "")}>
                      {formatKes(client.outstanding)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", agencyClientStatusChipClass(status))}>
                        {agencyClientStatusLabel(status)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>

      {/* Property performance */}
      <section className={cn(AGENCY_CARD.panel, "mb-6")} aria-labelledby="agency-dashboard-properties">
        <div className="mb-3 flex items-start justify-between gap-2">
          <DashboardSectionHeader
            id="agency-dashboard-properties"
            eyebrow="Portfolio detail"
            title="Property performance"
            description="Occupancy and collections by building, with real client relationships"
            className="mb-0"
          />
          <Button variant="ghost" size="sm" className="shrink-0" asChild>
            <Link to={AGENCY_ROUTES.portfolio}>
              Portfolio
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden />
            </Link>
          </Button>
        </div>
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
        ) : (data?.properties.length ?? 0) === 0 ? (
          <EmptyState
            icon={Building2}
            title="No buildings on the book yet"
            description="Add a property to start tracking occupancy and collections here."
            actionLabel="Add property"
            onAction={() => navigate(AGENCY_OPS_ROUTES.buildings)}
            className="min-h-0 py-8"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead className="hidden sm:table-cell">Client</TableHead>
                <TableHead className="hidden lg:table-cell">Service</TableHead>
                <TableHead className="hidden text-right md:table-cell">Units</TableHead>
                <TableHead className="text-right">Occ.</TableHead>
                <TableHead className="text-right">Collected</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Outstanding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data!.properties.slice(0, 5).map((property) => (
                <TableRow key={property.id}>
                  <TableCell>
                    <Link to={agencyPropertyPath(property.id)} className="block truncate font-medium hover:underline">
                      {property.name}
                    </Link>
                    <p className="text-xs text-muted-foreground sm:hidden">{property.clientName}</p>
                  </TableCell>
                  <TableCell className="hidden truncate text-sm text-muted-foreground sm:table-cell">{property.clientName}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {property.serviceModel ? (
                      <span className="inline-flex max-w-[180px] items-center rounded-full border border-border bg-muted/30 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        <span className="truncate">{AGENCY_SERVICE_MODEL_SHORT_LABELS[property.serviceModel]}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-warning">Set mandate</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-right text-sm md:table-cell">{property.occupied}/{property.units}</TableCell>
                  <TableCell className={cn("text-right text-sm", occupancyRateColor(property.occupancyRate))}>
                    {property.occupancyRate}%
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">{formatKes(property.collectedMtd)}</TableCell>
                  <TableCell className={cn("hidden text-right text-sm sm:table-cell", property.outstanding > 0 ? "text-destructive" : "")}>
                    {formatKes(property.outstanding)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {/* Quick actions — linked to real Agency routes */}
      <section className="mb-6 flex flex-wrap items-center gap-2" aria-labelledby="agency-dashboard-quick-actions">
        <h2 id="agency-dashboard-quick-actions" className="section-title mr-auto pr-4">Quick actions</h2>
        <Button size="sm" variant="outline" className="min-h-11" asChild>
          <Link to={AGENCY_ROUTES.clients}>
            <Handshake className="h-4 w-4" aria-hidden /> Add client
          </Link>
        </Button>
        <Button size="sm" variant="outline" className="min-h-11" asChild>
          <Link to={AGENCY_OPS_ROUTES.buildings}>
            <Building2 className="h-4 w-4" aria-hidden /> Add property
          </Link>
        </Button>
        <Button size="sm" variant="outline" className="min-h-11" asChild>
          <Link to={AGENCY_OPS_ROUTES.invites}>
            <UserPlus className="h-4 w-4" aria-hidden /> Invite tenant
          </Link>
        </Button>
        <Button size="sm" variant="outline" className="min-h-11" asChild>
          <Link to={AGENCY_ROUTES.billing}>
            <CreditCard className="h-4 w-4" aria-hidden /> Create billing
          </Link>
        </Button>
        <Button size="sm" variant="outline" className="min-h-11" asChild>
          <Link to={AGENCY_ROUTES.reports}>
            <FileChartColumn className="h-4 w-4" aria-hidden /> View reports
          </Link>
        </Button>
      </section>

      {/* Recent activity */}
      <section className={AGENCY_CARD.panel} aria-labelledby="agency-dashboard-activity">
        <DashboardSectionHeader id="agency-dashboard-activity" eyebrow="Timeline" title="Recent activity" className="mb-3" />
        <ManagerActivityLog compact limit={8} />
      </section>
    </AgencyLayout>
  );
}
