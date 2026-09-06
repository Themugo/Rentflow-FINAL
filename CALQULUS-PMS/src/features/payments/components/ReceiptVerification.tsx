import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { useToast } from '@/shared/hooks/use-toast';
import { useAuth } from '@/features/auth/AuthContext';
import {
  FileCheck,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  User,
  Calendar,
  Banknote,
  Search,
  Filter,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';

// Helper to check if a URL is a full URL or a storage path
const isFullUrl = (url: string) => url.startsWith('http://') || url.startsWith('https://');

// Helper to generate signed URL for a receipt (24 hour expiry for manager verification)
const getSignedReceiptUrl = async (receiptPath: string): Promise<string | null> => {
  // If it's already a full URL (legacy public URLs), return as-is
  if (isFullUrl(receiptPath)) {
    return receiptPath;
  }
  
  // Generate a signed URL with 24-hour expiry for manager verification
  const { data, error } = await supabase.storage
    .from('payment-receipts')
    .createSignedUrl(receiptPath, 86400); // 24 hours
  
  if (error) {
    return null;
  }
  
  return data.signedUrl;
};

interface PaymentReceipt {
  id: string;
  tenant_id: string;
  invoice_id: string | null;
  receipt_url: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_number: string | null;
  status: string;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  tenants?: {
    name: string;
    email: string;
    property: string | null;
    unit: string | null;
  };
}

const paymentMethodLabels: Record<string, string> = {
  mpesa_paybill: 'M-Pesa Paybill',
  mpesa_till: 'M-Pesa Till',
  bank_transfer: 'Bank Transfer',
  cash: 'Cash',
  cheque: 'Cheque',
  other: 'Other',
};

export const ReceiptVerification = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentReceipt | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingUrls, setLoadingUrls] = useState<Record<string, boolean>>({});

  const handleViewReceipt = useCallback(async (receiptId: string, receiptUrl: string) => {
    setLoadingUrls(prev => ({ ...prev, [receiptId]: true }));
    
    const url = await getSignedReceiptUrl(receiptUrl);
    
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      toast({
        title: 'Error',
        description: 'Failed to load receipt',
        variant: 'destructive',
      });
    }
    
    setLoadingUrls(prev => ({ ...prev, [receiptId]: false }));
  }, [toast]);

  const fetchReceipts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase
        .from('payment_receipts')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Fetch tenant data separately
      const tenantIds = (data || []).map(r => r.tenant_id);
      const { data: tenants } = await supabase
        .from('tenants')
        .select('id, name, email, property, unit, manager_id')
        .in('id', tenantIds);
      
      const tenantMap = new Map((tenants || []).map(t => [t.id, t]));
      
      // Filter by manager_id and join tenant data
      const filteredReceipts = (data || [])
        .filter(r => tenantMap.get(r.tenant_id)?.manager_id === user.id)
        .map(r => ({
          ...r,
          tenants: tenantMap.get(r.tenant_id)
        }));
      
      setReceipts(filteredReceipts);
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load receipts',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast, user]);

  useEffect(() => {
    fetchReceipts();
  }, [statusFilter, fetchReceipts]);

  const handleVerify = async (receipt: PaymentReceipt) => {
    setProcessing(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const verifierId = userData.user?.id ?? user?.id;
      if (!verifierId) throw new Error("Authenticated user required to verify a receipt.");
      const { error } = await supabase.rpc('verify_payment_receipt_atomic', {
        p_receipt_id: receipt.id,
        p_verified_by: verifierId,
      });
      if (error) throw error;

      // Get manager_id from tenant's property for payment notification
      let managerId: string | null = null;
      if (receipt.tenants) {
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('manager_id, property_id')
          .eq('email', receipt.tenants.email)
          .single();
        
        managerId = tenantData?.manager_id || null;
        
        // If no direct manager_id, try from property
        if (!managerId && tenantData?.property_id) {
          const { data: propData } = await supabase
            .from('properties')
            .select('manager_id')
            .eq('id', tenantData.property_id)
            .single();
          managerId = propData?.manager_id || null;
        }
      }

      // Notify manager about the verified payment (confirmed payment received)
      if (managerId) {
        try {
          await supabase.functions.invoke('notify-manager-payment', {
            body: {
              managerId,
              tenantName: receipt.tenants?.name || 'Tenant',
              tenantEmail: receipt.tenants?.email || '',
              propertyName: receipt.tenants?.property || 'Property',
              unit: receipt.tenants?.unit || undefined,
              invoiceNumber: receipt.invoice_id ? `INV-${receipt.invoice_id.slice(0, 8)}` : 'Manual Payment',
              amount: receipt.amount,
              paymentDate: receipt.payment_date,
              paymentMethod: paymentMethodLabels[receipt.payment_method] || receipt.payment_method,
              notifyEmail: true,
              notifySms: true,
              notifyWhatsapp: true,
            },
          });
        } catch {
        }
      }

      // Send notification to tenant
      try {
        await supabase.functions.invoke('send-receipt-status-notification', {
          body: {
            tenantEmail: receipt.tenants?.email,
            tenantName: receipt.tenants?.name || 'Tenant',
            status: 'verified',
            amount: receipt.amount,
            paymentDate: receipt.payment_date,
            paymentMethod: paymentMethodLabels[receipt.payment_method] || receipt.payment_method,
            referenceNumber: receipt.reference_number,
          },
        });
      } catch {
      }

      toast({
        title: 'Receipt verified!',
        description: 'The payment has been marked as verified.',
      });

      fetchReceipts();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Verification failed';
      toast({
        title: 'Verification failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedReceipt || !rejectionReason.trim()) {
      toast({
        title: 'Reason required',
        description: 'Please provide a reason for rejection',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const verifierId = userData.user?.id ?? user?.id;
      if (!verifierId) throw new Error("Authenticated user required to reject a receipt.");

      const { error } = await supabase.rpc('reject_payment_receipt_atomic', {
        p_receipt_id: selectedReceipt.id, p_rejection_reason: rejectionReason, p_verified_by: verifierId,
      });
      if (error) throw error;

      // Send notification to tenant
      try {
        await supabase.functions.invoke('send-receipt-status-notification', {
          body: {
            tenantEmail: selectedReceipt.tenants?.email,
            tenantName: selectedReceipt.tenants?.name || 'Tenant',
            status: 'rejected',
            amount: selectedReceipt.amount,
            paymentDate: selectedReceipt.payment_date,
            paymentMethod: paymentMethodLabels[selectedReceipt.payment_method] || selectedReceipt.payment_method,
            referenceNumber: selectedReceipt.reference_number,
            rejectionReason: rejectionReason,
          },
        });
      } catch {
      }

      toast({
        title: 'Receipt rejected',
        description: 'The tenant will be notified of the rejection.',
      });

      setRejectDialogOpen(false);
      setSelectedReceipt(null);
      setRejectionReason('');
      fetchReceipts();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Rejection failed';
      toast({
        title: 'Rejection failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const filteredReceipts = receipts.filter((receipt) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      receipt.tenants?.name?.toLowerCase().includes(search) ||
      receipt.tenants?.email?.toLowerCase().includes(search) ||
      receipt.reference_number?.toLowerCase().includes(search) ||
      receipt.amount.toString().includes(search)
    );
  });

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-warning" />
            Receipt Verification
          </CardTitle>
          <CardDescription>
            Review and verify tenant payment receipts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or reference..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Receipts List */}
          {filteredReceipts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No receipts to review</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReceipts.map((receipt) => (
                <div
                  key={receipt.id}
                  className="p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Tenant Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium truncate">
                          {receipt.tenants?.name || 'Unknown Tenant'}
                        </span>
                        <Badge
                          variant={
                            receipt.status === 'verified'
                              ? 'default'
                              : receipt.status === 'rejected'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {receipt.status === 'verified' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {receipt.status === 'rejected' && <XCircle className="h-3 w-3 mr-1" />}
                          {receipt.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                          {receipt.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p className="flex items-center gap-2">
                          <Banknote className="h-4 w-4" />
                          KES {receipt.amount.toLocaleString()} via{' '}
                          {paymentMethodLabels[receipt.payment_method] || receipt.payment_method}
                        </p>
                        <p className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Paid on {format(new Date(receipt.payment_date), 'dd/MM/yy')}
                        </p>
                        {receipt.reference_number && (
                          <p className="font-mono text-xs">
                            Ref: {receipt.reference_number}
                          </p>
                        )}
                        {receipt.tenants?.property && (
                          <p className="text-xs">
                            {receipt.tenants.property}
                            {receipt.tenants.unit && ` - ${receipt.tenants.unit}`}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewReceipt(receipt.id, receipt.receipt_url)}
                        disabled={loadingUrls[receipt.id]}
                      >
                        {loadingUrls[receipt.id] ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <ExternalLink className="h-4 w-4 mr-1" />
                        )}
                        View
                      </Button>
                      {receipt.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleVerify(receipt)}
                            disabled={processing}
                          >
                            {processing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Verify
                              </>
                            )}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setSelectedReceipt(receipt);
                              setRejectDialogOpen(true);
                            }}
                            disabled={processing}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Receipt</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this payment receipt. The tenant will be notified.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter rejection reason..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={processing || !rejectionReason.trim()}
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Reject Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
