import { format } from "date-fns";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { CreditCard, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/shared/lib/utils";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { Link } from "react-router-dom";
import { LoadingState } from "@/shared/components/ui/loading-state";

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  description: string | null;
  tenant_id: string | null;
}

interface Tenant {
  id: string;
  name: string;
}

const statusStyles: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  paid: "bg-success/10 text-success border-success/20",
  overdue: "bg-red-500/10 text-red-600 border-red-500/20",
  cancelled: "bg-slate-500/10 text-slate-600 border-slate-500/20",
};

interface PropertyInvoicesTabProps {
  propertyId: string;
  tenants: Tenant[];
}

export function PropertyInvoicesTab({ propertyId, tenants }: PropertyInvoicesTabProps) {
  const { formatCurrency } = useCurrency();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const tenantIdsKey = tenants.map(t => t.id).sort().join(",");

  useEffect(() => {
    const fetchInvoices = async () => {
      const tenantIds = tenants.map(t => t.id);
      if (tenantIds.length === 0) {
        setInvoices([]);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .in("tenant_id", tenantIds)
        .order("due_date", { ascending: false })
        .limit(50);

      if (!error) setInvoices(data || []);
      setIsLoading(false);
    };
    fetchInvoices();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantIdsKey]);

  const getTenantName = (tenantId: string | null) => {
    if (!tenantId) return "—";
    return tenants.find(t => t.id === tenantId)?.name || "Unknown";
  };

  const totalPending = invoices.filter(i => i.status === "pending").reduce((sum, i) => sum + i.amount, 0);
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((sum, i) => sum + i.amount, 0);
  const totalOverdue = invoices.filter(i => i.status === "overdue").reduce((sum, i) => sum + i.amount, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-warning" />
            Property Invoices
          </CardTitle>
          <div className="flex gap-4 mt-2 text-sm">
            <span className="text-success">Paid: {formatCurrency(totalPaid)}</span>
            <span className="text-warning">Pending: {formatCurrency(totalPending)}</span>
            <span className="text-red-600">Overdue: {formatCurrency(totalOverdue)}</span>
          </div>
        </div>
        <Link to="/billing">
          <Button variant="outline" size="sm">View All</Button>
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingState label="Loading records…" variant="inline" className="py-4" />
        ) : invoices.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No invoices for this property</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                  <TableCell>{getTenantName(invoice.tenant_id)}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(invoice.amount)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(invoice.due_date), 'dd/MM/yy')}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("capitalize", statusStyles[invoice.status] || "")}>
                      {invoice.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
