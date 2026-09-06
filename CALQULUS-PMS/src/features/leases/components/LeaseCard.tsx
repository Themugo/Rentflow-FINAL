import { Card, CardContent } from "@/shared/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Calendar, Wallet, Paperclip, CheckCircle2, Clock, AlertTriangle, XCircle } from "lucide-react";
import { formatDate } from "@/shared/lib/dateFormat";
import { leaseStatusTone, statusBadgeClass } from "@/shared/lib/statusBadge";
import { cn } from "@/shared/lib/utils";

type LeaseStatus = "active" | "expiring" | "expired" | "pending" | "terminated";

interface Tenant {
  id: string;
  name: string;
  email: string;
  photo_url: string | null;
}

interface Lease {
  id: string;
  tenant_id: string | null;
  property_id: string | null;
  unit_id?: string | null;
  property: string;
  unit: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  deposit: number | null;
  status: LeaseStatus;
  document_url: string | null;
  tenants: Tenant | null;
}

interface LeaseCardProps {
  lease: Lease;
  isSelected: boolean;
  formatCurrency: (amount: number) => string;
  /** Computed by the parent from real end_date data — no date math in here. */
  expiringSoon?: boolean;
  onSelect: () => void;
  onView: () => void;
}

const statusIcons: Record<LeaseStatus, React.ReactNode> = {
  active: <CheckCircle2 className="h-3 w-3" />,
  expiring: <Clock className="h-3 w-3" />,
  expired: <XCircle className="h-3 w-3" />,
  pending: <Clock className="h-3 w-3" />,
  terminated: <AlertTriangle className="h-3 w-3" />,
};

export const LeaseCard = ({ lease, isSelected, formatCurrency, expiringSoon, onSelect, onView }: LeaseCardProps) => {
  return (
    <Card
      className={cn(
        "group cursor-pointer transition-all duration-200 active:scale-[0.98] hover:border-primary/40 bg-card border-border",
        isSelected && "ring-2 ring-primary border-primary/60"
      )}
      onClick={onView}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2 sm:gap-3 mb-2 sm:mb-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelect}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Select lease for ${lease.tenants?.name}`}
              className="flex-shrink-0 h-5 w-5"
            />
            <Avatar className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
              <AvatarImage src={lease.tenants?.photo_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs sm:text-sm font-medium">
                {lease.tenants?.name?.split(" ").map((n) => n[0]).join("") || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                {expiringSoon ? (
                  <span className={cn(statusBadgeClass("warning"), "flex-shrink-0")}>
                    <Clock className="h-3 w-3" />
                    Expiring soon
                  </span>
                ) : (
                  <span className={cn(statusBadgeClass(leaseStatusTone(lease.status)), "flex-shrink-0")}>
                    {statusIcons[lease.status]}
                    <span className="capitalize">{lease.status}</span>
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-sm sm:text-base text-foreground truncate group-hover:text-primary transition-colors">
                {lease.tenants?.name || "No Tenant"}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                {lease.property} · {lease.unit}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 sm:pt-3 border-t border-border">
          <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm">
            <div className="flex items-center gap-1 sm:gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Expires {formatDate(lease.end_date)}</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5">
              <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
              <span className="font-semibold text-foreground">{formatCurrency(lease.monthly_rent)}</span>
            </div>
          </div>
          {lease.document_url && (
            <div className="flex items-center gap-1 text-success">
              <Paperclip className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
