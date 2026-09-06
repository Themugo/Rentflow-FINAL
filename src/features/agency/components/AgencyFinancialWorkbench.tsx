import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { endOfMonth, format, startOfMonth } from "date-fns";
import {
  Banknote,
  CheckCircle2,
  Download,
  FileCheck2,
  FileSpreadsheet,
  ImageUp,
  ReceiptText,
  ShieldAlert,
  UnlockKeyhole,
  Upload,
  XCircle,
} from "lucide-react";
import AgencyLayout from "@/features/agency/components/AgencyLayout";
import Billing from "@/features/billing/pages/Billing";
import AgencyPaymentRoutingPanel from "@/features/billing/components/AgencyPaymentRoutingPanel";
import { useAgencyOperationsConfig } from "@/features/agency/lib/useAgencyOperationsConfig";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { Badge } from "@/shared/components/ui/badge";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useToast } from "@/shared/hooks/use-toast";
import { formatKes } from "@/features/landlord/lib/formatKes";

function jsonRecords(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  return `"${raw.replaceAll('"', '""')}"`;
}

const PAYMENT_METHODS = [
  "bank_transfer",
  "cash",
  "mpesa",
  "direct_to_landlord",
  "direct_to_tenant",
  "other",
] as const;

const PAYMENT_DESTINATIONS = ["agency", "landlord", "tenant_direct", "external", "split"] as const;

const EVIDENCE_SOURCES = [
  "agent_manual",
  "tenant_upload",
  "bank_statement",
  "external_consolidation",
  "landlord_confirmation",
] as const;

function friendly(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function AgencyFinancialWorkbench() {
  const { data: config } = useAgencyOperationsConfig();
  const { toast } = useToast();
  const month = useMemo(() => new Date(), []);
  const [start, setStart] = useState(format(startOfMonth(month), "yyyy-MM-dd"));
  const [end, setEnd] = useState(format(endOfMonth(month), "yyyy-MM-dd"));
  const [evidenceBusy, setEvidenceBusy] = useState<string | null>(null);
  const [evidenceForm, setEvidenceForm] = useState({
    invoiceId: "",
    propertyId: "",
    unitId: "",
    tenantId: "",
    amount: "",
    date: format(new Date(), "yyyy-MM-dd"),
    method: "bank_transfer",
    reference: "",
    payerName: "",
    destination: "agency",
    source: "agent_manual",
    notes: "",
  });
  const [proof, setProof] = useState<File | null>(null);
  const [reopenReason, setReopenReason] = useState("");

  const agencyId = config?.agency_id;
  const viewer = config?.viewer;
  const canViewFinancials = Boolean(viewer?.can_view_financials || viewer?.can_close_books);
  const canRecordEvidence = Boolean(viewer?.can_record_payments);
  const canVerifyEvidence = Boolean(viewer?.can_verify_payment_evidence);
  const canCloseBooks = Boolean(viewer?.can_close_books);

  const { data: breakdown, isLoading: breakdownLoading, refetch: refetchBreakdown } = useQuery({
    queryKey: ["agency-financial-breakdown", agencyId, start, end],
    enabled: Boolean(agencyId && canViewFinancials),
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_agency_financial_breakdown", {
        p_agency_id: agencyId,
        p_period_start: start,
        p_period_end: end,
      });
      if (error) throw error;
      return data as any;
    },
  });

  const { data: ledger = [], refetch: refetchLedger } = useQuery({
    queryKey: ["agency-financial-ledger", agencyId, start, end],
    enabled: Boolean(agencyId && canViewFinancials),
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_agency_financial_ledger", {
        p_agency_id: agencyId,
        p_period_start: start,
        p_period_end: end,
      });
      if (error) throw error;
      return jsonRecords(data);
    },
  });

  const { data: closeState, refetch: refetchClose } = useQuery({
    queryKey: ["agency-financial-close", agencyId, start, end],
    enabled: Boolean(agencyId && (canViewFinancials || canCloseBooks)),
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_agency_financial_close", {
        p_agency_id: agencyId,
        p_period_start: start,
        p_period_end: end,
      });
      if (error) throw error;
      return data as any;
    },
  });

  const { data: evidence = [], refetch: refetchEvidence } = useQuery({
    queryKey: ["agency-payment-evidence", agencyId],
    enabled: Boolean(agencyId && (canRecordEvidence || canVerifyEvidence)),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("agency_payment_evidence")
        .select(
          "id,property_id,unit_id,tenant_id,invoice_id,reported_amount,expected_amount,payment_date,payment_method,reference,payer_name,destination_type,source_type,proof_url,status,discrepancy_amount,review_notes,notes,created_at",
        )
        .eq("agency_id", agencyId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: invoiceOptions = [] } = useQuery({
    queryKey: ["agency-payment-invoice-options", agencyId],
    enabled: Boolean(agencyId && canRecordEvidence),
    queryFn: async () => {
      const { data: agency, error: agencyError } = await (supabase as any)
        .from("agencies")
        .select("manager_id")
        .eq("id", agencyId)
        .maybeSingle();
      if (agencyError) throw agencyError;
      if (!agency?.manager_id) return [];
      const { data, error } = await (supabase as any)
        .from("invoices")
        .select("id,invoice_number,amount,balance_due,tenant_id,property_id,unit_id,due_date,status")
        .eq("manager_id", agency.manager_id)
        .in("status", ["pending", "overdue", "partially_paid"])
        .order("due_date", { ascending: true })
        .limit(250);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: properties = [] } = useQuery({
    queryKey: ["agency-payment-properties", agencyId],
    enabled: Boolean(agencyId && canRecordEvidence),
    queryFn: async () => {
      const { data: agency, error: agencyError } = await (supabase as any)
        .from("agencies")
        .select("manager_id")
        .eq("id", agencyId)
        .maybeSingle();
      if (agencyError) throw agencyError;
      if (!agency?.manager_id) return [];
      const { data, error } = await (supabase as any)
        .from("properties")
        .select("id,name,address")
        .eq("manager_id", agency.manager_id)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const externalQueue = evidence.filter((row) => row.destination_type !== "agency" && row.status !== "rejected");

  function exportLedger() {
    const rows = Array.isArray(ledger) ? ledger : [];
    const header = [
      "Date",
      "Type",
      "Reference",
      "Counterparty",
      "Category",
      "Destination",
      "Source",
      "Billed",
      "Collected",
      "External Confirmed",
      "Expense",
    ];
    const body = rows.map((row) =>
      [
        row.event_date,
        row.event_type,
        row.reference,
        row.counterparty,
        row.category,
        row.destination,
        row.source_type,
        row.billed,
        row.collected,
        row.external_confirmed,
        row.expense,
      ]
        .map(csvCell)
        .join(","),
    );
    const blob = new Blob([[header.map(csvCell).join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `calqulus-agency-ledger-${start}-to-${end}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function submitEvidence() {
    if (!agencyId || !evidenceForm.amount) return;
    setEvidenceBusy("submit");
    try {
      let proofUrl = "";
      if (proof) {
        const ext = proof.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${agencyId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("agency-payment-evidence").upload(path, proof, { upsert: false });
        if (error) throw error;
        proofUrl = path;
      }
      const selectedInvoice = invoiceOptions.find((invoice: any) => invoice.id === evidenceForm.invoiceId);
      const payload = {
        ...evidenceForm,
        reported_amount: Number(evidenceForm.amount),
        invoice_id: evidenceForm.invoiceId || null,
        property_id: evidenceForm.propertyId || selectedInvoice?.property_id || null,
        unit_id: evidenceForm.unitId || selectedInvoice?.unit_id || null,
        tenant_id: evidenceForm.tenantId || selectedInvoice?.tenant_id || null,
        payment_date: evidenceForm.date,
        payment_method: evidenceForm.method,
        destination_type: evidenceForm.destination,
        source_type: evidenceForm.source,
        proof_url: proofUrl,
      };
      const { data, error } = await (supabase as any).rpc("submit_agency_payment_evidence_atomic", {
        p_agency_id: agencyId,
        p_payload: payload,
      });
      if (error) throw error;
      setEvidenceForm((value) => ({ ...value, amount: "", reference: "", payerName: "", notes: "" }));
      setProof(null);
      toast({
        title: "Payment evidence submitted",
        description: data?.expected_amount != null
          ? `Expected balance ${formatKes(Number(data.expected_amount))}. The evidence is in the review queue.`
          : "The evidence is now in the Agency review queue.",
      });
      await Promise.all([refetchEvidence(), refetchClose()]);
    } catch (error: any) {
      toast({ title: "Couldn't submit evidence", description: error?.message ?? "The evidence could not be recorded.", variant: "destructive" });
    } finally {
      setEvidenceBusy(null);
    }
  }

  async function decideEvidence(id: string, decision: "accepted" | "rejected" | "needs_review") {
    setEvidenceBusy(id);
    try {
      const reason =
        decision === "rejected"
          ? "Rejected after Agency review."
          : decision === "needs_review"
            ? "Held for additional evidence."
            : "Accepted after Agency review.";
      const { data, error } = await (supabase as any).rpc("review_agency_payment_evidence_atomic", {
        p_evidence_id: id,
        p_decision: decision,
        p_reason: reason,
      });
      if (error) throw error;
      const detail = Number(data?.credit_amount ?? 0) > 0
        ? `Allocated ${formatKes(Number(data?.allocated_amount ?? 0))}; credit ${formatKes(Number(data.credit_amount))}.`
        : Number(data?.allocated_amount ?? 0) > 0
          ? `Allocated ${formatKes(Number(data.allocated_amount))}.`
          : "The evidence status has been updated.";
      toast({ title: `Evidence ${friendly(decision)}`, description: detail });
      await Promise.all([refetchEvidence(), refetchBreakdown(), refetchLedger(), refetchClose()]);
    } catch (error: any) {
      toast({ title: "Review failed", description: error?.message ?? "The evidence decision could not be saved.", variant: "destructive" });
    } finally {
      setEvidenceBusy(null);
    }
  }

  async function closeBooks() {
    if (!agencyId) return;
    setEvidenceBusy("close");
    try {
      const { error } = await (supabase as any).rpc("close_agency_financial_period_atomic", {
        p_agency_id: agencyId,
        p_period_start: start,
        p_period_end: end,
        p_notes: "Closed from Agency Financial Workbench",
      });
      if (error) throw error;
      toast({ title: "Books closed", description: "The period snapshot has been saved from live Agency records." });
      await refetchClose();
    } catch (error: any) {
      toast({ title: "Books are not ready to close", description: error?.message ?? "Resolve the outstanding reconciliation items first.", variant: "destructive" });
    } finally {
      setEvidenceBusy(null);
    }
  }

  async function reopenBooks() {
    if (!agencyId || !reopenReason.trim()) return;
    setEvidenceBusy("reopen");
    try {
      const { error } = await (supabase as any).rpc("reopen_agency_financial_period_atomic", {
        p_agency_id: agencyId,
        p_period_start: start,
        p_period_end: end,
        p_reason: reopenReason.trim(),
      });
      if (error) throw error;
      setReopenReason("");
      toast({ title: "Books reopened", description: "The period can now accept controlled corrections." });
      await refetchClose();
    } catch (error: any) {
      toast({ title: "Couldn't reopen books", description: error?.message ?? "The Agency period could not be reopened.", variant: "destructive" });
    } finally {
      setEvidenceBusy(null);
    }
  }

  return (
    <AgencyLayout
      title="Financial Workbench"
      description="Configure and reconcile the financial rules of your Agency — invoices, charge lines, payments, outside-source evidence, expenses and month-end control."
      actions={
        <div className="flex items-center gap-2">
          <Input type="date" value={start} onChange={(event) => setStart(event.target.value)} className="w-[138px]" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" value={end} onChange={(event) => setEnd(event.target.value)} className="w-[138px]" />
        </div>
      }
    >
      <Tabs defaultValue="agency-financials" className="space-y-5">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="agency-financials" className="gap-2"><FileSpreadsheet className="h-4 w-4" />Agency Ledger</TabsTrigger>
          {(canRecordEvidence || canVerifyEvidence) ? <TabsTrigger value="evidence" className="gap-2"><ReceiptText className="h-4 w-4" />Payment Evidence</TabsTrigger> : null}
          {canCloseBooks ? <TabsTrigger value="close" className="gap-2"><FileCheck2 className="h-4 w-4" />Close Books</TabsTrigger> : null}
          <TabsTrigger value="pms-billing" className="gap-2"><Banknote className="h-4 w-4" />PMS Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="agency-financials" className="space-y-5">
          {breakdownLoading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)}</div> : null}
          {!breakdownLoading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ["Billed", breakdown?.totals?.billed ?? 0],
              ["Agency cash", breakdown?.totals?.collected ?? 0],
              ["Outside confirmed", breakdown?.totals?.external_confirmed ?? 0],
              ["Expenses", breakdown?.totals?.expenses ?? 0],
              ["Net position", Number(breakdown?.totals?.collected ?? 0) + Number(breakdown?.totals?.external_confirmed ?? 0) - Number(breakdown?.totals?.expenses ?? 0)],
            ].map(([label, value]) => (
              <Card key={label as string} className="shadow-sm"><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 font-heading text-xl font-semibold">{formatKes(Number(value))}</p></CardContent></Card>
            ))}
          </div> : null}

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Charge & expense breakdown</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Rent, water, security, garbage, service charges, other invoice lines and expenses are tallied from live records.</p>
              </div>
              <Button variant="outline" size="sm" onClick={exportLedger} disabled={!canViewFinancials}><Download className="mr-2 h-4 w-4" />Excel / CSV</Button>
            </CardHeader>
            <CardContent>{breakdownLoading ? <Skeleton className="h-56 w-full" /> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/50"><tr><th className="p-3 text-left">Category</th><th className="p-3 text-right">Billed</th><th className="p-3 text-right">Agency cash</th><th className="p-3 text-right">Outside</th><th className="p-3 text-right">Outstanding</th><th className="p-3 text-right">Expenses</th><th className="p-3 text-right">Net</th></tr></thead><tbody>{jsonRecords(breakdown?.rows).map((row: any)=><tr key={`${row.charge_type}-${row.label}`} className="border-t border-border"><td className="p-3 font-medium">{row.label}</td><td className="p-3 text-right">{formatKes(Number(row.billed))}</td><td className="p-3 text-right">{formatKes(Number(row.collected))}</td><td className="p-3 text-right">{formatKes(Number(row.external_confirmed))}</td><td className="p-3 text-right">{formatKes(Number(row.outstanding))}</td><td className="p-3 text-right">{formatKes(Number(row.expenses))}</td><td className="p-3 text-right font-semibold">{formatKes(Number(row.net))}</td></tr>)}{!jsonRecords(breakdown?.rows).length ? <tr><td colSpan={7} className="p-10 text-center text-sm text-muted-foreground">No financial activity in this period.</td></tr> : null}</tbody></table></div>}</CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Detailed Agency ledger</CardTitle><p className="mt-1 text-xs text-muted-foreground">Invoice lines, Agency cash, outside settlements and expenses — ready to export for client reporting and dispute resolution.</p></CardHeader>
            <CardContent><div className="max-h-[440px] overflow-auto rounded-lg border border-border"><table className="w-full text-xs"><thead className="sticky top-0 bg-card"><tr><th className="p-2 text-left">Date</th><th className="p-2 text-left">Type</th><th className="p-2 text-left">Reference</th><th className="p-2 text-left">Counterparty</th><th className="p-2 text-left">Category</th><th className="p-2 text-left">Destination</th><th className="p-2 text-left">Source</th><th className="p-2 text-right">Billed</th><th className="p-2 text-right">Collected</th><th className="p-2 text-right">Outside</th><th className="p-2 text-right">Expense</th></tr></thead><tbody>{ledger.map((row: any)=><tr key={`${row.source_id}-${row.event_type}-${row.reference}`} className="border-t border-border"><td className="p-2 whitespace-nowrap">{row.event_date}</td><td className="p-2 uppercase">{row.event_type}</td><td className="p-2">{row.reference}</td><td className="p-2">{row.counterparty}</td><td className="p-2">{row.category}</td><td className="p-2">{row.destination ? friendly(row.destination) : "—"}</td><td className="p-2">{row.source_type ? friendly(row.source_type) : "—"}</td><td className="p-2 text-right">{formatKes(Number(row.billed))}</td><td className="p-2 text-right">{formatKes(Number(row.collected))}</td><td className="p-2 text-right">{formatKes(Number(row.external_confirmed))}</td><td className="p-2 text-right">{formatKes(Number(row.expense))}</td></tr>)}</tbody></table></div></CardContent>
          </Card>
        </TabsContent>

        {(canRecordEvidence || canVerifyEvidence) ? <TabsContent value="evidence" className="grid gap-5 xl:grid-cols-[440px_minmax(0,1fr)]">
          {canRecordEvidence ? <Card>
            <CardHeader><CardTitle className="text-base">Record payment evidence</CardTitle><p className="text-xs text-muted-foreground">Use this for bank transfers, cash, tenant-paid-direct, landlord collections, bank statements or other outside-source payments. Accepted evidence can settle an invoice without being counted as Agency cash when the destination is external.</p></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5"><Label>Invoice (optional)</Label><Select value={evidenceForm.invoiceId} onValueChange={(value)=>setEvidenceForm((current)=>({...current,invoiceId:value}))}><SelectTrigger><SelectValue placeholder="Choose invoice" /></SelectTrigger><SelectContent>{invoiceOptions.map((invoice:any)=><SelectItem key={invoice.id} value={invoice.id}>{invoice.invoice_number} · {formatKes(Number(invoice.balance_due ?? invoice.amount ?? 0))}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>Property</Label><Select value={evidenceForm.propertyId} onValueChange={(value)=>setEvidenceForm((current)=>({...current,propertyId:value}))}><SelectTrigger><SelectValue placeholder="Choose property" /></SelectTrigger><SelectContent>{properties.map((property:any)=><SelectItem key={property.id} value={property.id}>{property.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label>Payment date</Label><Input type="date" value={evidenceForm.date} onChange={(event)=>setEvidenceForm((current)=>({...current,date:event.target.value}))} /></div></div>
              <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>Amount (KES)</Label><Input type="number" min="0" step="0.01" value={evidenceForm.amount} onChange={(event)=>setEvidenceForm((current)=>({...current,amount:event.target.value}))} /></div><div className="space-y-1.5"><Label>Reference</Label><Input value={evidenceForm.reference} onChange={(event)=>setEvidenceForm((current)=>({...current,reference:event.target.value}))} placeholder="Bank / M-Pesa / receipt reference" /></div></div>
              <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>Payment method</Label><Select value={evidenceForm.method} onValueChange={(value)=>setEvidenceForm((current)=>({...current,method:value}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_METHODS.map((value)=><SelectItem key={value} value={value}>{friendly(value)}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label>Destination</Label><Select value={evidenceForm.destination} onValueChange={(value)=>setEvidenceForm((current)=>({...current,destination:value}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_DESTINATIONS.map((value)=><SelectItem key={value} value={value}>{friendly(value)}</SelectItem>)}</SelectContent></Select></div></div>
              <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label>Evidence source</Label><Select value={evidenceForm.source} onValueChange={(value)=>setEvidenceForm((current)=>({...current,source:value}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{EVIDENCE_SOURCES.map((value)=><SelectItem key={value} value={value}>{friendly(value)}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label>Payer name</Label><Input value={evidenceForm.payerName} onChange={(event)=>setEvidenceForm((current)=>({...current,payerName:event.target.value}))} placeholder="Person / entity making the payment" /></div></div>
              <div className="space-y-1.5"><Label>Proof image / PDF</Label><label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-background px-3 py-4 text-sm"><ImageUp className="h-5 w-5 text-primary" /><span className="min-w-0 flex-1 truncate">{proof?.name ?? "Choose bank slip, receipt or evidence"}</span><Upload className="h-4 w-4" /><input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event)=>setProof(event.target.files?.[0] ?? null)} /></label></div>
              <Textarea value={evidenceForm.notes} onChange={(event)=>setEvidenceForm((current)=>({...current,notes:event.target.value}))} placeholder="Add dispute context, partial-payment detail, bank narration or client instruction." />
              <Button className="w-full" disabled={evidenceBusy === "submit" || !evidenceForm.amount} onClick={()=>void submitEvidence()}>{evidenceBusy === "submit" ? "Submitting…" : "Submit for verification"}</Button>
            </CardContent>
          </Card> : <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">You have verification access but not payment-recording access. Use the review queue on the right.</CardContent></Card>}

          {canVerifyEvidence ? <Card>
            <CardHeader><CardTitle className="text-base">Verification & dispute queue</CardTitle><p className="text-xs text-muted-foreground">Verify amount, reference, evidence and destination before accepting. An accepted external settlement reduces the invoice balance but stays outside Agency cash totals.</p></CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-primary/15 bg-primary/5 p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Outside-source control</p><p className="mt-1 text-xs text-muted-foreground">{externalQueue.length} non-Agency evidence item{externalQueue.length === 1 ? "" : "s"} currently in the queue.</p></div><ShieldAlert className="h-4 w-4 text-primary" /></div></div>
              {evidence.map((row:any)=><div key={row.id} className="rounded-xl border border-border bg-background p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold">{formatKes(Number(row.reported_amount))} · {friendly(row.payment_method ?? "other")}</p><p className="mt-1 text-xs text-muted-foreground">{row.payment_date} · {row.reference || "No reference"} · {friendly(row.destination_type ?? "external")} · {friendly(row.source_type ?? "agent_manual")}</p>{row.expected_amount != null ? <p className={`mt-1 text-xs ${Math.abs(Number(row.reported_amount)-Number(row.expected_amount)) < 0.01 ? "text-primary" : "text-warning"}`}>Expected balance {formatKes(Number(row.expected_amount))} · Difference {formatKes(Number(row.reported_amount)-Number(row.expected_amount))}</p> : null}{row.notes ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{row.notes}</p> : null}</div><Badge variant={row.status === "accepted" ? "secondary" : row.status === "rejected" ? "destructive" : "outline"}>{friendly(row.status)}</Badge></div>{row.proof_url ? <Button size="sm" variant="ghost" className="mt-2" onClick={()=>void supabase.storage.from("agency-payment-evidence").createSignedUrl(row.proof_url,300).then(({data,error})=>{if(error||!data?.signedUrl){toast({title:"Couldn't open proof",description:error?.message??"Evidence file unavailable",variant:"destructive"});return}window.open(data.signedUrl,"_blank","noopener,noreferrer")})}>View proof</Button> : null}{(row.status === "pending" || row.status === "needs_review") ? <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" onClick={()=>void decideEvidence(row.id,"accepted")} disabled={evidenceBusy===row.id}><CheckCircle2 className="mr-1.5 h-4 w-4" />Accept</Button><Button size="sm" variant="outline" onClick={()=>void decideEvidence(row.id,"needs_review")} disabled={evidenceBusy===row.id}><ShieldAlert className="mr-1.5 h-4 w-4" />Need review</Button><Button size="sm" variant="destructive" onClick={()=>void decideEvidence(row.id,"rejected")} disabled={evidenceBusy===row.id}><XCircle className="mr-1.5 h-4 w-4" />Reject</Button></div> : null}</div>)}
              {!evidence.length ? <div className="py-10 text-center text-sm text-muted-foreground">No evidence submissions yet.</div> : null}
            </CardContent>
          </Card> : null}
        </TabsContent> : null}

        {canCloseBooks ? <TabsContent value="close" className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Pending evidence",closeState?.checks?.pending_evidence ?? 0],["Unmatched bank",closeState?.checks?.unmatched_bank_transactions ?? 0],["Pending payments",closeState?.checks?.pending_payments ?? 0],["Ready",closeState?.ready_to_close ? "YES" : "NO"]].map(([label,value])=><Card key={String(label)}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-heading text-xl font-semibold">{value}</p></CardContent></Card>)}</div>
          <Card><CardHeader><CardTitle className="text-base">Month-end reconciliation</CardTitle><p className="mt-1 text-xs text-muted-foreground">Close only after Agency evidence, bank exceptions and pending payment states are resolved. The snapshot is generated automatically from the live ledger.</p></CardHeader><CardContent className="space-y-4"><div className="rounded-xl border border-border bg-background p-4"><div className="flex items-start gap-3"><CheckCircle2 className={`mt-0.5 h-5 w-5 ${closeState?.ready_to_close ? "text-primary" : "text-warning"}`} /><div><p className="text-sm font-semibold">{closeState?.ready_to_close ? "The period is ready to close" : "Resolve the remaining control items"}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Closing stores live invoice lines, Agency cash, accepted outside-source evidence, expenses and control checks. No manual total entry is required.</p></div></div></div><div className="flex flex-wrap gap-2"><Button disabled={!closeState?.ready_to_close || closeState?.status === "closed" || evidenceBusy === "close"} onClick={()=>void closeBooks()}>{evidenceBusy === "close" ? "Closing…" : closeState?.status === "closed" ? "Books already closed" : "Close Agency books"}</Button>{closeState?.status === "closed" ? <div className="flex min-w-[280px] flex-1 gap-2"><Input value={reopenReason} onChange={(event)=>setReopenReason(event.target.value)} placeholder="Reason required to reopen closed period" /><Button variant="outline" disabled={!reopenReason.trim() || evidenceBusy === "reopen"} onClick={()=>void reopenBooks()}><UnlockKeyhole className="mr-1.5 h-4 w-4" />{evidenceBusy === "reopen" ? "Reopening…" : "Reopen"}</Button></div> : null}</div></CardContent></Card>
        </TabsContent> : null}

        <TabsContent value="pms-billing" className="space-y-5"><Card><CardHeader><CardTitle className="text-base">Agency collection destination</CardTitle><p className="mt-1 text-xs text-muted-foreground">The routing screen reflects the Agency's configured collection destination. Client contracts can override the baseline per relationship.</p></CardHeader><CardContent><AgencyPaymentRoutingPanel agencyId={agencyId ?? ""}/></CardContent></Card><Billing/></TabsContent>
      </Tabs>
    </AgencyLayout>
  );
}
