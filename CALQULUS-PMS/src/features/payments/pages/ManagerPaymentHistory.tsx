// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/shared/components/layout/Layout";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Search,
  Smartphone,
  CreditCard,
  CheckCircle,
  Building,
  Calendar,
  Download,
  RefreshCw,
  Receipt,
  BarChart3,
  User,
  Users,
  Plus,
  Clock,
  AlertTriangle,
  Bell,
  FileText,
} from "lucide-react";
import { useToast } from "@/shared/hooks/use-toast";
import { useAuth } from "@/features/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getAutoTableFinalY } from "@/shared/lib/pdf/companyPdfHeader";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import PaymentAnalytics from "@/features/payments/components/PaymentAnalytics";
import BankReconciliationPanel from "@/features/payments/components/BankReconciliationPanel";
import NotificationFailuresPanel from "@/features/payments/components/NotificationFailuresPanel";
import PaymentExceptionControlCenter from "@/features/payments/components/PaymentExceptionControlCenter";
import RecordPaymentDialog from "@/features/payments/components/RecordPaymentDialog";
import {
  invoiceStatusTone,
  invoiceStatusLabel,
  paymentMethodLabel,
  isMpesaMethod,
  statusBadgeClass,
} from "@/shared/lib/statusBadge";
import { onActivateKey } from "@/shared/lib/a11y";

interface PaymentRecord {
  id: string;
  invoice_number: string;
  amount: number;
  paid_date: string | null;
  description: string | null;
  // Real payment_transactions columns (comprehensive-payment-schema migration) —
  // this is the source of truth for how a payment was made and how to look it
  // up on M-Pesa/bank statements, not something inferred from tenant contact info.
  payment_method: string | null;
  reference: string | null;
  tx_status: string;
  tenants: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    photo_url: string | null;
  } | null;
  leases: {
    property: string;
    unit: string;
  } | null;
}

const ManagerPaymentHistory = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { formatCurrency, currency: _currency } = useCurrency();
  const queryClient = useQueryClient();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [tenantFilter, setTenantFilter] = useState("all");
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);

  // Record payment dialog state
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [recordTenant, setRecordTenant] = useState<{ id: string; name: string } | null>(null);
  const [recordInvoice, setRecordInvoice] = useState<{ id: string; invoice_number: string; amount: number; balance_due: number } | null>(null);

  // Fetch tenants with unpaid invoices for the record-payment flow
  const { data: tenantsWithBalances = [] } = useQuery({
    queryKey: ["manager-tenants-with-balances", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select(`id, name, email, phone, unit, property, property_id, unit_id, manager_id,
                 invoices!inner(id, invoice_number, amount, balance_due, original_amount, due_date, status)`)
        .eq("manager_id", user!.id)
        .in("invoices.status", ["pending", "overdue"])
        .order("name");
      if (error) throw new Error(`tenants with balances: ${error.message}`);
      return (data || []) as Array<{ id: string; name: string; email: string; phone: string | null; unit: string | null; property: string | null; property_id: string | null; unit_id: string | null; manager_id: string | null }>;
    },
    enabled: !!user?.id,
  });

  // Fetch all pending+overdue invoices for the pending tab
  const { data: pendingInvoices = [], isLoading: pendingLoading, refetch: refetchPending } = useQuery({
    queryKey: ["manager-pending-invoices", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(`id, invoice_number, amount, balance_due, original_amount, paid_amount,
                 due_date, status, installment_plan, penalty_amount,
                 tenants(id, name, email, phone, photo_url, unit, property, property_id, unit_id, manager_id),
                 leases(property, unit)`)
        .in("status", ["pending", "overdue"])
        .eq("manager_id", user!.id)
        .order("due_date", { ascending: true });
      if (error) throw new Error(`pending invoices: ${error.message}`);
      return (data || []) as Array<{ id: string; invoice_number: string; amount: number; balance_due: number; original_amount: number; paid_amount: number; due_date: string; status: string; installment_plan: unknown; penalty_amount: number | null }>;
    },
    enabled: !!user?.id,
  });

  const fetchPayments = useCallback(async () => {
    setIsLoading(true);

    // Source of truth is payment_transactions, not invoices: it's the only
    // table that actually records how a payment was made (payment_method)
    // and the receipt/bank reference to reconcile it against (bank_reference /
    // mpesa_receipt_number), both written by record-payment -> process-payment
    // for manual entries and by mpesa-callback for STK completions.
    const { data, error } = await supabase
      .from("payment_transactions")
      .select(`
        id,
        amount,
        status,
        payment_method,
        payment_type,
        bank_reference,
        mpesa_receipt_number,
        checkout_request_id,
        completed_at,
        initiated_at,
        tenants (
          id,
          name,
          email,
          phone,
          photo_url
        ),
        invoices (
          invoice_number,
          description,
          leases (
            property,
            unit
          )
        )
      `)
      .eq("manager_id", user?.id ?? "")
      .eq("status", "completed")
      .order("completed_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch payment history",
        variant: "destructive",
      });
    } else {
      setPayments(
        (data || []).map((tx) => ({
          id: tx.id,
          invoice_number: tx.invoices?.invoice_number ?? "—",
          amount: tx.amount,
          paid_date: tx.completed_at ?? tx.initiated_at ?? null,
          description: tx.invoices?.description ?? null,
          payment_method: tx.payment_method ?? tx.payment_type ?? null,
          reference: tx.bank_reference ?? tx.mpesa_receipt_number ?? tx.checkout_request_id ?? null,
          tx_status: tx.status,
          tenants: tx.tenants ?? null,
          leases: tx.invoices?.leases ?? null,
        }))
      );
    }
    setIsLoading(false);
  }, [toast, user?.id]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const getFilteredPayments = () => {
    let filtered = payments;

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      let startDate: Date;
      let endDate: Date = now;

      switch (dateFilter) {
        case "this_month":
          startDate = startOfMonth(now);
          endDate = endOfMonth(now);
          break;
        case "last_month":
          startDate = startOfMonth(subMonths(now, 1));
          endDate = endOfMonth(subMonths(now, 1));
          break;
        case "last_3_months":
          startDate = startOfMonth(subMonths(now, 2));
          break;
        case "last_6_months":
          startDate = startOfMonth(subMonths(now, 5));
          break;
        default:
          startDate = new Date(0);
      }

      filtered = filtered.filter((p) => {
        if (!p.paid_date) return false;
        const paidDate = new Date(p.paid_date);
        return paidDate >= startDate && paidDate <= endDate;
      });
    }

    // Tenant filter
    if (tenantFilter !== "all") {
      filtered = filtered.filter((p) => p.tenants?.id === tenantFilter);
    }

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (p) =>
          p.tenants?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.leases?.property?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.tenants?.phone?.includes(searchQuery)
      );
    }

    return filtered;
  };

  const filteredPayments = getFilteredPayments();

  // Get unique tenants for filter dropdown
  const uniqueTenants = useMemo(() => {
    const tenantMap = new Map<string, { id: string; name: string; photo_url: string | null }>();
    payments.forEach((p) => {
      if (p.tenants?.id && !tenantMap.has(p.tenants.id)) {
        tenantMap.set(p.tenants.id, {
          id: p.tenants.id,
          name: p.tenants.name,
          photo_url: p.tenants.photo_url,
        });
      }
    });
    return Array.from(tenantMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [payments]);

  // Tenant payment breakdown data
  const tenantBreakdownData = useMemo(() => {
    const tenantMap = new Map<string, { 
      id: string; 
      name: string; 
      photo_url: string | null;
      email: string;
      phone: string | null;
      totalAmount: number; 
      transactionCount: number;
      property: string | null;
      unit: string | null;
      lastPayment: string | null;
    }>();
    
    filteredPayments.forEach((p) => {
      if (p.tenants?.id) {
        const existing = tenantMap.get(p.tenants.id);
        if (existing) {
          existing.totalAmount += Number(p.amount);
          existing.transactionCount += 1;
          if (p.paid_date && (!existing.lastPayment || p.paid_date > existing.lastPayment)) {
            existing.lastPayment = p.paid_date;
          }
        } else {
          tenantMap.set(p.tenants.id, {
            id: p.tenants.id,
            name: p.tenants.name,
            photo_url: p.tenants.photo_url,
            email: p.tenants.email,
            phone: p.tenants.phone,
            totalAmount: Number(p.amount),
            transactionCount: 1,
            property: p.leases?.property || null,
            unit: p.leases?.unit || null,
            lastPayment: p.paid_date,
          });
        }
      }
    });
    
    return Array.from(tenantMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredPayments]);

  // Calculate stats. Method split now reads the real payment_method column
  // (isMpesaMethod checks for the mpesa_stk/mpesa_ussd/mpesa_till prefix)
  // instead of guessing from whether the tenant has a phone number on file.
  const stats = {
    totalTransactions: filteredPayments.length,
    totalAmount: filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0),
    mpesaPayments: filteredPayments.filter((p) => isMpesaMethod(p.payment_method)).length,
    cardPayments: filteredPayments.filter((p) => !isMpesaMethod(p.payment_method)).length,
    thisMonth: payments.filter((p) => {
      if (!p.paid_date) return false;
      const paidDate = new Date(p.paid_date);
      const now = new Date();
      return (
        paidDate.getMonth() === now.getMonth() &&
        paidDate.getFullYear() === now.getFullYear()
      );
    }).reduce((sum, p) => sum + Number(p.amount), 0),
  };

  // Generate monthly revenue data for charts (last 6 months)
  const monthlyRevenueData = useMemo(() => {
    const months: { month: string; revenue: number; mpesa: number; card: number }[] = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const monthName = format(monthDate, "MMM");
      
      const monthPayments = payments.filter((p) => {
        if (!p.paid_date) return false;
        const paidDate = parseISO(p.paid_date);
        return paidDate >= monthStart && paidDate <= monthEnd;
      });
      
      const mpesaAmount = monthPayments
        .filter((p) => isMpesaMethod(p.payment_method))
        .reduce((sum, p) => sum + Number(p.amount), 0);

      const cardAmount = monthPayments
        .filter((p) => !isMpesaMethod(p.payment_method))
        .reduce((sum, p) => sum + Number(p.amount), 0);
      
      months.push({
        month: monthName,
        revenue: mpesaAmount + cardAmount,
        mpesa: mpesaAmount,
        card: cardAmount,
      });
    }
    
    return months;
  }, [payments]);

  // Property revenue breakdown
  const propertyRevenueData = useMemo(() => {
    const propertyMap = new Map<string, number>();
    
    filteredPayments.forEach((p) => {
      const property = p.leases?.property || "Unknown";
      propertyMap.set(property, (propertyMap.get(property) || 0) + Number(p.amount));
    });
    
    return Array.from(propertyMap.entries())
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredPayments]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      "Date",
      "Invoice Number",
      "Tenant Name",
      "Tenant Email",
      "Tenant Phone",
      "Property",
      "Unit",
      "Amount",
      "Payment Method",
      "Reference",
      "Status",
      "Description",
    ];

    const rows = filteredPayments.map((p) => [
      p.paid_date ? format(new Date(p.paid_date), "dd/MM/yy") : "",
      p.invoice_number,
      p.tenants?.name || "",
      p.tenants?.email || "",
      p.tenants?.phone || "",
      p.leases?.property || "",
      p.leases?.unit || "",
      p.amount.toString(),
      paymentMethodLabel(p.payment_method),
      p.reference || "",
      invoiceStatusLabel(p.tx_status),
      p.description || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `payment-history-${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Complete",
      description: `Exported ${filteredPayments.length} payments to CSV`,
    });
  };

  // Export to PDF with charts
  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const reportDate = format(new Date(), "dd/MM/yy");
    
    // Header
    doc.setFillColor(21, 94, 239); // Navy blue
    doc.rect(0, 0, pageWidth, 40, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("Payment History Report", 14, 22);
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated on ${reportDate}`, 14, 32);
    
    let yPos = 55;
    
    // Summary Section
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", 14, yPos);
    yPos += 10;
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    
    const summaryData = [
      ["Total Revenue Collected", formatCurrency(stats.totalAmount)],
      ["Total Transactions", stats.totalTransactions.toString()],
      ["M-Pesa Payments", stats.mpesaPayments.toString()],
      ["Card/Other Payments", stats.cardPayments.toString()],
      ["This Month's Revenue", formatCurrency(stats.thisMonth)],
    ];
    
    autoTable(doc, {
      startY: yPos,
      head: [["Metric", "Value"]],
      body: summaryData,
      theme: "striped",
      headStyles: { 
        fillColor: [13, 39, 68],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      styles: { 
        fontSize: 10,
        cellPadding: 4,
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 60, halign: "right" },
      },
      margin: { left: 14, right: 14 },
    });
    
    yPos = getAutoTableFinalY(doc) + 15;
    
    // Monthly Revenue Chart (as a table representation)
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Monthly Revenue (Last 6 Months)", 14, yPos);
    yPos += 10;
    
    const monthlyTableData = monthlyRevenueData.map((m) => [
      m.month,
      formatCurrency(m.mpesa),
      formatCurrency(m.card),
      formatCurrency(m.revenue),
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [["Month", "M-Pesa", "Card/Other", "Total"]],
      body: monthlyTableData,
      theme: "striped",
      headStyles: { 
        fillColor: [59, 130, 246],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      styles: { 
        fontSize: 10,
        cellPadding: 4,
      },
      columnStyles: {
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right", fontStyle: "bold" },
      },
      margin: { left: 14, right: 14 },
    });
    
    yPos = getAutoTableFinalY(doc) + 15;
    
    // Top Properties Section
    if (propertyRevenueData.length > 0) {
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Top Properties by Revenue", 14, yPos);
      yPos += 10;
      
      const propertyTableData = propertyRevenueData.map((p, index) => [
        `#${index + 1}`,
        p.name,
        formatCurrency(p.revenue),
      ]);
      
      autoTable(doc, {
        startY: yPos,
        head: [["Rank", "Property", "Revenue"]],
        body: propertyTableData,
        theme: "striped",
        headStyles: { 
          fillColor: [139, 92, 246],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        styles: { 
          fontSize: 10,
          cellPadding: 4,
        },
        columnStyles: {
          0: { cellWidth: 20, halign: "center" },
          2: { halign: "right", fontStyle: "bold" },
        },
        margin: { left: 14, right: 14 },
      });
      
    }
    
    // Add new page for transactions
    doc.addPage();
    // Transactions Header
    doc.setFillColor(13, 39, 68);
    doc.rect(0, 0, pageWidth, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Transaction Details", 14, 20);
    
    yPos = 45;
    
    // Payment Method Distribution
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Payment Method Distribution", 14, yPos);
    yPos += 10;
    
    const totalPayments = stats.mpesaPayments + stats.cardPayments;
    const mpesaPercent = totalPayments > 0 ? ((stats.mpesaPayments / totalPayments) * 100).toFixed(1) : "0";
    const cardPercent = totalPayments > 0 ? ((stats.cardPayments / totalPayments) * 100).toFixed(1) : "0";
    
    autoTable(doc, {
      startY: yPos,
      head: [["Method", "Count", "Percentage"]],
      body: [
        ["M-Pesa", stats.mpesaPayments.toString(), `${mpesaPercent}%`],
        ["Card/Other", stats.cardPayments.toString(), `${cardPercent}%`],
      ],
      theme: "striped",
      headStyles: { 
        fillColor: [47, 111, 237],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      styles: { 
        fontSize: 10,
        cellPadding: 4,
      },
      columnStyles: {
        1: { halign: "center" },
        2: { halign: "center" },
      },
      margin: { left: 14, right: 14 },
    });
    
    yPos = getAutoTableFinalY(doc) + 15;
    
    // Transactions list
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`Recent Transactions (${Math.min(filteredPayments.length, 50)} of ${filteredPayments.length})`, 14, yPos);
    yPos += 10;
    
    const transactionsData = filteredPayments.slice(0, 50).map((p) => [
      p.paid_date ? format(new Date(p.paid_date), "dd/MM/yy") : "-",
      p.tenants?.name || "Unknown",
      p.leases ? `${p.leases.property} - ${p.leases.unit}` : "-",
      p.invoice_number,
      formatCurrency(Number(p.amount)),
      p.tenants?.phone ? "M-Pesa" : "Card",
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [["Date", "Tenant", "Property", "Invoice", "Amount", "Method"]],
      body: transactionsData,
      theme: "striped",
      headStyles: { 
        fillColor: [59, 130, 246],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      styles: { 
        fontSize: 8,
        cellPadding: 3,
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 35 },
        2: { cellWidth: 45 },
        3: { cellWidth: 25 },
        4: { cellWidth: 30, halign: "right" },
        5: { cellWidth: 20, halign: "center" },
      },
      margin: { left: 14, right: 14 },
    });
    
    // Footer on all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Page ${i} of ${pageCount} | Generated by CALQULUS PMS Property Management`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
    }
    
    doc.save(`payment-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    
    toast({
      title: "PDF Report Generated",
      description: "Your payment report has been downloaded",
    });
  };

  return (
    <Layout
      title="Payments"
      subtitle="Completed payments with full traceability — record a payment against any pending invoice"
    >
      {/* Record Payment dialog */}
      {recordDialogOpen && recordTenant && (
        <RecordPaymentDialog
          tenant={recordTenant}
          invoice={recordInvoice ?? undefined}
          availableInvoices={recordTenant.invoices ?? []}
          open={recordDialogOpen}
          onOpenChange={(open) => {
            setRecordDialogOpen(open);
            if (!open) { setRecordTenant(null); setRecordInvoice(null); }
          }}
          onSuccess={() => {
            fetchPayments();
            refetchPending();
            queryClient.invalidateQueries({ queryKey: ["manager-pending-invoices"] });
          }}
        />
      )}

      <Tabs defaultValue="history" className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList className="flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="history" className="gap-1.5">
              <Receipt className="h-4 w-4" />
              Payment History
            </TabsTrigger>
            <TabsTrigger value="pending" className="gap-1.5">
              <Clock className="h-4 w-4" />
              Pending
              {pendingInvoices.length > 0 && (
                <Badge className="ml-1 h-5 min-w-5 text-xs bg-[hsl(214_73%_48%/0.1)] text-[hsl(214_73%_48%)] border-[hsl(214_73%_48%/0.2)]">
                  {pendingInvoices.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="reconcile" className="gap-1.5">
              <Building className="h-4 w-4" />
              Bank Reconciliation
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1.5">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="operations" className="gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              Operations
            </TabsTrigger>
          </TabsList>

          <Button
            className="bg-[hsl(214_73%_48%)] hover:bg-[hsl(214_73%_42%)] text-white gap-2"
            onClick={() => {
              if (tenantsWithBalances.length > 0) {
                setRecordTenant(tenantsWithBalances[0]);
                setRecordInvoice(null);
              }
              setRecordDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Record Payment
          </Button>
        </div>

      {/* ── Pending Invoices Tab ── */}
      <TabsContent value="pending">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pending &amp; overdue invoices</CardTitle>
            <CardDescription>
              All unpaid invoices across your properties — click "Record" to log a payment
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingLoading ? (
              <div className="py-8 text-center text-muted-foreground">Loading...</div>
            ) : pendingInvoices.length === 0 ? (
              <EmptyState
                icon={CheckCircle}
                title="All invoices paid up"
                description="No pending or overdue invoices"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Property / Unit</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Owed</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingInvoices.map((inv: { id: string; invoice_number: string; amount: number; balance_due: number; original_amount: number; paid_amount: number; due_date: string; status: string; installment_plan: unknown; tenants: { id: string; name: string; email: string; phone: string | null; photo_url: string | null; property: string | null; unit: string | null } | null; leases: { property: string; unit: string } | null }) => {
                    const isOverdue = inv.status === "overdue";
                    const balanceDue = Number(inv.balance_due ?? inv.amount);
                    const isPart = Number(inv.paid_amount ?? 0) > 0;
                    return (
                      <TableRow key={inv.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={inv.tenants?.photo_url ?? undefined} />
                              <AvatarFallback className="text-xs bg-amber-400/10">
                                {inv.tenants?.name?.split(" ").map((n: string) => n[0]).join("") || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{inv.tenants?.name ?? "—"}</p>
                              <p className="text-xs text-muted-foreground">{inv.tenants?.phone}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {inv.leases?.property ?? inv.tenants?.property ?? "—"}{" "}
                          {inv.leases?.unit ?? inv.tenants?.unit ? `· Unit ${inv.leases?.unit ?? inv.tenants?.unit}` : ""}
                        </TableCell>
                        <TableCell className={`text-sm ${isOverdue ? "text-[hsl(0_72%_51%)] font-medium" : "text-muted-foreground"}`}>
                          {inv.due_date ? format(new Date(inv.due_date), "dd/MM/yy") : "—"}
                          {isOverdue && <span className="ml-1 text-xs">(overdue)</span>}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-semibold text-sm">{formatCurrency(balanceDue)}</p>
                            {isPart && (
                              <p className="text-xs text-muted-foreground">
                                of {formatCurrency(Number(inv.original_amount ?? inv.amount))} — partial
                              </p>
                            )}
                            {inv.installment_plan && (
                              <Badge variant="outline" className="text-xs h-4 border-[hsl(214_73%_48%/0.3)] text-[hsl(214_73%_40%)] mt-0.5">
                                Instalment plan
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={isOverdue
                              ? "border-[hsl(0_72%_51%/0.3)] text-[hsl(0_72%_51%)] bg-[hsl(0_72%_51%/0.05)]"
                              : "border-[hsl(214_73%_48%/0.3)] text-[hsl(214_73%_48%)] bg-[hsl(214_73%_48%/0.05)]"
                            }
                          >
                            {isOverdue ? <AlertTriangle className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                            {isOverdue ? "Overdue" : "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            className="bg-[hsl(214_73%_48%)] hover:bg-[hsl(214_73%_42%)] text-white h-7 text-xs gap-1"
                            onClick={() => {
                              const tenant = inv.tenants ?? {};
                              // collect all invoices for this tenant
                              const allTenantInvoices = pendingInvoices
                                .filter((i: { tenants: { id: string } | null }) => i.tenants?.id === tenant.id)
                                .map((i: { id: string; invoice_number: string; original_amount: number; amount: number; balance_due: number; paid_amount: number; due_date: string; status: string }) => ({
                                  id: i.id,
                                  invoice_number: i.invoice_number,
                                  amount: Number(i.original_amount ?? i.amount),
                                  balance_due: Number(i.balance_due ?? i.amount),
                                  paid_amount: Number(i.paid_amount ?? 0),
                                  due_date: i.due_date,
                                  status: i.status,
                                }));
                              setRecordTenant({
                                ...tenant,
                                invoices: allTenantInvoices,
                              });
                              setRecordInvoice({
                                id: inv.id,
                                invoice_number: inv.invoice_number,
                                amount: Number(inv.original_amount ?? inv.amount),
                                balance_due: Number(inv.balance_due ?? inv.amount),
                                paid_amount: Number(inv.paid_amount ?? 0),
                                due_date: inv.due_date,
                                status: inv.status,
                              });
                              setRecordDialogOpen(true);
                            }}
                          >
                            <Plus className="h-3 w-3" />
                            Record
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── Payment History Tab ── */}
      <TabsContent value="history">
      {/* Summary strip — three plain numbers, semantic color only where it
          signals something (Collected is a positive outcome). Monthly trend,
          payment-method split, and collection-rate detail all already live
          on the Analytics tab (PaymentAnalytics) — repeating them here as a
          second set of charts was pure duplication, and a wall of rainbow
          chart colors on the page every manager lands on first isn't the
          "trustworthy, professional" look finance pages need. */}
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <div className="rounded-xl border border-[hsl(214_73%_48%/0.15)] bg-white p-4 shadow-sm hover:border-[hsl(214_73%_48%/0.25)] transition-colors">
          <p className="text-xs font-semibold text-[hsl(215_20%_45%)] uppercase tracking-wider">Total Collected</p>
          <p className="mt-1 text-2xl font-bold text-[hsl(214_73%_48%)]">{formatCurrency(stats.totalAmount)}</p>
          <p className="text-xs text-[hsl(215_20%_45%)] mt-1">Matches current filters</p>
        </div>
        <div className="rounded-xl border border-[hsl(214_73%_48%/0.15)] bg-white p-4 shadow-sm hover:border-[hsl(214_73%_48%/0.25)] transition-colors">
          <p className="text-xs font-semibold text-[hsl(215_20%_45%)] uppercase tracking-wider">Transactions</p>
          <p className="mt-1 text-2xl font-bold text-[hsl(222_47%_11%)]">{stats.totalTransactions}</p>
          <p className="text-xs text-[hsl(215_20%_45%)] mt-1">Completed payments</p>
        </div>
        <div className="rounded-xl border border-[hsl(214_73%_48%/0.15)] bg-white p-4 shadow-sm hover:border-[hsl(214_73%_48%/0.25)] transition-colors">
          <p className="text-xs font-semibold text-[hsl(215_20%_45%)] uppercase tracking-wider">This Month</p>
          <p className="mt-1 text-2xl font-bold text-[hsl(222_47%_11%)]">{formatCurrency(stats.thisMonth)}</p>
          <p className="text-xs text-[hsl(215_20%_45%)] mt-1">All completed payments, unfiltered</p>
        </div>
      </div>

      {/* Top Properties by Revenue — kept as a plain ranked list rather than
          a bar chart; this data isn't shown anywhere on the Analytics tab,
          so it stays, just without another chart-color palette. */}
      {propertyRevenueData.length > 0 && (
        <Card className="mb-6 card-shadow animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building className="h-5 w-5 text-muted-foreground" />
              Top Properties by Revenue
            </CardTitle>
            <CardDescription>Revenue collection by property, current filters</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {propertyRevenueData.map((p) => (
                <div key={p.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-foreground font-medium truncate">{p.name}</span>
                    <span className="text-foreground font-semibold">{formatCurrency(p.revenue)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${(p.revenue / propertyRevenueData[0].revenue) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tenant Payment Breakdown */}
      <Card className="mb-6 card-shadow animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-muted-foreground" />
            Tenant Payment Details
          </CardTitle>
          <CardDescription>Payment breakdown by tenant with total amounts and transaction counts</CardDescription>
        </CardHeader>
        <CardContent>
          {tenantBreakdownData.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No tenant payment data available</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {tenantBreakdownData.slice(0, 6).map((tenant) => {
                const toggleTenantSelection = () => {
                  if (selectedTenant === tenant.id) {
                    setSelectedTenant(null);
                    setTenantFilter("all");
                  } else {
                    setSelectedTenant(tenant.id);
                    setTenantFilter(tenant.id);
                  }
                };
                return (
                <div
                  key={tenant.id}
                  role="button"
                  tabIndex={0}
                  className={`p-4 rounded-lg border transition-all cursor-pointer ${
                    selectedTenant === tenant.id
                      ? "border-primary/50 bg-primary/5"
                      : "border-border hover:border-primary/30 hover:bg-muted/30"
                  }`}
                  onClick={toggleTenantSelection}
                  onKeyDown={onActivateKey(toggleTenantSelection)}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={tenant.photo_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {tenant.name
                          ?.split(" ")
                          .map((n) => n[0])
                          .join("") || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{tenant.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{tenant.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total Paid</p>
                      <p className="font-semibold text-[hsl(214_73%_48%)]">{formatCurrency(tenant.totalAmount)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Transactions</p>
                      <p className="font-semibold text-foreground">{tenant.transactionCount}</p>
                    </div>
                  </div>
                  {tenant.property && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Building className="h-3 w-3" />
                        {tenant.property} {tenant.unit && `- ${tenant.unit}`}
                      </div>
                    </div>
                  )}
                  {tenant.lastPayment && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Last payment: {format(new Date(tenant.lastPayment), "dd/MM/yy")}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
          {tenantBreakdownData.length > 6 && (
            <p className="text-sm text-muted-foreground mt-4 text-center">
              Showing top 6 tenants. Use filters below to see all.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between mb-6">
        <div className="flex gap-4 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by tenant, invoice, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-full sm:w-80 bg-card border-border"
            />
          </div>

          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[180px] bg-card border-border">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="last_3_months">Last 3 Months</SelectItem>
              <SelectItem value="last_6_months">Last 6 Months</SelectItem>
            </SelectContent>
          </Select>

          <Select value={tenantFilter} onValueChange={(value) => {
            setTenantFilter(value);
            setSelectedTenant(value === "all" ? null : value);
          }}>
            <SelectTrigger className="w-[200px] bg-card border-border">
              <User className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by tenant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tenants</SelectItem>
              {uniqueTenants.map((tenant) => (
                <SelectItem key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {tenantFilter !== "all" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setTenantFilter("all");
                setSelectedTenant(null);
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              Clear filter
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToPDF} disabled={filteredPayments.length === 0}>
            <FileText className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          <Button variant="outline" onClick={exportToCSV} disabled={filteredPayments.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={fetchPayments}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Payment History Table */}
      <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden animate-fade-in">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            Loading payment history...
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No payments found</p>
            <p className="text-sm">Completed payments will appear here.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead className="font-heading font-semibold">Date</TableHead>
                <TableHead className="font-heading font-semibold">Tenant</TableHead>
                <TableHead className="font-heading font-semibold">Invoice / Ref</TableHead>
                <TableHead className="font-heading font-semibold">Amount</TableHead>
                <TableHead className="font-heading font-semibold">Method</TableHead>
                <TableHead className="font-heading font-semibold">Reference</TableHead>
                <TableHead className="font-heading font-semibold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.map((payment, index) => (
                <TableRow
                  key={payment.id}
                  className="hover:bg-muted/30 border-border animate-slide-in"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {payment.paid_date
                      ? format(new Date(payment.paid_date), "dd/MM/yy")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={payment.tenants?.photo_url || undefined} />
                        <AvatarFallback className="bg-[hsl(214_73%_48%/0.1)] text-[hsl(214_73%_48%)] text-xs">
                          {payment.tenants?.name
                            ?.split(" ")
                            .map((n) => n[0])
                            .join("") || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="text-foreground font-medium">
                          {payment.tenants?.name || "Unknown"}
                        </span>
                        {payment.leases && (
                          <p className="text-xs text-muted-foreground">
                            {payment.leases.property} · {payment.leases.unit}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <span className="font-mono text-sm text-foreground">{payment.invoice_number}</span>
                      {payment.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">{payment.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold text-foreground">
                    {formatCurrency(Number(payment.amount))}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      {isMpesaMethod(payment.payment_method) ? (
                        <Smartphone className="h-3.5 w-3.5 text-[hsl(214_73%_48%)]" />
                      ) : (
                        <CreditCard className="h-3.5 w-3.5" />
                      )}
                      <span className="text-sm text-foreground">{paymentMethodLabel(payment.payment_method)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {payment.reference ?? "—"}
                  </TableCell>
                  <TableCell>
                    <span className={`${statusBadgeClass(invoiceStatusTone(payment.tx_status))} gap-1`}>
                      <CheckCircle className="h-3 w-3" />
                      {invoiceStatusLabel(payment.tx_status)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      </TabsContent>

      {/* ── Analytics Tab ── */}
      <TabsContent value="analytics">
        <PaymentAnalytics payments={payments} pendingInvoices={pendingInvoices} />
      </TabsContent>

      {/* ── Bank Reconciliation Tab ── */}
      <TabsContent value="reconcile">
        <BankReconciliationPanel managerId={user?.id ?? ''} />
      </TabsContent>

      {/* ── Notifications Tab ── */}
      <TabsContent value="notifications">
        <NotificationFailuresPanel />
      </TabsContent>

      <TabsContent value="operations">
        <PaymentExceptionControlCenter />
      </TabsContent>

      </Tabs>
    </Layout>
  );
};

export default ManagerPaymentHistory;
