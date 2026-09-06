// @ts-nocheck — Supabase generated types are updated separately from migrations.
import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { AlertCircle, CheckCircle2, ChevronRight, CreditCard, Loader2, Search, Users, Wallet } from "lucide-react";
import { useCurrency } from "@/shared/hooks/useCurrency";

const STATUS: Record<string, { label: string; className: string }> = {
  paid: { label: "Paid", className: "bg-success/10 text-success border-success/20" },
  partially_paid: { label: "Partial", className: "bg-warning/10 text-warning border-warning/20" },
  overdue: { label: "Overdue", className: "bg-destructive/10 text-destructive border-destructive/20" },
  pending: { label: "Pending", className: "bg-muted text-muted-foreground border-border" },
  no_billing: { label: "No billing", className: "bg-muted text-muted-foreground border-border" },
};

const UnitPaymentReconciliation = ({ propertyId, landlordView = false, title = "Unit payment reconciliation" }: { propertyId?: string; landlordView?: boolean; title?: string }) => {
  const { formatCurrency } = useCurrency();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedUnit, setSelectedUnit] = useState<any>(null);

  const { data: rows = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["unit-payment-reconciliation", propertyId ?? "manager"],
    queryFn: async () => {
      const result = propertyId
        ? await supabase.rpc("get_unit_payment_reconciliation", { p_property_id: propertyId })
        : await supabase.rpc("get_manager_unit_payment_reconciliation");
      if (result.error) throw result.error;
      return result.data ?? [];
    },
  });

  const visible = useMemo(() => rows.filter((r: any) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || r.unit_number?.toLowerCase().includes(q) || r.property_name?.toLowerCase().includes(q);
    return matchesSearch && (filter === "all" || r.payment_status === filter);
  }), [rows, search, filter]);

  const totals = useMemo(() => rows.reduce((a: any, r: any) => ({ billed: a.billed + Number(r.invoiced_amount || 0), paid: a.paid + Number(r.paid_amount || 0), balance: a.balance + Number(r.balance_due || 0) }), { billed: 0, paid: 0, balance: 0 }), [rows]);

  return <>
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2"><Wallet className="h-4 w-4" />{title}</CardTitle>
            <CardDescription>One payment can cover several units. Every allocation is reconciled back to the affected unit.</CardDescription>
          </div>
          <div className="grid grid-cols-3 gap-2 text-right text-xs">
            <div><span className="text-muted-foreground">Billed</span><p className="font-semibold">{formatCurrency(totals.billed)}</p></div>
            <div><span className="text-muted-foreground">Collected</span><p className="font-semibold text-success">{formatCurrency(totals.paid)}</p></div>
            <div><span className="text-muted-foreground">Balance</span><p className="font-semibold text-destructive">{formatCurrency(totals.balance)}</p></div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search unit…" value={search} onChange={e => setSearch(e.target.value)} /></div>
          <div className="flex gap-1 flex-wrap">
            {[["all","All"],["paid","Paid"],["partially_paid","Partial"],["overdue","Overdue"],["pending","Pending"]].map(([v,l]) => <Button key={v} size="sm" variant={filter===v ? "default" : "ghost"} onClick={() => setFilter(v)}>{l}</Button>)}
          </div>
        </div>
        {isLoading ? <div className="space-y-2">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-12 w-full" />)}</div> : isError ? <div className="py-8 text-center text-sm text-muted-foreground"><AlertCircle className="h-7 w-7 mx-auto mb-2" />Could not load unit reconciliation.<Button className="ml-2" size="sm" variant="outline" onClick={() => refetch()}>Retry</Button></div> : visible.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground">No units match this filter.</div> : <div className="overflow-x-auto rounded-lg border border-border">
          <Table><TableHeader><TableRow><TableHead>Unit</TableHead>{!propertyId && <TableHead>Property</TableHead>}<TableHead>Status</TableHead><TableHead>Invoiced</TableHead><TableHead>Collected</TableHead><TableHead>Balance</TableHead><TableHead>Payments</TableHead><TableHead className="text-right"> </TableHead></TableRow></TableHeader>
            <TableBody>{visible.map((r: any) => { const s=STATUS[r.payment_status] || STATUS.pending; return <TableRow key={`${r.property_id ?? propertyId}-${r.unit_id}`}>
              <TableCell className="font-semibold">{r.unit_number}</TableCell>
              {!propertyId && <TableCell className="text-sm">{r.property_name}</TableCell>}
              <TableCell><Badge variant="outline" className={s.className}>{s.label}</Badge></TableCell>
              <TableCell>{formatCurrency(Number(r.invoiced_amount || 0))}</TableCell>
              <TableCell className="text-success">{formatCurrency(Number(r.paid_amount || 0))}</TableCell>
              <TableCell className={Number(r.balance_due)>0 ? "text-destructive font-semibold" : "text-muted-foreground"}>{formatCurrency(Number(r.balance_due || 0))}</TableCell>
              <TableCell><span className="inline-flex items-center gap-1 text-xs"><CreditCard className="h-3.5 w-3.5" />{r.payment_count || 0}</span>{!landlordView && r.payer_count > 0 && <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" />{r.payer_count} payer{r.payer_count===1?"":"s"}</span>}</TableCell>
              <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => setSelectedUnit(r)}>Details <ChevronRight className="h-4 w-4 ml-1" /></Button></TableCell>
            </TableRow>; })}</TableBody>
          </Table>
        </div>}
      </CardContent>
    </Card>
    <UnitPaymentDetail unit={selectedUnit} open={!!selectedUnit} onOpenChange={(open) => !open && setSelectedUnit(null)} landlordView={landlordView} formatCurrency={formatCurrency} />
  </>;
};

const UnitPaymentDetail = ({ unit, open, onOpenChange, landlordView, formatCurrency }) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["unit-payment-activity", unit?.unit_id],
    enabled: open && !!unit?.unit_id,
    queryFn: async () => { const { data, error } = await supabase.rpc("get_unit_payment_activity", { p_unit_id: unit.unit_id }); if (error) throw error; return data; },
  });
  const allocations = data?.allocations ?? [];
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Unit {unit?.unit_number} — payment trail</DialogTitle><DialogDescription>Every completed allocation is shown here, including payments that were part of a larger bulk transaction.</DialogDescription></DialogHeader>
    {isLoading ? <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div> : isError ? <p className="text-sm text-destructive">Could not load payment activity.</p> : allocations.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground"><CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-40" />No completed payments allocated to this unit.</div> : <div className="overflow-x-auto rounded-lg border border-border"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Invoice</TableHead><TableHead>Allocation</TableHead><TableHead>Transaction</TableHead><TableHead>Method</TableHead>{!landlordView && <TableHead>Payer</TableHead>}<TableHead>Reference</TableHead></TableRow></TableHeader><TableBody>{allocations.map((a:any) => <TableRow key={a.allocation_id}><TableCell className="whitespace-nowrap">{a.completed_at ? new Date(a.completed_at).toLocaleDateString() : "—"}</TableCell><TableCell>{a.invoice_number}</TableCell><TableCell className="font-semibold">{formatCurrency(Number(a.allocated_amount || 0))}</TableCell><TableCell className="font-mono text-xs">{String(a.transaction_id).slice(0,8)}</TableCell><TableCell className="capitalize">{String(a.payment_method || a.payment_type || "payment").replaceAll("_"," ")}</TableCell>{!landlordView && <TableCell><div className="font-medium">{a.payer_name}</div><div className="text-xs text-muted-foreground capitalize">{String(a.payer_type || "").replaceAll("_"," ")}</div></TableCell>}<TableCell className="font-mono text-xs">{a.mpesa_receipt_number || a.bank_reference || "—"}</TableCell></TableRow>)}</TableBody></Table></div>}
  </DialogContent></Dialog>;
};

export default UnitPaymentReconciliation;
