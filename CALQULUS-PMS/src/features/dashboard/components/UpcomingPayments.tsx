import { Badge } from "@/shared/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatDate } from "@/shared/lib/dateFormat";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { isInvoiceOverdue, getDaysUntilDue } from "@/features/billing/lib/invoiceDueLogic";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { useDashboardTenantIds } from "@/features/dashboard/hooks/useDashboardData";

type PaymentStatus = "upcoming" | "due_soon" | "due_today" | "overdue";

interface Payment {
  id: string;
  tenant_name: string;
  tenant_photo: string | null;
  unit: string | null;
  amount: number;
  due_date: string;
  status: PaymentStatus;
  daysUntilDue: number;
}

export function UpcomingPayments({ showHeader = true }: { showHeader?: boolean }) {
  const { formatCurrency } = useCurrency();
  const { managerId, restrictToAssignedProperties, assignedPropertyIds } = useManagerScope();
  const { data: scopedTenantIds = [], isPending: tenantIdsLoading } = useDashboardTenantIds();
  const assignedKey = assignedPropertyIds.join(",");
  const { data: payments = [], isPending: loading } = useQuery({
    queryKey: ["dashboard", "upcoming-payments", managerId ?? "", assignedKey],
    queryFn: async (): Promise<Payment[]> => {
      if (!managerId || (restrictToAssignedProperties && scopedTenantIds.length === 0)) return [];
      let invoiceQuery = supabase.from("invoices").select("id, amount, due_date, status, tenant_id").eq("manager_id", managerId).in("status", ["pending", "overdue"]).order("due_date", { ascending: true }).limit(6);
      if (restrictToAssignedProperties) invoiceQuery = invoiceQuery.in("tenant_id", scopedTenantIds);
      const { data: invoices, error } = await invoiceQuery;
      if (error) throw error;
      if (!invoices?.length) return [];
      const tenantIds = [...new Set(invoices.map((inv) => inv.tenant_id).filter(Boolean))];
      const { data: tenants, error: tenantError } = await supabase.from("tenants").select("id, name, photo_url, unit").eq("manager_id", managerId).in("id", tenantIds);
      if (tenantError) throw tenantError;
      const tenantMap = new Map(tenants?.map((t) => [t.id, t]) || []);
      return invoices.map((inv) => {
        const tenant = tenantMap.get(inv.tenant_id);
        const daysUntilDue = getDaysUntilDue(inv.due_date);
        const isOverdue = inv.status === "overdue" || isInvoiceOverdue(inv.due_date, inv.status);
        const status: PaymentStatus = isOverdue ? "overdue" : daysUntilDue === 0 ? "due_today" : daysUntilDue <= 3 ? "due_soon" : "upcoming";
        return { id: inv.id, tenant_name: tenant?.name || "Unknown Tenant", tenant_photo: tenant?.photo_url || null, unit: tenant?.unit || null, amount: inv.amount, due_date: inv.due_date, status, daysUntilDue };
      });
    },
    enabled: !!managerId && !tenantIdsLoading,
    staleTime: 30 * 1000,
  });

  const formatDateStr = (dateStr: string) => {
    return formatDate(dateStr);
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 card-shadow">
        {showHeader ? (
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <Skeleton className="h-5 sm:h-6 w-32 sm:w-40" />
            <Skeleton className="h-5 w-16 sm:w-20" />
          </div>
        ) : null}
        <div className="space-y-2.5 sm:space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 sm:h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-6 card-shadow">
      {showHeader ? (
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h3 className="font-heading text-base sm:text-lg font-semibold text-card-foreground">
            Upcoming Payments
          </h3>
          <Badge variant="secondary" className="font-medium text-xs">
            {payments.length} pending
          </Badge>
        </div>
      ) : null}
      <div className="space-y-2.5 sm:space-y-3">
        {payments.length === 0 ? (
          <p className="text-xs sm:text-sm text-muted-foreground text-center py-3 sm:py-4">
            No pending payments
          </p>
        ) : (
          payments.map((payment, index) => (
            <Link
              key={payment.id}
              to={`/billing?filter=${payment.status === "overdue" ? "overdue" : "pending"}`}
              aria-label={`Open billing for ${payment.tenant_name}, ${payment.status.replace("_", " ")}`}
              className="flex items-center gap-2.5 sm:gap-4 p-2.5 sm:p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors animate-slide-in touch-manipulation"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <Avatar className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
                <AvatarImage src={payment.tenant_photo || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-[10px] sm:text-xs">
                  {payment.tenant_name.split(" ").map((n) => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-card-foreground truncate">
                  {payment.tenant_name}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{payment.unit || "No unit"}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs sm:text-sm font-semibold text-card-foreground">
                  {formatCurrency(payment.amount)}
                </p>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
                  <span className="text-[10px] sm:text-xs text-muted-foreground">
                    {formatDateStr(payment.due_date)}
                  </span>
                  {payment.status === "overdue" && (
                    <Badge variant="destructive" className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0">
                      Overdue
                    </Badge>
                  )}
                  {payment.status === "due_today" && (
                    <Badge className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0 bg-warning/20 text-warning border-warning/30">
                      Due Today
                    </Badge>
                  )}
                  {payment.status === "due_soon" && (
                    <Badge className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0 bg-warning/20 text-warning border-warning/30">
                      {payment.daysUntilDue}d
                    </Badge>
                  )}
                  {payment.status === "upcoming" && (
                    <Badge className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0 bg-[hsl(214_73%_48%/0.15)] text-[hsl(214_73%_42%)] border-[hsl(214_73%_48%/0.3)]">
                      {payment.daysUntilDue}d
                    </Badge>
                  )}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
      {payments.length > 0 ? (
        <div className="mt-3 border-t border-border pt-3">
          <Link
            to="/billing?filter=pending"
            className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
          >
            Review billing queue <span aria-hidden className="ml-1">→</span>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
