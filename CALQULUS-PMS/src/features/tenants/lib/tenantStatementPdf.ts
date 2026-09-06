import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { CurrencyCode } from "@/shared/hooks/useCurrency";

interface TenantStatementData {
  tenantName: string;
  tenantEmail: string;
  tenantPhone?: string | null;
  propertyName?: string | null;
  unitNumber?: string | null;
  moveInDate?: string | null;
  companyName?: string | null;
  companyAddress?: string | null;
  companyPhone?: string | null;
  companyEmail?: string | null;
  logoUrl?: string | null;
  invoices: Array<{
    invoice_number: string;
    amount: number;
    due_date: string;
    paid_date?: string | null;
    status: string;
    description?: string | null;
  }>;
  currency?: CurrencyCode;
  generatedAt?: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  KES: "KSh",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

function formatCurrencyLocal(amount: number, currency: CurrencyCode = "KES"): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  return `${symbol} ${Number(amount).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function downloadTenantStatementPDF(
  data: TenantStatementData
): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const currency = data.currency || "KES";
  const today = data.generatedAt || format(new Date(), 'dd/MM/yy');

  // Header background
  doc.setFillColor(26, 86, 219);
  doc.rect(0, 0, pageWidth, 38, "F");

  // Company name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(data.companyName || "CALQULUS PMS Properties", 14, 14);

  // Statement title
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("TENANT ACCOUNT STATEMENT", 14, 22);
  doc.text(`Generated: ${today}`, 14, 29);

  // Company contact on right
  if (data.companyEmail || data.companyPhone) {
    doc.setFontSize(9);
    if (data.companyEmail) doc.text(data.companyEmail, pageWidth - 14, 18, { align: "right" });
    if (data.companyPhone) doc.text(data.companyPhone, pageWidth - 14, 25, { align: "right" });
    if (data.companyAddress) doc.text(data.companyAddress, pageWidth - 14, 32, { align: "right" });
  }

  // Tenant info box
  doc.setTextColor(0, 0, 0);
  doc.setFillColor(243, 244, 246);
  doc.rect(14, 44, pageWidth - 28, 30, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Tenant Details", 18, 52);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Name: ${data.tenantName}`, 18, 59);
  doc.text(`Email: ${data.tenantEmail}`, 18, 65);
  if (data.tenantPhone) doc.text(`Phone: ${data.tenantPhone}`, 18, 71);
  if (data.propertyName) {
    doc.text(`Property: ${data.propertyName}${data.unitNumber ? ` — Unit ${data.unitNumber}` : ""}`, 80, 59);
  }
  if (data.moveInDate) doc.text(`Move-in: ${data.moveInDate}`, 80, 65);

  // Summary stats
  const totalBilled = data.invoices.reduce((s, i) => s + Number(i.amount), 0);
  const totalPaid = data.invoices.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
  const outstanding = totalBilled - totalPaid;

  const summaryY = 82;
  const colW = (pageWidth - 28) / 3;
  [
    ["Total Billed", formatCurrencyLocal(totalBilled, currency), [243, 244, 246]],
    ["Total Paid", formatCurrencyLocal(totalPaid, currency), [220, 252, 231]],
    ["Outstanding", formatCurrencyLocal(outstanding, currency), outstanding > 0 ? [254, 226, 226] : [220, 252, 231]],
  ].forEach(([label, value, color], i) => {
    const x = 14 + i * colW;
    doc.setFillColor(...(color as [number, number, number]));
    doc.rect(x, summaryY, colW - 2, 16, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(label as string, x + 3, summaryY + 5);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(value as string, x + 3, summaryY + 13);
  });

  // Invoice table
  autoTable(doc, {
    startY: summaryY + 24,
    head: [["Invoice #", "Description", "Due Date", "Paid Date", "Amount", "Status"]],
    body: data.invoices.map(inv => [
      inv.invoice_number,
      inv.description || "Monthly Rent",
      inv.due_date,
      inv.paid_date || "—",
      formatCurrencyLocal(inv.amount, currency),
      inv.status.toUpperCase(),
    ]),
    headStyles: {
      fillColor: [26, 86, 219],
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: "bold",
    },
    bodyStyles: { fontSize: 8.5 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 28 },
      4: { halign: "right", fontStyle: "bold" },
      5: {
        fontStyle: "bold",
        cellWidth: 22,
      },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 5) {
        const val = String(data.cell.raw).toLowerCase();
        if (val === "paid") data.cell.styles.textColor = [22, 163, 74];
        else if (val === "overdue") data.cell.styles.textColor = [220, 38, 38];
        else data.cell.styles.textColor = [180, 100, 0];
      }
    },
  });

  // Footer
  const finalY = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(120, 120, 120);
  doc.text(
    `This statement was generated by ${data.companyName || "CALQULUS PMS"} on ${today}. For queries, contact ${data.companyEmail || "your property manager"}.`,
    14, finalY, { maxWidth: pageWidth - 28 }
  );

  // Page numbers
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 8, { align: "right" });
  }

  const filename = `statement_${data.tenantName.replace(/\s+/g, "_").toLowerCase()}_${new Date().toISOString().slice(0, 7)}.pdf`;
  doc.save(filename);
}
