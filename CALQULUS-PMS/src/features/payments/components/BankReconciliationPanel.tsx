// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { CheckCircle, AlertTriangle, Search, Landmark, RefreshCw, Link2 } from 'lucide-react';
import { format } from 'date-fns';
import { errorToast } from "@/shared/lib/errorToast";

const fmt = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n);

const AUTO_ALLOCATE = 'auto';

interface BankTx {
  id: string;
  external_id: string;
  bank_name: string;
  amount: number;
  reference: string;
  payer_name: string;
  payer_phone: string;
  transaction_date: string;
  matched: boolean;
  match_method: string | null;
  matched_invoice_id: string | null;
  matched_tenant_id: string | null;
}

interface BankReconciliationPanelProps {
  managerId: string;
}

const BankReconciliationPanel: React.FC<BankReconciliationPanelProps> = ({ managerId }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [matchDialog, setMatchDialog] = useState<BankTx | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(AUTO_ALLOCATE);
  const [search, setSearch] = useState('');

  const { data: transactions = [], isLoading, refetch } = useQuery({
    queryKey: ['bank-transactions', managerId],
    queryFn: async () => {
      const { data } = await (supabase
        .from('bank_transactions')
        .select('*')
        .eq('manager_id', managerId)
        .order('transaction_date', { ascending: false })
        .limit(100));
      return (data || []) as BankTx[];
    },
  });

  const unmatched = transactions.filter(t => !t.matched && t.match_method !== 'ignored');
  const matched   = transactions.filter(t => t.matched && t.match_method !== 'ignored');

  // Tenants for matching
  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants-for-reconcile', managerId],
    queryFn: async () => {
      const { data } = await supabase
        .from('tenants')
        .select('id, name, unit, property')
        .eq('manager_id', managerId)
        .eq('status', 'active')
        .order('name');
      return (data || []) as Array<{ id: string; name: string; unit: string | null; property: string | null }>;
    },
  });

  // Pending invoices for selected tenant
  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices-for-reconcile', selectedTenantId],
    queryFn: async () => {
      if (!selectedTenantId) return [];
      const { data } = await supabase
        .from('invoices')
        .select('id, invoice_number, amount, balance_due, due_date')
        .eq('tenant_id', selectedTenantId)
        .in('status', ['pending', 'overdue', 'partially_paid'])
        .order('due_date');
      return (data || []) as Array<{ id: string; invoice_number: string; amount: number; balance_due: number; due_date: string }>;
    },
    enabled: !!selectedTenantId,
  });

  const matchTransaction = useMutation({
    mutationFn: async () => {
      if (!matchDialog) return;
      const { data, error } = await supabase.rpc('reconcile_bank_transaction_atomic', {
        p_bank_transaction_id: matchDialog.id,
        p_invoice_id: selectedInvoiceId === AUTO_ALLOCATE ? null : selectedInvoiceId,
        p_manager_id: managerId,
        p_recorded_by: managerId,
        p_tenant_id: selectedTenantId,
      });
      if (error) throw error;
      if (!data?.success) throw new Error('Bank reconciliation did not complete');
    },
    onSuccess: () => {
      toast({ title: 'Payment matched', description: 'Invoice updated and receipt sent.' });
      setMatchDialog(null);
      setSelectedTenantId('');
      setSelectedInvoiceId(AUTO_ALLOCATE);
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
    },
    onError: (err: Error) => errorToast('Match failed', err),
  });

  const ignoreTransaction = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc('dismiss_bank_transaction_atomic', { p_bank_transaction_id: id, p_manager_id: managerId });
      if (error) throw error;
      if (!data?.success) throw new Error('Transaction dismissal did not complete');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
      toast({ title: 'Transaction ignored' });
    },
    onError: (e: Error) => errorToast('Failed to ignore', e),
  });

  const filtered = transactions.filter(t => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.reference?.toLowerCase().includes(q) ||
      t.payer_name?.toLowerCase().includes(q) ||
      t.bank_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-xs text-muted-foreground">Unmatched</p>
          <p className="text-xl font-bold text-red-700">{unmatched.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {fmt(unmatched.reduce((s, t) => s + Number(t.amount), 0))} total
          </p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-3">
          <p className="text-xs text-muted-foreground">Matched</p>
          <p className="text-xl font-bold text-green-700">{matched.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {fmt(matched.reduce((s, t) => s + Number(t.amount), 0))} total
          </p>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">All transactions</p>
          <p className="text-xl font-bold">{transactions.length}</p>
          <Button size="sm" variant="ghost" className="h-6 text-xs mt-1 gap-1 p-0" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3" />Refresh
          </Button>
        </div>
      </div>

      {/* Info when no bank integration */}
      {transactions.length === 0 && !isLoading && (
        <Card className="border-blue-200 bg-blue-50/40">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Landmark className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900 text-sm">No bank transactions yet</p>
                <p className="text-xs text-blue-700 mt-1">
                  Connect your bank in Settings → Bank Integration to receive automatic transaction feeds.
                  Supported banks: Equity, KCB, NCBA, Co-op, ABSA, Stanbic.
                  When a tenant pays, the transaction appears here for matching.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction list */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm">Transactions</CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search reference, payer…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs w-52"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-14 w-full"/>)}</div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">No transactions found</p>
          ) : (
            <div className="space-y-2">
              {filtered.map(tx => (
                <div key={tx.id} className={`flex items-center gap-3 p-3 rounded-lg border ${
                  tx.matched && tx.match_method !== 'ignored' ? 'border-green-200 bg-green-50/30' :
                  tx.matched && tx.match_method === 'ignored' ? 'border-border opacity-50' :
                  'border-amber-200 bg-amber-50/30'
                }`}>
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                    tx.matched && tx.match_method !== 'ignored' ? 'bg-green-100' : 'bg-amber-100'
                  }`}>
                    {tx.matched && tx.match_method !== 'ignored'
                      ? <CheckCircle className="h-4 w-4 text-green-600" />
                      : <AlertTriangle className="h-4 w-4 text-warning" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{fmt(tx.amount)}</p>
                      <Badge variant="outline" className="text-xs capitalize">{tx.bank_name}</Badge>
                      <Badge variant="outline" className={`text-xs ${tx.matched && tx.match_method !== 'ignored' ? 'bg-green-100 text-green-800 border-green-200' : tx.matched && tx.match_method === 'ignored' ? '' : 'bg-amber-100 text-amber-800 border-amber-200'}`}>
                        {tx.matched ? (tx.match_method === 'ignored' ? 'ignored' : 'matched') : 'unmatched'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {tx.payer_name} · {tx.reference} · {format(new Date(tx.transaction_date), 'dd/MM/yy')}
                    </p>
                  </div>
                  {tx.match_status === 'unmatched' && (
                    <div className="flex gap-1.5 shrink-0">
                      <Button size="sm" className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => { setMatchDialog(tx); setSelectedTenantId(''); setSelectedInvoiceId(AUTO_ALLOCATE); }}>
                        <Link2 className="h-3 w-3" />Match
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                        onClick={() => ignoreTransaction.mutate(tx.id)}>
                        Ignore
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Match dialog */}
      <Dialog open={!!matchDialog} onOpenChange={open => !open && setMatchDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Match bank transaction</DialogTitle>
            <DialogDescription>
              {matchDialog && `${fmt(matchDialog.amount)} from ${matchDialog.payer_name} on ${format(new Date(matchDialog.transaction_date), 'dd/MM/yy')}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Tenant</Label>
              <Select value={selectedTenantId} onValueChange={v => { setSelectedTenantId(v); setSelectedInvoiceId(AUTO_ALLOCATE); }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select tenant" /></SelectTrigger>
                <SelectContent>
                  {tenants.map((t: { id: string; name: string; unit: string | null; property: string | null }) => (
                    <SelectItem key={t.id} value={t.id}>{t.name} — {t.unit}, {t.property}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedTenantId && (
              <div>
                <Label>Apply to invoice (optional — auto-allocates if blank)</Label>
                <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Auto-allocate oldest first" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={AUTO_ALLOCATE}>Auto-allocate (oldest first)</SelectItem>
                    {invoices.map((i: { id: string; invoice_number: string; amount: number; balance_due: number; due_date: string }) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.invoice_number} — {fmt(i.balance_due ?? i.amount)} due {format(new Date(i.due_date), 'dd MMM')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMatchDialog(null)}>Cancel</Button>
            <Button
              onClick={() => matchTransaction.mutate()}
              disabled={!selectedTenantId || matchTransaction.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {matchTransaction.isPending ? 'Processing…' : 'Match & process payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BankReconciliationPanel;
