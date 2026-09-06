import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Wallet, TrendingDown, TrendingUp, CheckCircle, AlertTriangle, Clock, Gift } from 'lucide-react';
import { format } from 'date-fns';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n);

interface TenantBalanceSummaryProps {
  tenantId: string; // the tenant row id (from tenants table)
  userId: string; // auth user id
}

interface BalanceResult {
  total_credited: number;
  outstanding: number;
  total_paid: number;
}

interface CreditEntry {
  id: string;
  created_at: string;
  entry_type: string;
  description: string | null;
  amount: number;
  balance_after: number;
}

interface ArrearsSchedule {
  total_owed: number;
  total_paid: number;
  paid_count: number;
  instalment_count: number;
  next_due_date: string | null;
  notes: string | null;
}

const TenantBalanceSummary: React.FC<TenantBalanceSummaryProps> = ({ tenantId, userId }) => {
  // Running balance from SQL function
  const { data: balance, isLoading: balLoading } = useQuery({
    queryKey: ['tenant-balance', userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_tenant_financial_position', { p_tenant_id: tenantId });
      if (error) throw error;
      return (data?.[0] as BalanceResult) ?? null;
    },
    enabled: !!userId,
  });

  // Credit ledger entries
  const { data: credits = [], isLoading: creditsLoading } = useQuery({
    queryKey: ['tenant-credit-ledger', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_credit_ledger')
        .select('*')
        .eq('tenant_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []) as CreditEntry[];
    },
    enabled: !!userId,
  });

  // Arrears / instalment schedule
  const { data: schedule } = useQuery({
    queryKey: ['tenant-arrears-schedule', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('arrears_schedule')
        .select('*')
        .eq('tenant_id', userId)
        .eq('status', 'active')
        .maybeSingle();
      if (error) throw error;
      return data as ArrearsSchedule;
    },
    enabled: !!userId,
  });

  const creditBalance = Number(balance?.total_credited ?? 0);
  const balanceDue = Number(balance?.outstanding ?? 0);
  const isFullyPaid = balanceDue === 0 && creditBalance >= 0;

  return (
    <div className="space-y-4">
      {/* Balance summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">Balance due</p>
              <AlertTriangle className={`h-4 w-4 ${balanceDue > 0 ? 'text-warning' : 'text-success'}`} />
            </div>
            {balLoading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <p className={`text-xl font-semibold ${balanceDue > 0 ? 'text-warning' : 'text-success'}`}>
                {fmt(balanceDue)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {isFullyPaid ? 'Account fully paid up' : 'Remaining to pay'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">Credit balance</p>
              <Gift className="h-4 w-4 text-primary" />
            </div>
            {balLoading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <p className={`text-xl font-semibold ${creditBalance > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                {fmt(creditBalance)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {creditBalance > 0 ? 'Applied to next invoice' : 'No advance credit'}
            </p>
          </CardContent>
        </Card>

        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">Total paid</p>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            {balLoading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <p className="text-xl font-semibold">{fmt(Number(balance?.total_paid ?? 0))}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">All time payments</p>
          </CardContent>
        </Card>
      </div>

      {/* Instalment plan (if active) */}
      {schedule && (
        <Card className="border-primary/30 bg-primary/10">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm flex items-center gap-2 text-primary">
              <Clock className="h-4 w-4" />
              Instalment plan active
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-primary">Total owed</p>
                <p className="font-semibold text-primary">{fmt(schedule.total_owed)}</p>
              </div>
              <div>
                <p className="text-xs text-primary">Total paid</p>
                <p className="font-semibold text-primary">{fmt(schedule.total_paid)}</p>
              </div>
              <div>
                <p className="text-xs text-primary">Instalments</p>
                <p className="font-semibold text-primary">
                  {schedule.paid_count}/{schedule.instalment_count}
                </p>
              </div>
              <div>
                <p className="text-xs text-primary">Next due</p>
                <p className="font-semibold text-primary">
                  {schedule.next_due_date ? format(new Date(schedule.next_due_date), 'dd MMM') : '—'}
                </p>
              </div>
            </div>
            {schedule.notes && <p className="text-xs text-primary mt-2">{schedule.notes}</p>}
          </CardContent>
        </Card>
      )}

      {/* Credit ledger */}
      {credits.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm">Credit history</CardTitle>
            <CardDescription>Advance payments and credit applied to invoices</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {credits.map((entry: CreditEntry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {entry.created_at ? format(new Date(entry.created_at), 'dd/MM/yy') : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          entry.entry_type === 'credit'
                            ? 'border-success/40 text-success bg-success/20'
                            : entry.entry_type === 'refund'
                              ? 'border-primary/30 text-primary bg-primary/10'
                              : 'border-warning/40 text-warning bg-warning/20'
                        }
                      >
                        {entry.entry_type === 'credit' ? (
                          <>
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Credit
                          </>
                        ) : entry.entry_type === 'refund' ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Refund
                          </>
                        ) : (
                          <>
                            <TrendingDown className="h-3 w-3 mr-1" />
                            Applied
                          </>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                      {entry.description || '—'}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium text-sm ${
                        entry.entry_type === 'credit' ? 'text-success' : 'text-warning'
                      }`}
                    >
                      {entry.entry_type === 'debit' ? '-' : '+'}
                      {fmt(entry.amount)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold">{fmt(entry.balance_after)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TenantBalanceSummary;
