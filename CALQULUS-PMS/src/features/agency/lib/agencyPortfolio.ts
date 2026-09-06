import type { AgencyClientRow } from "@/features/agency/lib/useAgencyPortfolio";

/**
 * Agency identity: navy + white with amber used sparingly (status chips,
 * thin performance bars, small icon accents). Money is never green —
 * colour is reserved for status meaning.
 */

export type AgencyClientStatus = "active" | "pending" | "attention";

/**
 * Balances below this are floating-point / partial-payment rounding dust,
 * not real arrears — without a floor a client with a fractional leftover
 * balance would be permanently flagged "Attention".
 */
const ATTENTION_THRESHOLD = 1;

export function agencyClientStatus(client: Pick<AgencyClientRow, "pending" | "outstanding">): AgencyClientStatus {
  if (client.pending) return "pending";
  if (client.outstanding >= ATTENTION_THRESHOLD) return "attention";
  return "active";
}

export function agencyClientStatusLabel(status: AgencyClientStatus): string {
  switch (status) {
    case "attention":
      return "Attention";
    case "pending":
      return "Invitation pending";
    default:
      return "Active";
  }
}

/** Portal accent (cyan) = needs attention; neutral outline otherwise. */
export function agencyClientStatusChipClass(status: AgencyClientStatus): string {
  switch (status) {
    case "attention":
      return "bg-[var(--portal-accent-muted)] text-[var(--portal-accent)] border border-[var(--portal-accent-border)]";
    case "pending":
      return "bg-muted text-muted-foreground border border-border";
    default:
      return "bg-card text-muted-foreground border border-border";
  }
}

/** Chart + bar palette: navy for collected, warning hue for outstanding — never success green. */
export const AGENCY_TREND_COLORS = {
  collected: "hsl(var(--navy-mid))",
  outstanding: "hsl(var(--warning))",
} as const;

export function agencyCollectionRate(collected: number, outstanding: number): number {
  const denominator = collected + outstanding;
  return denominator > 0 ? Math.round((collected / denominator) * 100) : 0;
}

export interface AgencyAttentionItem {
  label: string;
  value: string;
  detail: string;
  href: string;
}

export interface AgencyAttentionInput {
  outstanding: number;
  overdueInvoices: number;
  expiringLeases: number;
  unlinkedCount: number;
  formatAmount: (amount: number) => string;
  hrefs: { billing: string; leases: string; clients: string };
}

/** Arrears first (operational pain), then lapsing leases, then unlinked buildings. */
export function buildAgencyAttentionItems(input: AgencyAttentionInput): AgencyAttentionItem[] {
  const items: AgencyAttentionItem[] = [];
  if (input.outstanding > 0) {
    items.push({
      label: "Arrears",
      value: input.formatAmount(input.outstanding),
      detail:
        input.overdueInvoices > 0
          ? `${input.overdueInvoices} overdue invoice${input.overdueInvoices === 1 ? "" : "s"}`
          : "Across partially paid invoices",
      href: input.hrefs.billing,
    });
  }
  if (input.expiringLeases > 0) {
    items.push({
      label: "Leases",
      value: `${input.expiringLeases} expiring`,
      detail: "Review before they lapse",
      href: input.hrefs.leases,
    });
  }
  if (input.unlinkedCount > 0) {
    items.push({
      label: "Unlinked buildings",
      value: `${input.unlinkedCount} without a client`,
      detail: "Link a landlord to the property",
      href: input.hrefs.clients,
    });
  }
  return items;
}

/** Client detail tab order: overview → portfolio → financial → maintenance → activity → documents. */
export const AGENCY_CLIENT_TABS = [
  "overview",
  "portfolio",
  "financial",
  "maintenance",
  "activity",
  "documents",
] as const;
export type AgencyClientTab = (typeof AGENCY_CLIENT_TABS)[number];
