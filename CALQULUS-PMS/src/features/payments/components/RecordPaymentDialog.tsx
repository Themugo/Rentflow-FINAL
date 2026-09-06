// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useRBAC } from '@/shared/hooks/useRBAC';
import { useActivityLog } from '@/shared/hooks/useActivityLog';
import { useToast } from '@/shared/hooks/use-toast';
import { queryKeys } from '@/shared/hooks/useOptimizedQuery';
import { toUserFacingError } from '@/shared/lib/errorLogger';
import { trackTimeToFirst } from '@/features/dashboard/lib/activationMetrics';
import { invalidateManagerActivation } from '@/features/dashboard/hooks/useManagerActivation';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Badge } from '@/shared/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/shared/components/ui/select';
import { Switch } from '@/shared/components/ui/switch';
import {
  Smartphone, Landmark, Receipt,
  CreditCard, CheckCircle, Loader2, Info, Briefcase
} from 'lucide-react';

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  balance_due?: number;
  paid_amount?: number;
  due_date: string;
  status: string;
}

interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  unit: string | null;
  property: string | null;
  property_id: string | null;
  unit_id: string | null;
  manager_id: string | null;
}

interface RecordPaymentDialogProps {
  tenant: Tenant;
  invoice?: Invoice;            // if pre-selected from invoice list
  availableInvoices?: Invoice[]; // all unpaid invoices for this tenant
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const PAYMENT_METHODS = [
  { value: 'mpesa_stk',         label: 'M-Pesa STK push',        icon: Smartphone, desc: 'Sent push to tenant phone' },
  { value: 'mpesa_ussd',        label: 'M-Pesa Paybill / USSD',  icon: Smartphone, desc: 'Tenant paid via paybill' },
  { value: 'mpesa_till',        label: 'M-Pesa Buy Goods (Till)', icon: Smartphone, desc: 'Tenant paid via till' },
  { value: 'bank_transfer',     label: 'Bank transfer',           icon: Landmark,   desc: 'EFT / direct bank deposit' },
  { value: 'bank_direct_debit', label: 'Bank direct debit',       icon: Landmark,   desc: 'Standing order / direct debit' },
  { value: 'receipt_upload',    label: 'Receipt upload confirmed', icon: Receipt,    desc: 'Tenant uploaded proof' },
];

const fmt = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n);

const AUTO_ALLOCATE = 'auto';

const RecordPaymentDialog: React.FC<RecordPaymentDialogProps> = ({
  tenant, invoice, availableInvoices = [], open, onOpenChange, onSuccess,
}) => {
  const { user } = useAuth();
  const { can: _can } = useRBAC();
  const { logActivity } = useActivityLog();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [method, setMethod]           = useState('mpesa_ussd');
  const [amount, setAmount]           = useState(invoice ? String(invoice.balance_due ?? invoice.amount) : '');
  const [reference, setReference]     = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(invoice?.id ?? AUTO_ALLOCATE);
  const [notes, setNotes]             = useState('');
  const [isInstallment, setIsInstallment] = useState(false);
  const [instalmentCount, setInstalmentCount] = useState('3');
  const [selectedPayerId, setSelectedPayerId] = useState('self');

  // Fetch third-party payers for this tenant
  const { data: payers = [] } = useQuery({
    queryKey: ['payment-payers', tenant.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('payment_payers')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true);
      return (data || []) as Array<{ id: string; name: string; relationship: string; phone: string | null; email: string | null }>;
    },
  });

  const activePayer = payers.find((p: { id: string }) => p.id === selectedPayerId);

  const totalUnpaid = availableInvoices.reduce((s, i) => s + Number(i.balance_due ?? i.amount), 0);
  const selectedInv = selectedInvoiceId === AUTO_ALLOCATE
    ? invoice
    : availableInvoices.find(i => i.id === selectedInvoiceId) ?? invoice;
  const enteredAmount = parseFloat(amount) || 0;
  const targetBalance = selectedInv ? Number(selectedInv.balance_due ?? selectedInv.amount) : totalUnpaid;

  const isOverpayment = enteredAmount > targetBalance;
  const isPartial     = enteredAmount > 0 && enteredAmount < targetBalance;
  const isExact       = Math.abs(enteredAmount - targetBalance) < 0.5;

  const selectedMethod = PAYMENT_METHODS.find(m => m.value === method);
  const isMpesa  = method.startsWith('mpesa');
  const isBank   = method.startsWith('bank');

  const recordPayment = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      if (!enteredAmount || enteredAmount <= 0) throw new Error('Enter a valid amount');
      if (!reference.trim()) throw new Error('Enter a payment reference');

      const { data, error } = await supabase.functions.invoke('record-payment', {
        body: {
          tenantId:       tenant.id,
          invoiceId:      selectedInvoiceId === AUTO_ALLOCATE ? undefined : selectedInvoiceId,
          amount:         enteredAmount,
          paymentMethod:  method,
          reference:      reference.trim(),
          paymentDate,
          notes:          notes.trim() || undefined,
          isInstallment:  isInstallment && isPartial,
          instalmentCount: isInstallment && isPartial ? parseInt(instalmentCount) : undefined,
          // Third-party payer info
          payerType:     activePayer ? activePayer.payer_type : 'self',
          payerName:     activePayer ? (activePayer.payer_name || activePayer.payer_organisation) : undefined,
          payerPhone:    activePayer ? activePayer.payer_phone : undefined,
          payerId:       activePayer ? activePayer.id : undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      const msgs: string[] = [];
      if (data.closedInvoices?.length) msgs.push(`Closed invoice${data.closedInvoices.length > 1 ? 's' : ''}: ${data.closedInvoices.join(', ')}`);
      if (data.advanceCredit > 0) msgs.push(`Advance credit: ${fmt(data.advanceCredit)}`);
      if (data.finalBalance > 0) msgs.push(`Balance remaining: ${fmt(data.finalBalance)}`);
      else msgs.push('Account fully paid up');

      toast({ title: 'Payment recorded', description: msgs.join(' · ') });

      // Audit log
      logActivity({
        action: 'record_payment',
        entityType: 'payment',
        entityLabel: `${tenant.name} — ${fmt(enteredAmount)}`,
        metadata: { amount: enteredAmount, method, tenant_id: tenant.id, payer_type: activePayer?.payer_type ?? 'self' },
      });

      queryClient.invalidateQueries({ queryKey: ['tenant-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['manager-payments'] });
      queryClient.invalidateQueries({ queryKey: ['payment-history'] });
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats(user.id) });
      }
      trackTimeToFirst('payment', { managerId: user?.id, signupAt: user?.created_at });
      invalidateManagerActivation(queryClient);
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to record payment', description: toUserFacingError(err, 'Could not record this payment.'), variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-green-600" />
            Record payment
          </DialogTitle>
          <DialogDescription>
            {tenant.name} · {tenant.property} {tenant.unit ? `· Unit ${tenant.unit}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Third-party payer selector (only shown if payers exist) */}
          {payers.length > 0 && (
            <div>
              <Label>Paying party</Label>
              <Select value={selectedPayerId} onValueChange={setSelectedPayerId}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">
                    <div className="flex items-center gap-2">
                      <span>Tenant pays directly — {tenant.name}</span>
                    </div>
                  </SelectItem>
                  {payers.map((p: { id: string; payer_name: string; payer_organisation: string; payer_type: string }) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{p.payer_name || p.payer_organisation} ({p.payer_type.replace('_', ' ')})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activePayer && (
                <p className="text-xs text-muted-foreground mt-1">
                  Receipt will show: <span className="font-medium">{activePayer.payer_name || activePayer.payer_organisation}</span> paying on behalf of {tenant.name}
                </p>
              )}
            </div>
          )}

          {/* Invoice selector */}
          {availableInvoices.length > 1 && (
            <div>
              <Label>Apply to invoice</Label>
              <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Auto-allocate oldest first" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUTO_ALLOCATE}>Auto-allocate (oldest first)</SelectItem>
                  {availableInvoices.map(inv => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.invoice_number} — {fmt(Number(inv.balance_due ?? inv.amount))}
                      {inv.status === 'overdue' && ' ⚠️'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Amount */}
          <div>
            <Label>Amount (KES)</Label>
            <div className="relative mt-1">
              <Input
                type="number"
                min="1"
                step="1"
                placeholder="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="pr-24"
              />
              {enteredAmount > 0 && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {isOverpayment && <Badge className="bg-[hsl(214_73%_48%/0.12)] text-[hsl(214_73%_35%)] border-[hsl(214_73%_48%/0.25)] text-xs">Advance</Badge>}
                  {isPartial && <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">Partial</Badge>}
                  {isExact && <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Exact</Badge>}
                </div>
              )}
            </div>
            <div className="flex justify-between mt-1 text-xs text-muted-foreground">
              <span>Owing: {fmt(targetBalance)}</span>
              {selectedInvoiceId === AUTO_ALLOCATE && availableInvoices.length > 1 && (
                <span>Total unpaid: {fmt(totalUnpaid)}</span>
              )}
            </div>
          </div>

          {/* Payment method */}
          <div>
            <Label>Payment method</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {PAYMENT_METHODS.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors text-xs ${
                    method === m.value
                      ? 'border-amber-400/50 bg-amber-400/8 text-warning'
                      : 'border-border hover:border-amber-400/40 text-muted-foreground'
                  }`}
                >
                  <m.icon className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="font-medium leading-tight">{m.label}</span>
                </button>
              ))}
            </div>
            {selectedMethod && (
              <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                <Info className="h-3 w-3" />{selectedMethod.desc}
              </p>
            )}
          </div>

          {/* Reference */}
          <div>
            <Label>
              {isMpesa ? 'M-Pesa receipt code' : isBank ? 'Bank reference / narration' : 'Reference'}
            </Label>
            <Input
              placeholder={isMpesa ? 'e.g. QK7X2ABC3D' : isBank ? 'e.g. FT240512345' : 'Reference number'}
              value={reference}
              onChange={e => setReference(e.target.value.toUpperCase())}
              className="mt-1 font-mono"
            />
          </div>

          {/* Payment date */}
          <div>
            <Label>Payment date</Label>
            <Input
              type="date"
              value={paymentDate}
              onChange={e => setPaymentDate(e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Installment plan toggle (only for partial payments) */}
          {isPartial && (
            <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-900">Set up installment plan</p>
                  <p className="text-xs text-warning">Tenant pays the remaining {fmt(targetBalance - enteredAmount)} in instalments</p>
                </div>
                <Switch checked={isInstallment} onCheckedChange={setIsInstallment} />
              </div>
              {isInstallment && (
                <div>
                  <Label className="text-amber-900">Number of instalments</Label>
                  <Select value={instalmentCount} onValueChange={setInstalmentCount}>
                    <SelectTrigger className="mt-1 bg-white border-amber-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2,3,4,6].map(n => (
                        <SelectItem key={n} value={String(n)}>
                          {n} instalments of ~{fmt(Math.ceil((targetBalance - enteredAmount) / n))} each
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Advance credit notice */}
          {isOverpayment && (
            <div className="p-3 rounded-lg border border-[hsl(214_73%_48%/0.25)] bg-[hsl(214_73%_48%/0.06)]">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-[hsl(214_73%_45%)] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-[hsl(214_73%_30%)]">Advance payment detected</p>
                  <p className="text-xs text-[hsl(214_73%_40%)] mt-0.5">
                    {fmt(enteredAmount - targetBalance)} will be held as credit and automatically applied to the next invoice.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Any additional context for this payment..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="mt-1 resize-none"
              rows={2}
            />
          </div>

          {/* Receipt info */}
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 text-xs text-muted-foreground">
            <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
            <span>Receipt will be emailed and SMS'd to {tenant.name} immediately after recording.</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={recordPayment.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => recordPayment.mutate()}
            disabled={recordPayment.isPending || !reference.trim() || enteredAmount <= 0}
            className="bg-green-600 hover:bg-green-700 text-white gap-2"
          >
            {recordPayment.isPending
              ? <><Loader2 className="h-4 w-4 animate-spin" />Recording…</>
              : <><CreditCard className="h-4 w-4" />Record {fmt(enteredAmount || 0)}</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RecordPaymentDialog;
