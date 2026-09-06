import { FileText } from "lucide-react";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { formatDate } from "@/shared/lib/dateFormat";
import { leaseStatusTone, statusBadgeClass } from "@/shared/lib/statusBadge";
import { useCurrency } from "@/shared/hooks/useCurrency";

export interface TenantLease {
  id: string;
  property: string;
  unit: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  deposit: number | null;
  status: string;
  /** Computed by the caller from real end_date data — this component never
   * calls Date.now() itself so it stays a pure render of whatever it's given. */
  expiringSoon: boolean;
}

interface TenantLeaseTabProps {
  leases: TenantLease[];
}

/** Real lease records for this tenant only — no invented data, no synthetic rows. */
export function TenantLeaseTab({ leases }: TenantLeaseTabProps) {
  const { formatCurrency } = useCurrency();

  if (leases.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No lease on record"
        description="This tenant has no lease agreement yet."
      />
    );
  }

  return (
    <div className="space-y-3">
      {leases.map((lease) => {
        const expiringSoon = lease.expiringSoon;
        return (
          <div key={lease.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-foreground">{lease.property}</p>
                <p className="text-xs text-muted-foreground">{lease.unit}</p>
              </div>
              <div className="flex items-center gap-2">
                {expiringSoon && (
                  <span className={statusBadgeClass("warning")}>Expiring soon</span>
                )}
                <span className={statusBadgeClass(leaseStatusTone(lease.status))}>{lease.status}</span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Start</p>
                <p className="font-medium text-foreground">{formatDate(lease.start_date)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Expiry</p>
                <p className="font-medium text-foreground">{formatDate(lease.end_date)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rent</p>
                <p className="font-medium text-foreground">{formatCurrency(lease.monthly_rent)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Deposit</p>
                <p className="font-medium text-foreground">
                  {lease.deposit ? formatCurrency(lease.deposit) : "—"}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
