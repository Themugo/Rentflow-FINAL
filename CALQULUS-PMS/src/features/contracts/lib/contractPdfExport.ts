import jsPDF from "jspdf";
import { format } from "date-fns";
import { formatDate, formatDateTime12h } from "@/shared/lib/dateFormat";

interface ContractForPdf {
  title: string;
  content: string;
  valid_from: string | null;
  valid_until: string | null;
  manager_signature: string | null;
  manager_signed_at: string | null;
  tenant_signature: string | null;
  tenant_signed_at: string | null;
  tenantName?: string;
  propertyInfo?: string;
}

export async function exportContractToPdf(contract: ContractForPdf): Promise<void> {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPosition = margin;

  // Title
  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.text(contract.title, pageWidth / 2, yPosition, { align: "center" });
  yPosition += 12;

  // Contract info
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(100);

  if (contract.tenantName) {
    pdf.text(`Tenant: ${contract.tenantName}`, margin, yPosition);
    yPosition += 5;
  }

  if (contract.propertyInfo) {
    pdf.text(`Property: ${contract.propertyInfo}`, margin, yPosition);
    yPosition += 5;
  }

  if (contract.valid_from && contract.valid_until) {
    pdf.text(
      `Period: ${formatDate(contract.valid_from)} - ${formatDate(contract.valid_until)}`,
      margin,
      yPosition
    );
    yPosition += 5;
  }

  yPosition += 5;

  // Divider line
  pdf.setDrawColor(200);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  // Contract content
  pdf.setFontSize(11);
  pdf.setTextColor(0);

  // Parse and render content
  const lines = contract.content.split("\n");

  for (const line of lines) {
    // Check if we need a new page
    if (yPosition > pageHeight - 60) {
      pdf.addPage();
      yPosition = margin;
    }

    if (line.startsWith("# ")) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      yPosition += 4;
      pdf.text(line.slice(2), margin, yPosition);
      yPosition += 8;
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
    } else if (line.startsWith("## ")) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      yPosition += 3;
      pdf.text(line.slice(3), margin, yPosition);
      yPosition += 7;
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
    } else if (line.startsWith("### ")) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      yPosition += 2;
      pdf.text(line.slice(4), margin, yPosition);
      yPosition += 6;
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
    } else if (line.startsWith("- ")) {
      const bulletText = `• ${line.slice(2)}`;
      const splitText = pdf.splitTextToSize(bulletText, contentWidth - 5);
      pdf.text(splitText, margin + 5, yPosition);
      yPosition += splitText.length * 5;
    } else if (line === "---") {
      yPosition += 3;
      pdf.setDrawColor(200);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 6;
    } else if (line.trim() === "") {
      yPosition += 4;
    } else {
      // Regular paragraph - handle bold markers
      const cleanLine = line.replace(/\*\*([^*]+)\*\*/g, "$1");
      const splitText = pdf.splitTextToSize(cleanLine, contentWidth);
      pdf.text(splitText, margin, yPosition);
      yPosition += splitText.length * 5;
    }
  }

  // Signatures section
  yPosition += 10;

  // Check if we need a new page for signatures
  if (yPosition > pageHeight - 80) {
    pdf.addPage();
    yPosition = margin;
  }

  // Divider before signatures
  pdf.setDrawColor(200);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("SIGNATURES", margin, yPosition);
  yPosition += 10;

  const signatureWidth = (contentWidth - 20) / 2;

  // Manager signature
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.text("Manager Signature:", margin, yPosition);
  pdf.text("Tenant Signature:", margin + signatureWidth + 20, yPosition);
  yPosition += 5;

  pdf.setFont("helvetica", "normal");

  if (contract.manager_signature) {
    try {
      pdf.addImage(contract.manager_signature, "PNG", margin, yPosition, 50, 20);
      pdf.setFontSize(8);
      pdf.setTextColor(100);
      pdf.text(
        `Signed: ${formatDate(contract.manager_signed_at!)}`,
        margin,
        yPosition + 24
      );
    } catch {
      pdf.text("(Signature on file)", margin, yPosition + 10);
    }
  } else {
    pdf.setTextColor(150);
    pdf.text("Not signed", margin, yPosition + 10);
  }

  if (contract.tenant_signature) {
    try {
      pdf.addImage(contract.tenant_signature, "PNG", margin + signatureWidth + 20, yPosition, 50, 20);
      pdf.setFontSize(8);
      pdf.setTextColor(100);
      pdf.text(
        `Signed: ${formatDate(contract.tenant_signed_at!)}`,
        margin + signatureWidth + 20,
        yPosition + 24
      );
    } catch {
      pdf.text("(Signature on file)", margin + signatureWidth + 20, yPosition + 10);
    }
  } else {
    pdf.setTextColor(150);
    pdf.text("Not signed", margin + signatureWidth + 20, yPosition + 10);
  }

  // Footer
  pdf.setFontSize(8);
  pdf.setTextColor(150);
  pdf.text(
    `Generated on ${formatDateTime12h(new Date())}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: "center" }
  );

  // Save the PDF
  const fileName = `${contract.title.replace(/[^a-z0-9]/gi, "_")}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
  pdf.save(fileName);
}
