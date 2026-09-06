import { StatCard } from "@/features/dashboard/components/StatCard";
import { AttentionStrip } from "@/features/dashboard/components/AttentionStrip";
import { PortfolioOperationsControlCenter } from "@/features/dashboard/components/PortfolioOperationsControlCenter";
import { OperationWorkQueue } from "@/features/dashboard/components/OperationWorkQueue";
import { ManagementAnalyticsPanel } from "@/features/dashboard/components/ManagementAnalyticsPanel";
import { ExecutivePortfolioIntelligence } from "@/features/dashboard/components/ExecutivePortfolioIntelligence";
import { PortfolioFinancialIntelligence } from "@/features/dashboard/components/PortfolioFinancialIntelligence";
import { FinancialCloseControlCenter } from "@/features/dashboard/components/FinancialCloseControlCenter";
import { OwnerPayoutSettlementCenter } from "@/features/dashboard/components/OwnerPayoutSettlementCenter";
import { PropertyRevenueLeaseOptimization } from "@/features/dashboard/components/PropertyRevenueLeaseOptimization";
import { RevenueLeakageIntelligence } from "@/features/dashboard/components/RevenueLeakageIntelligence";
import { CollectionsRecoveryAutomation } from "@/features/dashboard/components/CollectionsRecoveryAutomation";
import { CollectionsCommunicationsMonitoring } from "@/features/dashboard/components/CollectionsCommunicationsMonitoring";
import { TenantRetentionChurnIntelligence } from "@/features/dashboard/components/TenantRetentionChurnIntelligence";
import { TenantExperienceServiceQualityIntelligence } from "@/features/dashboard/components/TenantExperienceServiceQualityIntelligence";
import { TenantServiceRecoveryCenter } from "@/features/dashboard/components/TenantServiceRecoveryCenter";
import { DocumentEvidenceControlCenter } from "@/features/dashboard/components/DocumentEvidenceControlCenter";
import { FinancialOperationalReconciliationCenter } from "@/features/dashboard/components/FinancialOperationalReconciliationCenter";
import { FinancialAuditPackCenter } from "@/features/dashboard/components/FinancialAuditPackCenter";
import { ManagementComplianceAssuranceCenter } from "@/features/dashboard/components/ManagementComplianceAssuranceCenter";
import ControlledManagementReportingCenter from "@/features/dashboard/components/ControlledManagementReportingCenter";
import DoubleEntryLedgerIntegrityCenter from "@/features/dashboard/components/DoubleEntryLedgerIntegrityCenter";
import LedgerAdjustmentsReversalsGovernance from "@/features/dashboard/components/LedgerAdjustmentsReversalsGovernance";
import TrialBalanceFinancialStatementsCenter from "@/features/dashboard/components/TrialBalanceFinancialStatementsCenter";
import BudgetForecastVarianceCenter from "@/features/dashboard/components/BudgetForecastVarianceCenter";
import CashFlowTreasuryLiquidityCenter from "@/features/dashboard/components/CashFlowTreasuryLiquidityCenter";
import ExpenseCommitmentPayablesCenter from "@/features/dashboard/components/ExpenseCommitmentPayablesCenter";
import VendorProcurementContractControlCenter from "@/features/dashboard/components/VendorProcurementContractControlCenter";
import MaintenanceProcurementCostControlCenter from "@/features/dashboard/components/MaintenanceProcurementCostControlCenter";
import MaintenanceSlaVendorDispatchAssuranceCenter from "@/features/dashboard/components/MaintenanceSlaVendorDispatchAssuranceCenter";
import PreventiveMaintenanceLifecycleCenter from "@/features/dashboard/components/PreventiveMaintenanceLifecycleCenter";
import MaintenanceAssetLifecycleCenter from "@/features/dashboard/components/MaintenanceAssetLifecycleCenter";
import PropertySafetyRegulatoryRiskCenter from "@/features/dashboard/components/PropertySafetyRegulatoryRiskCenter";
import PropertyInspectionComplianceAssuranceCenter from "@/features/dashboard/components/PropertyInspectionComplianceAssuranceCenter";

import ManagerOperatingSummary from "@/features/manager/components/ManagerOperatingSummary";
import ManagerLayout from "@/features/manager/components/ManagerLayout";

import { ManagerQuickActions } from "@/features/dashboard/components/ManagerQuickActions";
import { ManagerActivationEmpty } from "@/features/dashboard/components/ManagerActivationEmpty";
import ManagerSubscriptionBanner from "@/features/payments/components/ManagerSubscriptionBanner";
import { ManagerBillingRecoveryBanner } from "@/features/payments/components/ManagerPlanStatus";
import { PaymentSetupStatus } from "@/features/settings/components/PaymentSetupStatus";
import { ArrearsHeatMap } from "@/features/dashboard/components/ArrearsHeatMap";
import { OpenMaintenancePreview } from "@/features/dashboard/components/OpenMaintenancePreview";
import { UpcomingPayments } from "@/features/dashboard/components/UpcomingPayments";
import { PropertiesOverview } from "@/features/dashboard/components/PropertiesOverview";
import {
  Home, RefreshCw, DollarSign, Building2, DoorOpen, Plus, BarChart3,
} from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthContext";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Button } from "@/shared/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { useNavigate } from "react-router-dom";
import { ErrorBoundary } from "@/shared/components/ErrorBoundary";
import { ErrorState } from "@/shared/components/ui/error-state";
import { useLeaseExpiryReminders } from "@/shared/hooks/useLeaseExpiryReminders";
import { useManagerActivation } from "@/features/dashboard/hooks/useManagerActivation";
import { DashboardSectionHeader } from "@/features/dashboard/components/DashboardSectionHeader";
import { fetchManagerDashboardStats } from "@/features/dashboard/lib/dashboardStats";
import { buildAttentionItems } from "@/features/dashboard/lib/attentionItems";
import { queryKeys, STALE_TIMES } from "@/shared/hooks/useOptimizedQuery";
import managerHeroImage from "@/assets/marketing/property-residential-thumb.webp";

const RevenueChart = lazy(() =>
  import("@/features/dashboard/components/RevenueChart").then((m) => ({ default: m.RevenueChart })),
);
const OccupancyChart = lazy(() =>
  import("@/features/dashboard/components/OccupancyChart").then((m) => ({ default: m.OccupancyChart })),
);
const RecentActivity = lazy(() =>
  import("@/features/dashboard/components/RecentActivity").then((m) => ({ default: m.RecentActivity })),
);

const ChartFallback = () => <Skeleton className="h-72 w-full rounded-xl" />;
const ActivityFallback = () => <Skeleton className="h-64 w-full rounded-xl" />;

const Dashboard = () => {
  const { user } = useAuth();
  const { managerId, restrictToAssignedProperties, assignedPropertyIds } = useManagerScope();
  const assignedKey = assignedPropertyIds.join(",");
  useLeaseExpiryReminders();
  const { isEmptyPortfolio, progress } = useManagerActivation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { currency, setCurrency, currencies, formatCurrency } = useCurrency();

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const userId = user?.id;
  const statsScope = useMemo(
    () => ({
      restrictToAssignedProperties,
      assignedPropertyIds,
    }),
    [restrictToAssignedProperties, assignedPropertyIds],
  );

  const {
    data: stats = null,
    isPending: loading,
    isError: statsError,
  } = useQuery({
    queryKey: [...queryKeys.dashboard.stats(managerId ?? ""), assignedKey],
    queryFn: () => fetchManagerDashboardStats(managerId!, statsScope),
    enabled: !!managerId,
    staleTime: STALE_TIMES.frequentlyChanging,
    gcTime: 5 * 60 * 1000,
  });

  const { data: profile } = useQuery({
    queryKey: queryKeys.profile.detail(userId ?? ""),
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle();
      return data;
    },
    enabled: !!userId,
    staleTime: STALE_TIMES.profile,
  });

  const userName = profile?.full_name?.split(" ")[0] || "there";
  const [activeDeskTab, setActiveDeskTab] = useState<"overview" | "collections" | "occupancy" | "operations" | "controls">("overview");
  const deskTabs = [
    { id: "overview" as const, label: "Command center", hint: "Today's priorities" },
    { id: "collections" as const, label: "Collections", hint: "Cash and arrears" },
    { id: "occupancy" as const, label: "Portfolio", hint: "Properties and occupancy" },
    { id: "operations" as const, label: "Operations", hint: "Maintenance and service" },
    { id: "controls" as const, label: "Controls", hint: "Finance and governance" },
  ];
  const attentionItems = useMemo(
    () => (stats ? buildAttentionItems(stats, formatCurrency) : []),
    [stats, formatCurrency],
  );

  const refreshStats = () => {
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const realtimeRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!managerId) return;
    const invalidate = () => {
      if (realtimeRefreshTimer.current) return;
      realtimeRefreshTimer.current = setTimeout(() => {
        realtimeRefreshTimer.current = null;
        void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      }, 300);
    };
    const channels = [
      supabase.channel("dash-tenants").on("postgres_changes", { event: "*", schema: "public", table: "tenants" }, invalidate).subscribe(),
      supabase.channel("dash-leases").on("postgres_changes", { event: "*", schema: "public", table: "leases" }, invalidate).subscribe(),
      supabase.channel("dash-invoices").on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, invalidate).subscribe(),
      supabase.channel("dash-properties").on("postgres_changes", { event: "*", schema: "public", table: "properties" }, invalidate).subscribe(),
      supabase.channel("dash-maint").on("postgres_changes", { event: "*", schema: "public", table: "maintenance_requests" }, invalidate).subscribe(),
      supabase.channel("dash-refunds").on("postgres_changes", { event: "*", schema: "public", table: "deposit_refunds" }, invalidate).subscribe(),
    ];
    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
      if (realtimeRefreshTimer.current) {
        clearTimeout(realtimeRefreshTimer.current);
        realtimeRefreshTimer.current = null;
      }
    };
  }, [managerId, queryClient]);

  return (
    <ManagerLayout
      title="Dashboard"
      subtitle="Portfolio overview and today's operational priorities."
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost" size="sm"
            onClick={refreshStats}
            className="min-h-11 min-w-11 h-11 w-11 text-muted-foreground hover:text-foreground"
            title="Refresh operational stats"
            aria-label="Refresh operational stats"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="w-[120px] h-9 text-sm" aria-label="Currency">
              <SelectValue placeholder="Currency" />
            </SelectTrigger>
            <SelectContent>
              {currencies.map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.symbol} {c.code}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      <ManagerOperatingSummary />
      {!isEmptyPortfolio && <PaymentSetupStatus />}
      <ManagerSubscriptionBanner compact />
      <ManagerBillingRecoveryBanner />

      {user?.email?.includes("@calqulusrms.com") && (
        <div className="mb-4 rounded-xl border border-warning/30 bg-warning/10 px-4 py-2.5 flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-warning animate-pulse-soft flex-shrink-0" />
          <span className="text-xs text-warning font-medium">
            <strong>Demo mode</strong> — browsing sample property data. Changes won't persist.
          </span>
        </div>
      )}

      {/* Greeting / context hero — compact, with restrained property imagery */}
      <section
        aria-label="Portfolio overview"
        className="relative mb-6 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_8px_28px_-22px_rgb(13_39_68/0.28)]"
      >
        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="min-w-0">
            <p className="meta-text mb-1 uppercase tracking-wider text-muted-foreground">
              Portfolio overview
            </p>
            <h1 className="font-heading text-2xl font-semibold tracking-[-0.025em] text-foreground sm:text-[2rem]">
              {getGreeting()}, <span className="capitalize">{userName}</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isEmptyPortfolio
                ? `Portfolio setup ${progress.percent}% complete`
                : stats
                  ? `${stats.totalProperties} properties · ${stats.occupiedUnits}/${stats.totalUnits} units occupied`
                  : "A snapshot of how your portfolio is performing today."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              className="min-h-11"
              onClick={() => navigate("/properties")}
              aria-label="Add property"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add property</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={() => navigate("/reports")}
              aria-label="View reports"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">View reports</span>
            </Button>
          </div>
        </div>
        {/* Subtle photographic veil — restrained, preserves readability */}
        <div className="pointer-events-none absolute inset-y-0 right-0 -z-0 hidden h-full w-72 lg:block" aria-hidden>
          <img
            src={managerHeroImage}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover opacity-[0.16]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-card via-card/85 to-card/10" />
        </div>
      </section>

      {statsError && !loading && (
        <div className="mb-5">
          <ErrorState
            title="Couldn't load dashboard metrics"
            message="A connection issue prevented loading your latest stats."
            onRetry={refreshStats}
          />
        </div>
      )}

      {isEmptyPortfolio && !loading ? (
        <ManagerActivationEmpty />
      ) : (
        <>
          {/* Portfolio setup nudge — only while onboarding is incomplete; folded in here rather
              than as a permanent section so a fully set-up manager never sees it again. */}
          {!progress.isComplete && (
            <section className="mb-6">
              <ManagerQuickActions includeSetup includeShortcuts={false} />
            </section>
          )}

          {/* Executive KPI row — one unified metric system */}
          <section className="mb-6 min-w-0" aria-labelledby="dashboard-kpi">
            <DashboardSectionHeader
              id="dashboard-kpi"
              eyebrow="At a glance"
              title="Portfolio"
              description="Properties, units, occupancy, and collections from live records"
            />
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              {loading || !stats
                ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[5.5rem] rounded-xl" />)
                : (
                  <>
                    <div id="dashboard-properties">
                    <StatCard
                      compact
                      title="Properties"
                      value={String(stats.totalProperties)}
                      change={stats.activeLeases > 0 ? `${stats.activeLeases} active leases` : undefined}
                      changeType="neutral"
                      icon={Building2}
                      iconColor="primary"
                    />
                    </div>
                    <div id="dashboard-units">
                    <StatCard
                      compact
                      title="Units"
                      value={String(stats.totalUnits)}
                      change={`${stats.occupiedUnits} occupied · ${stats.vacantUnits} vacant`}
                      changeType="neutral"
                      icon={DoorOpen}
                      iconColor="primary"
                    />
                    </div>
                    <div id="dashboard-collections">
                    <StatCard
                      compact
                      title="Collections"
                      value={formatCurrency(stats.collectedRent)}
                      change={stats.revenueChange !== 0 ? `${stats.revenueChange > 0 ? "+" : ""}${stats.revenueChange}% vs last month` : "Same as last month"}
                      changeType={stats.revenueChange > 0 ? "positive" : stats.revenueChange < 0 ? "negative" : "neutral"}
                      icon={DollarSign}
                      iconColor="primary"
                    />
                    </div>
                    <div id="dashboard-occupancy">
                    <StatCard
                      compact
                      title="Occupancy"
                      value={`${stats.occupancyRate}%`}
                      changeType={stats.occupancyRate >= 90 ? "positive" : stats.occupancyRate >= 70 ? "neutral" : "negative"}
                      icon={Home}
                      iconColor={stats.occupancyRate >= 70 ? "success" : "destructive"}
                      progressValue={stats.occupancyRate}
                    />
                    </div>
                  </>
                )}
            </div>
          </section>

          {stats && (
            <section className="mb-6" aria-labelledby="dashboard-collections-pulse">
              <DashboardSectionHeader
                id="dashboard-collections-pulse"
                eyebrow="Collections pulse"
                title="Know what needs collecting"
                description="A compact view of this month's rent position before you open the billing queue"
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border bg-card p-4 card-shadow">
                  <p className="text-xs font-medium text-muted-foreground">Collected</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{formatCurrency(stats.collectedRent)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">of {formatCurrency(stats.expectedRent)} expected</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 card-shadow">
                  <p className="text-xs font-medium text-muted-foreground">Outstanding</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{formatCurrency(stats.outstandingRent)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stats.overdueInvoices > 0
                      ? `${stats.overdueInvoices} overdue invoice${stats.overdueInvoices === 1 ? "" : "s"}`
                      : stats.outstandingRent > 0
                        ? "Across partially paid invoices"
                        : "No invoices overdue"}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 card-shadow">
                  <p className="text-xs font-medium text-muted-foreground">Collection rate</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{stats.collectionRate}%</p>
                  <p className={stats.revenueChange < 0 ? "mt-1 text-xs text-destructive" : "mt-1 text-xs text-muted-foreground"}>
                    {stats.revenueChange > 0 ? "+" : ""}{stats.revenueChange}% vs last month
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Manager operations desk: keep the existing live intelligence, but reveal it through
              a small number of deliberate workspaces instead of one uninterrupted dashboard. */}
          <section className="mb-6 rounded-2xl border border-border bg-card p-2 shadow-[0_8px_28px_-22px_rgb(13_39_68/0.28)]" aria-label="Manager operations workspaces">
            <div className="flex flex-col gap-2 border-b border-border px-2 pb-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="px-2 py-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Operations desk</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">Move from signal to action without losing portfolio context.</p>
              </div>
              <div className="grid grid-cols-2 gap-1 sm:flex sm:flex-wrap" role="tablist" aria-label="Manager dashboard workspaces">
                {deskTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeDeskTab === tab.id}
                    onClick={() => setActiveDeskTab(tab.id)}
                    className={activeDeskTab === tab.id
                      ? "rounded-lg bg-primary px-3 py-2 text-left text-primary-foreground shadow-sm sm:min-w-[8.5rem]"
                      : "rounded-lg px-3 py-2 text-left text-muted-foreground hover:bg-muted/60 hover:text-foreground sm:min-w-[8.5rem]"}
                  >
                    <span className="block text-xs font-semibold">{tab.label}</span>
                    <span className={activeDeskTab === tab.id ? "block text-[10px] opacity-80" : "block text-[10px] opacity-70"}>{tab.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-2 pt-4">
              {activeDeskTab === "overview" && (
                <div className="space-y-5">
                  <PortfolioOperationsControlCenter stats={stats} loading={loading} />
                  <section aria-labelledby="dashboard-attention-inline">
                    <DashboardSectionHeader id="dashboard-attention-inline" eyebrow="Action queue" title="Needs attention" description="The exceptions most likely to affect cash, occupancy, leases or service." />
                    <AttentionStrip items={attentionItems} loading={loading} />
                  </section>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <section className="min-w-0 lg:col-span-2" aria-labelledby="dashboard-collections-overview">
                      <DashboardSectionHeader id="dashboard-collections-overview" eyebrow="Cash flow" title="Collections performance" description="Collected versus expected rent and outstanding balances." />
                      <ErrorBoundary compact label="Revenue chart"><Suspense fallback={<ChartFallback />}><RevenueChart /></Suspense></ErrorBoundary>
                    </section>
                    <section className="min-w-0" aria-labelledby="dashboard-maintenance-overview">
                      <DashboardSectionHeader id="dashboard-maintenance-overview" eyebrow="Operations" title="Maintenance" description={stats ? `${stats.openMaintenanceCount} open · ${stats.urgentMaintenanceCount} urgent` : "Open work orders"} />
                      <OpenMaintenancePreview />
                    </section>
                  </div>
                </div>
              )}

              {activeDeskTab === "collections" && (
                <div className="space-y-5">
                  {stats && (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-success/20 bg-success/[0.035] p-4"><p className="text-xs font-medium text-muted-foreground">Collected</p><p className="mt-1 text-xl font-semibold">{formatCurrency(stats.collectedRent)}</p><p className="mt-1 text-xs text-muted-foreground">of {formatCurrency(stats.expectedRent)} expected</p></div>
                      <div className="rounded-xl border border-destructive/20 bg-destructive/[0.035] p-4"><p className="text-xs font-medium text-muted-foreground">Outstanding</p><p className="mt-1 text-xl font-semibold">{formatCurrency(stats.outstandingRent)}</p><p className="mt-1 text-xs text-muted-foreground">{stats.overdueInvoices} overdue invoice{stats.overdueInvoices === 1 ? "" : "s"}</p></div>
                      <div className="rounded-xl border border-primary/20 bg-primary/[0.035] p-4"><p className="text-xs font-medium text-muted-foreground">Collection rate</p><p className="mt-1 text-xl font-semibold">{stats.collectionRate}%</p><p className="mt-1 text-xs text-muted-foreground">{stats.revenueChange > 0 ? "+" : ""}{stats.revenueChange}% vs last month</p></div>
                    </div>
                  )}
                  <div className="grid gap-4 lg:grid-cols-2">
                    <ErrorBoundary compact label="Revenue chart"><Suspense fallback={<ChartFallback />}><RevenueChart /></Suspense></ErrorBoundary>
                    <ArrearsHeatMap />
                  </div>
                  <PortfolioFinancialIntelligence />
                  <CollectionsRecoveryAutomation />
                  <CollectionsCommunicationsMonitoring />
                  <FinancialOperationalReconciliationCenter />
                </div>
              )}

              {activeDeskTab === "occupancy" && (
                <div className="space-y-5">
                  <div className="grid gap-4 lg:grid-cols-3">
                    <section className="min-w-0 lg:col-span-2"><DashboardSectionHeader eyebrow="Portfolio" title="Property performance" description="See occupancy and operational pressure property by property." /><PropertiesOverview showHeader={false} /></section>
                    <section className="min-w-0"><DashboardSectionHeader eyebrow="Occupancy" title="Portfolio occupancy" description="Occupied versus vacant units." /><ErrorBoundary compact label="Occupancy chart"><Suspense fallback={<ChartFallback />}><OccupancyChart /></Suspense></ErrorBoundary></section>
                  </div>
                  <ExecutivePortfolioIntelligence />
                  <PropertyRevenueLeaseOptimization />
                  <TenantRetentionChurnIntelligence />
                  <TenantExperienceServiceQualityIntelligence />
                </div>
              )}

              {activeDeskTab === "operations" && (
                <div className="space-y-5">
                  <OperationWorkQueue />
                  <div className="grid gap-4 lg:grid-cols-2">
                    <TenantServiceRecoveryCenter />
                    <DocumentEvidenceControlCenter />
                  </div>
                  <MaintenanceProcurementCostControlCenter />
                  <MaintenanceSlaVendorDispatchAssuranceCenter />
                  <PreventiveMaintenanceLifecycleCenter />
                  <MaintenanceAssetLifecycleCenter />
                  <PropertySafetyRegulatoryRiskCenter />
                  <PropertyInspectionComplianceAssuranceCenter />
                </div>
              )}

              {activeDeskTab === "controls" && (
                <div className="space-y-5">
                  <ManagementAnalyticsPanel />
                  <ManagementComplianceAssuranceCenter />
                  <ControlledManagementReportingCenter />
                  <div className="grid gap-4 lg:grid-cols-2">
                    <FinancialCloseControlCenter />
                    <OwnerPayoutSettlementCenter />
                  </div>
                  <DoubleEntryLedgerIntegrityCenter />
                  <LedgerAdjustmentsReversalsGovernance />
                  <TrialBalanceFinancialStatementsCenter />
                  <BudgetForecastVarianceCenter />
                  <CashFlowTreasuryLiquidityCenter />
                  <ExpenseCommitmentPayablesCenter />
                  <VendorProcurementContractControlCenter />
                  <FinancialAuditPackCenter />
                  <RevenueLeakageIntelligence />
                </div>
              )}
            </div>
          </section>

          {activeDeskTab === "overview" && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <section className="min-w-0" aria-labelledby="dashboard-activity">
                <DashboardSectionHeader eyebrow="Timeline" id="dashboard-activity" title="Recent activity" description="Latest tenant, lease and payment events." />
                <ErrorBoundary compact label="Recent activity"><Suspense fallback={<ActivityFallback />}><RecentActivity showHeader={false} /></Suspense></ErrorBoundary>
              </section>
              <section className="min-w-0" aria-labelledby="dashboard-upcoming">
                <DashboardSectionHeader eyebrow="Next up" id="dashboard-upcoming" title="Upcoming actions" description="Pending and overdue invoices from live billing." />
                <UpcomingPayments showHeader={false} />
              </section>
            </div>
          )}
        </>
      )}
    </ManagerLayout>
  );
};

export default Dashboard;
