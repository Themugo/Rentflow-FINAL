import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate } from "@/shared/lib/dateFormat";
import { CurrencyCode } from "@/shared/hooks/useCurrency";
import { createCurrencyFormatter, fetchCompanySettings, drawCompanyPdfHeader } from "@/shared/lib/pdf/companyPdfHeader";
import { composeBrandConfig } from "@/core/brand/composeBrandConfig";
import { documentFooter, documentShowLogo, documentTitle } from "@/core/brand/pdfCompany";
import type { OrgBrandRecord } from "@/core/brand/parseOrgRecord";

interface JsPDFWithAutoTable extends jsPDF {
  lastAutoTable?: { finalY: number };
}

interface InvoiceData {
  invoice_number: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  description: string | null;
  created_at: string;
  tenant?: {
    name: string;
    email: string;
    phone?: string | null;
  } | null;
  lease?: {
    property: string;
    unit: string;
  } | null;
}

export const generateInvoicePDF = async (invoice: InvoiceData, currency: CurrencyCode = "KES"): Promise<jsPDF> => {
  const doc = new jsPDF();
  const formatCurrency = createCurrencyFormatter(currency);
  const pageWidth = doc.internal.pageSize.getWidth();
  const companySettings = await fetchCompanySettings();
  const brand = composeBrandConfig((companySettings as OrgBrandRecord | null) ?? null);

  let yPos = await drawCompanyPdfHeader(doc, companySettings, 14, {
    includeLogo: documentShowLogo(brand, "invoices"),
  });

  // Invoice Title
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(documentTitle(brand, "invoices"), pageWidth / 2, yPos, { align: "center" });
  yPos += 10;

  // Invoice Number and Date
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Invoice #: ${invoice.invoice_number}`, 14, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${formatDate(invoice.created_at)}`, pageWidth - 14, yPos, { align: "right" });
  yPos += 10;

  // Separator line
  doc.setDrawColor(200, 200, 200);
  doc.line(14, yPos, pageWidth - 14, yPos);
  yPos += 10;

  // Bill To section
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Bill To:", 14, yPos);
  yPos += 6;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  if (invoice.tenant) {
    doc.text(invoice.tenant.name, 14, yPos);
    yPos += 5;
    doc.text(invoice.tenant.email, 14, yPos);
    yPos += 5;
    if (invoice.tenant.phone) {
      doc.text(invoice.tenant.phone, 14, yPos);
      yPos += 5;
    }
  }
  
  if (invoice.lease) {
    doc.text(`${invoice.lease.property} - ${invoice.lease.unit}`, 14, yPos);
    yPos += 5;
  }
  yPos += 8;

  // Invoice Details Table
  autoTable(doc, {
    startY: yPos,
    head: [["Description", "Due Date", "Status", "Amount"]],
    body: [
      [
        invoice.description || "Monthly Rent",
        formatDate(invoice.due_date),
        invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1),
        formatCurrency(invoice.amount),
      ],
    ],
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    styles: {
      fontSize: 10,
      cellPadding: 5,
    },
    columnStyles: {
      0: { cellWidth: 80 },
      3: { halign: "right", fontStyle: "bold" },
    },
  });

  const docWithTable = doc as JsPDFWithAutoTable;
  const finalY = (docWithTable.lastAutoTable?.finalY ?? 100) + 10;

  // Total Box
  doc.setFillColor(245, 245, 245);
  doc.rect(pageWidth - 80, finalY, 66, 20, "F");
  
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Total Due:", pageWidth - 76, finalY + 8);
  doc.setFontSize(14);
  doc.text(formatCurrency(invoice.amount), pageWidth - 18, finalY + 15, { align: "right" });

  // Payment Status
  const statusY = finalY + 30;
  if (invoice.status === "paid") {
    doc.setTextColor(34, 197, 94);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("PAID", pageWidth / 2, statusY, { align: "center" });
    if (invoice.paid_date) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Paid on: ${formatDate(invoice.paid_date)}`, pageWidth / 2, statusY + 6, { align: "center" });
    }
  } else if (invoice.status === "overdue") {
    doc.setTextColor(239, 68, 68);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("OVERDUE", pageWidth / 2, statusY, { align: "center" });
  }
  doc.setTextColor(0, 0, 0);

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  if (companySettings) {
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    const footerText = [
      companySettings.company_name,
      companySettings.phone,
      companySettings.email,
    ]
      .filter(Boolean)
      .join(" | ");
    doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: "center" });
    const note = documentFooter(brand, "invoices");
    if (note) {
      doc.text(note, pageWidth / 2, pageHeight - 6, { align: "center" });
    }
    doc.setTextColor(0, 0, 0);
  }

  return doc;
};

export const downloadInvoicePDF = async (invoice: InvoiceData, currency: CurrencyCode = "KES") => {
  const doc = await generateInvoicePDF(invoice, currency);
  doc.save(`invoice_${invoice.invoice_number}_${new Date().toISOString().split("T")[0]}.pdf`);
};
