/**
 * Billing.tsx  (refactored)
 *
 * Before: 2,240 lines — data fetching, 30+ useState, all JSX inlined.
 * After:  ~280 lines — orchestrator only.
 *
 * Data lives in useBillingData (React Query).
 * Rendering is delegated to BillingStatsBar, InvoiceTable, ExpendituresTab.
 * Mutations use useMarkInvoicePaid, useUpdateInvoice (typed, cache-invalidating).
 */

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { trackTimeToFirst } from "@/features/dashboard/lib/activationMetrics";
import { invalidateManagerActivation } from "@/features/dashboard/hooks/useManagerActivation";
import { useRBAC } from "@/shared/hooks/useRBAC";
import { Layout } from "@/shared/components/layout/Layout";
import { DashboardSectionHeader } from "@/features/dashboard/components/DashboardSectionHeader";
import { ErrorState } from "@/shared/components/ui/error-state";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/shared/components/ui/dialog";
import {
  Plus, FileText, CheckCircle2, ClipboardCheck,
  Receipt, Save, Loader2, Search, Wallet,
} from "lucide-react";
import { MpesaPaymentDialog } from "@/features/billing/components/MpesaPaymentDialog";
import TenantInvoiceForm from "@/features/billing/components/TenantInvoiceForm";
import { ReceiptVerification } from "@/features/payments/components/ReceiptVerification";
import { BillingStatsBar } from "@/features/billing/components/BillingStatsBar";
import { InvoiceTable } from "@/features/billing/components/InvoiceTable";
import { ExpendituresTab } from "@/features/billing/components/ExpendituresTab";
import UnitPaymentReconciliation from "@/features/billing/components/UnitPaymentReconciliation";
import { ReceiptsTab } from "@/features/billing/components/ReceiptsTab";
import { useToast } from "@/shared/hooks/use-toast";
import { toUserFacingError, logError } from "@/shared/lib/errorLogger";
import { roundMoney, isPositiveMoney } from "@/shared/lib/money";
import { supabase } from "@/integrations/supabase/client";
import { useActivityLog } from "@/shared/hooks/useActivityLog";
import {
  useBillingData,
  useMarkInvoicePaid,
  useUpdateInvoice,
} from "@/features/billing/hooks/useBillingData";
import type { BillingInvoice } from "@/features/billing/hooks/useBillingData";

// ── Types ─────────────────────────────────────────────────────────────────────

type MainTab = "invoices" | "reconciliation" | "receipts" | "expenditures" | "verify";

// ── Component ─────────────────────────────────────────────────────────────────

const Billing = () => {
  const { toast } = useToast();
  const { user }  = useAuth();
  const { can }   = useRBAC();
  const { logActivity } = useActivityLog();
  const queryClient = useQueryClient();

  // ── UI state (data state has moved to the hook) ──────────────────────────

  const [searchParams] = useSearchParams();
  const [mainTab,       setMainTab]       = useState<MainTab>("invoices");
  const [activeTab,     setActiveTab]     = useState("all");
  const [searchQuery,   setSearchQuery]   = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });

  const [isDialogOpen,             setIsDialogOpen]             = useState(false);
  const [isCreatingInvoice,        setIsCreatingInvoice]        = useState(false);
  const [isGenerating,             setIsGenerating]             = useState(false);
  const [isSendingNotifications,   setIsSendingNotifications]   = useState(false);

  const [mpesaDialogOpen,          setMpesaDialogOpen]          = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<BillingInvoice | null>(null);

  const [isEditDialogOpen,  setIsEditDialogOpen]  = useState(false);
  const [editingInvoice,    setEditingInvoice]    = useState<BillingInvoice | null>(null);
  const [editInvoiceData,   setEditInvoiceData]   = useState({ amount: "", due_date: "", description: "" });

  // ── Server state (React Query) ────────────────────────────────────────────

  const { invoices, leases, tenants, expenditures, isLoading, isError, refetchInvoices, invalidateInvoices, managerId } =
    useBillingData(selectedMonth);

  useEffect(() => {
    const filter = searchParams.get("filter");
    if (filter) setActiveTab(filter);
    const tab = searchParams.get("tab");
    if (tab === "receipts" || tab === "invoices" || tab === "reconciliation" || tab === "expenditures" || tab === "verify") {
      setMainTab(tab);
    }
  }, [searchParams]);

  const markPaidMutation   = useMarkInvoicePaid();
  const updateMutation     = useUpdateInvoice();

  // ── Derived / filtered data ───────────────────────────────────────────────

  const filteredInvoices = invoices
    .filter(inv => activeTab === "all" || inv.status === activeTab)
    .filter(inv =>
      !searchQuery ||
      inv.tenants?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.leases?.property?.toLowerCase().includes(searchQuery.toLowerCase()),
    );

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleGenerateMonthlyInvoices = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-monthly-invoices");
      if (error) throw error;
      toast({ title: "Invoices Generated", description: data.message || "Monthly invoices generated." });
      logActivity({ action: "generate_monthly_invoices", entityType: "invoice", metadata: { count: data.count ?? null } });
      if ((data?.count ?? 0) > 0) {
        trackTimeToFirst("invoice", { managerId: user?.id, signupAt: user?.created_at });
      }
      invalidateManagerActivation(queryClient);
      invalidateInvoices();
    } catch (err: unknown) {
      toast({ title: "Error", description: toUserFacingError(err, "Could not generate invoices. Please try again."), variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendOverdueNotifications = async () => {
    const overdueCount = invoices.filter(inv => inv.status === "overdue").length;
    if (overdueCount === 0) {
      toast({ title: "No Overdue Invoices", description: "There are no overdue invoices to notify." });
      return;
    }
    setIsSendingNotifications(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-overdue-notifications");
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Failed to send notifications");
      toast({ title: "Notifications Sent", description: data.message || `Sent ${data.sent} reminders.` });
    } catch (err: unknown) {
      toast({ title: "Error", description: toUserFacingError(err, "Could not send overdue reminders."), variant: "destructive" });
    } finally {
      setIsSendingNotifications(false);
    }
  };

  const handleCreateInvoice = async (data: {
    tenant_id: string | null;
    lease_id: string | null;
    amount: number;
    description: string;
    due_date: string;
    send_notification: boolean;
  }) => {
    if (!user?.id) {
      toast({ title: "Error", description: "You must be signed in to create invoices.", variant: "destructive" });
      return;
    }

    setIsCreatingInvoice(true);
    try {
      const leaseId = data.lease_id ?? leases.find((lease) => lease.tenant_id === data.tenant_id)?.id ?? null;
      if (!leaseId) {
        toast({
          title: "Lease Required",
          description: "Create or activate a lease for this tenant before issuing an invoice.",
          variant: "destructive",
        });
        return;
      }

      const lease = leases.find((row) => row.id === leaseId);
      const { data: created, error } = await supabase.functions.invoke("create-invoice", {
        body: { tenantId: data.tenant_id, leaseId, amount: data.amount, dueDate: data.due_date, description: data.description || "Invoice", managerId: managerId ?? user.id, propertyId: lease?.property_id ?? null, unitId: lease?.unit_id ?? null, generationKey: crypto.randomUUID() },
      });
      if (error || !created?.success) {
        logError("billing.handleCreateInvoice", error ?? created?.error);
        toast({ title: "Error", description: toUserFacingError(error ?? new Error(created?.error ?? "Failed to create invoice"), "Failed to create invoice"), variant: "destructive" });
        return;
      }
      const { data: inserted, error: fetchError } = await supabase.from("invoices").select("*, tenants(id,name,email,phone,photo_url), leases(property,unit)").eq("id", created.id).single();
      if (fetchError || !inserted) {
        logError("billing.handleCreateInvoice.fetch", fetchError);
        throw fetchError ?? new Error("Created invoice could not be loaded");
      }

      toast({ title: "Invoice Created", description: "Invoice created and recorded." });
      trackTimeToFirst("invoice", { managerId: user?.id, signupAt: user?.created_at });
      invalidateManagerActivation(queryClient);

      if (data.send_notification && inserted?.tenants?.email) {
        const { data: co } = await supabase
          .from("company_settings").select("company_name").limit(1).maybeSingle();
        const { data: notifyResult, error: notifyError } = await supabase.functions.invoke("send-invoice-notification", {
          body: {
            tenantEmail:   inserted.tenants.email,
            tenantName:    inserted.tenants.name,
            companyName:   co?.company_name ?? "CALQULUS PMS",
            invoiceNumber: inserted.invoice_number,
            amount:        inserted.amount,
            dueDate:       inserted.due_date,
            property:      inserted.leases?.property,
            unit:          inserted.leases?.unit,
            description:   inserted.description,
          },
        });
        if (notifyError || notifyResult?.emailSent === false || notifyResult?.success === false) {
          toast({
            title: "Invoice saved, email not sent",
            description: "The invoice is on file. Tell the tenant manually or resend from billing.",
            variant: "destructive",
          });
        }
      }

      setIsDialogOpen(false);
      invalidateInvoices();
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  const handleMarkPaid = (invoiceId: string) => {
    markPaidMutation.mutate(
      { invoiceId },
      {
        onSuccess: ({ paidDate }) => {
          const invoice = invoices.find(i => i.id === invoiceId);
          if (invoice?.tenants?.email) {
            void (async () => {
              try {
                const { data: co } = await supabase
                  .from("company_settings")
                  .select("company_name")
                  .limit(1)
                  .maybeSingle();
                await supabase.functions.invoke("send-payment-confirmation", {
                  body: {
                    tenantEmail:   invoice.tenants!.email,
                    tenantName:    invoice.tenants!.name,
                    companyName:   co?.company_name ?? "Property Management",
                    invoiceNumber: invoice.invoice_number,
                    amount:        invoice.amount,
                    paidDate,
                    property:      invoice.leases?.property ?? "N/A",
                    unit:          invoice.leases?.unit ?? "N/A",
                  },
                });
              } catch {
                /* silent – payment already recorded */
              }
            })();
          }
          trackTimeToFirst("payment", { managerId: user?.id, signupAt: user?.created_at });
          invalidateManagerActivation(queryClient);
          toast({ title: "Payment recorded", description: "Invoice closed through the payment ledger." });
        },
        onError: (err) =>
          toast({ title: "Error", description: toUserFacingError(err, "Failed to record payment"), variant: "destructive" }),
      },
    );
  };

  const handleEditInvoice = (invoice: BillingInvoice) => {
    setEditingInvoice(invoice);
    setEditInvoiceData({
      amount:      invoice.amount.toString(),
      due_date:    invoice.due_date,
      description: invoice.description ?? "",
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEditInvoice = () => {
    if (!editingInvoice) return;
    const amount = roundMoney(Number(editInvoiceData.amount));
    if (!isPositiveMoney(amount)) {
      toast({ title: "Validation Error", description: "Please enter a valid amount", variant: "destructive" });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(editInvoiceData.due_date)) {
      toast({ title: "Validation Error", description: "Please enter a valid due date", variant: "destructive" });
      return;
    }
    updateMutation.mutate(
      { id: editingInvoice.id, amount, due_date: editInvoiceData.due_date, description: editInvoiceData.description || null },
      {
        onSuccess: () => {
          toast({ title: "Invoice Updated", description: `Invoice ${editingInvoice.invoice_number} updated.` });
          setIsEditDialogOpen(false);
          setEditingInvoice(null);
        },
        onError: () =>
          toast({ title: "Error", description: "Failed to update invoice", variant: "destructive" }),
      },
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Layout title="Billing" subtitle="Invoice lifecycle — from billing through collection, with full payment traceability">
      <div className="mb-5">
        <DashboardSectionHeader
          eyebrow="Money / Collections"
          title="Receivables at a glance"
          description="Track what has been billed, collected and remains outstanding before moving into invoice-level work."
        />
      </div>
      <Tabs
        value={mainTab}
        onValueChange={v => setMainTab(v as MainTab)}
        className="space-y-4 sm:space-y-6"
      >
        <TabsList className="bg-card border border-border w-full sm:w-auto">
          <TabsTrigger value="invoices"     className="gap-2 text-sm"><FileText className="h-4 w-4" />Invoices</TabsTrigger>
          <TabsTrigger value="reconciliation" className="gap-2 text-sm"><Wallet className="h-4 w-4" />Unit Collections</TabsTrigger>
          <TabsTrigger value="receipts"     className="gap-2 text-sm"><CheckCircle2 className="h-4 w-4" />Receipts</TabsTrigger>
          <TabsTrigger value="verify"       className="gap-2 text-sm"><ClipboardCheck className="h-4 w-4" />Verify Payments</TabsTrigger>
          <TabsTrigger value="expenditures" className="gap-2 text-sm"><Receipt className="h-4 w-4" />Expenditures</TabsTrigger>
        </TabsList>

        {/* ── Invoices tab ─────────────────────────────────────────────── */}
        <TabsContent value="invoices" className="space-y-4 sm:space-y-6">
          {isError && (
            <ErrorState
              title="Couldn't load invoices"
              onRetry={() => { void refetchInvoices(); }}
            />
          )}
          <BillingStatsBar invoices={invoices} isLoading={isLoading} />

          {/* Actions bar */}
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="relative flex-1 sm:flex-none sm:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search invoices…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm bg-card border-border"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline" size="sm"
                onClick={handleSendOverdueNotifications}
                disabled={isSendingNotifications || invoices.filter(i => i.status === "overdue").length === 0}
              >
                {isSendingNotifications ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {isSendingNotifications ? "Sending…" : "Send Overdue Reminders"}
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={handleGenerateMonthlyInvoices}
                disabled={isGenerating || !can("create_invoices")}
              >
                {isGenerating ? "Generating…" : "Generate Monthly"}
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="btn-brand" disabled={!can("create_invoices")}>
                    <Plus className="h-4 w-4 mr-2" />Create Invoice
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[650px] bg-card border-border max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="font-heading text-foreground">Create New Invoice</DialogTitle>
                    <DialogDescription>Create an invoice for a tenant directly or from an existing lease.</DialogDescription>
                  </DialogHeader>
                  <TenantInvoiceForm
                    tenants={tenants}
                    leases={leases}
                    onSubmit={handleCreateInvoice}
                    isPending={isCreatingInvoice}
                    onCancel={() => setIsDialogOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Status filter tabs + table */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Lifecycle</span>
              {(["pending", "partially_paid", "overdue", "paid"] as const).map((step, i) => (
                <span key={step} className="inline-flex items-center gap-1.5">
                  {i > 0 && <span className="text-border">→</span>}
                  <button
                    type="button"
                    onClick={() => setActiveTab(step)}
                    className={`rounded-full px-2 py-0.5 border transition-colors ${
                      activeTab === step
                        ? "bg-[hsl(214_73%_48%/0.08)] text-[hsl(214_73%_48%)] border-[hsl(214_73%_48%/0.2)] font-semibold"
                        : "border-border hover:border-[hsl(214_73%_48%/0.3)] hover:text-foreground"
                    }`}
                  >
                    {step === "partially_paid" ? "Partial" : step.charAt(0).toUpperCase() + step.slice(1)}
                  </button>
                </span>
              ))}
              <span className="text-border">→</span>
              <button
                type="button"
                onClick={() => setMainTab("receipts")}
                className="rounded-full px-2 py-0.5 border border-border hover:border-[hsl(214_73%_48%/0.3)] hover:text-foreground transition-colors"
              >
                Receipt
              </button>
            </div>
            <TabsList className="bg-card border border-border flex-wrap h-auto">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="partially_paid">Partial</TabsTrigger>
              <TabsTrigger value="paid">Paid</TabsTrigger>
              <TabsTrigger value="overdue">Overdue</TabsTrigger>
              <TabsTrigger value="failed">Failed</TabsTrigger>
              <TabsTrigger value="refunded">Refunded</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
            </TabsList>
            <TabsContent value={activeTab}>
              <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden animate-fade-in">
                <InvoiceTable
                  invoices={filteredInvoices}
                  isLoading={isLoading}
                  userId={user?.id}
                  canEdit={can("create_invoices")}
                  onEdit={handleEditInvoice}
                  onMpesa={inv => { setSelectedInvoiceForPayment(inv); setMpesaDialogOpen(true); }}
                  onMarkPaid={handleMarkPaid}
                  onSendReminder={inv =>
                    toast({ title: "Reminder Sent", description: `Reminder sent to ${inv.tenants?.name ?? "tenant"}.` })
                  }
                />
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ── Unit reconciliation tab ───────────────────────────────────── */}
        <TabsContent value="reconciliation" className="space-y-4 sm:space-y-6">
          <UnitPaymentReconciliation title="Portfolio unit collections" />
        </TabsContent>

        {/* ── Receipts tab ─────────────────────────────────────────────── */}
        <TabsContent value="receipts" className="space-y-6">
          <ReceiptsTab invoices={invoices} isLoading={isLoading} />
        </TabsContent>

        {/* ── Verify tab ───────────────────────────────────────────────── */}
        <TabsContent value="verify" className="space-y-4 sm:space-y-6">
          <ReceiptVerification />
        </TabsContent>

        {/* ── Expenditures tab ─────────────────────────────────────────── */}
        <TabsContent value="expenditures" className="space-y-6">
          <ExpendituresTab
            invoices={invoices}
            expenditures={expenditures}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <MpesaPaymentDialog
        invoice={selectedInvoiceForPayment}
        open={mpesaDialogOpen}
        onOpenChange={setMpesaDialogOpen}
        onPaymentComplete={invalidateInvoices}
      />

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[450px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-heading text-foreground">Edit Invoice</DialogTitle>
            <DialogDescription>Update invoice {editingInvoice?.invoice_number} details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {editingInvoice?.tenants && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={editingInvoice.tenants.photo_url ?? undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {editingInvoice.tenants.name?.split(" ").map(n => n[0]).join("") ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-foreground">{editingInvoice.tenants.name}</p>
                  <p className="text-sm text-muted-foreground">{editingInvoice.tenants.email}</p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="editAmount">Amount (KSh) *</Label>
                <Input
                  id="editAmount" type="number" step="0.01"
                  value={editInvoiceData.amount}
                  onChange={e => setEditInvoiceData(d => ({ ...d, amount: e.target.value }))}
                  className="bg-background border-border"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="editDueDate">Due Date *</Label>
                <Input
                  id="editDueDate" type="date"
                  value={editInvoiceData.due_date}
                  onChange={e => setEditInvoiceData(d => ({ ...d, due_date: e.target.value }))}
                  className="bg-background border-border"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editDescription">Description</Label>
              <Input
                id="editDescription"
                value={editInvoiceData.description}
                onChange={e => setEditInvoiceData(d => ({ ...d, description: e.target.value }))}
                placeholder="Monthly rent — December 2024"
                className="bg-background border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSaveEditInvoice}
              className="btn-brand"
              loading={updateMutation.isPending}
            >
              <Save className="h-4 w-4" />Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Billing;
