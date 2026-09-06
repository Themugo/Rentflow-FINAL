import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowRight,
  Banknote,
  Building2,
  CreditCard,
  DoorOpen,
  HandCoins,
  TriangleAlert,
  TrendingUp,
  Wallet,
  Wrench,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import LandlordLayout from "@/features/landlord/components/LandlordLayout";
import { PropertyImage } from "@/shared/components/LazyImage";
import { LandlordPayoutDialog } from "@/features/landlord/components/LandlordPayoutDialog";
import { useLandlordPortfolio } from "@/features/landlord/hooks/useLandlordPortfolio";
import { useLandlordIncomeTrend } from "@/features/landlord/hooks/useLandlordOps";
import { useLandlordPayouts } from "@/features/landlord/hooks/useLandlordPayouts";
import { formatKes } from "@/features/landlord/lib/formatKes";
import { LANDLORD_ROUTES, landlordPropertyPath } from "@/features/landlord/lib/landlordPaths";
import {
  LANDLORD_TREND_COLORS,
  buildAttentionItems,
  buildRecentEvents,
  collectionRate,
  netShare,
  strongestProperty,
} from "@/features/landlord/lib/portfolioMetrics";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Progress } from "@/shared/components/ui/progress";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ErrorState } from "@/shared/components/ui/error-state";
import { occupancyRateColor } from "@/shared/lib/statusBadge";
import { occupancyBarClass } from "@/features/landlord/lib/formatKes";

type KpiTone = "navy" | "primary" | "accent" | "warning" | "danger" | "neutral";

const iconTone: Record<KpiTone, string> = {
  navy: "bg-navy-mid/10 text-navy-mid",
  primary: "bg-primary/10 text-primary",
  accent: "bg-[var(--portal-accent)]/10 text-[var(--portal-accent)]",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
};
const valueTone: Record<KpiTone, string> = {
  navy: "",
  primary: "",
  accent: "",
  warning: "text-foreground",
  danger: "text-destructive",
  neutral: "",
};

export default function LandlordDashboard() {
  const { portfolio, properties, isLoading, isError, refetch } = useLandlordPortfolio();
  const { payouts, isLoading: payoutsLoading } = useLandlordPayouts();
  const trendQuery = useLandlordIncomeTrend(properties);
  const pendingPayouts = payouts.filter((p) => p.status === "pending").length;
  const recentEvents = buildRecentEvents(portfolio.activities, payouts).slice(0, 8);

  const rate = collectionRate(portfolio.totalCollectedRent, portfolio.totalExpectedRent);
  const attention = buildAttentionItems(portfolio, pendingPayouts, LANDLORD_ROUTES, formatKes);
  const insight = strongestProperty(properties);
  const hasPortfolio = portfolio.totalProperties > 0;

  const reportingPeriod = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date());

  const kpis = [
    {
      key: "net",
      label: "NET TO YOU",
      value: formatKes(portfolio.netLandlordShareMTD),
      href: LANDLORD_ROUTES.financials,
      hint: "After the revenue split",
      icon: Wallet,
      tone: "navy" as KpiTone,
    },
    {
      key: "collected",
      label: "COLLECTED",
      value: formatKes(portfolio.totalCollectedRent),
      href: LANDLORD_ROUTES.financials,
      hint: `Rent received · ${rate}% billed`,
      icon: HandCoins,
      tone: "primary" as KpiTone,
    },
    {
      key: "occupancy",
      label: "OCCUPANCY",
      value: `${portfolio.occupancyRate}%`,
      href: LANDLORD_ROUTES.portfolio,
      hint: `${portfolio.totalOccupied} of ${portfolio.totalUnits} units`,
      icon: DoorOpen,
      tone: "accent" as KpiTone,
    },
    {
      key: "outstanding",
      label: "OUTSTANDING",
      value: formatKes(portfolio.totalArrears),
      href: LANDLORD_ROUTES.statements,
      hint: "Uncollected rent",
      icon: CreditCard,
      tone: portfolio.totalArrears > 0 ? ("danger" as KpiTone) : ("neutral" as KpiTone),
    },
  ];

  return (
    <LandlordLayout
      title="Dashboard"
      description="Track occupancy, collections and your share across every property you own."
      actions={hasPortfolio ? <LandlordPayoutDialog properties={properties} /> : undefined}
    >
      {isError ? <ErrorState title="Couldn't load your portfolio" onRetry={() => void refetch()} className="mb-6" /> : null}

      {/* Investment overview hero */}
      <section aria-label="Portfolio summary" className="overflow-hidden rounded-xl border border-navy-primary/20 bg-navy-primary text-white">
        <div className="h-0.5 w-full bg-[var(--portal-accent)]" aria-hidden />
        <div className="flex flex-col gap-4 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            {isLoading ? (
              <Skeleton className="h-14 w-3/4 bg-white/10" />
            ) : (
              <>
                <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--portal-accent)]">
                  {hasPortfolio ? `Your portfolio · ${reportingPeriod}` : "Your portfolio"}
                </p>
                <h1 className="mt-1.5 font-heading text-xl font-semibold sm:text-2xl">Your portfolio, at a glance.</h1>
                <p className="mt-1 max-w-xl text-sm text-white/70">
                  Track occupancy, collections and your share across every property you own.
                </p>
                {attention.length > 0 ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {attention.slice(0, 3).map((a) => (
                      <Link
                        key={a.label}
                        to={a.href}
                        className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/90 hover:bg-white/10"
                      >
                        <TriangleAlert className="h-3.5 w-3.5" />
                        {a.label}: {a.value}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
          {!isLoading && hasPortfolio ? (
            <div className="shrink-0 sm:text-right">
              <p className="text-[11px] font-medium uppercase tracking-wider text-white/70">Collected this month</p>
              <p className="mt-1 font-heading text-2xl font-semibold tabular-nums sm:text-3xl">{formatKes(portfolio.totalCollectedRent)}</p>
              <div className="mt-2 flex items-center justify-end gap-2">
                <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full rounded-full bg-[var(--portal-accent)]" style={{ width: `${rate}%` }} aria-hidden />
                </div>
                <span className="text-xs text-white/80">{rate}% collected</span>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* Premium KPI strip */}
      <section aria-label="Key portfolio metrics" className="mt-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          : kpis.map((kpi) => (
              <Link
                key={kpi.key}
                to={kpi.href}
                aria-label={`${kpi.label}: ${kpi.value}`}
                className="group flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30"
              >
                <div className="flex items-center gap-2.5">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconTone[kpi.tone]}`}>
                    <kpi.icon className="h-4 w-4" />
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{kpi.label}</span>
                </div>
                <div className="mt-3">
                  <p className={`font-heading text-2xl font-semibold tabular-nums tracking-tight ${valueTone[kpi.tone]}`}>{kpi.value}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{kpi.hint}</p>
                </div>
              </Link>
            ))}
      </section>

      {/* Income + health + insight */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5 xl:col-span-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="section-title">Portfolio income</h2>
              <p className="meta-text mt-0.5">Net collections, last 6 months</p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to={LANDLORD_ROUTES.financials}>
                Financials <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
          {trendQuery.isLoading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : (trendQuery.data?.length ?? 0) === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Income trend appears once your property manager records collections.
            </p>
          ) : (
            <div className="chart-frame h-[220px]">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={trendQuery.data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="landlordNetFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={LANDLORD_TREND_COLORS.net} stopOpacity={0.26} />
                      <stop offset="100%" stopColor={LANDLORD_TREND_COLORS.net} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis width={52} tick={{ fontSize: 11 }} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                  <Tooltip formatter={(v) => formatKes(Number(v ?? 0))} />
                  <Area type="monotone" dataKey="collected" name="Collected" stroke={LANDLORD_TREND_COLORS.collected} strokeWidth={2} fill="none" />
                  <Area type="monotone" dataKey="net" name="Net to you" stroke={LANDLORD_TREND_COLORS.net} strokeWidth={2} fill="url(#landlordNetFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <div className="xl:col-span-2 flex flex-col gap-6">
          {/* Portfolio health */}
          <section aria-label="Portfolio health" className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <h2 className="section-title mb-4">Portfolio health</h2>
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <DoorOpen className="h-4 w-4" /> Occupancy
                    </span>
                    <span className="font-semibold tabular-nums">{portfolio.occupancyRate}%</span>
                  </div>
                  <Progress value={portfolio.occupancyRate} className="h-2 bg-muted" indicatorClassName={occupancyBarClass(portfolio.occupancyRate)} />
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-center">
                  <div>
                    <p className="text-xl font-semibold tabular-nums">{portfolio.totalOccupied}</p>
                    <p className="text-[11px] text-muted-foreground">Occupied</p>
                  </div>
                  <div>
                    <p className="text-xl font-semibold tabular-nums">{portfolio.totalVacant}</p>
                    <p className="text-[11px] text-muted-foreground">Vacant</p>
                  </div>
                  <div>
                    <p className="text-xl font-semibold tabular-nums">{rate}%</p>
                    <p className="text-[11px] text-muted-foreground">Collected</p>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Portfolio insight — real data only */}
          {!isLoading && insight ? (
            <section aria-label="Portfolio insight" className="rounded-xl border border-border bg-card p-4 sm:p-5">
              <div className="mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[var(--portal-accent)]" />
                <h2 className="section-title">Portfolio insight</h2>
              </div>
              <p className="text-sm text-foreground">
                <span className="font-semibold">{insight.name}</span> is currently your strongest-performing property by net
                collections this month.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline">{formatKes(insight.net)} net</Badge>
                <Badge variant="outline">{insight.occupancyPct}% occupied</Badge>
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {/* Your properties */}
      <section className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-5" aria-label="Your properties">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="section-title">Your properties</h2>
            <p className="meta-text mt-0.5">Occupancy, collections and your share per building.</p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to={LANDLORD_ROUTES.portfolio}>
              Portfolio <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}</div>
        ) : properties.length === 0 ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" />
            Your buildings will be listed here once your manager links them.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {properties.map((prop) => {
              const occ = prop.units > 0 ? Math.round((prop.occupied / prop.units) * 100) : 0;
              const propNet = netShare(prop.collectedRent, prop.revenue_share_pct);
              return (
                <Link
                  key={prop.id}
                  to={landlordPropertyPath(prop.id)}
                  className="group flex items-stretch gap-4 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/30 hover:bg-muted/20"
                >
                  <div className="w-20 flex-shrink-0 overflow-hidden rounded-lg bg-muted sm:w-24">
                    <PropertyImage src={prop.image_url} propertyName={prop.name} aspectRatio="4/3" className="h-full w-full" />
                  </div>
                  <div className="min-w-0 flex-1 self-center">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-heading text-sm font-semibold text-foreground">{prop.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{prop.address}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px]">{prop.revenue_share_pct}% share</Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Occupancy</p>
                        <p className={`font-semibold tabular-nums ${occupancyRateColor(occ)}`}>{occ}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Units</p>
                        <p className="font-semibold tabular-nums">
                          {prop.occupied}/{prop.units}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Net to you</p>
                        <p className="font-semibold tabular-nums">{formatKes(propNet)}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2">
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <HandCoins className="h-3 w-3" /> {formatKes(prop.collectedRent)}
                      </p>
                      {prop.outstandingArrears > 0 ? (
                        <p className="text-xs font-semibold text-destructive">{formatKes(prop.outstandingArrears)} outstanding</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">No arrears</p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent activity — real maintenance + payouts only */}
      {!isLoading ? (
        <section className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-5" aria-label="Recent activity">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="section-title">Recent activity</h2>
              <p className="meta-text mt-0.5">Open maintenance and your latest payout requests.</p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to={LANDLORD_ROUTES.maintenance}>
                Maintenance <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
          {payoutsLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : recentEvents.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No activity yet. Open maintenance and payout requests will appear here.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {recentEvents.map((ev) => (
                <li key={ev.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    {ev.kind === "payout" ? <Banknote className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{ev.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {ev.propertyName ? `${ev.propertyName} · ` : ""}
                      {format(new Date(ev.timestamp), "dd MMM yyyy")}
                    </p>
                  </div>
                  {ev.kind === "payout" && ev.amountLabel ? (
                    <span className="text-sm font-semibold tabular-nums">{formatKes(Number(ev.amountLabel))}</span>
                  ) : (
                    <TriangleAlert className="h-4 w-4 shrink-0 text-warning" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {/* Intentional empty state for a fresh account */}
      {!isLoading && !hasPortfolio ? (
        <section aria-label="Empty portfolio" className="mt-6 rounded-xl border border-border bg-card p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--portal-accent)]/10 text-[var(--portal-accent)]">
            <TrendingUp className="h-8 w-8" />
          </div>
          <h2 className="mt-4 font-heading text-xl font-semibold text-foreground">Your portfolio is ready.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Your properties will appear here once your property manager links them to your CALQULUS account.
          </p>
          <p className="mx-auto mt-4 max-w-md text-xs text-muted-foreground">
            Share the email you signed in with so your manager can link your buildings.
          </p>
        </section>
      ) : null}

      {/* Privacy note */}
      <p className="mt-6 text-[11px] text-muted-foreground">
        Tenant names and personal details stay with your manager. You see building totals only.
      </p>
    </LandlordLayout>
  );
}