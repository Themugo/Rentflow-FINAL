import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { createCurrencyFormatter, drawCompanyPdfHeader, fetchCompanySettings } from "@/shared/lib/pdf/companyPdfHeader";
import { composeBrandConfig } from "@/core/brand/composeBrandConfig";
import { documentAccent, documentFooter, documentShowLogo, documentTitle } from "@/core/brand/pdfCompany";
import type { OrgBrandRecord } from "@/core/brand/parseOrgRecord";

export interface IssuedPaymentReceiptPayload {
  receipt: { id: string; receipt_number: string; issued_at: string; total_amount: number };
  payer?: { display_name?: string | null; phone?: string | null; party_type?: string | null } | null;
  transaction?: { id: string; payment_type?: string | null; mpesa_receipt_number?: string | null; bank_reference?: string | null; phone_number?: string | null } | null;
  allocations: Array<{ invoice_number?: string | null; unit_number?: string | null; property_name?: string | null; amount?: number | null }>;
}

const hexToRgb = (hex: string): [number, number, number] => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [34, 197, 94];
};

export async function fetchIssuedPaymentReceipt(id: string): Promise<IssuedPaymentReceiptPayload> {
  const { data, error } = await supabase.rpc("get_payment_receipt" as any, { p_receipt_id: id });
  if (error) throw error;
  if (!data?.receipt) throw new Error("Receipt could not be loaded");
  return data as IssuedPaymentReceiptPayload;
}

export async function generateIssuedPaymentReceiptPDF(payload: IssuedPaymentReceiptPayload): Promise<jsPDF> {
  const doc = new jsPDF();
  const width = doc.internal.pageSize.getWidth();
  const settings = await fetchCompanySettings();
  const brand = composeBrandConfig((settings as OrgBrandRecord | null) ?? null);
  const accent = hexToRgb(documentAccent(brand, "receipts"));
  const formatCurrency = createCurrencyFormatter("KES");
  let y = await drawCompanyPdfHeader(doc, settings, 14, { includeLogo: documentShowLogo(brand, "receipts") });

  doc.setFillColor(...accent); doc.circle(width / 2, y + 5, 8, "F");
  doc.setTextColor(255,255,255); doc.setFont("helvetica","bold"); doc.setFontSize(12); doc.text("✓", width / 2 - 2, y + 8);
  doc.setTextColor(0,0,0); y += 20;
  doc.setFontSize(21); doc.text(documentTitle(brand, "receipts"), width / 2, y, { align: "center" }); y += 7;
  doc.setFontSize(10); doc.setTextColor(...accent); doc.text("PAYMENT RECEIVED", width / 2, y, { align: "center" }); doc.setTextColor(0,0,0); y += 13;

  doc.setFontSize(10); doc.setFont("helvetica","bold"); doc.text(`Receipt: ${payload.receipt.receipt_number}`, 14, y);
  doc.setFont("helvetica","normal"); doc.text(new Date(payload.receipt.issued_at).toLocaleString(), width - 14, y, { align: "right" }); y += 8;
  doc.line(14, y, width - 14, y); y += 9;

  doc.setFont("helvetica","bold"); doc.text("Payer", 14, y); doc.setFont("helvetica","normal");
  doc.text(payload.payer?.display_name || "Payment party", 14, y + 5);
  if (payload.payer?.phone) doc.text(payload.payer.phone, 14, y + 10);
  doc.setFont("helvetica","bold"); doc.text("Payment", width / 2 + 8, y); doc.setFont("helvetica","normal");
  doc.text(String(payload.transaction?.payment_type || "payment").replace(/_/g, " ").toUpperCase(), width / 2 + 8, y + 5);
  const reference = payload.transaction?.mpesa_receipt_number || payload.transaction?.bank_reference || payload.transaction?.id;
  doc.text(`Reference: ${reference || "—"}`, width / 2 + 8, y + 10); y += 22;

  autoTable(doc, {
    startY: y,
    head: [["Property", "Unit", "Invoice", "Allocated"]],
    body: payload.allocations.map(a => [a.property_name || "—", a.unit_number || "—", a.invoice_number || "—", formatCurrency(Number(a.amount || 0))]),
    foot: [["", "", "TOTAL", formatCurrency(Number(payload.receipt.total_amount || 0))]],
    theme: "grid",
    headStyles: { fillColor: accent },
    footStyles: { fontStyle: "bold" },
    styles: { fontSize: 9 },
  });
  const finalY = (doc as any).lastAutoTable?.finalY ?? y + 20;
  doc.setFontSize(9); doc.setTextColor(100,100,100); doc.text(documentFooter(brand, "receipts"), 14, Math.min(finalY + 16, 280));
  return doc;
}

export async function downloadIssuedPaymentReceiptPDF(id: string): Promise<void> {
  const payload = await fetchIssuedPaymentReceipt(id);
  const doc = await generateIssuedPaymentReceiptPDF(payload);
  doc.save(`${payload.receipt.receipt_number}.pdf`);
}
