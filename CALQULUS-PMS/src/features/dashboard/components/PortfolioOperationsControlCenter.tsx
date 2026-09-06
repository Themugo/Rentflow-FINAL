import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CheckCircle2, CreditCard, Home, Wrench, FileClock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import type { ManagerDashboardStats } from "@/features/dashboard/lib/dashboardStats";
import { useCurrency } from "@/shared/hooks/useCurrency";

type Props = { stats: ManagerDashboardStats | null; loading?: boolean };
type PaymentExceptions = { stale_pending?: unknown[]; allocation_mismatches?: unknown[]; receipt_recovery?: unknown[]; failed_24h?: unknown[] };

export function PortfolioOperationsControlCenter({ stats, loading = false }: Props) {
  const navigate = useNavigate();
  const { formatCurrency } = useCurrency();
  const { data: payments } = useQuery({
    queryKey: ["payment-exception-control-center", "dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_payment_exception_control_center" as any);
      if (error) throw error;
      return (data ?? {}) as PaymentExceptions;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  if (loading || !stats) return <div className="h-40 rounded-xl border border-border bg-card animate-pulse" aria-busy="true" />;

  const paymentCount = Object.values(payments ?? {}).reduce((n, rows) => n + (Array.isArray(rows) ? rows.length : 0), 0);
  // Collections can't rely on count alone: arrearsTotal can be > 0 (money owed
  // on partially paid invoices) even when overdueInvoices is 0, so gate on
  // both — otherwise pure-partial-payment arrears would silently vanish from
  // this control center even though the same money shows up in the KPI above.
  const arrearsActive = stats.overdueInvoices > 0 || stats.arrearsTotal > 0;
  const items = [
    { id: "arrears", label: "Collections", count: stats.overdueInvoices, detail: `${formatCurrency(stats.arrearsTotal)} overdue`, href: "/billing?filter=overdue", icon: CreditCard, tone: arrearsActive ? "danger" : "clear", active: arrearsActive },
    { id: "maintenance", label: "Maintenance", count: stats.openMaintenanceCount, detail: `${stats.urgentMaintenanceCount} urgent`, href: "/maintenance", icon: Wrench, tone: stats.urgentMaintenanceCount ? "danger" : stats.openMaintenanceCount ? "warning" : "clear", active: stats.openMaintenanceCount > 0 },
    { id: "leases", label: "Lease renewals", count: stats.expiringLeases, detail: "Expiring within 30 days", href: "/leases", icon: FileClock, tone: stats.expiringLeases ? "warning" : "clear", active: stats.expiringLeases > 0 },
    { id: "vacancy", label: "Vacancies", count: stats.vacantUnits, detail: `${stats.totalUnits} total units`, href: "/properties", icon: Home, tone: stats.vacantUnits ? "info" : "clear", active: stats.vacantUnits > 0 },
    { id: "payments", label: "Payment exceptions", count: paymentCount, detail: "Reconciliation or recovery needed", href: "/billing", icon: AlertTriangle, tone: paymentCount ? "danger" : "clear", active: paymentCount > 0 },
  ] as const;
  const active = items.filter((item) => item.active);

  return <Card className="border-border/80 shadow-[0_8px_28px_-22px_rgb(13_39_68/0.28)]">
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between gap-3">
        <div><CardTitle className="text-base">Portfolio operations control</CardTitle><p className="mt-1 text-xs text-muted-foreground">One queue for the issues that can affect cash, occupancy, leases or service.</p></div>
        <Badge variant={active.length ? "destructive" : "outline"}>{active.length} active</Badge>
      </div>
    </CardHeader>
    <CardContent>
      {active.length === 0 ? <div className="flex items-center gap-3 rounded-lg border border-success/20 bg-success/[0.035] px-4 py-3"><CheckCircle2 className="h-5 w-5 text-success" /><div><p className="text-sm font-semibold">Portfolio is operationally clear</p><p className="text-xs text-muted-foreground">No current collections, maintenance, lease, vacancy or payment exceptions are visible.</p></div></div> :
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{items.map((item) => { const Icon = item.icon; const activeItem = item.active; return <div key={item.id} className="rounded-lg border border-border p-3"><div className="flex items-center gap-2"><Icon className="h-4 w-4" /><span className="text-sm font-semibold">{item.label}</span><span className="ml-auto text-lg font-bold">{item.count}</span></div><p className="mt-1 text-xs text-muted-foreground">{item.detail}</p><Button variant="ghost" size="sm" className="mt-2 h-8 px-1 text-xs" disabled={!activeItem} onClick={() => navigate(item.href)}>{activeItem ? "Open" : "Clear"}<ArrowRight className="ml-1 h-3 w-3" /></Button></div>; })}</div>}
    </CardContent>
  </Card>;
}
