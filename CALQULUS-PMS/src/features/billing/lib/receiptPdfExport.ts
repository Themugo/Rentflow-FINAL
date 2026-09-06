import jsPDF from "jspdf";
import autoTable, { type UserOptions } from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/shared/lib/dateFormat";
import { CurrencyCode } from "@/shared/hooks/useCurrency";
import { createCurrencyFormatter, fetchCompanySettings, drawCompanyPdfHeader, getAutoTableFinalY } from "@/shared/lib/pdf/companyPdfHeader";
import { composeBrandConfig } from "@/core/brand/composeBrandConfig";
import { documentAccent, documentFooter, documentShowLogo, documentTitle } from "@/core/brand/pdfCompany";
import type { OrgBrandRecord } from "@/core/brand/parseOrgRecord";

interface LineItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface ReceiptData {
  invoice_number: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  description: string | null;
  mpesa_receipt?: string | null;
  line_items?: LineItem[] | null;
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

interface ReceiptSettings {
  primary_color: string;
  secondary_color: string;
  footer_message: string;
  include_logo: boolean;
}

const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [34, 197, 94]; // Default green
};

const fetchReceiptSettings = async (userId: string): Promise<ReceiptSettings | null> => {
  const { data, error } = await supabase
    .from("receipt_settings")
    .select("primary_color, secondary_color, footer_message, include_logo")
    .eq("manager_user_id", userId)
    .maybeSingle();

  if (!error && data) {
    return data as ReceiptSettings;
  }
  return null;
};

// Parse line items from description if encoded
const parseLineItemsFromDescription = (description: string | null): { displayText: string; lineItems: LineItem[] | null } => {
  if (!description) {
    return { displayText: '', lineItems: null };
  }
  
  const marker = '<!--LINE_ITEMS:';
  const markerIndex = description.indexOf(marker);
  
  if (markerIndex === -1) {
    return { displayText: description, lineItems: null };
  }
  
  const displayText = description.substring(0, markerIndex).trim();
  const jsonStart = markerIndex + marker.length;
  const jsonEnd = description.indexOf('-->', jsonStart);
  
  if (jsonEnd === -1) {
    return { displayText, lineItems: null };
  }
  
  try {
    const lineItems = JSON.parse(description.substring(jsonStart, jsonEnd)) as LineItem[];
    return { displayText, lineItems };
  } catch {
    return { displayText, lineItems: null };
  }
};

export const generateReceiptPDF = async (receipt: ReceiptData, userId?: string, currency: CurrencyCode = "KES"): Promise<jsPDF> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const formatCurrency = createCurrencyFormatter(currency);
  const companySettings = await fetchCompanySettings();
  const brand = composeBrandConfig((companySettings as OrgBrandRecord | null) ?? null);
  const receiptSettings = userId ? await fetchReceiptSettings(userId) : null;
  
  // Parse line items from description if not provided directly
  const { displayText, lineItems: parsedLineItems } = parseLineItemsFromDescription(receipt.description);
  const effectiveLineItems = receipt.line_items || parsedLineItems;
  const effectiveDescription = displayText || receipt.description;
  
  // Get colors from settings or use defaults
  const primaryColor = hexToRgb(receiptSettings?.primary_color || documentAccent(brand, "receipts"));
  const secondaryColor = hexToRgb(receiptSettings?.secondary_color || "#1e293b");
  const footerMessage = receiptSettings?.footer_message || documentFooter(brand, "receipts");
  const includeLogo = receiptSettings?.include_logo ?? documentShowLogo(brand, "receipts");

  let yPos = await drawCompanyPdfHeader(doc, companySettings, 14, { includeLogo });

  // Receipt Title with checkmark using primary color
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.circle(pageWidth / 2, yPos + 5, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("✓", pageWidth / 2 - 2, yPos + 8);
  doc.setTextColor(0, 0, 0);
  yPos += 20;

  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(documentTitle(brand, "receipts"), pageWidth / 2, yPos, { align: "center" });
  yPos += 8;

  doc.setFontSize(10);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("Payment Successful", pageWidth / 2, yPos, { align: "center" });
  doc.setTextColor(0, 0, 0);
  yPos += 12;

  // Receipt Number and Date
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Receipt for Invoice #: ${receipt.invoice_number}`, 14, yPos);
  doc.setFont("helvetica", "normal");
  if (receipt.paid_date) {
    doc.text(`Paid: ${formatDate(receipt.paid_date)}`, pageWidth - 14, yPos, { align: "right" });
  }
  yPos += 10;

  // Separator line
  doc.setDrawColor(200, 200, 200);
  doc.line(14, yPos, pageWidth - 14, yPos);
  yPos += 10;

  // Received From section
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Received From:", 14, yPos);
  yPos += 6;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  if (receipt.tenant) {
    doc.text(receipt.tenant.name, 14, yPos);
    yPos += 5;
    doc.text(receipt.tenant.email, 14, yPos);
    yPos += 5;
    if (receipt.tenant.phone) {
      doc.text(receipt.tenant.phone, 14, yPos);
      yPos += 5;
    }
  }
  
  if (receipt.lease) {
    doc.text(`Property: ${receipt.lease.property} - ${receipt.lease.unit}`, 14, yPos);
    yPos += 5;
  }
  yPos += 8;

  // Payment Details Table with line items breakdown
  const hasLineItems = effectiveLineItems && effectiveLineItems.length > 0;
  
  // Full breakdown table (Qty/Rate/Amount columns + a Total footer row) when
  // line items are available; otherwise a single summary row.
  let tableBody: (string | number)[][];
  let tableFoot: UserOptions["foot"];
  let tableFootStyles: UserOptions["footStyles"];

  if (hasLineItems) {
    tableBody = effectiveLineItems.map(item => [
      item.description,
      item.quantity,
      formatCurrency(item.rate),
      formatCurrency(item.amount),
    ]);
    tableFoot = [[
      { content: "Total", colSpan: 3, styles: { halign: "right", fontStyle: "bold" } },
      { content: formatCurrency(receipt.amount), styles: { halign: "right", fontStyle: "bold" } }
    ]];
    tableFootStyles = {
      fillColor: [245, 245, 245],
      textColor: secondaryColor,
    };
  } else {
    tableBody = [
      [
        effectiveDescription || "Monthly Rent",
        "1",
        formatCurrency(receipt.amount),
        formatCurrency(receipt.amount),
      ],
    ];
    if (receipt.mpesa_receipt) {
      tableBody.push(["M-Pesa Receipt", "", "", receipt.mpesa_receipt]);
    }
  }

  autoTable(doc, {
    startY: yPos,
    head: [["Description", "Qty", "Rate", "Amount"]],
    body: tableBody,
    theme: "striped",
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    styles: {
      fontSize: 10,
      cellPadding: 5,
    },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { halign: "center", cellWidth: 25 },
      2: { halign: "right", cellWidth: 35 },
      3: { halign: "right", fontStyle: "bold", cellWidth: 35 },
    },
    ...(tableFoot ? { foot: tableFoot, footStyles: tableFootStyles } : {}),
  });

  const finalY = getAutoTableFinalY(doc) + 10;

  // Total Paid Box using primary color
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.roundedRect(pageWidth - 90, finalY, 76, 25, 3, 3, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Amount Paid:", pageWidth - 86, finalY + 10);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(receipt.amount), pageWidth - 18, finalY + 20, { align: "right" });
  doc.setTextColor(0, 0, 0);

  // Thank you message using custom footer
  const thankYouY = finalY + 40;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(footerMessage, pageWidth / 2, thankYouY, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("This receipt confirms your payment has been received.", pageWidth / 2, thankYouY + 6, { align: "center" });
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
    doc.setTextColor(0, 0, 0);
  }

  return doc;
};

export const downloadReceiptPDF = async (receipt: ReceiptData, userId?: string, currency: CurrencyCode = "KES") => {
  const doc = await generateReceiptPDF(receipt, userId, currency);
  doc.save(`receipt_${receipt.invoice_number}_${new Date().toISOString().split("T")[0]}.pdf`);
};
