import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { CurrencyCode, CURRENCIES } from "@/shared/hooks/useCurrency";

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

interface ManagerInfo {
  full_name: string | null;
  email: string;
}

const createCurrencyFormatter = (currency: CurrencyCode = "KES") => {
  const currencyInfo = CURRENCIES.find(c => c.code === currency) || CURRENCIES[1];
  return (amount: number) => `${currencyInfo.symbol} ${Number(amount).toLocaleString()}`;
};

export const generateManagerReceipt = (invoice: ManagerInvoice, manager: ManagerInfo, currency: CurrencyCode = "KES") => {
  const formatCurrency = createCurrencyFormatter(currency);
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Colors
  const primaryColor: [number, number, number] = [147, 51, 234]; // Purple
  const darkText: [number, number, number] = [30, 30, 30];
  const grayText: [number, number, number] = [100, 100, 100];
  
  // Header with gradient effect
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  // Company name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('CALQULUS PMS', 20, 25);
  
  // Receipt label
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('PAYMENT RECEIPT', pageWidth - 20, 20, { align: 'right' });
  doc.setFontSize(10);
  doc.text(`Receipt #: ${invoice.invoice_number}`, pageWidth - 20, 30, { align: 'right' });
  
  // Receipt details section
  let yPos = 65;
  
  // Status badge
  doc.setFillColor(16, 185, 129); // Emerald for paid
  doc.roundedRect(20, yPos - 8, 30, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('PAID', 35, yPos - 2, { align: 'center' });
  
  yPos += 15;
  
  // Receipt info grid
  doc.setTextColor(...grayText);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  // Left column
  doc.text('Invoice Date:', 20, yPos);
  doc.text('Payment Date:', 20, yPos + 10);
  doc.text('Due Date:', 20, yPos + 20);
  
  doc.setTextColor(...darkText);
  doc.setFont('helvetica', 'bold');
  doc.text(format(new Date(invoice.created_at), 'dd/MM/yy'), 60, yPos);
  doc.text(invoice.paid_date ? format(new Date(invoice.paid_date), 'dd/MM/yy') : 'N/A', 60, yPos + 10);
  doc.text(format(new Date(invoice.due_date), 'dd/MM/yy'), 60, yPos + 20);
  
  // Right column - Billed To
  doc.setTextColor(...grayText);
  doc.setFont('helvetica', 'normal');
  doc.text('Billed To:', pageWidth - 80, yPos);
  
  doc.setTextColor(...darkText);
  doc.setFont('helvetica', 'bold');
  doc.text(manager.full_name || 'Property Manager', pageWidth - 80, yPos + 10);
  doc.setFont('helvetica', 'normal');
  doc.text(manager.email, pageWidth - 80, yPos + 20);
  
  yPos += 45;
  
  // Divider line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(20, yPos, pageWidth - 20, yPos);
  
  yPos += 15;
  
  // Invoice details table header
  doc.setFillColor(245, 245, 250);
  doc.rect(20, yPos - 5, pageWidth - 40, 12, 'F');
  
  doc.setTextColor(...grayText);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Description', 25, yPos + 3);
  doc.text('Properties', pageWidth - 85, yPos + 3, { align: 'right' });
  doc.text('Rate', pageWidth - 55, yPos + 3, { align: 'right' });
  doc.text('Amount', pageWidth - 25, yPos + 3, { align: 'right' });
  
  yPos += 20;
  
  // Invoice item
  doc.setTextColor(...darkText);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.description || 'Platform Service Fee', 25, yPos);
  doc.text(String(invoice.property_count || 0), pageWidth - 85, yPos, { align: 'right' });
  doc.text(formatCurrency(invoice.rate_per_property || 1000), pageWidth - 55, yPos, { align: 'right' });
  doc.text(formatCurrency(invoice.amount), pageWidth - 25, yPos, { align: 'right' });
  
  yPos += 25;
  
  // Divider line
  doc.line(20, yPos, pageWidth - 20, yPos);
  
  yPos += 15;
  
  // Total section
  doc.setFillColor(...primaryColor);
  doc.rect(pageWidth - 90, yPos - 5, 70, 20, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL PAID', pageWidth - 85, yPos + 3);
  doc.setFontSize(12);
  doc.text(formatCurrency(invoice.amount), pageWidth - 25, yPos + 3, { align: 'right' });
  
  yPos += 40;
  
  // Thank you message
  doc.setTextColor(...primaryColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Thank you for your payment!', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 15;
  
  doc.setTextColor(...grayText);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('This receipt confirms your payment has been processed successfully.', pageWidth / 2, yPos, { align: 'center' });
  doc.text('Please keep this receipt for your records.', pageWidth / 2, yPos + 10, { align: 'center' });
  
  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setDrawColor(200, 200, 200);
  doc.line(20, footerY - 10, pageWidth - 20, footerY - 10);
  
  doc.setTextColor(...grayText);
  doc.setFontSize(8);
  doc.text('CALQULUS PMS Property Management Platform', pageWidth / 2, footerY, { align: 'center' });
  doc.text(`Generated on ${format(new Date(), 'MMM dd, yyyy \'at\' HH:mm')}`, pageWidth / 2, footerY + 8, { align: 'center' });
  
  // Save the PDF
  const fileName = `Receipt_${invoice.invoice_number}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(fileName);
};
