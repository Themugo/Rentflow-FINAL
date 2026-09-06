import type { ManagerDashboardStats } from "@/features/dashboard/lib/dashboardStats";

export type AttentionTone = "danger" | "warning" | "info";

export interface AttentionItem {
  id: string;
  label: string;
  detail: string;
  href: string;
  cta: string;
  tone: AttentionTone;
  count: number;
}

const TONE_RANK: Record<AttentionTone, number> = {
  danger: 0,
  warning: 1,
  info: 2,
};

/**
 * Build the manager attention queue from live stats.
 * Zero-count items are omitted so the list only answers "what needs me now".
 */
export function buildAttentionItems(
  stats: ManagerDashboardStats,
  formatCurrency: (value: number) => string,
): AttentionItem[] {
  const items: AttentionItem[] = [];

  // arrearsTotal can be > 0 even when overdueInvoices is 0 — a partially
  // paid invoice keeps a real balance_due while its status moves off
  // "overdue", so the card must still surface pure-partial-payment arrears.
  if (stats.overdueInvoices > 0 || stats.arrearsTotal > 0) {
    const invoiceCountLabel =
      stats.overdueInvoices > 0
        ? `${stats.overdueInvoices} invoice${stats.overdueInvoices === 1 ? "" : "s"} · `
        : "";
    items.push({
      id: "overdue",
      label: "Overdue invoices",
      detail: `${invoiceCountLabel}${formatCurrency(stats.arrearsTotal)} outstanding`,
      href: "/billing?filter=overdue",
      cta: "Collect",
      tone: "danger",
      count: stats.overdueInvoices,
    });
  }

  if (stats.urgentMaintenanceCount > 0) {
    items.push({
      id: "urgent-maintenance",
      label: "Urgent repairs",
      detail: `${stats.urgentMaintenanceCount} high-priority work order${stats.urgentMaintenanceCount === 1 ? "" : "s"} still open`,
      href: "/maintenance",
      cta: "Triage",
      tone: "danger",
      count: stats.urgentMaintenanceCount,
    });
  }

  if (stats.pendingDepositRefundsCount > 0) {
    items.push({
      id: "refunds",
      label: "Deposit refunds",
      detail: `${stats.pendingDepositRefundsCount} pending approval`,
      href: "/tenants",
      cta: "Review",
      tone: "warning",
      count: stats.pendingDepositRefundsCount,
    });
  }

  if (stats.expiringLeases > 0) {
    items.push({
      id: "expiring-leases",
      label: "Leases expiring in 30 days",
      detail: `${stats.expiringLeases} active lease${stats.expiringLeases === 1 ? "" : "s"} due for renewal or notice`,
      href: "/leases",
      cta: "Review",
      tone: "warning",
      count: stats.expiringLeases,
    });
  }

  if (stats.openMaintenanceCount > stats.urgentMaintenanceCount) {
    const other = stats.openMaintenanceCount - stats.urgentMaintenanceCount;
    items.push({
      id: "open-maintenance",
      label: "Open maintenance",
      detail: `${other} additional open request${other === 1 ? "" : "s"}`,
      href: "/maintenance",
      cta: "Work orders",
      tone: "warning",
      count: other,
    });
  }

  if (stats.vacantUnits > 0) {
    items.push({
      id: "vacant",
      label: "Vacant units",
      detail: `${stats.vacantUnits} of ${stats.totalUnits} units empty`,
      href: "/properties",
      cta: "Fill",
      tone: "info",
      count: stats.vacantUnits,
    });
  }

  return items.sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone] || b.count - a.count);
}
