/**
 * BillingStatsBar.tsx
 *
 * The four stat cards at the top of the Invoices tab.
 * Extracted from Billing.tsx (was inline JSX in the component body).
 *
 * Phase 4 redesign: trustworthy Navy/Blue palette.
 * Color communicates volume/progress, not emotion. Green/Red reserved
 * for status badges only — stat cards use blue intensity to signal
 * priority (Billed → Collected → Outstanding → Overdue).
 */

import { useCurrency } from "@/shared/hooks/useCurrency";
import { roundMoney, invoiceOwedMinor, fromMinorUnits } from "@/shared/lib/money";
import type { BillingInvoice } from "../hooks/useBillingData";

import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";

interface Props {
  invoices: BillingInvoice[];
  isLoading?: boolean;
}

export function BillingStatsBar({ invoices, isLoading = false }: Props) {
  const { formatCurrency } = useCurrency();

  const live = invoices.filter(i => i.status !== "cancelled" && i.status !== "refunded");
  const unpaid = live.filter(i => i.status !== "paid");
  const overdueInvoices = invoices.filter(i => i.status === "overdue");

  const stats = {
    billed:      roundMoney(live.reduce((s, i) => s + Number(i.original_amount ?? i.amount ?? 0), 0)),
    collected:   roundMoney(invoices.reduce((s, i) => s + Number(i.paid_amount ?? (i.status === "paid" ? i.amount : 0) ?? 0), 0)),
    outstanding: fromMinorUnits(unpaid.reduce((s, i) => s + invoiceOwedMinor(i), 0)),
    overdue:     fromMinorUnits(overdueInvoices.reduce((s, i) => s + invoiceOwedMinor(i), 0)),
  };

  const totalBilled = stats.billed || 1;
  const collectedPct = Math.round((stats.collected / totalBilled) * 100);

  const cards = [
    {
      label: "Billed",
      value: stats.billed,
      icon: FileText,
      accent: "bg-[hsl(214_73%_48%/0.08)]",
      iconColor: "text-[hsl(214_73%_48%)]",
      valueColor: "text-[hsl(222_47%_11%)]",
      hint: "Total invoiced this period",
      bar: null as null | number,
    },
    {
      label: "Collected",
      value: stats.collected,
      icon: CheckCircle2,
      accent: "bg-[hsl(214_73%_48%/0.06)]",
      iconColor: "text-[hsl(214_73%_48%)]",
      valueColor: "text-[hsl(214_73%_48%)]",
      hint: "Received to date",
      bar: collectedPct,
    },
    {
      label: "Outstanding",
      value: stats.outstanding,
      icon: Clock,
      accent: "bg-[hsl(215_20%_45%/0.06)]",
      iconColor: "text-[hsl(215_20%_45%)]",
      valueColor: "text-[hsl(222_47%_11%)]",
      hint: "Remaining balance owed",
      bar: null,
    },
    {
      label: "Overdue",
      value: stats.overdue,
      icon: AlertTriangle,
      accent: "bg-[hsl(215_20%_45%/0.06)]",
      iconColor: "text-[hsl(215_20%_45%)]",
      valueColor: stats.overdue > 0 ? "text-[hsl(222_47%_11%)]" : "text-muted-foreground",
      hint: "Past due invoices",
      bar: null,
    },
  ] as const;

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-3 sm:p-4 card-shadow">
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-7 w-32" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
      {cards.map(({ label, value, icon: Icon, accent, iconColor, valueColor, hint, bar }) => (
        <div
          key={label}
          className="rounded-xl border border-border bg-card p-3 sm:p-4 card-shadow group hover:border-[hsl(214_73%_48%/0.2)] transition-colors"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`rounded-lg p-1.5 ${accent}`}>
              <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
            </div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
          </div>
          <p className={`font-heading text-lg sm:text-2xl font-bold truncate ${valueColor}`}>
            {formatCurrency(value)}
          </p>
          {bar !== null && bar > 0 && (
            <div className="mt-2">
              <div className="h-1.5 w-full bg-[hsl(215_20%_95%)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[hsl(214_73%_48%)] rounded-full transition-all"
                  style={{ width: `${Math.min(bar, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{bar}% collected</p>
            </div>
          )}
          {bar === null && (
            <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>
          )}
        </div>
      ))}
    </div>
  );
}
