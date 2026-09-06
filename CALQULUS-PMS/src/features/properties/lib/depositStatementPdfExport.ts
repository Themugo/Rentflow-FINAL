import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  property: string | null;
  unit: string | null;
  move_in_date: string | null;
  deposit_amount: number | null;
  deposit_balance: number | null;
}

interface Deduction {
  id: string;
  amount: number;
  description: string;
  deduction_type: string;
  created_at: string;
}

interface Refund {
  id: string;
  refund_amount: number;
  refund_method: string;
  refund_reference: string | null;
  status: string;
  move_out_date: string;
  processed_at: string | null;
  created_at: string;
}

interface CompanySettings {
  company_name?: string;
  company_address?: string;
  company_phone?: string;
  company_email?: string;
}

export const generateDepositStatementPdf = (
  tenant: Tenant,
  deductions: Deduction[],
  refund: Refund | null,
  companySettings?: CompanySettings
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Colors
  const primaryColor: [number, number, number] = [59, 130, 246]; // Blue
  const textColor: [number, number, number] = [31, 41, 55];
  const mutedColor: [number, number, number] = [107, 114, 128];

  // Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 40, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("DEPOSIT STATEMENT", 14, 25);

  // Company info on right
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (companySettings?.company_name) {
    doc.text(companySettings.company_name, pageWidth - 14, 15, { align: "right" });
  }
  if (companySettings?.company_phone) {
    doc.text(companySettings.company_phone, pageWidth - 14, 22, { align: "right" });
  }
  if (companySettings?.company_email) {
    doc.text(companySettings.company_email, pageWidth - 14, 29, { align: "right" });
  }

  let yPos = 55;

  // Statement details
  doc.setTextColor(...textColor);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Statement Date:", 14, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(format(new Date(), "dd/MM/yy"), 50, yPos);

  // Tenant Information Box
  yPos += 15;
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(14, yPos - 5, pageWidth - 28, 45, 3, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Tenant Information", 20, yPos + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...mutedColor);
  
  yPos += 15;
  doc.text("Name:", 20, yPos);
  doc.setTextColor(...textColor);
  doc.text(tenant.name, 50, yPos);

  doc.setTextColor(...mutedColor);
  doc.text("Email:", 110, yPos);
  doc.setTextColor(...textColor);
  doc.text(tenant.email, 130, yPos);

  yPos += 8;
  doc.setTextColor(...mutedColor);
  doc.text("Property:", 20, yPos);
  doc.setTextColor(...textColor);
  doc.text(tenant.property || "N/A", 50, yPos);

  doc.setTextColor(...mutedColor);
  doc.text("Unit:", 110, yPos);
  doc.setTextColor(...textColor);
  doc.text(tenant.unit || "N/A", 130, yPos);

  yPos += 8;
  doc.setTextColor(...mutedColor);
  doc.text("Move-in:", 20, yPos);
  doc.setTextColor(...textColor);
  doc.text(tenant.move_in_date ? format(new Date(tenant.move_in_date), "dd/MM/yy") : "N/A", 50, yPos);

  if (refund?.move_out_date) {
    doc.setTextColor(...mutedColor);
    doc.text("Move-out:", 110, yPos);
    doc.setTextColor(...textColor);
    doc.text(format(new Date(refund.move_out_date), "dd/MM/yy"), 140, yPos);
  }

  // Deposit Summary
  yPos += 25;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...textColor);
  doc.text("Deposit Summary", 14, yPos);

  const originalDeposit = tenant.deposit_amount || 0;
  const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);
  const currentBalance = tenant.deposit_balance ?? originalDeposit;

  // Summary table
  yPos += 5;
  autoTable(doc, {
    startY: yPos,
    head: [["Description", "Amount (KES)"]],
    body: [
      ["Original Deposit", originalDeposit.toLocaleString()],
      ["Total Deductions", `(${totalDeductions.toLocaleString()})`],
      ["Current Balance", currentBalance.toLocaleString()],
    ],
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
      0: { cellWidth: 100 },
      1: { cellWidth: 60, halign: "right" },
    },
    margin: { left: 14, right: 14 },
  });

  // Deductions table
  if (deductions.length > 0) {
    yPos = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Deduction History", 14, yPos);

    autoTable(doc, {
      startY: yPos + 5,
      head: [["Date", "Description", "Type", "Amount (KES)"]],
      body: deductions.map((d) => [
        format(new Date(d.created_at), "dd/MM/yy"),
        d.description,
        d.deduction_type === "maintenance_auto" ? "Auto (Maintenance)" :
        d.deduction_type === "maintenance_manual" ? "Manual (Maintenance)" : "Manual",
        d.amount.toLocaleString(),
      ]),
      theme: "striped",
      headStyles: {
        fillColor: [220, 38, 38], // Red for deductions
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      styles: {
        fontSize: 9,
        cellPadding: 4,
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 80 },
        2: { cellWidth: 35 },
        3: { cellWidth: 35, halign: "right" },
      },
      margin: { left: 14, right: 14 },
    });
  }

  // Refund details if exists
  if (refund) {
    yPos = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
    
    doc.setFillColor(236, 253, 245); // Light green
    doc.roundedRect(14, yPos - 5, pageWidth - 28, 35, 3, 3, "F");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(22, 163, 74); // Green
    doc.text("Refund Details", 20, yPos + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...textColor);
    
    yPos += 15;
    doc.text(`Refund Amount: KES ${refund.refund_amount.toLocaleString()}`, 20, yPos);
    doc.text(`Method: ${refund.refund_method.replace("_", " ").toUpperCase()}`, 110, yPos);
    
    yPos += 8;
    doc.text(`Status: ${refund.status.toUpperCase()}`, 20, yPos);
    if (refund.refund_reference) {
      doc.text(`Reference: ${refund.refund_reference}`, 110, yPos);
    }
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setDrawColor(...mutedColor);
  doc.line(14, footerY - 5, pageWidth - 14, footerY - 5);
  
  doc.setFontSize(8);
  doc.setTextColor(...mutedColor);
  doc.text(
    `Generated on ${format(new Date(), "dd/MM/yyyy 'at' HH:mm")}`,
    14,
    footerY
  );
  doc.text(
    "This is a computer-generated statement",
    pageWidth - 14,
    footerY,
    { align: "right" }
  );

  // Save the PDF
  const fileName = `Deposit_Statement_${tenant.name.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`;
  doc.save(fileName);
};
