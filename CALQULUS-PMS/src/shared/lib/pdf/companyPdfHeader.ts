import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { CurrencyCode } from "@/shared/hooks/useCurrency";

/**
 * Shared PDF export helpers.
 *
 * Extracted from what used to be near-identical copies of the same
 * "company header" drawing logic in invoicePdfExport.ts, receiptPdfExport.ts,
 * and maintenanceReportPdfExport.ts (~70-150 duplicated lines each).
 */

export interface CompanySettings {
  company_name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  logo_url: string | null;
  brand_primary_hex?: string | null;
  white_label_enabled?: boolean | null;
  brand_config?: unknown;
}

export const createCurrencyFormatter = (currency: CurrencyCode = "KES") => {
  const locale = currency === "KES" ? "en-KE" : currency === "USD" ? "en-US" : currency === "EUR" ? "de-DE" : "en-GB";
  return (amount: number) => {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };
};

export const fetchCompanySettings = async (): Promise<CompanySettings | null> => {
  const { data, error } = await supabase
    .from("company_settings")
    .select("*")
    .maybeSingle();

  if (!error && data) {
    return data;
  }
  return null;
};

/**
 * Draws the company logo + name/address/contact block used at the top of
 * every generated PDF (invoices, receipts, maintenance reports). Returns the
 * yPos to continue drawing from.
 */
export const drawCompanyPdfHeader = async (
  doc: jsPDF,
  companySettings: CompanySettings | null,
  startYPos = 14,
  options: { includeLogo?: boolean } = {}
): Promise<number> => {
  const includeLogo = options.includeLogo ?? true;
  let yPos = startYPos;
  let logoWidth = 0;

  if (!companySettings) {
    return yPos;
  }

  if (companySettings.logo_url && includeLogo) {
    try {
      const response = await fetch(companySettings.logo_url);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      const img = new Image();
      img.src = base64;
      await new Promise((resolve) => { img.onload = resolve; });
      const aspectRatio = img.width / img.height;
      const logoHeight = 20;
      logoWidth = logoHeight * aspectRatio;

      doc.addImage(base64, "PNG", 14, yPos - 4, logoWidth, logoHeight);
    } catch {
      // Logo failed to load — continue without it
    }
  }

  const textStartX = logoWidth > 0 ? 14 + logoWidth + 6 : 14;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(companySettings.company_name, textStartX, yPos);
  yPos += 6;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);

  if (companySettings.address) {
    doc.text(companySettings.address, textStartX, yPos);
    yPos += 4;
  }

  if (companySettings.city || companySettings.state || companySettings.zip_code) {
    const cityStateZip = [
      companySettings.city,
      companySettings.state,
      companySettings.zip_code,
    ]
      .filter(Boolean)
      .join(", ");
    doc.text(cityStateZip, textStartX, yPos);
    yPos += 4;
  }

  const contactInfo: string[] = [];
  if (companySettings.phone) contactInfo.push(`Tel: ${companySettings.phone}`);
  if (companySettings.email) contactInfo.push(companySettings.email);
  if (contactInfo.length > 0) {
    doc.text(contactInfo.join(" | "), textStartX, yPos);
    yPos += 4;
  }

  if (companySettings.website) {
    doc.text(companySettings.website, textStartX, yPos);
    yPos += 4;
  }

  doc.setTextColor(0, 0, 0);

  if (logoWidth > 0) {
    yPos = Math.max(yPos, 14 + 20 + 6);
  }
  yPos += 6;

  return yPos;
};

/**
 * jspdf-autotable augments a jsPDF instance with `lastAutoTable` at runtime,
 * but doesn't ship a type augmentation for it. Casting through `unknown`
 * (rather than casting directly, or falling back to `any`) is the safe way
 * to read it without disabling type-checking for the whole call site.
 */
export function getAutoTableFinalY(doc: import("jspdf").default): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}
