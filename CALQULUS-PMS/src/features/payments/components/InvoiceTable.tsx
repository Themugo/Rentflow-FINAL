import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Calendar, Mail, MessageCircle, CreditCard, Smartphone, Loader2, DownloadIcon } from "lucide-react";
import { format } from "date-fns";

interface ManagerInvoice {
  id: string;
  invoice_number: string;
  amount: number;
  description: string | null;
  status: string;
  due_date: string;
  paid_date: string | null;
  created_at: string;
  property_count: number;
  rate_per_property: number;
}

interface InvoiceTableProps {
  invoices: ManagerInvoice[];
  formatCurrency: (amount: number) => string;
  isSendingEmail: string | null;
  isSendingWhatsApp: string | null;
  isProcessing: boolean;
  onSendInvoiceEmail: (invoice: ManagerInvoice) => void;
  onSendWhatsApp: (invoice: ManagerInvoice, type: "invoice" | "receipt") => void;
  onPayClick: (invoice: ManagerInvoice, method: "stripe" | "mpesa") => void;
  onDownloadInvoice: (invoice: ManagerInvoice) => void;
}

const getInvoiceStatusBadge = (status: string, dueDate: string) => {
  if (status === "paid") {
    return <Badge className="bg-success/10 text-success border-success/20">Paid</Badge>;
  }
  if (status === "pending") {
    const isOverdue = new Date(dueDate) < new Date();
    if (isOverdue) {
      return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Overdue</Badge>;
    }
    return <Badge className="bg-warning/10 text-warning border-warning/20">Pending</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
};

export const InvoiceTable = ({
  invoices,
  formatCurrency,
  isSendingEmail,
  isSendingWhatsApp,
  isProcessing,
  onSendInvoiceEmail,
  onSendWhatsApp,
  onPayClick,
  onDownloadInvoice,
}: InvoiceTableProps) => {
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>Invoice #</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell className="font-mono text-sm">{invoice.invoice_number}</TableCell>
              <TableCell>{invoice.description || "Platform subscription fee"}</TableCell>
              <TableCell className="font-semibold">{formatCurrency(invoice.amount)}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {format(new Date(invoice.due_date), "dd/MM/yy")}
                </div>
              </TableCell>
              <TableCell>{getInvoiceStatusBadge(invoice.status, invoice.due_date)}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1 flex-wrap">
                  {invoice.status === "pending" ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onSendInvoiceEmail(invoice)}
                        disabled={isSendingEmail === invoice.id}
                        className="text-blue-500 hover:bg-blue-500/10"
                        title="Send to Email"
                      >
                        {isSendingEmail === invoice.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Mail className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onSendWhatsApp(invoice, "invoice")}
                        disabled={isSendingWhatsApp === invoice.id}
                        className="text-green-500 hover:bg-green-500/10"
                        title="Send to WhatsApp/SMS"
                      >
                        {isSendingWhatsApp === invoice.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MessageCircle className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onPayClick(invoice, "stripe")}
                        disabled={isProcessing}
                        className="border-blue-500/30 text-blue-500 hover:bg-blue-500/10"
                      >
                        <CreditCard className="h-4 w-4 mr-1" />
                        Card
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onPayClick(invoice, "mpesa")}
                        disabled={isProcessing}
                        className="border-green-500/30 text-green-600 hover:bg-green-500/10"
                      >
                        <Smartphone className="h-4 w-4 mr-1" />
                        M-Pesa
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDownloadInvoice(invoice)}
                      className="text-blue-500 hover:bg-blue-500/10"
                    >
                      <DownloadIcon className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
