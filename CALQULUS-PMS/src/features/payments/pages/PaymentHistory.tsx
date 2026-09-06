import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { formatDate } from '@/shared/lib/dateFormat';
import { CreditCard, Receipt, ExternalLink, AlertCircle, RefreshCw } from 'lucide-react';
import { useOfflineData } from '@/shared/hooks/useOfflineData';
import { OfflineBanner, OfflineIndicator } from '@/shared/components/ui/offline-indicator';
import { invoiceStatusLabel, invoiceStatusTone, statusBadgeClass } from '@/shared/lib/statusBadge';
import TenantLayout from '@/features/tenant-portal/components/TenantLayout';
import TenantBillsHub from '@/features/tenant-portal/components/TenantBillsHub';
import TenantPayNowDialog, { type PayableInvoice } from '@/features/tenant-portal/components/TenantPayNowDialog';
import TenantPaymentShareButton from '@/features/tenant-portal/components/TenantPaymentShareButton';

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: string;
  invoiceNumber: string | null;
  invoiceId: string | null;
  paymentMethod: string;
  receiptUrl: string | null;
  mpesaReceipt?: string | null;
  source?: 'stripe' | 'database';
}

const PaymentHistory = () => {
  const { user, userRole } = useAuth();
  const [stkInvoices, setStkInvoices] = useState<PayableInvoice[]>([]);
  const [stkOpen, setStkOpen] = useState(false);
  const [tenantPhone, setTenantPhone] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    void supabase
      .from('profiles')
      .select('phone')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => setTenantPhone(data?.phone ?? null));
  }, [user?.id]);

  const fetchPayments = useCallback(async (): Promise<Payment[]> => {
    const { data, error } = await supabase.functions.invoke('get-payment-history');
    if (error) throw error;
    return data?.payments || [];
  }, []);

  const {
    data: payments,
    loading,
    isOffline,
    isFromCache,
    error,
    refetch,
  } = useOfflineData(`payment_history_${user?.id || 'anon'}`, fetchPayments, { enabled: !!user?.id });

  const safePayments = payments || [];

  const formatCurrency = (amount: number, _currency: string = 'KES') => {
    // Always use KES for display, converting the currency code to KES format
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <TenantLayout title="Payments" description="What you owe, then what you already paid.">
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      </TenantLayout>
    );
  }

  return (
    <TenantLayout title="Payments" description="Pay what is due. History is the list below.">
      {(isOffline || isFromCache) && (
        <OfflineIndicator isOffline={isOffline} isFromCache={isFromCache} className="mb-4" />
      )}

        {/* Error state */}
        {error && !loading && (
          <Card className="mb-6 border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-destructive">Failed to load payment history</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {error.message || 'An unexpected error occurred. Please try again.'}
                  </p>
                  <Button variant="outline" size="sm" onClick={refetch} className="mt-3 gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Retry
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {userRole?.tenant_id ? (
          <div className="mb-6 space-y-3">
            <div className="flex justify-end"><TenantPaymentShareButton /></div>
            <TenantBillsHub
              tenantId={userRole.tenant_id}
              onPay={(invoices) => {
                setStkInvoices(invoices);
                setStkOpen(true);
              }}
            />
          </div>
        ) : null}

        <Card>
          <CardHeader className="pb-3 md:pb-6">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Receipt className="h-4 w-4 md:h-5 md:w-5" />
              Payment History
            </CardTitle>
            <CardDescription className="text-xs md:text-sm">All your completed payments</CardDescription>
          </CardHeader>
          <CardContent>
            {safePayments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No payments found</p>
                <p className="text-sm">Your payment history will appear here once you make a payment.</p>
              </div>
            ) : (
              <>
                {/* Mobile View - Cards */}
                <div className="md:hidden space-y-3">
                  {safePayments.map((payment) => (
                    <div key={payment.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{payment.invoiceNumber || 'Payment'}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(payment.created)}
                          </p>
                          {payment.mpesaReceipt && (
                            <p className="text-xs text-muted-foreground">
                              Receipt: {payment.mpesaReceipt}
                            </p>
                          )}
                        </div>
                        <p className="font-bold text-lg">{formatCurrency(payment.amount, payment.currency)}</p>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CreditCard className="h-3 w-3" />
                          <span className="capitalize">{payment.paymentMethod}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={statusBadgeClass(invoiceStatusTone(payment.status))}>
                            {invoiceStatusLabel(payment.status)}
                          </span>
                          {payment.receiptUrl && (
                            <Button variant="ghost" size="sm" asChild className="h-7 px-2">
                              <a href={payment.receiptUrl} target="_blank" rel="noopener noreferrer">
                                <Receipt className="h-3 w-3" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop View - Table */}
                <Table className="hidden md:table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Receipt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {safePayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          {formatDate(payment.created)}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div>
                            {payment.invoiceNumber || '-'}
                            {payment.mpesaReceipt && (
                              <p className="text-xs text-muted-foreground font-normal">
                                M-Pesa: {payment.mpesaReceipt}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                            {payment.paymentMethod}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(payment.amount, payment.currency)}
                        </TableCell>
                        <TableCell>
                          <span className={statusBadgeClass(invoiceStatusTone(payment.status))}>
                            {invoiceStatusLabel(payment.status)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {payment.receiptUrl ? (
                            <Button variant="ghost" size="sm" asChild>
                              <a
                                href={payment.receiptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="gap-1"
                              >
                                <Receipt className="h-4 w-4" />
                                View
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>

      {stkInvoices.length > 0 && (
        <TenantPayNowDialog
          invoices={stkInvoices}
          tenantPhone={tenantPhone}
          open={stkOpen}
          onOpenChange={(open) => {
            setStkOpen(open);
            if (!open) setStkInvoices([]);
          }}
          onPaymentSuccess={() => {
            setStkOpen(false);
            setStkInvoices([]);
            void refetch();
          }}
        />
      )}
      <OfflineBanner isOffline={isOffline} />
    </TenantLayout>
  );
};

export default PaymentHistory;
