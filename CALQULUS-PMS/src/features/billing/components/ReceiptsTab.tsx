import { LoadingState } from "@/shared/components/ui/loading-state";
/**
 * ReceiptsTab.tsx
 * Full receipts functionality: table, bulk email, bulk SMS, WhatsApp, per-row actions.
 */
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Badge } from "@/shared/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/components/ui/dialog";
import { Download, Mail, MessageSquare, MessageCircle, Search, Loader2, CheckCircle2, Building } from "lucide-react";
import { useToast } from "@/shared/hooks/use-toast";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { supabase } from "@/integrations/supabase/client";
import { downloadIssuedPaymentReceiptPDF } from "@/features/billing/lib/issuedPaymentReceiptPdf";
import type { BillingInvoice } from "@/features/billing/hooks/useBillingData";

interface Props { invoices: BillingInvoice[]; isLoading: boolean; }

export function ReceiptsTab({ invoices, isLoading }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();

  const [searchQuery, setSearchQuery] = useState("");
  const [sendingReceiptId, setSendingReceiptId] = useState<string | null>(null);
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isSendingBulk, setIsSendingBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ sent: 0, total: 0 });
  const [bulkSmsOpen, setBulkSmsOpen] = useState(false);
  const [smsMessage, setSmsMessage] = useState("");
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [issuedReceipts, setIssuedReceipts] = useState<any[]>([]);
  const [reconciliationSummary, setReconciliationSummary] = useState<any | null>(null);
  const [isLoadingIssued, setIsLoadingIssued] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoadingIssued(true);
      const [{ data: receipts }, { data: summary }] = await Promise.all([
        supabase.rpc("get_manager_issued_payment_receipts" as any),
        supabase.rpc("get_payment_reconciliation_summary" as any),
      ]);
      if (!cancelled) {
        setIssuedReceipts(receipts ?? []);
        setReconciliationSummary(summary ?? null);
        setIsLoadingIssued(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const paidInvoices = invoices.filter(inv => inv.status === "paid");
  const filteredReceipts = issuedReceipts.filter((receipt) =>
    !searchQuery ||
    String(receipt.payer_name ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(receipt.receipt_number ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(receipt.property_name ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(receipt.unit_number ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );
  const receiptsForBulkEmail = paidInvoices.filter(inv => {
    if (!inv.paid_date || !inv.tenants?.email) return false;
    if (dateFrom && inv.paid_date < dateFrom) return false;
    if (dateTo && inv.paid_date > dateTo) return false;
    return true;
  });
  const totalCollected = issuedReceipts.reduce((s, i) => s + Number(i.total_amount ?? 0), 0);

  async function getCompanySettings() {
    const { data } = await supabase.from("company_settings").select("company_name, logo_url").limit(1).maybeSingle();
    return data;
  }

  const handleSendReceiptEmail = async (inv: BillingInvoice) => {
    if (!inv.tenants?.email || !inv.paid_date) {
      toast({ title: "Cannot Send", description: "Missing tenant email or payment date.", variant: "destructive" });
      return;
    }
    setSendingReceiptId(inv.id);
    try {
      const co = await getCompanySettings();
      const { error } = await supabase.functions.invoke("send-receipt-email", {
        body: { tenantEmail: inv.tenants.email, tenantName: inv.tenants.name, invoiceNumber: inv.invoice_number, amount: inv.amount, paidDate: inv.paid_date, property: inv.leases?.property ?? "N/A", unit: inv.leases?.unit ?? "N/A", companyName: co?.company_name ?? "CALQULUS PMS" },
      });
      if (error) throw error;
      toast({ title: "Receipt Sent", description: `Receipt emailed to ${inv.tenants.name}.` });
    } catch (err: unknown) {
      toast({ title: "Error", description: (err as Error).message ?? "Failed to send.", variant: "destructive" });
    } finally { setSendingReceiptId(null); }
  };

  const handleBulkSendReceipts = async () => {
    if (receiptsForBulkEmail.length === 0) { toast({ title: "No Receipts", description: "No receipts in date range.", variant: "destructive" }); return; }
    setIsSendingBulk(true);
    setBulkProgress({ sent: 0, total: receiptsForBulkEmail.length });
    const co = await getCompanySettings();
    let ok = 0; let fail = 0;
    for (let i = 0; i < receiptsForBulkEmail.length; i++) {
      const inv = receiptsForBulkEmail[i];
      try {
        const { error } = await supabase.functions.invoke("send-receipt-email", {
          body: { tenantEmail: inv.tenants!.email, tenantName: inv.tenants!.name, invoiceNumber: inv.invoice_number, amount: inv.amount, paidDate: inv.paid_date, property: inv.leases?.property ?? "N/A", unit: inv.leases?.unit ?? "N/A", companyName: co?.company_name ?? "CALQULUS PMS" },
        });
        if (error) throw error;
        ok++;
      } catch { fail++; }
      setBulkProgress({ sent: i + 1, total: receiptsForBulkEmail.length });
    }
    setIsSendingBulk(false); setBulkEmailOpen(false); setDateFrom(""); setDateTo("");
    toast({ title: "Bulk Email Done", description: `Sent ${ok}.${fail > 0 ? ` ${fail} failed.` : ""}` });
  };

  const handleBulkSms = async () => {
    if (!smsMessage.trim()) { toast({ title: "Message Required", variant: "destructive" }); return; }
    const recipients = paidInvoices.filter(i => i.tenants?.phone).map(i => ({ phoneNumber: i.tenants!.phone!, name: i.tenants!.name }));
    if (recipients.length === 0) { toast({ title: "No Phone Numbers", variant: "destructive" }); return; }
    setIsSendingSms(true);
    try {
      const { error } = await supabase.functions.invoke("send-bulk-sms", { body: { recipients, message: smsMessage } });
      if (error) throw error;
      toast({ title: "SMS Sent", description: `Sent to ${recipients.length} tenant(s).` });
      setBulkSmsOpen(false); setSmsMessage("");
    } catch { toast({ title: "SMS Failed", variant: "destructive" }); }
    finally { setIsSendingSms(false); }
  };

  const handleSingleSms = async (inv: BillingInvoice) => {
    const message = `Hi ${inv.tenants?.name}! Payment of KES ${inv.amount.toLocaleString()} for ${inv.leases?.property ?? "rent"} received. Receipt: ${inv.invoice_number}. Thank you!`;
    try {
      await supabase.functions.invoke("send-sms-notification", { body: { phoneNumber: inv.tenants?.phone, message } });
      toast({ title: "SMS Sent", description: `Receipt SMS sent to ${inv.tenants?.name}.` });
    } catch { toast({ title: "SMS Failed", variant: "destructive" }); }
  };

  const handleWhatsApp = (inv: BillingInvoice) => {
    const phone = inv.tenants?.phone?.replace(/[^0-9]/g, "");
    const msg = encodeURIComponent(`Hi ${inv.tenants?.name}! Payment of KES ${inv.amount.toLocaleString()} for ${inv.leases?.property ?? "rent"} received. Receipt: ${inv.invoice_number}. Thank you!`);
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  };

  return (
    <div className="space-y-6">
      {reconciliationSummary && (reconciliationSummary.stale_pending_count > 0 || reconciliationSummary.allocation_mismatch_count > 0) && <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm"><strong>Reconciliation attention:</strong> {reconciliationSummary.stale_pending_count ?? 0} stale pending payment(s), {reconciliationSummary.allocation_mismatch_count ?? 0} allocation mismatch(es).</div>}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Total Receipts", value: issuedReceipts.length.toString(), color: "text-foreground" },
          { label: "Total Collected", value: formatCurrency(totalCollected), color: "text-[hsl(214_73%_48%)]" },
          { label: "Allocation Mismatches", value: String(reconciliationSummary?.allocation_mismatch_count ?? 0), color: "text-muted-foreground" },
        ].map(({ label, value, color }, i) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 card-shadow animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={`font-heading text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search receipts…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 w-full sm:w-80 bg-card border-border" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Dialog open={bulkEmailOpen} onOpenChange={setBulkEmailOpen}>
            <DialogTrigger asChild><Button variant="outline" className="gap-2"><Mail className="h-4 w-4" />Bulk Email</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-card border-border">
              <DialogHeader><DialogTitle className="font-heading">Bulk Email Receipts</DialogTitle><DialogDescription>Send receipt emails for paid invoices in a date range.</DialogDescription></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label>From</Label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-background border-border" /></div>
                  <div className="grid gap-2"><Label>To</Label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-background border-border" /></div>
                </div>
                <div className="rounded-lg border border-border p-4 bg-muted/30 flex items-center justify-between">
                  <span className="text-sm font-medium">Receipts to send:</span>
                  <Badge variant="secondary" className="text-lg px-3">{receiptsForBulkEmail.length}</Badge>
                </div>
                {isSendingBulk && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm"><span>Sending…</span><span>{bulkProgress.sent}/{bulkProgress.total}</span></div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-amber-400 transition-all" style={{ width: `${(bulkProgress.sent / bulkProgress.total) * 100}%` }} /></div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBulkEmailOpen(false)} disabled={isSendingBulk}>Cancel</Button>
                <Button onClick={handleBulkSendReceipts} disabled={isSendingBulk || receiptsForBulkEmail.length === 0} className="btn-brand">
                  {isSendingBulk ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending…</> : <><Mail className="h-4 w-4 mr-2" />Send {receiptsForBulkEmail.length}</>}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={bulkSmsOpen} onOpenChange={setBulkSmsOpen}>
            <DialogTrigger asChild><Button variant="outline" className="gap-2"><MessageSquare className="h-4 w-4" />Bulk SMS</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-card border-border">
              <DialogHeader><DialogTitle className="font-heading">Send Bulk SMS</DialogTitle><DialogDescription>Message all tenants with paid invoices and phone numbers.</DialogDescription></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="rounded-lg border border-border p-4 bg-muted/30 flex items-center justify-between">
                  <span className="text-sm font-medium">Recipients:</span>
                  <Badge variant="secondary" className="text-lg px-3">{paidInvoices.filter(i => i.tenants?.phone).length}</Badge>
                </div>
                <div className="grid gap-2">
                  <Label>Message *</Label>
                  <textarea value={smsMessage} onChange={e => setSmsMessage(e.target.value)} placeholder="Enter your message…" className="min-h-[100px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" maxLength={160} />
                  <p className="text-xs text-muted-foreground text-right">{smsMessage.length}/160</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBulkSmsOpen(false)} disabled={isSendingSms}>Cancel</Button>
                <Button onClick={handleBulkSms} disabled={isSendingSms || !smsMessage.trim()} className="btn-brand">
                  {isSendingSms ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending…</> : <><MessageSquare className="h-4 w-4 mr-2" />Send SMS</>}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" className="gap-2" onClick={() => { const first = paidInvoices.find(i => i.tenants?.phone); if (first) handleWhatsApp(first); }}>
            <MessageCircle className="h-4 w-4" />WhatsApp
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden animate-fade-in">
        {isLoading ? (
          <LoadingState label="Loading receipts…" variant="inline" />
        ) : isLoadingIssued ? (
          <LoadingState />
        ) : filteredReceipts.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground"><CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>{paidInvoices.length === 0 ? "No receipts yet." : "No receipts match your search."}</p></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead className="font-heading font-semibold">Receipt #</TableHead>
                <TableHead className="font-heading font-semibold">Payer</TableHead>
                <TableHead className="font-heading font-semibold">Property</TableHead>
                <TableHead className="font-heading font-semibold">Amount</TableHead>
                <TableHead className="font-heading font-semibold">Paid Date</TableHead>
                <TableHead className="font-heading font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReceipts.map((receipt, i) => (
                <TableRow key={receipt.receipt_id} className="hover:bg-muted/30 border-border animate-slide-in" style={{ animationDelay: `${i * 30}ms` }}>
                  <TableCell className="font-medium font-mono text-foreground">{receipt.receipt_number}</TableCell>
                  <TableCell>
                    <div><p className="text-foreground">{receipt.payer_name ?? "Unknown payer"}</p><p className="text-xs text-muted-foreground">{receipt.payer_type ?? "payer"}</p></div>
                  </TableCell>
                  <TableCell>{receipt.property_name ? <div className="flex items-center gap-2 text-muted-foreground"><Building className="h-4 w-4" /><span>{receipt.property_name}{receipt.unit_number ? ` — ${receipt.unit_number}` : ""}</span></div> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="font-semibold text-[hsl(214_73%_48%)]">{formatCurrency(Number(receipt.total_amount ?? 0))}</TableCell>
                  <TableCell className="text-muted-foreground">{receipt.issued_at ? format(new Date(receipt.issued_at), 'dd/MM/yy') : "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-8 px-2" title="Download canonical PDF receipt" onClick={() => downloadIssuedPaymentReceiptPDF(receipt.receipt_id)}><Download className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
