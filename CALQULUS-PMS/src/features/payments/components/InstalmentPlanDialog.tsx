// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import { format } from "date-fns";
import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Separator } from '@/shared/components/ui/separator';
import { Calendar, CreditCard, AlertTriangle, CheckCircle } from 'lucide-react';
import { errorToast } from "@/shared/lib/errorToast";

const fmt = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n);

interface Props {
  invoiceId: string;
  invoiceNumber: string;
  totalBalance: number;
  tenantName: string;
  tenantId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

const InstalmentPlanDialog: React.FC<Props> = ({
  invoiceId, invoiceNumber, totalBalance, tenantName, tenantId,
  open, onOpenChange, onSuccess,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [instalments, setInstalments] = useState('2');
  const [firstPaymentDate, setFirstPaymentDate] = useState(
    () => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  );
  const [frequency, setFrequency] = useState('weekly');
  const [depositPct, setDepositPct] = useState('0');
  const [notes, setNotes] = useState('');

  const numInstalments = parseInt(instalments) || 2;
  const deposit        = totalBalance * (parseInt(depositPct) / 100);
  const remaining      = totalBalance - deposit;
  const perInstalment  = numInstalments > 0 ? remaining / numInstalments : 0;

  // Generate preview schedule
  const schedule = (() => {
    const rows = [];
    let date = new Date(firstPaymentDate);
    const freqDays: Record<string, number> = { weekly: 7, biweekly: 14, monthly: 30 };
    const step = freqDays[frequency] ?? 7;
    if (deposit > 0) {
      rows.push({ label: 'Deposit', amount: deposit, date: new Date(firstPaymentDate) });
    }
    for (let i = 1; i <= numInstalments; i++) {
      if (deposit > 0 && i === 1) date = new Date(date.getTime() + step * 86400000);
      else if (i > 1) date = new Date(date.getTime() + step * 86400000);
      rows.push({ label: `Instalment ${i}`, amount: perInstalment, date: new Date(date) });
    }
    return rows;
  })();

  const createPlan = useMutation({
    mutationFn: async () => {
      // Update invoice with instalment_plan field
      const plan = {
        total: totalBalance,
        instalments: numInstalments,
        frequency,
        deposit,
        per_instalment: perInstalment,
        start_date: firstPaymentDate,
        created_by: user!.id,
        created_at: new Date().toISOString(),
        schedule: schedule.map(s => ({
          label: s.label,
          amount: s.amount,
          due_date: s.date.toISOString().slice(0, 10),
          status: 'pending',
        })),
        notes,
      };

      const { error } = await supabase.rpc('set_invoice_installment_plan_atomic', {
        p_invoice_id: invoiceId,
        p_plan: plan,
      });

      if (error) throw error;

      // Send notification to tenant
      await supabase.functions.invoke('send-invoice-notification', {
        body: {
          tenantId,
          invoiceId,
          notificationType: 'instalment_plan_created',
          message: `A payment plan has been set up for invoice ${invoiceNumber}. ${numInstalments} instalments of ${fmt(perInstalment)} each.`,
        },
      }).catch(() => {});
    },
    onSuccess: () => {
      toast({ title: 'Instalment plan created', description: `${numInstalments} instalments of ${fmt(perInstalment)} for ${tenantName}` });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      onOpenChange(false);
      onSuccess();
    },
    onError: (err: Error) => errorToast('Failed', err),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-warning" />
            Create instalment plan
          </DialogTitle>
          <DialogDescription>
            {tenantName} · {invoiceNumber} · Outstanding: {fmt(totalBalance)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Configuration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Number of instalments</Label>
              <Select value={instalments} onValueChange={setInstalments}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2,3,4,5,6,8,10,12].map(n => (
                    <SelectItem key={n} value={String(n)}>{n} instalments</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Bi-weekly (2 weeks)</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>First payment date</Label>
              <Input type="date" value={firstPaymentDate}
                onChange={e => setFirstPaymentDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Upfront deposit (%)</Label>
              <Select value={depositPct} onValueChange={setDepositPct}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No deposit</SelectItem>
                  <SelectItem value="10">10% deposit</SelectItem>
                  <SelectItem value="20">20% deposit</SelectItem>
                  <SelectItem value="30">30% deposit</SelectItem>
                  <SelectItem value="50">50% deposit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Per-instalment amount */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-amber-400/6 border border-amber-400/20">
            <span className="text-sm font-medium">Each instalment</span>
            <span className="text-lg font-bold text-warning">{fmt(perInstalment)}</span>
          </div>

          {/* Notes */}
          <div>
            <Label>Internal note (optional)</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Agreed on 15 April call" className="mt-1" />
          </div>

          <Separator />

          {/* Payment schedule preview */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Payment schedule preview
            </p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {schedule.map((row, i) => (
                <div key={i} className="flex items-center justify-between text-xs p-2 rounded border border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-4">{i + 1}.</span>
                    <span className="font-medium">{row.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">{format(row.date, 'dd/MM/yy')}</span>
                    <span className="font-semibold w-24 text-right">{fmt(row.amount)}</span>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between text-xs p-2 rounded bg-muted font-semibold">
                <span>Total</span>
                <span>{fmt(schedule.reduce((s, r) => s + r.amount, 0))}</span>
              </div>
            </div>
          </div>

          {/* Warning if total doesn't match */}
          {Math.abs(schedule.reduce((s, r) => s + r.amount, 0) - totalBalance) > 1 && (
            <div className="flex items-start gap-2 p-2 rounded bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              Rounding: plan total is {fmt(schedule.reduce((s, r) => s + r.amount, 0))} vs outstanding {fmt(totalBalance)}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => createPlan.mutate()} disabled={createPlan.isPending} className="gap-1.5">
            {createPlan.isPending
              ? 'Saving…'
              : <><CheckCircle className="h-4 w-4" />Create plan</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InstalmentPlanDialog;
