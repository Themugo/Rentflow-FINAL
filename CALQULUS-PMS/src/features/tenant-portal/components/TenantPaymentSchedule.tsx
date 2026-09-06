import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Progress } from '@/shared/components/ui/progress';
import { Calendar, CheckCircle, Clock, AlertTriangle, TrendingDown, CreditCard, ArrowRight } from 'lucide-react';
import { format, isPast, isToday, differenceInDays } from 'date-fns';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n);

interface InvoiceRow {
  id: string;
  invoice_number: string;
  amount: number;
  paid_amount: number | null;
  balance_due: number | null;
  status: string;
  due_date: string | null;
  paid_date: string | null;
  description: string | null;
}

interface ArrearsScheduleRow {
  id: string;
  status: string;
  total_owed: number;
  total_paid: number;
  paid_count: number;
  instalment_count: number;
  next_due_date: string | null;
  instalment_amount: number;
  notes: string | null;
  created_at: string;
  invoices: {
    invoice_number: string;
    due_date: string | null;
    description: string | null;
  } | null;
}

const TenantPaymentSchedule: React.FC = () => {
  const { user, userRole } = useAuth();
  const tenantId = userRole?.tenant_id;

  const { data: schedules = [], isLoading: schedLoading } = useQuery({
    queryKey: ['tenant-instalment-schedules', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('arrears_schedule')
        .select('*, invoices(invoice_number, due_date, description)')
        .eq('tenant_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ArrearsScheduleRow[];
    },
    enabled: !!user?.id,
  });

  const { data: invoices = [], isLoading: invLoading } = useQuery({
    queryKey: ['tenant-all-invoices-schedule', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('invoices')
        .select('id, invoice_number, amount, paid_amount, balance_due, status, due_date, paid_date, description')
        .eq('tenant_id', user!.id)
        .order('due_date', { ascending: true })
        .limit(24);
      return (data || []) as InvoiceRow[];
    },
    enabled: !!user?.id,
  });

  const pendingInvoices = invoices.filter((i) => ['pending', 'overdue'].includes(i.status));
  const totalPending = pendingInvoices.reduce((s, i) => s + Number(i.balance_due ?? i.amount), 0);

  if (schedLoading || invLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-border p-3 bg-muted/20">
          <p className="text-xs text-muted-foreground mb-1">Total outstanding</p>
          <p className={`text-xl font-semibold ${totalPending > 0 ? 'text-warning' : 'text-success'}`}>
            {fmt(totalPending)}
          </p>
        </div>
        <div className="rounded-lg border border-border p-3 bg-muted/20">
          <p className="text-xs text-muted-foreground mb-1">Overdue invoices</p>
          <p
            className={`text-xl font-semibold ${invoices.filter((i) => i.status === 'overdue').length > 0 ? 'text-destructive' : 'text-success'}`}
          >
            {invoices.filter((i) => i.status === 'overdue').length}
          </p>
        </div>
        <div className="rounded-lg border border-border p-3 bg-muted/20 col-span-2 sm:col-span-1">
          <p className="text-xs text-muted-foreground mb-1">Active plans</p>
          <p className="text-xl font-semibold">
            {schedules.filter((s: ArrearsScheduleRow) => s.status === 'active').length}
          </p>
        </div>
      </div>

      {/* Active instalment plans */}
      {schedules
        .filter((s: ArrearsScheduleRow) => s.status === 'active')
        .map((schedule: ArrearsScheduleRow) => {
          const pct = schedule.total_owed > 0 ? Math.min(100, (schedule.total_paid / schedule.total_owed) * 100) : 0;
          const remaining = schedule.total_owed - schedule.total_paid;
          const instalmentsDone = schedule.paid_count;
          const totalInstalments = schedule.instalment_count;
          const nextDue = schedule.next_due_date ? new Date(schedule.next_due_date) : null;
          const nextDueStr = nextDue ? format(nextDue, 'dd/MM/yy') : '—';
          const isOverdue = nextDue && isPast(nextDue) && !isToday(nextDue);
          const daysUntil = nextDue ? differenceInDays(nextDue, new Date()) : null;

          return (
            <Card
              key={schedule.id}
              className={`border-2 ${schedule.status === 'defaulted' ? 'border-destructive/40' : 'border-primary/30'}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-primary" />
                      Instalment plan
                    </CardTitle>
                    {schedule.notes && <CardDescription className="mt-0.5">{schedule.notes}</CardDescription>}
                  </div>
                  <Badge
                    className={`text-xs capitalize ${
                      schedule.status === 'active'
                        ? 'bg-primary/20 text-primary border-primary/30'
                        : schedule.status === 'completed'
                          ? 'bg-success/20 text-success border-success/30'
                          : schedule.status === 'defaulted'
                            ? 'bg-destructive/20 text-destructive border-destructive/30'
                            : ''
                    }`}
                  >
                    {schedule.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span>
                      Progress: {instalmentsDone}/{totalInstalments} instalments
                    </span>
                    <span>{Math.round(pct)}%</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>

                {/* Amounts grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Total owed</p>
                    <p className="font-semibold">{fmt(schedule.total_owed)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Paid so far</p>
                    <p className="font-semibold text-success">{fmt(schedule.total_paid)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Remaining</p>
                    <p className="font-semibold text-warning">{fmt(remaining)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Each instalment</p>
                    <p className="font-semibold">{fmt(schedule.instalment_amount)}</p>
                  </div>
                </div>

                {/* Next due */}
                <div
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    isOverdue
                      ? 'border-destructive/40 bg-destructive/20'
                      : daysUntil !== null && daysUntil <= 3
                        ? 'border-warning/40 bg-warning/20'
                        : 'border-border bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isOverdue ? (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    ) : (
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground">Next payment due</p>
                      <p className={`text-sm font-semibold ${isOverdue ? 'text-destructive' : ''}`}>{nextDueStr}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Amount</p>
                    <p className="font-semibold">{fmt(schedule.instalment_amount)}</p>
                  </div>
                </div>

                {isOverdue && (
                  <div className="text-xs text-destructive font-medium flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Payment is overdue. Please pay immediately to avoid additional charges.
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

      {schedules.filter((s: ArrearsScheduleRow) => s.status === 'active').length === 0 && (
        <div className="py-6 text-center text-muted-foreground">
          <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No active instalment plans</p>
          <p className="text-xs mt-1 opacity-70">Your manager can set up a payment plan if you have arrears</p>
        </div>
      )}

      {/* Invoice timeline */}
      {invoices.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Payment timeline</CardTitle>
            <CardDescription>All invoices — paid and pending</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {invoices.map((inv: InvoiceRow) => {
                const balDue = Number(inv.balance_due ?? inv.amount);
                const isPaid = inv.status === 'paid';
                const isOver = inv.status === 'overdue';
                const isPart = Number(inv.paid_amount ?? 0) > 0 && !isPaid;

                return (
                  <div
                    key={inv.id}
                    className={`flex items-center justify-between p-3 rounded-lg border text-sm ${
                      isOver
                        ? 'border-destructive/30 bg-destructive/30'
                        : isPart
                          ? 'border-warning/30 bg-warning/30'
                          : isPaid
                            ? 'border-success/30 bg-success/20 opacity-75'
                            : 'border-border'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isPaid ? (
                        <CheckCircle className="h-4 w-4 text-success shrink-0" />
                      ) : isOver ? (
                        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                      ) : (
                        <Clock className="h-4 w-4 text-warning shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate">{inv.description || inv.invoice_number}</p>
                        <p className="text-xs text-muted-foreground">
                          Due: {inv.due_date ? format(new Date(inv.due_date), 'dd/MM/yy') : '—'}
                          {inv.paid_date && ` · Paid: ${format(new Date(inv.paid_date), 'dd/MM/yy')}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className={`font-semibold ${isPaid ? 'text-success' : isOver ? 'text-destructive' : ''}`}>
                        {isPaid ? fmt(Number(inv.amount)) : fmt(balDue)}
                      </p>
                      {isPart && <p className="text-xs text-muted-foreground">{fmt(Number(inv.paid_amount))} paid</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completed plans */}
      {schedules.filter((s: ArrearsScheduleRow) => s.status === 'completed').length > 0 && (
        <Card className="opacity-75">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Completed plans</CardTitle>
          </CardHeader>
          <CardContent>
            {schedules
              .filter((s: ArrearsScheduleRow) => s.status === 'completed')
              .map((s: ArrearsScheduleRow) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm"
                >
                  <span className="text-muted-foreground">
                    {fmt(s.total_owed)} — {s.instalment_count} instalments
                  </span>
                  <Badge variant="outline" className="border-success/40 text-success bg-success/20 text-xs">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Completed
                  </Badge>
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TenantPaymentSchedule;
