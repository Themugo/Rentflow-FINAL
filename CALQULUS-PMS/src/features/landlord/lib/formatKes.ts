import { formatCurrency } from "@/shared/lib/formatCurrency";

export function formatKes(amount: number): string {
  return formatCurrency(amount, "KES", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function occupancyBarClass(pct: number): string {
  if (pct >= 90) return "bg-success";
  if (pct >= 70) return "bg-primary";
  if (pct >= 50) return "bg-warning";
  return "bg-destructive";
}
