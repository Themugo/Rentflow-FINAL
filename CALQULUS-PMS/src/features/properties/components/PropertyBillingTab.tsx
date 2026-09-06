// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Label } from "@/shared/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  CreditCard, FileText, Plus, Download, Send, CheckCircle, Clock, AlertCircle,
  XCircle, RefreshCw, Bell, Loader2, Zap, Droplets, Shield, Users, Pencil,
  Save, X, Receipt, Search, Mail, Wallet, Smartphone,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/shared/lib/utils";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { useAuth } from "@/features/auth/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { trackTimeToFirst } from "@/features/dashboard/lib/activationMetrics";
import { invalidateManagerActivation } from "@/features/dashboard/hooks/useManagerActivation";
import { useToast } from "@/shared/hooks/use-toast";
import { useActivityLog } from "@/shared/hooks/useActivityLog";
import { useViewOnly } from "@/shared/contexts/ViewOnlyContext";
import { downloadInvoicePDF } from "@/features/billing/lib/invoicePdfExport";
import { downloadReceiptPDF } from "@/features/billing/lib/receiptPdfExport";
import { formatDate } from "@/shared/lib/dateFormat";
import { MpesaPaymentDialog } from "@/features/billing/components/MpesaPaymentDialog";
import TenantInvoiceForm from "@/features/billing/components/TenantInvoiceForm";
import { ReceiptVerification } from "@/features/payments/components/ReceiptVerification";
import { useMarkInvoicePaid } from "@/features/billing/hooks/useBillingData";
import UnitPaymentReconciliation from "@/features/billing/components/UnitPaymentReconciliation";

type InvoiceStatus = "paid" | "pending" | "overdue" | "cancelled" | "partially_paid";

interface Invoice {
  id: string;
  invoice_number: string;
  lease_id: string | null;
  tenant_id: string | null;
  amount: number;
  balance_due: number | null;
  description: string | null;
  due_date: string;
  paid_date: string | null;
  status: InvoiceStatus;
  created_at: string;
  leases: { property: string; unit: string } | null;
  tenants: { id: string; name: string; email: string; phone?: string | null; photo_url: string | null } | null;
}

interface Expenditure {
  id: string;
  manager_id: string;
  property_id: string | null;
  category: string;
  description: string | null;
  amount: number;
  month: string;
  created_at: string;
  updated_at: string;
}

interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  photo_url: string | null;
  property: string | null;
  unit: string | null;
  monthly_rent: number | null;
}

interface Lease {
  id: string;
  property: string;
  unit: string;
  monthly_rent: number;
  tenant_id: string | null;
  property_id: string | null;
  unit_id: string | null;
  tenants: { id: string; name: string; email: string; photo_url: string | null } | null;
}

const EXPENDITURE_CATEGORIES = [
  { key: "electricity", label: "Electricity", icon: Zap, color: "text-warning" },
  { key: "water", label: "Water", icon: Droplets, color: "text-[hsl(195_60%_42%)]" },
  { key: "security", label: "Security", icon: Shield, color: "text-red-500" },
  { key: "staff", label: "Staff Salaries", icon: Users, color: "text-[hsl(218_58%_40%)]" },
  { key: "other", label: "Other Expenses", icon: Receipt, color: "text-muted-foreground" },
];

const statusConfig: Record<InvoiceStatus, { styles: string; icon: React.ComponentType<{ className?: string }> }> = {
  paid: { styles: "bg-success/10 text-success border-success/20", icon: CheckCircle },
  pending: { styles: "bg-warning/10 text-warning border-warning/20", icon: Clock },
  partially_paid: { styles: "bg-warning/10 text-warning border-warning/20", icon: Clock },
  overdue: { styles: "bg-destructive/10 text-destructive border-destructive/20", icon: AlertCircle },
  cancelled: { styles: "bg-slate-500/10 text-slate-400 border-slate-500/20", icon: XCircle },
};

interface PropertyBillingTabProps {
  propertyId: string;
  propertyName: string;
}

export function PropertyBillingTab({ propertyId, propertyName }: PropertyBillingTabProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { formatCurrency } = useCurrency();
  const { logActivity } = useActivityLog();
  const { isViewOnly } = useViewOnly();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [expenditures, setExpenditures] = useState<Expenditure[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [mainTab, setMainTab] = useState<"invoices" | "reconciliation" | "receipts" | "expenditures" | "verify">("invoices");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSendingNotifications, setIsSendingNotifications] = useState(false);
  const [mpesaDialogOpen, setMpesaDialogOpen] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);
  const [editingExpenditure, setEditingExpenditure] = useState<string | null>(null);
  const [expenditureValues, setExpenditureValues] = useState<Record<string, string>>({});
  const [savingExpenditure, setSavingExpenditure] = useState<string | null>(null);
  const [sendingReceiptId, setSendingReceiptId] = useState<string | null>(null);
  const markInvoicePaid = useMarkInvoicePaid();

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Fetch property-scoped invoices
  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    // Get tenant IDs for this property
    const { data: propTenants } = await supabase
      .from("tenants")
      .select("id")
      .eq("property_id", propertyId);

    const tenantIds = propTenants?.map(t => t.id) || [];
    if (tenantIds.length === 0) {
      setInvoices([]);
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .in("tenant_id", tenantIds)
      .order("created_at", { ascending: false });

    if (!error && data) {
      // Fetch related data separately
      const leaseIds = data.map(i => i.lease_id).filter(Boolean);
      const tenantIds = data.map(i => i.tenant_id);
      
      const [leasesData, tenantsData] = await Promise.all([
        leaseIds.length > 0 ? supabase.from("leases").select("id, property, unit, property_id, unit_id").in("id", leaseIds) : Promise.resolve({ data: [] }),
        tenantIds.length > 0 ? supabase.from("tenants").select("id, name, email, phone, photo_url").in("id", tenantIds) : Promise.resolve({ data: [] })
      ]);
      
      const leaseMap = new Map((leasesData.data || []).map(l => [l.id, l]));
      const tenantMap = new Map((tenantsData.data || []).map(t => [t.id, t]));
      
      const invoicesWithRelations = data.map(inv => ({
        ...inv,
        leases: leaseMap.get(inv.lease_id || ""),
        tenants: tenantMap.get(inv.tenant_id)
      }));
      
      setInvoices(invoicesWithRelations);
    } else {
      setInvoices([]);
    }
    setIsLoading(false);
  }, [propertyId]);

  const fetchLeases = useCallback(async () => {
    const { data } = await supabase
      .from("leases")
      .select("id, property, unit, monthly_rent, tenant_id, property_id, unit_id")
      .eq("property_id", propertyId)
      .eq("status", "active")
      .order("unit");
    
    if (data) {
      // Fetch tenant data separately
      const tenantIds = data.map(l => l.tenant_id);
      const { data: tenants } = await supabase
        .from("tenants")
        .select("id, name, email, photo_url")
        .in("id", tenantIds);
      
      const tenantMap = new Map((tenants || []).map(t => [t.id, t]));
      
      const leasesWithTenants = data.map(lease => ({
        ...lease,
        tenants: tenantMap.get(lease.tenant_id)
      }));
      
      setLeases(leasesWithTenants);
    } else {
      setLeases([]);
    }
  }, [propertyId]);

  const fetchTenants = useCallback(async () => {
    const { data } = await supabase
      .from("tenants")
      .select("id, name, email, phone, photo_url, property, unit, monthly_rent")
      .eq("property_id", propertyId)
      .eq("status", "active")
      .order("name");
    if (data) setTenants(data || []);
  }, [propertyId]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const fetchExpenditures = useCallback(async () => {
    if (!user?.id) return;
    const monthDate = `${selectedMonth}-01`;
    const { data } = await supabase
      .from("expenditures")
      .select("*")
      .eq("manager_id", user.id)
      .eq("property_id", propertyId)
      .eq("month", monthDate)
      .order("category");

    if (data) {
      setExpenditures(data);
      const values: Record<string, string> = {};
      data.forEach(exp => { values[exp.category] = exp.amount.toString(); });
      setExpenditureValues(values);
    }
  }, [user?.id, selectedMonth, propertyId]);

  useEffect(() => {
    fetchInvoices();
    fetchLeases();
    fetchTenants();
  }, [fetchInvoices, fetchLeases, fetchTenants, propertyId]);

  useEffect(() => {
    if (user?.id) fetchExpenditures();
  }, [user?.id, selectedMonth, propertyId, fetchExpenditures]);

  const handleGenerateMonthlyInvoices = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-monthly-invoices");
      if (error) throw error;
      toast({ title: "Invoices Generated", description: data.message || "Monthly invoices have been generated." });
      fetchInvoices();
    } catch (error: unknown) {
      toast({ title: "Error", description: `Failed to generate invoices`, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendOverdueNotifications = async () => {
    const overdueCount = invoices.filter(inv => inv.status === "overdue").length;
    if (overdueCount === 0) {
      toast({ title: "No Overdue Invoices", description: "There are no overdue invoices for this property." });
      return;
    }
    setIsSendingNotifications(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-overdue-notifications");
      if (error) throw error;
      toast({ title: "Notifications Sent", description: data?.message || "Sent overdue payment reminders." });
    } catch {
      toast({ title: "Error", description: "Failed to send notifications", variant: "destructive" });
    } finally {
      setIsSendingNotifications(false);
    }
  };

  const handleSaveExpenditure = async (category: string) => {
    if (!user?.id) return;
    setSavingExpenditure(category);
    const monthDate = `${selectedMonth}-01`;
    const amount = parseFloat(expenditureValues[category] || "0");
    const existing = expenditures.find(e => e.category === category);

    try {
      const { error } = await supabase.rpc("save_property_expenditure_atomic", {
        p_property_id: propertyId,
        p_category: category,
        p_amount: amount,
        p_month: selectedMonth,
        p_description: EXPENDITURE_CATEGORIES.find(c => c.key === category)?.label || category,
      });
      if (error) throw error;
      toast({ title: "Saved", description: `Expenditure updated.` });
      setEditingExpenditure(null);
      fetchExpenditures();
    } catch {
      toast({ title: "Error", description: "Failed to save expenditure", variant: "destructive" });
    } finally {
      setSavingExpenditure(null);
    }
  };

  const handleMarkAsPaid = async (invoiceId: string) => {
    try {
      // Do not mutate invoice.status directly. Payment recording must go through
      // the atomic payment path so the payment transaction, allocation, balance,
      // receipt and audit trail stay consistent.
      await markInvoicePaid.mutateAsync({ invoiceId });
      toast({ title: "Payment Recorded", description: "Payment recorded and invoice balance updated." });
      fetchInvoices();
    } catch (error) {
      toast({
        title: "Payment failed",
        description: error instanceof Error ? error.message : "Could not record this payment.",
        variant: "destructive",
      });
    }
  };

  const [voidConfirmId, setVoidConfirmId] = React.useState<string | null>(null);

  const handleVoidInvoice = async (invoiceId: string) => {
    // Void = set status to 'cancelled' — preserves financial history
    // Hard-delete is disabled: deleting invoices erases audit trail
    const invoice = invoices.find(i => i.id === invoiceId);
    if (invoice?.status === "paid") {
      toast({
        title: "Cannot void a paid invoice",
        description: "This invoice has already been paid. Raise a credit note or payout request instead.",
        variant: "destructive",
      });
      return;
    }
    try {
      const { error } = await supabase.rpc("cancel_invoice_atomic", { p_invoice_id: invoiceId });
      if (error) throw error;
      toast({ title: "Invoice voided", description: "Invoice status set to cancelled. History is preserved." });
      fetchInvoices();
    } catch (error) {
      toast({
        title: "Unable to void invoice",
        description: error instanceof Error ? error.message : "The invoice could not be cancelled.",
        variant: "destructive",
      });
    } finally {
      setVoidConfirmId(null);
    }
  };

  const handleSendReceipt = async (invoice: Invoice) => {
    if (!invoice.tenants?.email) return;
    setSendingReceiptId(invoice.id);
    try {
      const { error } = await supabase.functions.invoke("send-receipt-email", {
        body: { invoiceId: invoice.id, tenantEmail: invoice.tenants.email, tenantName: invoice.tenants.name },
      });
      if (error) throw error;
      toast({ title: "Receipt Sent", description: `Receipt emailed to ${invoice.tenants.email}` });
    } catch {
      toast({ title: "Error", description: "Failed to send receipt", variant: "destructive" });
    } finally {
      setSendingReceiptId(null);
    }
  };

  const getFilteredInvoices = () => {
    let filtered = invoices;
    if (activeTab !== "all") filtered = filtered.filter(inv => inv.status === activeTab);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(inv =>
        inv.invoice_number.toLowerCase().includes(q) ||
        inv.tenants?.name.toLowerCase().includes(q) ||
        inv.description?.toLowerCase().includes(q)
      );
    }
    return filtered;
  };

  // "partially_paid" invoices still carry a real balance_due — folded into
  // Pending (still awaiting full payment) rather than dropped from every
  // total, matching the same partially_paid fix applied to the manager and
  // agency dashboards.
  const totalPending = invoices
    .filter(i => i.status === "pending" || i.status === "partially_paid")
    .reduce((s, i) => s + Number(i.balance_due ?? i.amount ?? 0), 0);
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  // Same balance_due fallback as totalPending above: an "overdue" invoice
  // that was later partially paid (then re-flagged overdue once its due
  // date passed) still carries a reduced balance_due, not the full amount.
  const totalOverdue = invoices
    .filter(i => i.status === "overdue")
    .reduce((s, i) => s + Number(i.balance_due ?? i.amount ?? 0), 0);
  const totalExpenditures = expenditures.reduce((s, e) => s + e.amount, 0);

  const getMonthlyPaidInvoices = () => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    return invoices.filter(inv => {
      if (inv.status !== "paid" || !inv.paid_date) return false;
      const d = new Date(inv.paid_date);
      return d >= start && d <= end;
    });
  };

  const filteredInvoices = getFilteredInvoices();
  const monthlyPaidInvoices = getMonthlyPaidInvoices();
  const monthlyIncome = monthlyPaidInvoices.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Paid</p>
            <p className="text-lg font-bold text-success">{formatCurrency(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-lg font-bold text-warning">{formatCurrency(totalPending)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Overdue</p>
            <p className="text-lg font-bold text-destructive">{formatCurrency(totalOverdue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Expenditures</p>
            <p className="text-lg font-bold text-muted-foreground">{formatCurrency(totalExpenditures)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "invoices" | "reconciliation" | "receipts" | "expenditures" | "verify")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="reconciliation">Unit Collections</TabsTrigger>
            <TabsTrigger value="receipts">Receipts</TabsTrigger>
            <TabsTrigger value="expenditures">Expenditures</TabsTrigger>
            <TabsTrigger value="verify">Verify Receipts</TabsTrigger>
          </TabsList>
          {!isViewOnly && mainTab === "invoices" && (
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Create Invoice
              </Button>
              <Button size="sm" variant="outline" onClick={handleGenerateMonthlyInvoices} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                Generate Monthly
              </Button>
              <Button size="sm" variant="outline" onClick={handleSendOverdueNotifications} disabled={isSendingNotifications}>
                {isSendingNotifications ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Bell className="h-4 w-4 mr-1" />}
                Notify Overdue
              </Button>
            </div>
          )}
        </div>

        <TabsContent value="reconciliation" className="mt-4"><UnitPaymentReconciliation propertyId={propertyId} /></TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search invoices..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
                </div>
                <div className="flex gap-1">
                  {["all", "pending", "overdue", "paid", "cancelled"].map(tab => (
                    <Button key={tab} size="sm" variant={activeTab === tab ? "default" : "ghost"} onClick={() => setActiveTab(tab)} className="capitalize text-xs">
                      {tab}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-8 text-center text-muted-foreground">Loading...</div>
              ) : filteredInvoices.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No invoices found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map(invoice => {
                      const StatusIcon = statusConfig[invoice.status]?.icon || Clock;
                      return (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                          <TableCell>{invoice.tenants?.name || "—"}</TableCell>
                          <TableCell>{invoice.leases?.unit || "—"}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(invoice.amount)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDate(invoice.due_date)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("capitalize", statusConfig[invoice.status]?.styles)}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {invoice.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">•••</Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => downloadInvoicePDF({
                                  invoice_number: invoice.invoice_number,
                                  amount: invoice.amount,
                                  due_date: invoice.due_date,
                                  paid_date: invoice.paid_date,
                                  status: invoice.status,
                                  description: invoice.description,
                                  created_at: invoice.created_at,
                                  tenant: invoice.tenants,
                                  lease: invoice.leases,
                                })}>
                                  <Download className="h-4 w-4 mr-2" /> Download PDF
                                </DropdownMenuItem>
                                {invoice.status === "paid" && (
                                  <DropdownMenuItem onClick={() => handleSendReceipt(invoice)}>
                                    <Mail className="h-4 w-4 mr-2" /> Send Receipt
                                  </DropdownMenuItem>
                                )}
                                {invoice.status !== "paid" && !isViewOnly && (
                                  <>
                                    <DropdownMenuItem disabled={markInvoicePaid.isPending} onClick={() => handleMarkAsPaid(invoice.id)}>
                                      <CheckCircle className="h-4 w-4 mr-2" /> Mark Paid
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => {
                                      setSelectedInvoiceForPayment(invoice);
                                      setMpesaDialogOpen(true);
                                    }}>
                                      <Wallet className="h-4 w-4 mr-2" /> Pay via M-Pesa
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {!isViewOnly && invoice.status !== "paid" && (
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => setVoidConfirmId(invoice.id)}
                                  >
                                    <X className="h-4 w-4 mr-2" /> Void invoice
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
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

        <TabsContent value="receipts" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Payment Receipts</CardTitle>
                <Input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-auto" />
              </div>
            </CardHeader>
            <CardContent>
              {monthlyPaidInvoices.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No paid invoices this month</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Paid Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyPaidInvoices.map(inv => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                        <TableCell>{inv.tenants?.name || "—"}</TableCell>
                        <TableCell className="font-medium text-success">{formatCurrency(inv.amount)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(inv.paid_date!)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => downloadReceiptPDF({
                              invoice_number: inv.invoice_number,
                              amount: inv.amount,
                              due_date: inv.due_date,
                              paid_date: inv.paid_date,
                              description: inv.description,
                              mpesa_receipt: undefined,
                              line_items: undefined,
                              tenant: inv.tenants,
                              lease: inv.leases,
                            })}>
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleSendReceipt(inv)} disabled={sendingReceiptId === inv.id}>
                              {sendingReceiptId === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <div className="mt-4 p-3 rounded-lg bg-muted/50 flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Monthly Total</span>
                <span className="font-bold text-success">{formatCurrency(monthlyIncome)}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenditures" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Property Expenditures</CardTitle>
                <Input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-auto" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {EXPENDITURE_CATEGORIES.map(cat => {
                  const amount = expenditures.find(e => e.category === cat.key)?.amount || 0;
                  const isEditing = editingExpenditure === cat.key;
                  return (
                    <div key={cat.key} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-3">
                        <cat.icon className={cn("h-5 w-5", cat.color)} />
                        <span className="font-medium text-sm">{cat.label}</span>
                      </div>
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={expenditureValues[cat.key] || "0"}
                            onChange={e => setExpenditureValues(v => ({ ...v, [cat.key]: e.target.value }))}
                            className="w-28 h-8"
                          />
                          <Button size="sm" variant="ghost" onClick={() => handleSaveExpenditure(cat.key)} disabled={savingExpenditure === cat.key}>
                            {savingExpenditure === cat.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingExpenditure(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatCurrency(amount)}</span>
                          {!isViewOnly && (
                            <Button size="sm" variant="ghost" onClick={() => setEditingExpenditure(cat.key)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="flex items-center justify-between p-3 rounded-lg bg-amber-400/6 border border-amber-400/60/10">
                  <span className="font-semibold">Total Expenditures</span>
                  <span className="font-bold">{formatCurrency(totalExpenditures)}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-success/5 border border-success/10">
                  <span className="font-semibold">Net Income</span>
                  <span className="font-bold text-success">{formatCurrency(monthlyIncome - totalExpenditures)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="verify" className="mt-4">
          <ReceiptVerification />
        </TabsContent>
      </Tabs>

      {/* Create Invoice Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Invoice for {propertyName}</DialogTitle>
            <DialogDescription>Create a new invoice for a tenant in this property.</DialogDescription>
          </DialogHeader>
          <TenantInvoiceForm
            leases={leases}
            tenants={tenants}
            onSubmit={async (data) => {
              const lease = data.lease_id ? leases.find((l) => l.id === data.lease_id) : undefined;
              const { data: created, error } = await supabase.functions.invoke("create-invoice", {
                body: { tenantId: data.tenant_id, leaseId: data.lease_id, amount: data.amount, description: data.description, dueDate: data.due_date, managerId: user?.id, propertyId: lease?.property_id ?? propertyId, unitId: lease?.unit_id ?? null, generationKey: crypto.randomUUID() },
              });
              if (error || !created?.success) throw error ?? new Error(created?.error ?? "Failed to create invoice");
              trackTimeToFirst("invoice", { managerId: user?.id, signupAt: user?.created_at });
              invalidateManagerActivation(queryClient);
              setIsDialogOpen(false);
              fetchInvoices();
            }}
            isPending={false}
            onCancel={() => setIsDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* M-Pesa Dialog — manager-side STK push via MpesaPaymentDialog (existing) */}
      <MpesaPaymentDialog
        invoice={selectedInvoiceForPayment}
        open={mpesaDialogOpen}
        onOpenChange={(open) => { setMpesaDialogOpen(open); if (!open) setSelectedInvoiceForPayment(null); }}
        onPaymentComplete={() => { setMpesaDialogOpen(false); setSelectedInvoiceForPayment(null); fetchInvoices(); }}
      />

      {/* Void invoice confirmation */}
      <AlertDialog open={!!voidConfirmId} onOpenChange={open => !open && setVoidConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void this invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              The invoice will be marked as cancelled. This preserves your financial history — nothing is deleted.
              A voided invoice cannot be paid. This action can be reversed by a webhost admin if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => voidConfirmId && handleVoidInvoice(voidConfirmId)}
            >
              Yes, void invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
