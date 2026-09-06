import { useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ErrorState } from "@/shared/components/ui/error-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { formatDate } from "@/shared/lib/dateFormat";
import { invoiceStatusTone, statusBadgeClass } from "@/shared/lib/statusBadge";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { logError } from "@/shared/lib/errorLogger";

interface TenantInvoice {
  id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
}

interface TenantPaymentsTabProps {
  tenantId: string;
}

/** Real invoice history for this tenant, fetched fresh — no invented rows. */
export function TenantPaymentsTab({ tenantId }: TenantPaymentsTabProps) {
  const { formatCurrency } = useCurrency();
  const [invoices, setInvoices] = useState<TenantInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabase
      .from("invoices")
      .select("id, invoice_number, amount, due_date, paid_date, status")
      .eq("tenant_id", tenantId)
      .order("due_date", { ascending: false })
      .limit(25)
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          logError("TenantPaymentsTab", err);
          setError(err.message || "Failed to load payment history");
        } else {
          setInvoices(data ?? []);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)}
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Couldn't load payment history" message={error} />;
  }

  if (invoices.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="No invoices yet"
        description="Invoices billed to this tenant will appear here."
      />
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell className="text-sm font-medium text-foreground">{invoice.invoice_number}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatDate(invoice.due_date)}</TableCell>
              <TableCell className="text-sm font-medium text-foreground">{formatCurrency(invoice.amount)}</TableCell>
              <TableCell>
                <span className={statusBadgeClass(invoiceStatusTone(invoice.status))}>{invoice.status}</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
