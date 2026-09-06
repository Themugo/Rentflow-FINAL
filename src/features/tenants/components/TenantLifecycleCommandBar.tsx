import { AlertTriangle, CalendarClock, CheckCircle2, CircleDollarSign, Home, KeyRound, UserRoundCheck } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { statusBadgeClass, type StatusTone } from "@/shared/lib/statusBadge";

interface TenantLifecycleCommandBarProps {
  tenant: {
    status: string;
    property: string | null;
    unit: string | null;
    monthly_rent: number | null;
    move_in_date: string | null;
  };
  lease?: {
    start_date: string;
    end_date: string;
    monthly_rent: number;
    status: string;
  } | null;
  balance: number;
  expiringSoon?: boolean;
  canMoveOut?: boolean;
  onMoveOut?: () => void;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export function TenantLifecycleCommandBar({
  tenant,
  lease,
  balance,
  expiringSoon = false,
  canMoveOut = false,
  onMoveOut,
}: TenantLifecycleCommandBarProps) {
  const leaseClosed = !lease || ["expired", "terminated"].includes(lease.status);
  const isActive = tenant.status === "active" && lease?.status === "active";
  const lifecycleLabel = isActive ? "Active tenancy" : leaseClosed ? "No active lease" : "Lease in progress";
  const lifecycleTone: StatusTone = isActive ? "success" : expiringSoon ? "warning" : leaseClosed ? "neutral" : "warning";

  return (
    <Card className="border-primary/15 bg-primary/[0.025] shadow-none">
      <CardContent className="p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <KeyRound className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">Tenancy lifecycle</p>
              <p className="text-[11px] text-muted-foreground">One operational view of tenant, lease, unit and collections state.</p>
            </div>
          </div>
          <Badge className={statusBadgeClass(lifecycleTone)}>{lifecycleLabel}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-background/70 p-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Home className="h-3.5 w-3.5" />Location</div>
            <p className="mt-1 text-xs font-medium truncate">{tenant.property || "Unassigned"}</p>
            <p className="text-[11px] text-muted-foreground truncate">{tenant.unit || "No unit"}</p>
          </div>
          <div className="rounded-lg border border-border bg-background/70 p-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" />Lease end</div>
            <p className="mt-1 text-xs font-medium">{formatDate(lease?.end_date)}</p>
            {expiringSoon && <p className="text-[11px] text-warning">Renewal attention</p>}
          </div>
          <div className="rounded-lg border border-border bg-background/70 p-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><CircleDollarSign className="h-3.5 w-3.5" />Monthly rent</div>
            <p className="mt-1 text-xs font-medium">KES {(lease?.monthly_rent ?? tenant.monthly_rent ?? 0).toLocaleString()}</p>
            <p className="text-[11px] text-muted-foreground">Move-in {formatDate(tenant.move_in_date)}</p>
          </div>
          <div className="rounded-lg border border-border bg-background/70 p-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><UserRoundCheck className="h-3.5 w-3.5" />Balance</div>
            <p className="mt-1 text-xs font-medium">KES {Math.abs(balance).toLocaleString()}</p>
            <p className={balance > 0 ? "text-[11px] text-destructive" : "text-[11px] text-emerald-600"}>
              {balance > 0 ? "Outstanding" : "Clear"}
            </p>
          </div>
        </div>

        {balance > 0 || expiringSoon || leaseClosed ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              {balance > 0 || expiringSoon ? <AlertTriangle className="h-4 w-4 shrink-0 text-warning" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" />}
              <p className="text-xs text-muted-foreground">
                {balance > 0 ? `KES ${balance.toLocaleString()} requires collection attention.` : expiringSoon ? "Lease is approaching expiry; review renewal or exit path." : "Tenant has no active lease."}
              </p>
            </div>
            {canMoveOut && isActive && onMoveOut && (
              <Button size="sm" variant="outline" className="min-h-9" onClick={onMoveOut}>
                Process move-out
              </Button>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
