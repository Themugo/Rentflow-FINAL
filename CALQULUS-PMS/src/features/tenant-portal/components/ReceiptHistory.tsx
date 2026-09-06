import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { FileText, ExternalLink, Clock, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

// Helper to check if a URL is a full URL or a storage path
const isFullUrl = (url: string) => url.startsWith('http://') || url.startsWith('https://');

// Helper to generate signed URL for a receipt
const getSignedReceiptUrl = async (receiptPath: string): Promise<string | null> => {
  // If it's already a full URL (legacy public URLs), return as-is
  if (isFullUrl(receiptPath)) {
    return receiptPath;
  }

  // Generate a signed URL with 1-hour expiry
  const { data, error } = await supabase.storage.from('payment-receipts').createSignedUrl(receiptPath, 3600);

  if (error) {
    return null;
  }

  return data.signedUrl;
};

interface PaymentReceipt {
  id: string;
  receipt_url: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_number: string | null;
  status: string;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  invoice_id: string | null;
}

interface ReceiptHistoryProps {
  tenantId: string;
  refreshTrigger?: number;
}

const statusConfig: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Clock }
> = {
  pending: { label: 'Pending Review', variant: 'secondary', icon: Clock },
  verified: { label: 'Verified', variant: 'default', icon: CheckCircle2 },
  rejected: { label: 'Rejected', variant: 'destructive', icon: XCircle },
};

const paymentMethodLabels: Record<string, string> = {
  mpesa_paybill: 'M-Pesa Paybill',
  mpesa_till: 'M-Pesa Till',
  bank_transfer: 'Bank Transfer',
  cash: 'Cash',
  cheque: 'Cheque',
  other: 'Other',
};

export const ReceiptHistory = ({ tenantId, refreshTrigger }: ReceiptHistoryProps) => {
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingUrls, setLoadingUrls] = useState<Record<string, boolean>>({});
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const fetchReceipts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('payment_receipts')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReceipts(data || []);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchReceipts();
  }, [tenantId, refreshTrigger, fetchReceipts]);

  const handleViewReceipt = useCallback(
    async (receiptId: string, receiptUrl: string) => {
      // Check if we already have a signed URL
      if (signedUrls[receiptId]) {
        window.open(signedUrls[receiptId], '_blank', 'noopener,noreferrer');
        return;
      }

      setLoadingUrls((prev) => ({ ...prev, [receiptId]: true }));

      const url = await getSignedReceiptUrl(receiptUrl);

      if (url) {
        setSignedUrls((prev) => ({ ...prev, [receiptId]: url }));
        window.open(url, '_blank', 'noopener,noreferrer');
      }

      setLoadingUrls((prev) => ({ ...prev, [receiptId]: false }));
    },
    [signedUrls],
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (receipts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-warning" />
            Uploaded Receipts
          </CardTitle>
          <CardDescription>Your payment receipts will appear here</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No receipts uploaded yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-warning" />
          Uploaded Receipts
        </CardTitle>
        <CardDescription>Track the status of your payment submissions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {receipts.map((receipt) => {
          const config = statusConfig[receipt.status] || statusConfig.pending;
          const StatusIcon = config.icon;

          return (
            <div
              key={receipt.id}
              className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-warning transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">KES {receipt.amount.toLocaleString()}</span>
                  <Badge variant={config.variant} className="gap-1">
                    <StatusIcon className="h-3 w-3" />
                    {config.label}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>
                    {paymentMethodLabels[receipt.payment_method] || receipt.payment_method}
                    {receipt.reference_number && <span className="font-mono ml-1">({receipt.reference_number})</span>}
                  </p>
                  <p>Paid on {format(new Date(receipt.payment_date), 'dd/MM/yy')}</p>
                  {receipt.status === 'rejected' && receipt.rejection_reason && (
                    <div className="flex items-start gap-1 text-destructive mt-2">
                      <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <span>{receipt.rejection_reason}</span>
                    </div>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="flex-shrink-0"
                onClick={() => handleViewReceipt(receipt.id, receipt.receipt_url)}
                disabled={loadingUrls[receipt.id]}
              >
                {loadingUrls[receipt.id] ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
