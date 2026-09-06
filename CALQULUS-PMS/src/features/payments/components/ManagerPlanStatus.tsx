import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { AlertTriangle, ArrowRight, CreditCard } from "lucide-react";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { useManagerCommercialStatus } from "@/features/payments/hooks/useManagerCommercialStatus";
import { cn } from "@/shared/lib/utils";

export function ManagerPlanStatus() {
  const { data, isLoading } = useManagerCommercialStatus();
  const { formatCurrency } = useCurrency();

  if (isLoading || !data) return null;

  const healthClass =
    data.health.health === "suspended" ? "border-destructive/40 bg-destructive/5" :
    data.health.health === "warning" ? "border-amber-400/40 bg-amber-50/40" :
    data.health.health === "grace" ? "border-amber-400/30 bg-amber-50/20" :
    "border-border bg-card";

  return (
    <Card className={cn("mb-2", healthClass)}>
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">Your CALQULUS plan</p>
              <Badge variant="outline">{data.planName}</Badge>
              <Badge variant="secondary">{data.health.label}</Badge>
            </div>
            <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Amount</dt>
                <dd className="font-medium">{data.amountDue > 0 ? formatCurrency(data.amountDue) : data.rateLabel}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Billing cycle</dt>
                <dd className="font-medium">{data.billingCycle}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Next billing date</dt>
                <dd className="font-medium">{data.nextBilling ? format(data.nextBilling, "dd MMM yyyy") : "After first invoice"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Payment status</dt>
                <dd className="font-medium">{data.health.label}</dd>
              </div>
            </dl>
            {data.health.recovery && (
              <p className="mt-3 flex items-start gap-2 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                {data.health.recovery}
              </p>
            )}
          </div>
          {data.openInvoice && (
            <Button asChild className="shrink-0">
              <a href="#invoices">
                Pay invoice
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ManagerBillingRecoveryBanner() {
  const { data } = useManagerCommercialStatus();
  if (!data?.health.recovery) return null;
  if (data.health.health === "current" || data.health.health === "trial") return null;

  return (
    <div className="rounded-lg border border-amber-400/40 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <p className="text-sm text-amber-900">{data.health.recovery}</p>
      <Button asChild size="sm">
        <Link to="/platform-billing">
          Open Platform Billing
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}
