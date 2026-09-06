// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { isDevAccessEnabled } from "@/features/auth/lib/devAccess";
import { Navigate, useSearchParams } from "react-router-dom";
import { openSafely } from "@/shared/lib/safeWindow";
import { Layout } from "@/shared/components/layout/Layout";
import ManagerSubscriptionBanner from "@/features/payments/components/ManagerSubscriptionBanner";
import { ManagerPlanStatus } from "@/features/payments/components/ManagerPlanStatus";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { StatCard } from "@/shared/components/StatCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { EmptyState } from "@/shared/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  Receipt,
  CreditCard,
  CheckCircle,
  Clock,
  AlertCircle,
  Smartphone,
  Loader2,
  RefreshCw,
  FileText,
  Calendar,
  Download as DownloadIcon,
  FileCheck,
  FileSignature,
  Download,
  Eye,
  PenLine,
  ShieldCheck,
  XCircle,
  Mail,
  MessageCircle,
  Send,
} from "lucide-react";
import { useToast } from "@/shared/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { format } from "date-fns";
import { SignatureCanvas } from "@/features/contracts/components/SignatureCanvas";
import { InvoiceTable } from "@/features/payments/components/InvoiceTable";
import { trackCommercialEvent } from "@/features/dashboard/lib/commercialMetrics";

// =====================
// TYPES
// =====================

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

type ContractStatus = "pending" | "approved" | "rejected" | "signed" | "expired" | "cancelled";

interface ManagerContract {
  id: string;
  manager_user_id: string;
  manager_email: string;
  manager_name: string | null;
  title: string;
  description: string | null;
  contract_type: string | null;
  status: ContractStatus;
  uploaded_contract_url: string | null;
  parsed_content: Record<string, unknown> | null;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  signed_at: string | null;
  signature_url: string | null;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
}

const contractStatusConfig: Record<ContractStatus, { label: string; styles: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: "Pending Review", styles: "bg-[hsl(38_92%_50%/0.1)] text-[hsl(38_92%_40%)] border-[hsl(38_92%_50%/0.2)]", icon: Clock },
  approved: { label: "Ready to Sign", styles: "bg-[hsl(214_73%_48%/0.1)] text-[hsl(214_73%_48%)] border-[hsl(214_73%_48%/0.2)]", icon: CheckCircle },
  rejected: { label: "Rejected", styles: "bg-[hsl(0_72%_51%/0.08)] text-[hsl(0_72%_51%)] border-[hsl(0_72%_51%/0.15)]", icon: XCircle },
  signed: { label: "Signed", styles: "bg-[hsl(214_73%_48%/0.1)] text-[hsl(214_73%_48%)] border-[hsl(214_73%_48%/0.2)]", icon: ShieldCheck },
  expired: { label: "Expired", styles: "bg-[hsl(220_9%_46%/0.1)] text-[hsl(220_9%_46%)] border-[hsl(220_9%_46%/0.15)]", icon: XCircle },
  cancelled: { label: "Cancelled", styles: "bg-[hsl(220_9%_46%/0.1)] text-[hsl(220_9%_46%)] border-[hsl(220_9%_46%/0.15)]", icon: XCircle },
};

// =====================
// CONTRACT CARD COMPONENT
// =====================

interface ContractCardProps {
  contract: ManagerContract;
  onPreview: () => void;
  onSign: () => void;
  onDownload: () => void;
  getStatusBadge: (status: ContractStatus) => React.ReactNode;
  highlight?: boolean;
}

const ContractCard = ({
  contract,
  onPreview,
  onSign,
  onDownload,
  getStatusBadge,
  highlight = false,
}: ContractCardProps) => {
  return (
    <Card className={`transition-all ${highlight ? "border-[hsl(214_73%_48%/0.5)] bg-[hsl(214_73%_48%/0.05)]" : "border-border/50 bg-card/50"}`}>
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-amber-400/10 flex items-center justify-center flex-shrink-0">
              <FileText className="h-5 w-5 text-warning" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate">{contract.title}</h3>
              <p className="text-sm text-muted-foreground line-clamp-1">
                {contract.description || "Service agreement with platform"}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {getStatusBadge(contract.status)}
                {contract.valid_from && contract.valid_until && (
                  <span className="text-xs text-muted-foreground">
                    Valid: {format(new Date(contract.valid_from), "dd/MM/yy")} - {format(new Date(contract.valid_until), "dd/MM/yy")}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={onPreview}>
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
            {contract.uploaded_contract_url && (
              <Button variant="outline" size="sm" onClick={onDownload}>
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
            )}
            {contract.status === "approved" && (
              <Button size="sm" onClick={onSign}>
                <PenLine className="h-4 w-4 mr-1" />
                Sign
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// =====================
// MAIN COMPONENT
// =====================

const ManagerPlatformBilling = () => {
  const { user, userRole, loading } = useAuth();
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [searchParams, setSearchParams] = useSearchParams();
  const paymentProcessedRef = useRef(false);
  const [activeTab, setActiveTab] = useState("invoices");

  // Invoice state
  const [invoices, setInvoices] = useState<ManagerInvoice[]>([]);
  const [propertyCount, setPropertyCount] = useState(0);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<ManagerInvoice | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"mpesa" | "stripe" | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "pending" | "verifying" | "success">("idle");

  // Contract state
  const [contracts, setContracts] = useState<ManagerContract[]>([]);
  const [isLoadingContracts, setIsLoadingContracts] = useState(true);
  const [selectedContract, setSelectedContract] = useState<ManagerContract | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [isSigning, setIsSigning] = useState(false);

  // Send notification state
  const [isSendingEmail, setIsSendingEmail] = useState<string | null>(null);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState<string | null>(null);

  // =====================
  // INVOICE FUNCTIONS
  // =====================

  const fetchInvoices = useCallback(async () => {
    if (!user) return;
    setIsLoadingInvoices(true);
    
    const { data, error } = await supabase
      .from("manager_invoices")
      .select("*")
      .eq("manager_user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: "Failed to fetch invoices", variant: "destructive" });
    } else {
      setInvoices(data || []);
    }

    const { count } = await supabase
      .from("properties")
      .select("*", { count: "exact", head: true })
      .eq("manager_id", user.id);
    
    setPropertyCount(count || 0);
    setIsLoadingInvoices(false);
  }, [user, toast]);

  // Check for payment success/failure in URL
  useEffect(() => {
    const payment = searchParams.get('payment');
    if (!payment || paymentProcessedRef.current) return;

    paymentProcessedRef.current = true;
    if (payment === 'success') {
      toast({ 
        title: 'Payment processing', 
        description: 'Please wait while we confirm your payment.' 
      });
      trackCommercialEvent('subscription_paid', { managerId: user?.id });
      setTimeout(() => fetchInvoices(), 3000);
      setSearchParams({});
    } else if (payment === 'cancelled') {
      toast({ title: 'Payment cancelled', variant: 'destructive' });
      trackCommercialEvent('payment_failed', { managerId: user?.id, properties: { reason: 'cancelled' } });
      setSearchParams({});
    }
  }, [searchParams, fetchInvoices, setSearchParams, toast, user?.id]);

  const getInvoiceStatusBadge = (status: string, dueDate: string) => {
    // Overdue: 1+ day AFTER due date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    const isOverdue = diffDays > 1 && status === "pending";
    
    if (status === "paid") {
      return (
        <Badge className="bg-success/10 text-success border-success/20">
          <CheckCircle className="h-3 w-3 mr-1" />
          Paid
        </Badge>
      );
    }
    
    if (isOverdue) {
      return (
        <Badge variant="destructive">
          <AlertCircle className="h-3 w-3 mr-1" />
          Overdue
        </Badge>
      );
    }
    
    if (status === "pending") {
      return (
        <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    }
    
    return <Badge variant="outline">{status}</Badge>;
  };

  const handlePayClick = (invoice: ManagerInvoice, method: "mpesa" | "stripe") => {
    setSelectedInvoice(invoice);
    setPaymentMethod(method);
    
    if (method === "stripe") {
      handleStripePayment(invoice);
    } else {
      setPaymentDialogOpen(true);
    }
  };

  const handleStripePayment = async (invoice: ManagerInvoice) => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-manager-invoice-checkout", {
        body: {
          invoiceId: invoice.id,
          amount: invoice.amount,
          description: invoice.description || `Platform fee - ${invoice.invoice_number}`,
        },
      });

      if (error) throw error;
      if (data?.url) openSafely(data.url);
    } catch (error) {
      toast({
        title: "Payment Failed",
        description: error instanceof Error ? error.message : "Failed to initiate payment",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMpesaPayment = async () => {
    if (!selectedInvoice || !phoneNumber) {
      toast({ title: "Missing Information", description: "Please enter a valid phone number", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    setPaymentStatus("pending");

    try {
      const { data, error } = await supabase.functions.invoke("initiate-manager-paystack-payment", {
        body: {
          invoiceId: selectedInvoice.id,
          amount: selectedInvoice.amount,
          phoneNumber: phoneNumber,
          description: selectedInvoice.description || `Manager Invoice - ${selectedInvoice.invoice_number}`,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast({ title: "STK Push Sent", description: "Paystack will send an M-Pesa PIN prompt to this number." });
        setPaymentStatus("verifying");
        pollPaymentStatus(data.reference);
      } else {
        throw new Error(data.error || "Failed to initiate payment");
      }
    } catch (error) {
      setPaymentStatus("idle");
      toast({
        title: "Payment Failed",
        description: error instanceof Error ? error.message : "Failed to initiate payment",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const pollPaymentStatus = async (reference: string) => {
    let attempts = 0;
    const maxAttempts = 12;

    const checkStatus = async () => {
      attempts++;
      
      try {
        const { data, error } = await supabase.functions.invoke("verify-mpesa-payment", {
          body: { reference, isManagerInvoice: true },
        });

        if (error) throw error;

        if (data.status === "success") {
          setPaymentStatus("success");
          toast({ title: "Payment Successful", description: "Your payment has been received." });
          if (selectedInvoice?.id) {
            await supabase.rpc("reinstate_manager_on_payment", { p_invoice_id: selectedInvoice.id }).catch(() => undefined);
            trackCommercialEvent("subscription_paid", { managerId: user?.id });
          }
          setTimeout(() => {
            fetchInvoices();
            handleClosePaymentDialog();
          }, 2000);
          return;
        }

        if (data.status === "failed") {
          setPaymentStatus("idle");
          trackCommercialEvent("payment_failed", { managerId: user?.id });
          toast({ title: "Payment Failed", description: data.message || "The payment was not completed.", variant: "destructive" });
          return;
        }

        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 10000);
        } else {
          setPaymentStatus("idle");
          toast({ title: "Payment Timeout", description: "Please check your M-Pesa messages.", variant: "destructive" });
        }
      } catch (error) {
        if (attempts < maxAttempts) setTimeout(checkStatus, 10000);
      }
    };

    setTimeout(checkStatus, 5000);
  };

  const handleClosePaymentDialog = () => {
    if (paymentStatus !== "pending" && paymentStatus !== "verifying") {
      setPaymentDialogOpen(false);
      setSelectedInvoice(null);
      setPhoneNumber("");
      setPaymentStatus("idle");
      setPaymentMethod(null);
    }
  };

  // =====================
  // CONTRACT FUNCTIONS
  // =====================

  const fetchContracts = useCallback(async () => {
    if (!user) return;
    setIsLoadingContracts(true);

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email;

    let query = supabase.from("manager_contracts").select("*").order("created_at", { ascending: false });

    if (userEmail) {
      query = query.or(`manager_user_id.eq.${user.id},manager_email.eq.${userEmail}`);
    } else {
      query = query.eq("manager_user_id", user.id);
    }

    const { data, error } = await query;

    if (error) {
      toast({ title: "Error", description: "Failed to load contracts", variant: "destructive" });
    } else {
      setContracts(data as ManagerContract[]);
    }
    setIsLoadingContracts(false);
  }, [user, toast]);

  const getContractStatusBadge = (status: ContractStatus) => {
    const config = contractStatusConfig[status];
    const Icon = config.icon;
    return (
      <Badge className={config.styles}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const handleSignContract = async (signatureDataUrl: string) => {
    if (!selectedContract) return;
    setIsSigning(true);

    try {
      const signatureBlob = await fetch(signatureDataUrl).then(r => r.blob());
      const fileName = `signature-${selectedContract.id}-${Date.now()}.png`;
      const filePath = `signatures/${user?.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from("contracts").upload(filePath, signatureBlob);
      if (uploadError) throw uploadError;

      // Store the file path - signed URLs will be generated when viewing
      const storagePath = `contracts/${filePath}`;

      const { error: updateError } = await supabase.rpc('sign_manager_contract_atomic', { p_contract_id: selectedContract.id, p_signature_url: storagePath });

      if (updateError) throw updateError;

      toast({ title: "Contract Signed", description: "Your signature has been saved successfully." });
      setSignDialogOpen(false);
      setSelectedContract(null);
      fetchContracts();
    } catch (error) {
      toast({ title: "Error", description: "Failed to save signature", variant: "destructive" });
    } finally {
      setIsSigning(false);
    }
  };

  const handleDownloadContract = (contract: ManagerContract) => {
    if (contract.uploaded_contract_url) {
      openSafely(contract.uploaded_contract_url);
    }
  };

  // =====================
  // NOTIFICATION FUNCTIONS
  // =====================

  const handleSendInvoiceEmail = async (invoice: ManagerInvoice) => {
    setIsSendingEmail(invoice.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-manager-invoice-notification", {
        body: {
          invoiceId: invoice.id,
          notificationType: "new_invoice",
        },
      });

      if (error) throw error;

      toast({ 
        title: "Email Sent", 
        description: `Invoice ${invoice.invoice_number} has been sent to your email.` 
      });
    } catch (error) {
      toast({ 
        title: "Failed to Send", 
        description: error instanceof Error ? error.message : "Failed to send email",
        variant: "destructive" 
      });
    } finally {
      setIsSendingEmail(null);
    }
  };

  const handleSendReceiptEmail = async (invoice: ManagerInvoice) => {
    if (!user) return;
    setIsSendingEmail(invoice.id);
    
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", user.id)
        .single();

      const { data, error } = await supabase.functions.invoke("send-manager-receipt-email", {
        body: {
          email: profile?.email || user.email,
          managerName: profile?.full_name || "Manager",
          receiptNumber: invoice.invoice_number.replace("INV-", "RCP-"),
          invoiceNumber: invoice.invoice_number,
          amount: formatCurrency(invoice.amount),
          description: invoice.description || "Platform subscription fee",
          paidDate: invoice.paid_date ? format(new Date(invoice.paid_date), "dd/MM/yy") : "N/A",
        },
      });

      if (error) throw error;

      toast({ 
        title: "Receipt Sent", 
        description: `Receipt has been sent to your email.` 
      });
    } catch (error) {
      toast({ 
        title: "Failed to Send", 
        description: error instanceof Error ? error.message : "Failed to send email",
        variant: "destructive" 
      });
    } finally {
      setIsSendingEmail(null);
    }
  };

  const handleSendWhatsApp = async (invoice: ManagerInvoice, type: 'invoice' | 'receipt') => {
    if (!user) return;
    setIsSendingWhatsApp(invoice.id);
    
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone")
        .eq("id", user.id)
        .single();

      if (!profile?.phone) {
        toast({ 
          title: "Phone Required", 
          description: "Please add your phone number in settings to receive WhatsApp notifications.",
          variant: "destructive" 
        });
        setIsSendingWhatsApp(null);
        return;
      }

      const message = type === 'invoice' 
        ? `📄 CALQULUS PMS Invoice\n\nInvoice: ${invoice.invoice_number}\nAmount: ${formatCurrency(invoice.amount)}\nDue: ${format(new Date(invoice.due_date), "dd/MM/yy")}\nDescription: ${invoice.description || "Platform fee"}\n\nPlease log in to pay.`
        : `✅ CALQULUS PMS Receipt\n\nReceipt: ${invoice.invoice_number.replace("INV-", "RCP-")}\nAmount: ${formatCurrency(invoice.amount)}\nPaid: ${invoice.paid_date ? format(new Date(invoice.paid_date), "dd/MM/yy") : "N/A"}\n\nThank you for your payment!`;

      const { data, error } = await supabase.functions.invoke("send-whatsapp-notification", {
        body: {
          phoneNumber: profile.phone,
          message,
          type,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({ 
          title: "Notification Sent", 
          description: `${type === 'invoice' ? 'Invoice' : 'Receipt'} notification sent.` 
        });
      } else {
        toast({ 
          title: "Notice", 
          description: data?.message || "Notification service not fully configured.",
        });
      }
    } catch (error) {
      toast({ 
        title: "Failed to Send", 
        description: error instanceof Error ? error.message : "Failed to send notification",
        variant: "destructive" 
      });
    } finally {
      setIsSendingWhatsApp(null);
    }
  };

  // =====================
  // EFFECTS
  // =====================

  useEffect(() => {
    if (user) {
      fetchInvoices();
      fetchContracts();
    }
  }, [user, fetchInvoices, fetchContracts]);

  // =====================
  // RENDER
  // =====================

  if (loading) {
    return (
      <Layout title="Platform Billing" subtitle="Invoices & Contracts with CALQULUS PMS">
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-8 w-8 animate-spin text-[hsl(214_73%_48%)]" />
        </div>
      </Layout>
    );
  }

  if (!isDevAccessEnabled() && (!user || userRole?.role !== "manager")) {
    return <Navigate to="/landlord/login" replace />;
  }

  const paidInvoices = invoices.filter(i => i.status === "paid");
  
  const invoiceStats = {
    totalBilled: invoices.reduce((sum, i) => sum + Number(i.amount), 0),
    totalCollected: paidInvoices.reduce((sum, i) => sum + Number(i.amount), 0),
    totalOutstanding: invoices.filter(i => i.status === "pending").reduce((sum, i) => sum + Number(i.amount), 0),
    totalOverdue: invoices.filter(i => i.status === "pending" && new Date(i.due_date) < new Date()).reduce((sum, i) => sum + Number(i.amount), 0),
    pendingCount: invoices.filter(i => i.status === "pending").length,
    overdueCount: invoices.filter(i => i.status === "pending" && new Date(i.due_date) < new Date()).length,
  };

  const approvedContracts = contracts.filter(c => c.status === "approved");
  const signedContracts = contracts.filter(c => c.status === "signed");

  // Generate receipt number from invoice
  const getReceiptNumber = (invoice: ManagerInvoice) => {
    return invoice.invoice_number.replace("INV-", "RCP-");
  };

  // Download receipt as text (simple implementation)
  const handleDownloadReceipt = (invoice: ManagerInvoice) => {
    const receiptContent = `
=======================================
           PAYMENT RECEIPT
=======================================

Receipt Number: ${getReceiptNumber(invoice)}
Date: ${invoice.paid_date ? format(new Date(invoice.paid_date), "dd/MM/yy") : "N/A"}

Description: ${invoice.description || "Platform subscription fee"}
Amount Paid: ${formatCurrency(invoice.amount)}

Original Invoice: ${invoice.invoice_number}
Invoice Date: ${format(new Date(invoice.created_at), "dd/MM/yy")}

Status: PAID

=======================================
        Thank you for your payment!
=======================================
    `.trim();

    const blob = new Blob([receiptContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${getReceiptNumber(invoice)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({ title: "Receipt Downloaded", description: `Receipt ${getReceiptNumber(invoice)} has been downloaded.` });
  };

  const headerActions = (
    <Button variant="outline" onClick={() => { fetchInvoices(); fetchContracts(); }} disabled={isLoadingInvoices || isLoadingContracts}>
      <RefreshCw className={`h-4 w-4 mr-2 ${(isLoadingInvoices || isLoadingContracts) ? "animate-spin" : ""}`} />
      Refresh
    </Button>
  );

  return (
    <Layout 
      title="Platform Billing" 
      subtitle="Invoices & Contracts with CALQULUS PMS"
      headerActions={headerActions}
    >
      <div className="space-y-6">
        {/* Tier + usage overview at the top of billing page */}
        <ManagerPlanStatus />
        <ManagerSubscriptionBanner />
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white border border-[hsl(214_73%_48%/0.15)] shadow-sm">
            <TabsTrigger value="invoices" className="flex items-center gap-2 data-[state=active]:bg-[hsl(214_73%_48%)] data-[state=active]:text-white">
              <Receipt className="h-4 w-4" />
              Invoices
              {invoiceStats.pendingCount > 0 && (
                <Badge variant="secondary" className="ml-1 bg-[hsl(214_73%_48%/0.1)] text-[hsl(214_73%_48%)] border-[hsl(214_73%_48%/0.2)]">{invoiceStats.pendingCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="receipts" className="flex items-center gap-2 data-[state=active]:bg-[hsl(214_73%_48%)] data-[state=active]:text-white">
              <FileCheck className="h-4 w-4" />
              Receipts
              {paidInvoices.length > 0 && (
                <Badge className="ml-1 bg-[hsl(214_73%_48%/0.1)] text-[hsl(214_73%_48%)] border-[hsl(214_73%_48%/0.2)]">{paidInvoices.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="contracts" className="flex items-center gap-2 data-[state=active]:bg-[hsl(214_73%_48%)] data-[state=active]:text-white">
              <FileSignature className="h-4 w-4" />
              Platform Contracts
              {approvedContracts.length > 0 && (
                <Badge className="ml-1 bg-[hsl(214_73%_48%/0.1)] text-[hsl(214_73%_48%)] border-[hsl(214_73%_48%/0.2)]">{approvedContracts.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* INVOICES TAB */}
          <TabsContent value="invoices" className="space-y-6" id="invoices">
            {/* Stats — Billed / Collected / Outstanding / Overdue */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-white border border-[hsl(214_73%_48%/0.15)] shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 rounded-lg bg-[hsl(214_73%_48%/0.08)] border border-[hsl(214_73%_48%/0.15)] flex items-center justify-center text-[hsl(214_73%_48%)] shrink-0">
                      <Receipt className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[hsl(215_20%_45%)]">Total Billed</p>
                      <p className="text-xl font-bold text-[hsl(222_47%_11%)]">{formatCurrency(invoiceStats.totalBilled)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border border-[hsl(214_73%_48%/0.15)] shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 rounded-lg bg-[hsl(214_73%_48%/0.08)] border border-[hsl(214_73%_48%/0.15)] flex items-center justify-center text-[hsl(214_73%_48%)] shrink-0">
                      <CheckCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[hsl(215_20%_45%)]">Collected</p>
                      <p className="text-xl font-bold text-[hsl(222_47%_11%)]">{formatCurrency(invoiceStats.totalCollected)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border border-[hsl(214_73%_48%/0.15)] shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 rounded-lg bg-[hsl(220_9%_46%/0.08)] border border-[hsl(220_9%_46%/0.15)] flex items-center justify-center text-[hsl(220_9%_46%)] shrink-0">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[hsl(215_20%_45%)]">Outstanding</p>
                      <p className="text-xl font-bold text-[hsl(222_47%_11%)]">{formatCurrency(invoiceStats.totalOutstanding)}</p>
                      {invoiceStats.pendingCount > 0 && (
                        <p className="text-[11px] text-[hsl(220_9%_46%)] mt-0.5">{invoiceStats.pendingCount} invoice{invoiceStats.pendingCount === 1 ? '' : 's'}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border border-[hsl(214_73%_48%/0.15)] shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 rounded-lg bg-[hsl(0_72%_51%/0.06)] border border-[hsl(0_72%_51%/0.12)] flex items-center justify-center text-[hsl(0_72%_51%)] shrink-0">
                      <AlertCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[hsl(215_20%_45%)]">Overdue</p>
                      <p className="text-xl font-bold text-[hsl(222_47%_11%)]">{formatCurrency(invoiceStats.totalOverdue)}</p>
                      {invoiceStats.overdueCount > 0 && (
                        <p className="text-[11px] text-[hsl(0_72%_51%)] mt-0.5">{invoiceStats.overdueCount} overdue</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Invoices Table */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="font-heading">Invoices</CardTitle>
                <CardDescription>Your billing history and pending payments</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingInvoices ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : invoices.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No platform invoices yet.</p>
                    <p className="text-sm text-muted-foreground mt-1">After approval, monthly invoices show here. You can keep using CALQULUS in the meantime.</p>
                  </div>
                ) : (
                  <InvoiceTable
                    invoices={invoices}
                    formatCurrency={formatCurrency}
                    isSendingEmail={isSendingEmail}
                    isSendingWhatsApp={isSendingWhatsApp}
                    isProcessing={isProcessing}
                    onSendInvoiceEmail={handleSendInvoiceEmail}
                    onSendWhatsApp={handleSendWhatsApp}
                    onPayClick={handlePayClick}
                    onDownloadInvoice={handleDownloadInvoice}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* RECEIPTS TAB */}
          <TabsContent value="receipts" className="space-y-6">
            {/* Receipt Stats — Navy/Blue trustworthy */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-white border border-[hsl(214_73%_48%/0.15)] shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 rounded-lg bg-[hsl(214_73%_48%/0.08)] border border-[hsl(214_73%_48%/0.15)] flex items-center justify-center text-[hsl(214_73%_48%)] shrink-0">
                      <FileCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[hsl(215_20%_45%)]">Total Receipts</p>
                      <p className="text-xl font-bold text-[hsl(222_47%_11%)]">{paidInvoices.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border border-[hsl(214_73%_48%/0.15)] shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 rounded-lg bg-[hsl(214_73%_48%/0.08)] border border-[hsl(214_73%_48%/0.15)] flex items-center justify-center text-[hsl(214_73%_48%)] shrink-0">
                      <CheckCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[hsl(215_20%_45%)]">Total Paid</p>
                      <p className="text-xl font-bold text-[hsl(222_47%_11%)]">{formatCurrency(invoiceStats.totalCollected)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border border-[hsl(214_73%_48%/0.15)] shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 rounded-lg bg-[hsl(220_9%_46%/0.08)] border border-[hsl(220_9%_46%/0.15)] flex items-center justify-center text-[hsl(220_9%_46%)] shrink-0">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[hsl(215_20%_45%)]">Latest Payment</p>
                      <p className="text-xl font-bold text-[hsl(222_47%_11%)]">
                        {paidInvoices.length > 0 && paidInvoices[0].paid_date 
                          ? format(new Date(paidInvoices[0].paid_date), "dd/MM")
                          : "N/A"
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Receipts Table */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="font-heading">Payment Receipts</CardTitle>
                <CardDescription>Auto-generated receipts for your online payments</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingInvoices ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : paidInvoices.length === 0 ? (
                  <div className="text-center py-12">
                    <FileCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No payment receipts yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Receipts are automatically generated when you pay invoices online
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead>Receipt #</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Payment Date</TableHead>
                          <TableHead>Original Invoice</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paidInvoices.map((invoice) => (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-mono text-sm">
                              <div className="flex items-center gap-2">
                                <FileCheck className="h-4 w-4 text-success" />
                                {getReceiptNumber(invoice)}
                              </div>
                            </TableCell>
                            <TableCell>{invoice.description || "Platform subscription fee"}</TableCell>
                            <TableCell className="font-semibold text-[hsl(214_73%_48%)]">{formatCurrency(invoice.amount)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                {invoice.paid_date ? format(new Date(invoice.paid_date), "dd/MM/yy") : "N/A"}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm text-muted-foreground">
                              {invoice.invoice_number}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleSendReceiptEmail(invoice)}
                                  disabled={isSendingEmail === invoice.id}
                                  className="text-[hsl(214_73%_48%)] hover:bg-[hsl(214_73%_48%/0.1)]"
                                  title="Send to Email"
                                >
                                  {isSendingEmail === invoice.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Mail className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleSendWhatsApp(invoice, 'receipt')}
                                  disabled={isSendingWhatsApp === invoice.id}
                                  className="text-[hsl(214_73%_48%)] hover:bg-[hsl(214_73%_48%/0.1)]"
                                  title="Send to WhatsApp/SMS"
                                >
                                  {isSendingWhatsApp === invoice.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <MessageCircle className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDownloadReceipt(invoice)}
                                  className="border-[hsl(214_73%_48%/0.3)] text-[hsl(214_73%_48%)] hover:bg-[hsl(214_73%_48%/0.1)]"
                                >
                                  <DownloadIcon className="h-4 w-4 mr-1" />
                                  Download
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* CONTRACTS TAB */}
          <TabsContent value="contracts" className="space-y-6">
            {/* Stats — Navy/Blue trustworthy */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="bg-white border border-[hsl(214_73%_48%/0.15)] shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-[hsl(215_20%_45%)]">Total Contracts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-[hsl(222_47%_11%)]">{contracts.length}</div>
                </CardContent>
              </Card>
              <Card className="bg-white border border-[hsl(214_73%_48%/0.15)] shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-[hsl(215_20%_45%)]">Pending Review</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-[hsl(38_92%_40%)]">{contracts.filter(c => c.status === "pending").length}</div>
                </CardContent>
              </Card>
              <Card className="bg-white border border-[hsl(214_73%_48%/0.15)] shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-[hsl(215_20%_45%)]">Ready to Sign</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-[hsl(214_73%_48%)]">{approvedContracts.length}</div>
                </CardContent>
              </Card>
              <Card className="bg-white border border-[hsl(214_73%_48%/0.15)] shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-[hsl(215_20%_45%)]">Signed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-[hsl(214_73%_48%)]">{signedContracts.length}</div>
                </CardContent>
              </Card>
            </div>

            {/* Contracts List */}
            {isLoadingContracts ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : contracts.length === 0 ? (
              <EmptyState icon={FileText} title="No contracts yet" />
            ) : (
              <div className="grid gap-4">
                {contracts.map((contract) => (
                  <ContractCard
                    key={contract.id}
                    contract={contract}
                    onPreview={() => { setSelectedContract(contract); setPreviewDialogOpen(true); }}
                    onSign={() => { setSelectedContract(contract); setSignDialogOpen(true); }}
                    onDownload={() => handleDownloadContract(contract)}
                    getStatusBadge={getContractStatusBadge}
                    highlight={contract.status === "approved"}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* M-Pesa Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={handleClosePaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>M-Pesa Payment</DialogTitle>
            <DialogDescription>
              Enter your M-Pesa phone number to pay {selectedInvoice && formatCurrency(selectedInvoice.amount)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                placeholder="254712345678"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={paymentStatus !== "idle"}
              />
            </div>
            {paymentStatus === "verifying" && (
              <div className="flex items-center gap-2 text-[hsl(214_73%_48%)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Waiting for M-Pesa confirmation...</span>
              </div>
            )}
            {paymentStatus === "success" && (
              <div className="flex items-center gap-2 text-success">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">Payment successful!</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClosePaymentDialog} disabled={paymentStatus === "pending" || paymentStatus === "verifying"}>
              Cancel
            </Button>
            <Button onClick={handleMpesaPayment} disabled={isProcessing || !phoneNumber || paymentStatus !== "idle"}>
              {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Smartphone className="h-4 w-4 mr-2" />}
              Pay with M-Pesa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contract Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{selectedContract?.title}</DialogTitle>
            <DialogDescription>{selectedContract?.description || "Contract details"}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Status</p>
                  {selectedContract && getContractStatusBadge(selectedContract.status)}
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Contract Type</p>
                  <p className="font-medium capitalize">{selectedContract?.contract_type?.replace(/_/g, " ") || "Service Agreement"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Valid From</p>
                  <p className="font-medium">{selectedContract?.valid_from ? format(new Date(selectedContract.valid_from), "dd/MM/yy") : "Not set"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Valid Until</p>
                  <p className="font-medium">{selectedContract?.valid_until ? format(new Date(selectedContract.valid_until), "dd/MM/yy") : "Not set"}</p>
                </div>
              </div>

              {selectedContract?.review_notes && (
                <div className="space-y-1 p-3 rounded-lg bg-muted/50 border">
                  <p className="text-sm text-muted-foreground">Review Notes</p>
                  <p>{selectedContract.review_notes}</p>
                </div>
              )}

              {selectedContract?.signature_url && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Your Signature</p>
                  <div className="border rounded-lg p-4 bg-white">
                    <img src={selectedContract.signature_url} alt="Signature" className="max-h-24 mx-auto" />
                  </div>
                  {selectedContract.signed_at && (
                    <p className="text-xs text-muted-foreground text-center">
                      Signed on {format(new Date(selectedContract.signed_at), "dd/MM/yy 'at' h:mm a")}
                    </p>
                  )}
                </div>
              )}

              {selectedContract?.uploaded_contract_url && (
                <div className="border rounded-lg overflow-hidden">
                  {selectedContract.uploaded_contract_url.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                    <img src={selectedContract.uploaded_contract_url} alt="Contract" className="w-full max-h-[400px] object-contain" />
                  ) : (
                    <div className="p-6 text-center bg-muted/50">
                      <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                      <p className="font-medium mb-3">PDF Document</p>
                      <Button onClick={() => selectedContract && handleDownloadContract(selectedContract)}>
                        <Download className="h-4 w-4 mr-2" />
                        Open PDF
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>Close</Button>
            {selectedContract?.status === "approved" && (
              <Button onClick={() => { setPreviewDialogOpen(false); setSignDialogOpen(true); }}>
                <PenLine className="h-4 w-4 mr-2" />
                Sign Contract
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Signature Dialog */}
      <Dialog open={signDialogOpen} onOpenChange={setSignDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Sign Contract</DialogTitle>
            <DialogDescription>Draw your signature below to sign "{selectedContract?.title}"</DialogDescription>
          </DialogHeader>
          <SignatureCanvas onSave={handleSignContract} />
          {isSigning && (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">Saving signature...</span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default ManagerPlatformBilling;
