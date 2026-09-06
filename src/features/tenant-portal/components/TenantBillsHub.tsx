/**
 * TenantBillsHub — Rent, water, security & amenities with pay-one or pay-combined.
 */
import { format } from 'date-fns';
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { chargeMeta } from '@/shared/constants/chargeTypes';
import { Receipt, Smartphone, Layers, CheckCircle2, CalendarClock, CreditCard, Home } from 'lucide-react';
import { invoiceStatusLabel, invoiceStatusTone, statusBadgeClass } from '@/shared/lib/statusBadge';
import { invoiceDisplayBadge } from '@/shared/lib/invoiceStatusDisplay';
import type { PayableInvoice } from '@/features/tenant-portal/components/TenantPayNowDialog';

interface TenantBillsHubProps {
  tenantId: string;
  onPay: (invoices: PayableInvoice[]) => void;
  /** When the portal already loaded invoices, skip the duplicate list fetch. */
  invoices?: PayableInvoice[];
}

interface InvoiceRow extends PayableInvoice {
  lineItems: { charge_type: string; charge_label: string; amount: number }[];
  paymentAccount?: any;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n);

const balanceOf = (inv: PayableInvoice) => Number(inv.balance_due ?? inv.amount);

const TenantBillsHub: React.FC<TenantBillsHubProps> = ({ tenantId, onPay, invoices: seedInvoices }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: bills = [], isLoading } = useQuery({
    queryKey: ['tenant-invoices', tenantId, 'bills-hub', seedInvoices?.map((i) => i.id).join(',') ?? 'fetch'],
    queryFn: async (): Promise<InvoiceRow[]> => {
      let invoices = seedInvoices;
      if (!invoices) {
        const { data, error } = await supabase
          .from('invoices')
          .select('id, invoice_number, amount, balance_due, paid_amount, due_date, status, description, lease_id, leases(unit_id, unit, property_id, properties(name))')
          .eq('tenant_id', tenantId)
          .order('due_date', { ascending: true });
        if (error) throw error;
        invoices = (data ?? []) as PayableInvoice[];
      }

      const allInvoices = invoices ?? [];
      if (!allInvoices.length) return [];

      const ids = allInvoices.map((i) => i.id);
      const { data: lines } = await supabase
        .from('invoice_line_items')
        .select('invoice_id, charge_type, charge_label, amount')
        .in('invoice_id', ids);

      const linesByInv = new Map<string, typeof lines>();
      for (const line of lines ?? []) {
        const list = linesByInv.get(line.invoice_id) ?? [];
        list.push(line);
        linesByInv.set(line.invoice_id, list);
      }

      const enriched = await Promise.all(allInvoices.map(async (inv) => {
        const { data: paymentAccount } = (inv.status === 'paid') ? { data: null } : await supabase.rpc('get_invoice_payment_instructions' as any, { p_invoice_id: inv.id });
        const route = Array.isArray(paymentAccount) ? paymentAccount[0] : paymentAccount;
        const lease = Array.isArray((inv as any).leases) ? (inv as any).leases[0] : (inv as any).leases;
        const property = Array.isArray(lease?.properties) ? lease.properties[0] : lease?.properties;
        return { ...inv, unit_id: lease?.unit_id ?? null, unit_number: lease?.unit ?? null, property_id: lease?.property_id ?? inv.property_id ?? null, property_name: property?.name ?? null, status: inv.status as PayableInvoice['status'], lineItems: (linesByInv.get(inv.id) ?? []).map((l) => ({ charge_type: l.charge_type, charge_label: l.charge_label, amount: Number(l.amount) })), paymentAccount: route };
      }));
      return enriched;
    },
    enabled: !!tenantId,
  });

  const payable = bills.filter((b) => b.status !== 'paid' && balanceOf(b) > 0);
  const paidBills = bills.filter((b) => b.status === 'paid');
  const totalDue = payable.reduce((s, b) => s + balanceOf(b), 0);

  const selectedBills = useMemo(
    () => payable.filter((b) => selected.has(b.id)),
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
    [payable, selected],
  );
  const selectedTotal = selectedBills.reduce((s, b) => s + balanceOf(b), 0);
  const unitGroups = useMemo(() => {
    const groups = new Map<string, { label: string; bills: InvoiceRow[] }>();
    for (const bill of payable) {
      const key = bill.unit_id ?? bill.property_id ?? bill.id;
      const label = bill.unit_number ? `Unit ${bill.unit_number}` : (bill.property_name ?? 'Unit');
      const current = groups.get(key) ?? { label, bills: [] };
      current.bills.push(bill);
      groups.set(key, current);
    }
    return [...groups.values()];
  }, [payable]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(payable.map((b) => b.id)));
  const clearSelection = () => setSelected(new Set());

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (payable.length === 0 && paidBills.length === 0) {
    return (
      <Card className="border-success/30 bg-success/10"><CardContent className="py-10 text-center"><CheckCircle2 className="h-12 w-12 text-success mx-auto mb-3" /><p className="font-semibold text-success">All caught up</p><p className="text-sm text-success mt-1">No outstanding rent, water, or amenity bills.</p></CardContent></Card>
    );
  }

  return (
    <Card className="border-warning/40 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Receipt className="h-5 w-5 text-warning" />
              My bills
            </CardTitle>
            <CardDescription>
              Pay rent, water, security & other charges separately or in one M-Pesa payment
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total outstanding</p>
            <p className="text-2xl font-bold text-foreground">{fmt(totalDue)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={selectAll}>
            Select all ({payable.length})
          </Button>
          {selected.size > 0 && (
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Clear
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {unitGroups.map((group) => (
            <div key={group.label} className="space-y-2">
              <div className="flex items-center gap-2 px-1 pt-1">
                <Home className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">{group.label}</span>
                <span className="text-xs text-muted-foreground">{group.bills.length} bill{group.bills.length === 1 ? '' : 's'}</span>
              </div>
              {group.bills.map((bill) => {
            const meta = bill.lineItems.length
              ? chargeMeta(bill.lineItems[0].charge_type)
              : chargeMeta(
                  bill.description?.toLowerCase().includes('water')
                    ? 'water'
                    : bill.description?.toLowerCase().includes('security')
                      ? 'security'
                      : 'rent',
                );
            const Icon = meta.icon;
            const isChecked = selected.has(bill.id);

            return (
              <div
                key={bill.id}
                className={`rounded-xl border p-4 transition-colors ${
                  isChecked ? 'border-warning/40 bg-warning/10' : 'border-border bg-card'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => toggle(bill.id)}
                    className="mt-1"
                    aria-label={`Select ${bill.invoice_number}`}
                  />
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 border ${meta.bg}`}>
                    <Icon className={`h-5 w-5 ${meta.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-sm">
                        {bill.lineItems.length
                          ? bill.lineItems.map((l) => l.charge_label).join(' · ')
                          : bill.description || meta.label}
                      </p>
                      {(() => { const display = invoiceDisplayBadge(bill.status, bill.due_date); return <span className={display.className}>{display.label}</span>; })()}
                      <span className="text-xs text-muted-foreground">Due {format(new Date(bill.due_date), 'dd MMM')}</span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{bill.invoice_number}{bill.unit_number ? ` · Unit ${bill.unit_number}` : ''}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      {(() => { const display = invoiceDisplayBadge(bill.status, bill.due_date); return <span className={`inline-flex items-center gap-1 ${display.iconTone}`}><CalendarClock className="h-3.5 w-3.5" />Due {format(new Date(bill.due_date), 'dd MMM yyyy')}</span>; })()}
                      {bill.status !== 'paid' && bill.paymentAccount && <span className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-primary"><CreditCard className="h-3.5 w-3.5" />{bill.paymentAccount.payment_method === 'mpesa_till' ? `Till ${bill.paymentAccount.till_number}` : bill.paymentAccount.payment_method === 'mpesa_paybill' ? `Paybill ${bill.paymentAccount.paybill_number}` : bill.paymentAccount.payment_method === 'bank_transfer' ? `${bill.paymentAccount.bank_name} • ${bill.paymentAccount.bank_account_number}` : 'Office / cash'}</span>}
                    </div>
                    {bill.lineItems.length > 1 && (
                      <ul className="mt-2 space-y-0.5">
                        {bill.lineItems.map((l, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex justify-between gap-2">
                            <span>{l.charge_label}</span>
                            <span>{fmt(l.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold">{fmt(balanceOf(bill))}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 min-h-11 h-11 text-xs"
                      onClick={() => onPay([bill])}
                    >
                      Pay only
                    </Button>
                  </div>
                </div>
              </div>
            );
              })}
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-muted/50 border p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">
              {selected.size === 0
                ? 'Select bills to combine, or use Pay only on each row'
                : `${selected.size} bill${selected.size > 1 ? 's' : ''} selected`}
            </p>
            {selected.size > 0 && <p className="text-xl font-bold mt-0.5">{fmt(selectedTotal)}</p>}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button size="lg" className="gap-2 h-11" onClick={() => onPay(payable)}>
              <Smartphone className="h-4 w-4" />
              Pay now — {fmt(totalDue)}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="gap-2 min-h-11 h-11"
              disabled={selected.size === 0}
              onClick={() => onPay(selectedBills)}
            >
              <Layers className="h-4 w-4" />
              Pay selected ({selected.size || 0})
            </Button>
          </div>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Instant receipt by email & SMS after M-Pesa confirms.
        </p>
        {paidBills.length > 0 && (
          <div className="pt-3 border-t space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-success"><CheckCircle2 className="h-4 w-4" />Paid invoices</div>
            {paidBills.slice(0, 6).map((bill) => <div key={bill.id} className="flex items-center justify-between rounded-lg border border-success/20 bg-success/5 px-3 py-2"><div><p className="text-sm font-medium">{bill.description || bill.invoice_number}</p><p className="text-xs text-muted-foreground font-mono">{bill.invoice_number}</p></div><div className="text-right"><span className={statusBadgeClass('success')}>Paid</span><p className="text-xs text-muted-foreground mt-1">{format(new Date(bill.due_date), 'dd MMM yyyy')}</p></div></div>)}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TenantBillsHub;
