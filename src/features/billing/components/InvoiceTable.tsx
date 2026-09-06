/**
 * InvoiceTable.tsx
 *
 * The invoice rows table extracted from Billing.tsx.
 * Receives already-filtered invoices so the parent controls search/tab filtering.
 *
 * Phase 4 redesign: trustworthy Navy/Blue palette.
 * Status badges use semantic tones from the design system.
 * M-Pesa actions use interactive blue, not green.
 */

import { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { Button } from "@/shared/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/shared/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  CheckCircle, Clock, AlertCircle, XCircle,
  Building, Download, Receipt, Send, Pencil, Smartphone, Loader2, MoreHorizontal,
} from "lucide-react";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { formatDate } from "@/shared/lib/dateFormat";
import { downloadInvoicePDF } from "@/features/billing/lib/invoicePdfExport";
import { downloadReceiptPDF } from "@/features/billing/lib/receiptPdfExport";
import type { BillingInvoice } from "../hooks/useBillingData";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { statusBadgeClass } from "@/shared/lib/statusBadge";
import { invoiceOwedMinor, fromMinorUnits } from "@/shared/lib/money";
import { paginate, sortBy, toggleSort, type SortDir } from "@/shared/lib/clientTable";
import { SortableHead, TablePager } from "@/shared/components/ui/table-pager";
import { DataTableFrame } from "@/shared/components/ui/data-table-frame";

type InvoiceStatus = "paid" | "pending" | "overdue" | "cancelled" | "partially_paid" | "failed" | "refunded";

const PAGE_SIZE = 25;

const STATUS_CONFIG: Record<
  InvoiceStatus,
  { tone: "success" | "warning" | "danger" | "info" | "neutral"; icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  paid:           { tone: "success", icon: CheckCircle, label: "Paid" },
  partially_paid: { tone: "info",    icon: Clock,       label: "Partial" },
  pending:        { tone: "warning", icon: Clock,       label: "Pending" },
  overdue:        { tone: "danger",  icon: AlertCircle, label: "Overdue" },
  failed:         { tone: "danger",  icon: XCircle,     label: "Failed" },
  refunded:       { tone: "neutral", icon: XCircle,     label: "Refunded" },
  cancelled:      { tone: "neutral", icon: XCircle,     label: "Cancelled" },
};

interface Props {
  invoices: BillingInvoice[];
  isLoading: boolean;
  userId: string | undefined;
  canEdit: boolean;
  onEdit: (invoice: BillingInvoice) => void;
  onMpesa: (invoice: BillingInvoice) => void;
  onMarkPaid: (invoiceId: string) => void;
  onSendReminder: (invoice: BillingInvoice) => void;
}

export function InvoiceTable({
  invoices,
  isLoading,
  userId,
  canEdit,
  onEdit,
  onMpesa,
  onMarkPaid,
  onSendReminder,
}: Props) {
  const { formatCurrency } = useCurrency();
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState("due");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const listKey = `${invoices.length}:${invoices[0]?.id ?? ""}:${invoices[invoices.length - 1]?.id ?? ""}`;

  useEffect(() => {
    setPage(1);
  }, [listKey]);

  const sorted = useMemo(() => {
    const getter = (invoice: BillingInvoice) => {
      switch (sortKey) {
        case "status": return invoice.status;
        case "invoice": return invoice.invoice_number;
        case "tenant": return invoice.tenants?.name ?? "";
        case "property": return `${invoice.leases?.property ?? ""} ${invoice.leases?.unit ?? ""}`;
        case "amount": return Number(invoice.amount ?? 0);
        default: return invoice.due_date ?? "";
      }
    };
    return sortBy(invoices, getter, sortDir);
  }, [invoices, sortKey, sortDir]);

  const slice = useMemo(() => paginate(sorted, page, PAGE_SIZE), [sorted, page]);

  const handleSort = (key: string) => {
    const next = toggleSort(sortKey, key, sortDir);
    setSortKey(next.key);
    setSortDir(next.dir);
    setPage(1);
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading invoices…
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <EmptyState
        icon={Building}
        title="No invoices in this view"
        description="Create an invoice from a lease, then record payment and download the receipt."
      />
    );
  }

  return (
    <>
      <DataTableFrame minWidth="min-w-[820px]">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border">
            <SortableHead label="Status" sortKey="status" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
            <SortableHead label="Invoice" sortKey="invoice" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
            <SortableHead label="Tenant" sortKey="tenant" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
            <SortableHead label="Property / Unit" sortKey="property" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
            <SortableHead label="Amount" sortKey="amount" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
            <SortableHead label="Due" sortKey="due" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {slice.items.map((invoice) => {
            const status = invoice.status as InvoiceStatus;
            const cfg    = STATUS_CONFIG[status] ?? STATUS_CONFIG.cancelled;
            const StatusIcon = cfg.icon;
            const canCollect = status !== "paid" && status !== "cancelled" && status !== "failed" && status !== "refunded";
            const canCollectPayment = canCollect && (invoice.agencyCanCollect ?? true);
            const pdfPayload = {
              invoice_number: invoice.invoice_number,
              amount: invoice.amount,
              due_date: invoice.due_date,
              paid_date: invoice.paid_date,
              status,
              description: invoice.description,
              created_at: invoice.created_at,
              tenant: invoice.tenants
                ? { name: invoice.tenants.name, email: invoice.tenants.email, phone: invoice.tenants.phone }
                : null,
              lease: invoice.leases
                ? { property: invoice.leases.property, unit: invoice.leases.unit }
                : null,
            };

            return (
              <TableRow
                key={invoice.id}
                className="hover:bg-muted/30 border-border"
              >
                <TableCell>
                  <span className={`${statusBadgeClass(cfg.tone)} gap-1`}>
                    <StatusIcon className="h-3 w-3" />
                    {cfg.label}
                  </span>
                </TableCell>
                <TableCell className="font-medium font-mono text-foreground">
                  {invoice.invoice_number}
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={invoice.tenants?.photo_url ?? undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {invoice.tenants?.name?.split(" ").map(n => n[0]).join("") ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-foreground truncate">{invoice.tenants?.name ?? "No Tenant"}</span>
                  </div>
                </TableCell>

                <TableCell>
                  {invoice.leases ? (
                    <div className="text-sm">
                      <p className="text-foreground truncate">{invoice.leases.property}</p>
                      <p className="text-xs text-muted-foreground">{invoice.leases.unit}</p>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>

                <TableCell className="font-semibold text-foreground">
                  {/* balance_due/paid_amount are real columns (comprehensive-payment-
                      schema migration); show the remaining balance when a partial
                      payment has been made, with the original amount as context. */}
                  {(() => {
                    const owed = fromMinorUnits(invoiceOwedMinor(invoice));
                    const original = Number(invoice.original_amount ?? invoice.amount);
                    const isPartial = status === "partially_paid" && owed !== original;
                    return (
                      <div>
                        <div>{formatCurrency(isPartial ? owed : invoice.amount)}</div>
                        {isPartial && (
                          <div className="text-xs font-normal text-muted-foreground">
                            of {formatCurrency(original)} — partial
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </TableCell>

                <TableCell className="text-muted-foreground">
                  {formatDate(invoice.due_date)}
                </TableCell>

                <TableCell>
                  <div className="flex items-center justify-end gap-1.5">
                    {canCollectPayment && (
                      <>
                        <Button
                          variant="outline" size="sm"
                          className="h-8 text-xs text-[hsl(214_73%_48%)] border-[hsl(214_73%_48%/0.3)] hover:bg-[hsl(214_73%_48%/0.08)]"
                          onClick={() => onMpesa(invoice)}
                        >
                          <Smartphone className="h-3.5 w-3.5 sm:mr-1" />
                          <span className="hidden sm:inline">M-Pesa</span>
                        </Button>
                        <Button
                          variant="outline" size="sm" className="h-8 text-xs hidden sm:inline-flex"
                          onClick={() => onMarkPaid(invoice.id)}
                        >
                          Mark Paid
                        </Button>
                      </>
                    )}
                    {!canCollectPayment && invoice.agencyCollectionDestination === "landlord" && canCollect ? (
                      <span className="hidden items-center rounded-full border border-border bg-muted/60 px-2 py-1 text-[10px] font-medium text-muted-foreground sm:inline-flex">
                        Owner collects
                      </span>
                    ) : null}
                    {status === "paid" && (
                      <Button
                        variant="ghost" size="sm" className="h-8 px-2 text-[hsl(214_73%_48%)]"
                        title="Download Receipt PDF"
                        onClick={() => downloadReceiptPDF({
                          invoice_number: invoice.invoice_number,
                          amount: invoice.amount,
                          due_date: invoice.due_date,
                          paid_date: invoice.paid_date,
                          description: invoice.description,
                          tenant: invoice.tenants
                            ? { name: invoice.tenants.name, email: invoice.tenants.email, phone: invoice.tenants.phone }
                            : null,
                          lease: invoice.leases
                            ? { property: invoice.leases.property, unit: invoice.leases.unit }
                            : null,
                        }, userId)}
                      >
                        <Receipt className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">Receipt</span>
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More invoice actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => downloadInvoicePDF(pdfPayload)}>
                          <Download className="h-4 w-4 mr-2" />
                          Download invoice
                        </DropdownMenuItem>
                        {status === "pending" && (
                          <DropdownMenuItem onClick={() => onSendReminder(invoice)}>
                            <Send className="h-4 w-4 mr-2" />
                            Send reminder
                          </DropdownMenuItem>
                        )}
                        {canCollect && canEdit && (
                          <DropdownMenuItem onClick={() => onEdit(invoice)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit invoice
                          </DropdownMenuItem>
                        )}
                        {canCollectPayment && (
                          <DropdownMenuItem className="sm:hidden" onClick={() => onMarkPaid(invoice.id)}>
                            Mark paid
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </DataTableFrame>
      <TablePager page={slice} onPageChange={setPage} noun="invoices" />
    </>
  );
}
