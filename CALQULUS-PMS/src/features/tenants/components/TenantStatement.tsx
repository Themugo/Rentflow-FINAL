import { format } from "date-fns";
import { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Separator } from "@/shared/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import {
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  Calendar,
  Download,
  Printer,
  Mail,
  Loader2,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/shared/hooks/use-toast";
import { formatCurrency } from "@/shared/lib/formatCurrency";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  property: string | null;
  unit: string | null;
  status: string;
  photo_url: string | null;
  move_in_date: string | null;
  statement_history_months?: number | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: "paid" | "pending" | "overdue" | "cancelled";
  description: string | null;
  created_at: string;
}

interface CompanySettings {
  company_name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  logo_url: string | null;
}

interface TenantStatementProps {
  tenant: Tenant | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isManagerView?: boolean; // When true, ignores statement_history_months restriction
}

const statusStyles: Record<string, { bg: string; icon: React.ReactNode }> = {
  paid: {
    bg: "bg-success/10 text-success border-success/20",
    icon: <CheckCircle className="h-3.5 w-3.5" />,
  },
  pending: {
    bg: "bg-warning/10 text-warning border-warning/20",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  overdue: {
    bg: "bg-red-500/10 text-red-400 border-red-500/20",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  cancelled: {
    bg: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
};

export const TenantStatement = ({
  tenant,
  isOpen,
  onOpenChange,
  isManagerView = true, // Default to manager view (no restrictions)
}: TenantStatementProps) => {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [historyLimit, setHistoryLimit] = useState<number | null>(null);

  const fetchCompanySettings = async () => {
    const { data, error } = await supabase
      .from("company_settings")
      .select("*")
      .maybeSingle();

    if (!error && data) {
      setCompanySettings(data);
    }
  };

  const fetchInvoices = useCallback(async () => {
    if (!tenant) return;

    setIsLoading(true);
    
    let query = supabase
      .from("invoices")
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("due_date", { ascending: false });
    
    // Apply date filter for non-manager views with history limit
    if (!isManagerView && tenant.statement_history_months) {
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - tenant.statement_history_months);
      query = query.gte("due_date", cutoffDate.toISOString().split('T')[0]);
    }
    
    const { data, error } = await query;

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch invoices",
        variant: "destructive",
      });
    } else {
      setInvoices(data || []);
    }
    setIsLoading(false);
  }, [tenant?.id, tenant?.statement_history_months, isManagerView, toast]);

  useEffect(() => {
    if (tenant && isOpen) {
      if (!isManagerView && tenant.statement_history_months) {
        setHistoryLimit(tenant.statement_history_months);
      } else {
        setHistoryLimit(null);
      }
      fetchInvoices();
      fetchCompanySettings();
    }
  }, [tenant?.id, tenant?.statement_history_months, isOpen, isManagerView, fetchInvoices]);

  const totalBilled = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
  const totalPaid = invoices
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + Number(inv.amount), 0);
  const outstandingBalance = invoices
    .filter((inv) => inv.status === "pending" || inv.status === "overdue")
    .reduce((sum, inv) => sum + Number(inv.amount), 0);

  const formatKES = (amount: number) => formatCurrency(amount, "KES", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const generatePDF = async () => {
    if (!tenant) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    let yPos = 14;
    let logoWidth = 0;

    // Company Header with Logo
    if (companySettings) {
      // Add logo if available
      if (companySettings.logo_url) {
        try {
          const response = await fetch(companySettings.logo_url);
          const blob = await response.blob();
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          
          // Add logo to PDF (max height 20mm, maintain aspect ratio)
          const img = new Image();
          img.src = base64;
          await new Promise((resolve) => { img.onload = resolve; });
          const aspectRatio = img.width / img.height;
          const logoHeight = 20;
          logoWidth = logoHeight * aspectRatio;
          
          doc.addImage(base64, "PNG", 14, yPos - 4, logoWidth, logoHeight);
        } catch (error) {
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
      
      // Ensure yPos accounts for logo height if logo is taller than text
      if (logoWidth > 0) {
        yPos = Math.max(yPos, 14 + 20 + 6);
      }
      yPos += 6;
    }

    // Statement Title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("ACCOUNT STATEMENT", pageWidth / 2, yPos, { align: "center" });
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${format(new Date(), 'dd/MM/yy')}`, pageWidth / 2, yPos, {
      align: "center",
    });
    yPos += 12;

    // Separator line
    doc.setDrawColor(200, 200, 200);
    doc.line(14, yPos, pageWidth - 14, yPos);
    yPos += 10;

    // Tenant Info
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Bill To:", 14, yPos);
    yPos += 6;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(tenant.name, 14, yPos);
    yPos += 5;
    doc.text(tenant.email, 14, yPos);
    yPos += 5;
    if (tenant.phone) {
      doc.text(tenant.phone, 14, yPos);
      yPos += 5;
    }
    if (tenant.property) {
      doc.text(
        `${tenant.property}${tenant.unit ? ` - ${tenant.unit}` : ""}`,
        14,
        yPos
      );
      yPos += 5;
    }
    yPos += 8;

    // Summary Box
    doc.setFillColor(245, 245, 245);
    doc.rect(14, yPos, pageWidth - 28, 25, "F");

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    const colWidth = (pageWidth - 28) / 3;

    doc.text("Total Billed", 14 + colWidth / 2, yPos + 8, { align: "center" });
    doc.text("Total Paid", 14 + colWidth + colWidth / 2, yPos + 8, {
      align: "center",
    });
    doc.text("Outstanding", 14 + colWidth * 2 + colWidth / 2, yPos + 8, {
      align: "center",
    });

    doc.setFont("helvetica", "normal");
    doc.text(formatKES(totalBilled), 14 + colWidth / 2, yPos + 18, {
      align: "center",
    });
    doc.setTextColor(34, 197, 94);
    doc.text(formatKES(totalPaid), 14 + colWidth + colWidth / 2, yPos + 18, {
      align: "center",
    });
    doc.setTextColor(outstandingBalance > 0 ? 245 : 0, outstandingBalance > 0 ? 158 : 0, outstandingBalance > 0 ? 11 : 0);
    doc.text(
      formatKES(outstandingBalance),
      14 + colWidth * 2 + colWidth / 2,
      yPos + 18,
      { align: "center" }
    );
    doc.setTextColor(0, 0, 0);

    const tableStartY = yPos + 35;

    // Invoice Table
    const tableData = invoices.map((inv) => [
      inv.invoice_number,
      inv.description || "-",
      format(new Date(inv.due_date), 'dd/MM/yy'),
      inv.paid_date ? format(new Date(inv.paid_date), 'dd/MM/yy') : "-",
      inv.status.charAt(0).toUpperCase() + inv.status.slice(1),
      formatKES(Number(inv.amount)),
    ]);

    autoTable(doc, {
      startY: tableStartY,
      head: [["Invoice #", "Description", "Due Date", "Paid Date", "Status", "Amount"]],
      body: tableData,
      theme: "striped",
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 45 },
        5: { halign: "right" },
      },
    });

    // Footer with company contact
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

  const handleDownload = async () => {
    const doc = await generatePDF();
    if (doc && tenant) {
      doc.save(`statement_${tenant.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`);
      toast({
        title: "Downloaded",
        description: "Statement PDF has been downloaded.",
      });
    }
  };

  const handlePrint = async () => {
    const doc = await generatePDF();
    if (doc) {
      doc.autoPrint();
      window.open(doc.output("bloburl"), "_blank");
    }
  };

  const handleSendEmail = async () => {
    if (!tenant || invoices.length === 0) return;

    setIsSendingEmail(true);
    try {
      const doc = await generatePDF();
      if (!doc) {
        throw new Error("Failed to generate PDF");
      }

      // Convert PDF to base64
      const pdfBase64 = doc.output("datauristring").split(",")[1];
      const fileName = `statement_${tenant.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;

      const { data, error } = await supabase.functions.invoke("send-invoice-email", {
        body: {
          tenantEmail: tenant.email,
          tenantName: tenant.name,
          companyName: companySettings?.company_name || "CALQULUS PMS Properties",
          pdfBase64,
          fileName,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Email Sent",
          description: `Statement has been sent to ${tenant.email}`,
        });
      } else {
        throw new Error(data?.error || "Failed to send email");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="bg-card border-border w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-foreground flex items-center gap-3">
            {tenant && (
              <>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={tenant.photo_url || undefined} />
                  <AvatarFallback className="bg-amber-400 text-slate-900 text-xs">
                    {tenant.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <span>{tenant.name}</span>
                  {tenant.property && (
                    <p className="text-sm font-normal text-muted-foreground">
                      {tenant.property} {tenant.unit && `- ${tenant.unit}`}
                    </p>
                  )}
                </div>
              </>
            )}
          </SheetTitle>
          <SheetDescription>Account Statement & Payment History</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={invoices.length === 0}
              className="flex-1"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={invoices.length === 0}
              className="flex-1"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSendEmail}
              disabled={invoices.length === 0 || isSendingEmail}
              className="flex-1"
            >
              {isSendingEmail ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Email
            </Button>
          </div>

          {/* Balance Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/30 rounded-lg p-3 text-center">
              <Wallet className="h-5 w-5 mx-auto mb-1 text-warning" />
              <p className="text-xs text-muted-foreground">Total Billed</p>
              <p className="text-sm font-semibold text-foreground">
                {formatKES(totalBilled)}
              </p>
            </div>
            <div className="bg-success/10 rounded-lg p-3 text-center">
              <CheckCircle className="h-5 w-5 mx-auto mb-1 text-success" />
              <p className="text-xs text-muted-foreground">Total Paid</p>
              <p className="text-sm font-semibold text-success">
                {formatKES(totalPaid)}
              </p>
            </div>
            <div
              className={`rounded-lg p-3 text-center ${
                outstandingBalance > 0
                  ? "bg-warning/10"
                  : "bg-muted/30"
              }`}
            >
              <Clock
                className={`h-5 w-5 mx-auto mb-1 ${
                  outstandingBalance > 0 ? "text-warning" : "text-muted-foreground"
                }`}
              />
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p
                className={`text-sm font-semibold ${
                  outstandingBalance > 0 ? "text-warning" : "text-foreground"
                }`}
              >
                {formatKES(outstandingBalance)}
              </p>
            </div>
          </div>

          <Separator className="bg-border" />

          {/* Invoice History */}
          <div>
            <h3 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Invoice History
            </h3>
            <ScrollArea className="h-[calc(100vh-440px)]">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading invoices...
                </div>
              ) : invoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No invoices found for this tenant.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="bg-muted/30 rounded-lg p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-foreground">
                            {invoice.invoice_number}
                          </p>
                          {invoice.description && (
                            <p className="text-xs text-muted-foreground">
                              {invoice.description}
                            </p>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={`${statusStyles[invoice.status]?.bg} flex items-center gap-1`}
                        >
                          {statusStyles[invoice.status]?.icon}
                          {invoice.status.charAt(0).toUpperCase() +
                            invoice.status.slice(1)}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            Due: {format(new Date(invoice.due_date), 'dd/MM/yy')}
                          </span>
                          {invoice.paid_date && (
                            <span className="flex items-center gap-1 text-success">
                              <CheckCircle className="h-3.5 w-3.5" />
                              Paid: {format(new Date(invoice.paid_date), 'dd/MM/yy')}
                            </span>
                          )}
                        </div>
                        <span className="font-semibold text-foreground">
                          {formatKES(Number(invoice.amount))}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
