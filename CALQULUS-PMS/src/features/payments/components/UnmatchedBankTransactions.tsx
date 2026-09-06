import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/shared/hooks/use-toast';
import { useCurrency } from '@/shared/hooks/useCurrency';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/shared/components/ui/select';
import { AlertTriangle, Link, RefreshCw, Loader2, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { errorToast } from "@/shared/lib/errorToast";

interface BankTx {
  id: string;
  reference: string;
  description: string | null;
  amount: number;
  transaction_date: string;
  bank_name: string | null;
  payer_name: string | null;
  payer_phone: string | null;
  matched: boolean;
  source: string;
  created_at: string;
}

interface PendingInvoice {
  id: string;
  invoice_number: string;
  amount: number;
  balance_due: number;
  due_date: string;
  status: string;
  tenant_name: string;
  tenant_id: string;
  unit: string | null;
}

const UnmatchedBankTransactions: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const queryClient = useQueryClient();

  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<BankTx | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');

  const { data: unmatchedTxs = [], isLoading, refetch } = useQuery({
    queryKey: ['unmatched-bank-transactions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_transactions')
        .select('*')
        .eq('manager_id', user!.id)
        .eq('matched', false)
        .order('transaction_date', { ascending: false });
      if (error) throw error;
      return (data || []) as BankTx[];
    },
    enabled: !!user?.id,
  });

  const { data: pendingInvoices = [] } = useQuery({
    queryKey: ['pending-invoices-for-match', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select(`id, invoice_number, amount, balance_due, due_date, status,
                 tenants(id, name, unit)`)
        .in('status', ['pending', 'overdue'])
        .eq('manager_id', user!.id)
        .order('due_date', { ascending: true });
      if (error) throw error;
      return (data || []).map((inv: any) => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        amount: Number(inv.amount),
        balance_due: Number(inv.balance_due ?? inv.amount),
        due_date: inv.due_date,
        status: inv.status,
        tenant_name: inv.tenants?.name ?? 'Unknown',
        tenant_id: inv.tenants?.id ?? '',
        unit: inv.tenants?.unit ?? null,
      })) as PendingInvoice[];
    },
    enabled: !!user?.id,
  });

  const matchTransaction = useMutation({
    mutationFn: async () => {
      if (!selectedTx || !selectedInvoiceId) throw new Error('Select an invoice');
      const invoice = pendingInvoices.find(i => i.id === selectedInvoiceId);
      if (!invoice) throw new Error('Invoice not found');

      const { data, error } = await supabase.rpc('reconcile_bank_transaction_atomic', {
        p_bank_transaction_id: selectedTx.id,
        p_invoice_id: selectedInvoiceId,
        p_manager_id: user!.id,
        p_recorded_by: user!.id,
      });
      if (error) throw error;
      if (!data?.success) throw new Error('Bank reconciliation did not complete');
    },
    onSuccess: () => {
      toast({ title: 'Payment matched and recorded', description: 'Receipt sent to tenant.' });
      queryClient.invalidateQueries({ queryKey: ['unmatched-bank-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['pending-invoices-for-match'] });
      queryClient.invalidateQueries({ queryKey: ['manager-pending-invoices'] });
      setMatchDialogOpen(false);
      setSelectedTx(null);
      setSelectedInvoiceId('');
    },
    onError: (err: Error) => errorToast('Failed', err),
  });

  const dismissTransaction = useMutation({
    mutationFn: async (txId: string) => {
      const { data, error } = await supabase.rpc('dismiss_bank_transaction_atomic', { p_bank_transaction_id: txId, p_manager_id: user!.id });
      if (error) throw error;
      if (!data?.success) throw new Error('Transaction dismissal did not complete');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unmatched-bank-transactions'] });
      toast({ title: 'Transaction dismissed' });
    },
  });

  if (isLoading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Unmatched bank transactions
              {unmatchedTxs.length > 0 && (
                <Badge className="bg-amber-100 text-amber-800 border-amber-200">{unmatchedTxs.length}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Bank payments received that couldn't be auto-matched to an invoice
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {unmatchedTxs.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <CheckCircle className="h-10 w-10 mx-auto mb-3 opacity-30 text-green-600" />
              <p className="text-sm font-medium">All bank payments matched</p>
              <p className="text-xs mt-1 opacity-70">No unmatched transactions</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Bank / Payer</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unmatchedTxs.map(tx => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {tx.transaction_date ? format(new Date(tx.transaction_date), 'dd/MM/yy') : '—'}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{tx.payer_name || '—'}</p>
                        <p className="text-xs text-muted-foreground">
                          {tx.bank_name ? tx.bank_name.toUpperCase() : 'Bank'}{tx.payer_phone ? ` · ${tx.payer_phone}` : ''}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground max-w-xs truncate">
                      {tx.reference || tx.description || '—'}
                    </TableCell>
                    <TableCell className="font-semibold">{formatCurrency(tx.amount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{tx.source}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white gap-1"
                          onClick={() => {
                            setSelectedTx(tx);
                            setSelectedInvoiceId('');
                            setMatchDialogOpen(true);
                          }}
                        >
                          <Link className="h-3 w-3" />
                          Match
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-muted-foreground"
                          onClick={() => dismissTransaction.mutate(tx.id)}
                          disabled={dismissTransaction.isPending}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Match dialog */}
      <Dialog open={matchDialogOpen} onOpenChange={setMatchDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Match bank transaction</DialogTitle>
            <DialogDescription>
              Link this bank payment to a pending invoice.
              A receipt will be sent to the tenant immediately.
            </DialogDescription>
          </DialogHeader>
          {selectedTx && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-muted/40 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-semibold">{formatCurrency(selectedTx.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span>{selectedTx.transaction_date ? format(new Date(selectedTx.transaction_date), 'dd/MM/yy') : '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reference</span>
                  <span className="font-mono text-xs">{selectedTx.reference || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payer</span>
                  <span>{selectedTx.payer_name || '—'}</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Apply to invoice</label>
                <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an invoice..." />
                  </SelectTrigger>
                  <SelectContent>
                    {pendingInvoices.map(inv => (
                      <SelectItem key={inv.id} value={inv.id}>
                        <div className="flex items-center justify-between gap-4 w-full">
                          <span>{inv.tenant_name} {inv.unit ? `· Unit ${inv.unit}` : ''}</span>
                          <span className="font-mono text-xs text-muted-foreground">{inv.invoice_number} · {formatCurrency(inv.balance_due)}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedInvoiceId && (() => {
                const inv = pendingInvoices.find(i => i.id === selectedInvoiceId);
                if (!inv) return null;
                const diff = selectedTx.amount - inv.balance_due;
                return (
                  <div className={`p-3 rounded-lg border text-xs ${
                    Math.abs(diff) < 1 ? 'border-green-300 bg-green-50 text-green-800' :
                    diff > 0 ? 'border-[hsl(214_73%_48%/0.3)] bg-[hsl(214_73%_48%/0.08)] text-[hsl(214_73%_35%)]' :
                    'border-amber-300 bg-amber-50 text-amber-800'
                  }`}>
                    {Math.abs(diff) < 1 ? '✓ Exact match — invoice will be closed' :
                     diff > 0 ? `⬆ Overpayment by ${formatCurrency(diff)} — excess held as advance credit` :
                     `⬇ Short by ${formatCurrency(Math.abs(diff))} — invoice will remain partially paid`}
                  </div>
                );
              })()}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMatchDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => matchTransaction.mutate()}
              disabled={matchTransaction.isPending || !selectedInvoiceId}
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
            >
              {matchTransaction.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin" />Matching…</>
                : <><Link className="h-4 w-4" />Confirm match</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UnmatchedBankTransactions;
