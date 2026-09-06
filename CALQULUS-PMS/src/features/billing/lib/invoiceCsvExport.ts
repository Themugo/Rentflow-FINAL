import { format } from "date-fns";
import { CurrencyCode } from "@/shared/hooks/useCurrency";

interface InvoiceForExport {
  invoice_number: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  description: string | null;
  created_at: string;
  tenants?: {
    name: string;
    email: string;
    phone?: string | null;
  } | null;
  leases?: {
    property: string;
    unit: string;
  } | null;
}

const createCurrencyFormatter = (currency: CurrencyCode = "KES") => {
  const locale = currency === "KES" ? "en-KE" : currency === "USD" ? "en-US" : currency === "EUR" ? "de-DE" : "en-GB";
  return (amount: number) => {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };
};

const escapeCSV = (value: string | null | undefined): string => {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

export const exportInvoicesToCSV = (invoices: InvoiceForExport[], filename?: string, currency: CurrencyCode = "KES") => {
  const headers = [
    "Invoice #",
    "Tenant Name",
    "Tenant Email",
    "Tenant Phone",
    "Property",
    "Unit",
    `Amount (${currency})`,
    "Due Date",
    "Paid Date",
    "Status",
    "Description",
    "Created At",
  ];

  const rows = invoices.map((invoice) => [
    escapeCSV(invoice.invoice_number),
    escapeCSV(invoice.tenants?.name),
    escapeCSV(invoice.tenants?.email),
    escapeCSV(invoice.tenants?.phone),
    escapeCSV(invoice.leases?.property),
    escapeCSV(invoice.leases?.unit),
    invoice.amount.toString(),
    invoice.due_date ? format(new Date(invoice.due_date), 'dd/MM/yy') : "",
    invoice.paid_date ? format(new Date(invoice.paid_date), 'dd/MM/yy') : "",
    escapeCSV(invoice.status),
    escapeCSV(invoice.description),
    invoice.created_at ? format(new Date(invoice.created_at), 'dd/MM/yy') : "",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    filename || `invoices_export_${new Date().toISOString().split("T")[0]}.csv`
  );
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportPaymentSummaryToCSV = (invoices: InvoiceForExport[], currency: CurrencyCode = "KES") => {
  const formatCurrency = createCurrencyFormatter(currency);
  const paidInvoices = invoices.filter((inv) => inv.status === "paid");
  const pendingInvoices = invoices.filter((inv) => inv.status === "pending");
  const overdueInvoices = invoices.filter((inv) => inv.status === "overdue");

  const totalBilled = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalPaid = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalPending = pendingInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  const summaryRows = [
    ["Payment Summary Report", "", "", ""],
    ["Generated on:", format(new Date(), 'dd/MM/yy'), "", ""],
    ["", "", "", ""],
    ["Category", "Count", `Amount (${currency})`, ""],
    ["Total Billed", invoices.length.toString(), formatCurrency(totalBilled), ""],
    ["Paid", paidInvoices.length.toString(), formatCurrency(totalPaid), ""],
    ["Pending", pendingInvoices.length.toString(), formatCurrency(totalPending), ""],
    ["Overdue", overdueInvoices.length.toString(), formatCurrency(totalOverdue), ""],
    ["", "", "", ""],
    ["", "", "", ""],
    ["Detailed Invoice List", "", "", ""],
    ["Invoice #", "Tenant", `Amount (${currency})`, "Status", "Due Date", "Paid Date"],
    ...invoices.map((inv) => [
      inv.invoice_number,
      inv.tenants?.name || "N/A",
      formatCurrency(inv.amount),
      inv.status,
      format(new Date(inv.due_date), 'dd/MM/yy'),
      inv.paid_date ? format(new Date(inv.paid_date), 'dd/MM/yy') : "-",
    ]),
  ];

  const csvContent = summaryRows.map((row) => row.map(escapeCSV).join(",")).join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `payment_summary_${new Date().toISOString().split("T")[0]}.csv`
  );
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
