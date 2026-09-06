import jsPDF from 'jspdf';
import { format } from 'date-fns';

interface VacationNoticeData {
  tenantName: string;
  tenantEmail: string;
  phoneNumber?: string;
  propertyName: string;
  unitNumber?: string;
  noticeDate: string;
  intendedMoveOutDate: string;
  reason?: string;
  forwardingAddress?: string;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  tenantSignature?: string;
  tenantSignedAt?: string;
}

export const generateVacationNoticePdf = (data: VacationNoticeData): jsPDF => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = margin;

  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('NOTICE OF INTENT TO VACATE', pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  // Date line
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${format(new Date(data.noticeDate), 'dd/MM/yy')}`, margin, yPos);
  yPos += 15;

  // To section
  doc.setFont('helvetica', 'bold');
  doc.text('To:', margin, yPos);
  doc.setFont('helvetica', 'normal');
  yPos += 7;
  if (data.companyName) {
    doc.text(data.companyName, margin, yPos);
    yPos += 5;
  }
  doc.text('Property Management', margin, yPos);
  yPos += 5;
  if (data.companyAddress) {
    doc.text(data.companyAddress, margin, yPos);
    yPos += 5;
  }
  yPos += 10;

  // From section
  doc.setFont('helvetica', 'bold');
  doc.text('From:', margin, yPos);
  doc.setFont('helvetica', 'normal');
  yPos += 7;
  doc.text(data.tenantName, margin, yPos);
  yPos += 5;
  doc.text(`Property: ${data.propertyName}${data.unitNumber ? ` - Unit ${data.unitNumber}` : ''}`, margin, yPos);
  yPos += 5;
  doc.text(`Email: ${data.tenantEmail}`, margin, yPos);
  yPos += 5;
  if (data.phoneNumber) {
    doc.text(`Phone: ${data.phoneNumber}`, margin, yPos);
    yPos += 5;
  }
  yPos += 10;

  // Horizontal line
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  // Notice body
  doc.setFontSize(11);
  const bodyText = `Dear Property Management,

This letter serves as formal notice of my intention to vacate the premises located at ${data.propertyName}${data.unitNumber ? `, Unit ${data.unitNumber}` : ''}.

My intended move-out date is: ${format(new Date(data.intendedMoveOutDate), 'dd/MM/yy')}

${data.reason ? `Reason for vacating: ${data.reason}` : ''}

${data.forwardingAddress ? `My forwarding address will be:\n${data.forwardingAddress}` : 'I will provide my forwarding address at a later date.'}

I understand that I am responsible for:
• Returning all keys and access devices
• Leaving the property in clean condition
• Completing a final walk-through inspection
• Settling any outstanding balances

Please contact me to schedule a move-out inspection and to discuss the return of my security deposit.

Thank you for your attention to this matter.`;

  const splitText = doc.splitTextToSize(bodyText, pageWidth - (margin * 2));
  doc.text(splitText, margin, yPos);
  yPos += splitText.length * 5 + 20;

  // Signature section
  doc.text('Sincerely,', margin, yPos);
  yPos += 15;

  // Add e-signature if available
  if (data.tenantSignature) {
    try {
      doc.addImage(data.tenantSignature, 'PNG', margin, yPos - 5, 60, 25);
      yPos += 25;
    } catch (error) {
      doc.setLineWidth(0.3);
      doc.line(margin, yPos, margin + 80, yPos);
      yPos += 5;
    }
  } else {
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, margin + 80, yPos);
    yPos += 5;
  }

  doc.setFontSize(10);
  doc.text('Tenant Signature', margin, yPos);
  yPos += 5;
  if (data.tenantSignedAt) {
    doc.text(`Signed: ${format(new Date(data.tenantSignedAt), 'dd/MM/yy')}`, margin, yPos);
    yPos += 10;
  } else {
    yPos += 5;
  }

  doc.line(margin, yPos, margin + 80, yPos);
  yPos += 5;
  doc.text(`Printed Name: ${data.tenantName}`, margin, yPos);
  yPos += 10;

  doc.line(margin, yPos, margin + 80, yPos);
  yPos += 5;
  doc.text('Date', margin, yPos);

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(128, 128, 128);
  doc.text(
    `Generated on ${format(new Date(), 'dd/MM/yy')}`,
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: 'center' }
  );

  return doc;
};

export const downloadVacationNoticePdf = (data: VacationNoticeData, filename?: string): void => {
  const doc = generateVacationNoticePdf(data);
  const defaultFilename = `vacation-notice-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(filename || defaultFilename);
};
