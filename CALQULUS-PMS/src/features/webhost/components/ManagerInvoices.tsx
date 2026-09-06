// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
/* eslint-disable react-refresh/only-export-components */
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/shared/components/ui/dialog';
import { Badge } from '@/shared/components/ui/badge';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { useToast } from '@/shared/hooks/use-toast';
import { FileText, Plus, CheckCircle, Clock, XCircle, CreditCard, Smartphone, RefreshCw, Users, Percent, Send, AlertCircle, AlertTriangle, MessageSquare, MoreHorizontal, Building, Info } from 'lucide-react';
import { format } from 'date-fns';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import ManualInvoiceForm from './ManualInvoiceForm';
import { errorToast } from "@/shared/lib/errorToast";

// Billing Configuration - will be overridden by database settings
export const BILLING_CONFIG = {
  registration: {
    name: "Registration Fee",
    description: "One-time registration fee for new managers",
    amount: 3000,
  },
  subscription: {
    name: "Monthly Subscription",
    description: "1% of manager's net collection",
    rate: 0.01,
  },
};

// Payment Settings interface
interface PaymentSettings {
  id: string;
  registration_fee: number;
  subscription_rate: number;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_branch: string | null;
  mpesa_paybill_number: string | null;
  mpesa_paybill_account: string | null;
  mpesa_till_number: string | null;
  mpesa_phone_number: string | null;
  payment_instructions: string | null;
}

interface Manager {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  property_count: number;
  has_registration_invoice: boolean;
  net_collection: number;
  phone?: string;
}

export interface ManagerInvoice {
  id: string;
  manager_user_id: string;
  invoice_number: string;
  amount: number;
  description: string | null;
  status: string;
  due_date: string;
  paid_date: string | null;
  created_at: string;
  property_count: number;
  rate_per_property: number;
  invoice_type: string;
  net_collection: number;
  commission_rate: number;
}

interface ManagerInvoicesProps {
  managers: Manager[] | undefined;
  invoices: ManagerInvoice[] | undefined;
  isLoading: boolean;
  onRefresh: () => void;
}

const ManagerInvoices: React.FC<ManagerInvoicesProps> = ({ managers, invoices, isLoading, onRefresh }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<ManagerInvoice | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isGeneratingInvoices, setIsGeneratingInvoices] = useState(false);
  const [isEscalating, setIsEscalating] = useState(false);
  const [paymentInfoDialogOpen, setPaymentInfoDialogOpen] = useState(false);
  
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSmsDialogOpen, setBulkSmsDialogOpen] = useState(false);
  const [bulkSmsMessage, setBulkSmsMessage] = useState('');
  const [isSendingBulkSms, setIsSendingBulkSms] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Fetch payment settings from database
  const { data: paymentSettings } = useQuery({
    queryKey: ['webhost-payment-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webhost_payment_settings')
        .select('*')
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as PaymentSettings | null;
    },
  });

  // Get dynamic billing config
  const getBillingConfig = () => ({
    registration: {
      ...BILLING_CONFIG.registration,
      amount: paymentSettings?.registration_fee || BILLING_CONFIG.registration.amount,
    },
    subscription: {
      ...BILLING_CONFIG.subscription,
      rate: paymentSettings?.subscription_rate || BILLING_CONFIG.subscription.rate,
    },
  });

  const billingConfig = getBillingConfig();

  // Filter to only show unpaid invoices
  const pendingInvoices = invoices?.filter(inv => inv.status === 'pending' || inv.status === 'overdue') || [];

  // Toggle single selection
  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  // Toggle all selection
  const toggleAllSelection = () => {
    if (selectedIds.size === pendingInvoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingInvoices.map(inv => inv.id)));
    }
  };

  // Get selected invoices
  const getSelectedInvoices = () => pendingInvoices.filter(inv => selectedIds.has(inv.id));

  // Send email notification helper
  const sendInvoiceNotification = async (invoiceId: string, notificationType: 'new_invoice' | 'payment_reminder' | 'payment_confirmed') => {
    try {
      await supabase.functions.invoke('send-manager-invoice-notification', {
        body: { invoiceId, notificationType }
      });
    } catch (error) {
    }
  };

  // Create invoice mutation
  const createInvoice = useMutation({
    mutationFn: async (data: { 
      manager_user_id: string; 
      amount: number; 
      description: string; 
      due_date: string; 
      invoice_type: string;
      net_collection: number;
      commission_rate: number;
    }) => {
      const { data: result, error } = await supabase.rpc('create_manager_invoice_atomic', {
        p_manager_user_id: data.manager_user_id,
        p_amount: data.amount,
        p_due_date: data.due_date,
        p_description: data.description,
        p_invoice_type: data.invoice_type,
        p_invoice_number: null,
        p_property_count: 0,
        p_rate_per_property: 0,
        p_net_collection: data.net_collection,
        p_commission_rate: data.commission_rate,
      });

      if (error) throw error;
      if (!result?.success || !result?.id) throw new Error('Invoice creation did not complete');
      return { id: result.id };
    },
    onSuccess: async (data) => {
      toast({ title: 'Invoice created successfully' });
      
      if (data?.id) {
        await sendInvoiceNotification(data.id, 'new_invoice');
        toast({ title: 'Email notification sent to manager' });
      }
      
      queryClient.invalidateQueries({ queryKey: ['manager-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['webhost-managers-for-billing'] });
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      errorToast('Failed to create invoice', error);
    },
  });

  // Bulk mark as paid mutation
  const bulkMarkAsPaid = async () => {
    if (selectedIds.size === 0) return;
    
    setBulkActionLoading(true);
    try {
      for (const id of selectedIds) {
        const invoice = pendingInvoices.find((item) => item.id === id);
        if (!invoice) continue;
        const { data: result, error } = await supabase.rpc('record_platform_invoice_payment_atomic', {
          p_manager_invoice_id: id,
          p_manager_user_id: invoice.manager_user_id,
          p_amount: Number(invoice.amount),
          p_reference: `WEBHOST-${id}`,
          p_payment_method: 'manual',
        });
        if (error) throw error;
        if (!result?.success) throw new Error(`Payment settlement failed for ${invoice.invoice_number}`);
        await sendInvoiceNotification(id, 'payment_confirmed');
      }

      toast({ title: `${selectedIds.size} invoices marked as paid`, description: 'Suspended accounts reinstated where applicable.' });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['manager-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['webhost-managers-rich'] });
    } catch (error) {
      toast({
        title: 'Failed to update invoices',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Bulk cancel mutation
  const bulkCancel = async () => {
    if (selectedIds.size === 0) return;
    
    setBulkActionLoading(true);
    try {
      for (const id of selectedIds) {
        const { data: result, error } = await supabase.rpc('cancel_manager_invoice_atomic', {
          p_manager_invoice_id: id,
        });
        if (error) throw error;
        if (!result?.success) throw new Error('Invoice cancellation did not complete');
      }

      toast({ title: `${selectedIds.size} invoices cancelled` });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['manager-invoices'] });
    } catch (error) {
      toast({
        title: 'Failed to cancel invoices',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Bulk send reminders
  const bulkSendReminders = async () => {
    if (selectedIds.size === 0) return;
    
    setBulkActionLoading(true);
    try {
      let sent = 0;
      for (const id of selectedIds) {
        await sendInvoiceNotification(id, 'payment_reminder');
        sent++;
      }

      toast({ title: `Sent ${sent} reminder emails` });
      setSelectedIds(new Set());
    } catch (error) {
      toast({
        title: 'Failed to send reminders',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Bulk SMS function
  const sendBulkSms = async () => {
    if (selectedIds.size === 0 || !bulkSmsMessage.trim()) return;
    
    setIsSendingBulkSms(true);
    try {
      const selectedInvoices = getSelectedInvoices();
      
      // Get manager phone numbers from profiles
      const managerUserIds = [...new Set(selectedInvoices.map(inv => inv.manager_user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, phone, full_name')
        .in('id', managerUserIds);

      if (!profiles || profiles.length === 0) {
        throw new Error('No manager profiles found');
      }

      // Filter managers with phone numbers
      const recipients = profiles
        .filter(p => p.phone)
        .map(p => ({
          phoneNumber: p.phone!,
          name: p.full_name || 'Manager',
        }));

      if (recipients.length === 0) {
        toast({
          title: 'No phone numbers',
          description: 'Selected managers do not have phone numbers configured',
          variant: 'destructive',
        });
        return;
      }

      // Create custom messages per recipient with invoice details
      const customMessages: { [phone: string]: string } = {};
      for (const profile of profiles.filter(p => p.phone)) {
        const managerInvoices = selectedInvoices.filter(inv => inv.manager_user_id === profile.id);
        const totalAmount = managerInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
        const invoiceNumbers = managerInvoices.map(inv => inv.invoice_number).join(', ');
        
        const message = bulkSmsMessage
          .replace('{name}', profile.full_name || 'Manager')
          .replace('{amount}', `KES ${totalAmount.toLocaleString()}`)
          .replace('{invoices}', invoiceNumbers)
          .replace('{count}', String(managerInvoices.length));
        
        customMessages[profile.phone!] = message;
      }

      const { data, error } = await supabase.functions.invoke('send-bulk-sms', {
        body: {
          recipients,
          message: bulkSmsMessage,
          customMessages,
        },
      });

      if (error) throw error;

      toast({
        title: 'Bulk SMS sent',
        description: `Sent ${data.summary.success} of ${data.summary.total} messages`,
      });

      setBulkSmsDialogOpen(false);
      setBulkSmsMessage('');
      setSelectedIds(new Set());
    } catch (error) {
      toast({
        title: 'Failed to send SMS',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSendingBulkSms(false);
    }
  };

  // Mark as paid mutation
  const markAsPaid = useMutation({
    mutationFn: async (invoiceId: string) => {
      const invoice = invoices?.find((item) => item.id === invoiceId);
      if (!invoice) throw new Error('Invoice not found');
      const { data: result, error } = await supabase.rpc('record_platform_invoice_payment_atomic', {
        p_manager_invoice_id: invoice.id,
        p_manager_user_id: invoice.manager_user_id,
        p_amount: Number(invoice.amount),
        p_reference: `WEBHOST-${invoice.id}`,
        p_payment_method: 'manual',
      });
      if (error) throw error;
      if (!result?.success) throw new Error('Invoice settlement did not complete');
      return invoiceId;
    },
    onSuccess: async (invoiceId) => {
      toast({ title: 'Invoice marked as paid', description: 'Manager account reinstated if it was suspended for non-payment.' });
      await sendInvoiceNotification(invoiceId, 'payment_confirmed');
      queryClient.invalidateQueries({ queryKey: ['manager-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['webhost-managers-rich'] });
    },
    onError: (error: Error) => {
      errorToast('Failed to update invoice', error);
    },
  });

  // Cancel invoice mutation
  const cancelInvoice = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data: result, error } = await supabase.rpc('cancel_manager_invoice_atomic', {
        p_manager_invoice_id: invoiceId,
      });
      if (error) throw error;
      if (!result?.success) throw new Error('Invoice cancellation did not complete');
    },
    onSuccess: () => {
      toast({ title: 'Invoice cancelled' });
      queryClient.invalidateQueries({ queryKey: ['manager-invoices'] });
    },
    onError: (error: Error) => {
      errorToast('Failed to cancel invoice', error);
    },
  });

  // Send reminder mutation
  const sendReminder = useMutation({
    mutationFn: async (invoiceId: string) => {
      await sendInvoiceNotification(invoiceId, 'payment_reminder');
      return invoiceId;
    },
    onSuccess: () => {
      toast({ title: 'Reminder sent successfully' });
    },
    onError: (error: Error) => {
      errorToast('Failed to send reminder', error);
    },
  });

  const handleGenerateInvoices = async () => {
    setIsGeneratingInvoices(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-manager-invoices');
      
      if (error) throw error;
      
      toast({
        title: 'Invoice generation complete',
        description: `Generated ${data.generated} invoices, skipped ${data.skipped}`,
      });
      
      queryClient.invalidateQueries({ queryKey: ['manager-invoices'] });
    } catch (error) {
      toast({
        title: 'Failed to generate invoices',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingInvoices(false);
    }
  };

  const handleRunEscalation = async () => {
    setIsEscalating(true);
    try {
      // Call the Postgres function directly via RPC
      const { data, error } = await supabase.rpc('escalate_overdue_manager_invoices');
      if (error) throw error;
      toast({
        title: 'Escalation run',
        description: `${data ?? 0} overdue invoice(s) processed. Managers at 30+ days have been suspended.`,
      });
      queryClient.invalidateQueries({ queryKey: ['manager-invoices', 'webhost-managers-rich'] });
    } catch (error) {
      toast({
        title: 'Escalation failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsEscalating(false);
    }
  };

  const handleFormSubmit = (data: {
    manager_user_id: string;
    amount: number;
    description: string;
    due_date: string;
    invoice_type: string;
    net_collection: number;
    commission_rate: number;
  }) => {
    createInvoice.mutate(data);
  };

  // Render payment details for invoice view
  const renderPaymentDetails = () => {
    if (!paymentSettings) return null;
    
    const hasBank = paymentSettings.bank_name && paymentSettings.bank_account_number;
    const hasMpesa = paymentSettings.mpesa_paybill_number || paymentSettings.mpesa_till_number || paymentSettings.mpesa_phone_number;
    
    if (!hasBank && !hasMpesa) return null;
    
    return (
      <Dialog open={paymentInfoDialogOpen} onOpenChange={setPaymentInfoDialogOpen}>
        <DialogContent className="bg-card border-warning/15 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-warning" />
              Payment Details
            </DialogTitle>
            <DialogDescription className="text-warning/70">
              Use these details to make payment for your invoice
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {paymentSettings.payment_instructions && (
              <Alert className="bg-[hsl(214_73%_25%/0.3)] border-[hsl(214_73%_40%)]">
                <Info className="h-4 w-4 text-[hsl(214_73%_58%)]" />
                <AlertDescription className="text-[hsl(214_73%_65%)]">
                  {paymentSettings.payment_instructions}
                </AlertDescription>
              </Alert>
            )}
            
            {hasBank && (
              <div className="p-4 bg-secondary-background rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Building className="h-5 w-5 text-[hsl(214_73%_58%)]" />
                  <h4 className="text-foreground font-semibold">Bank Transfer</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-warning/70">Bank:</span>
                    <span className="text-foreground font-medium">{paymentSettings.bank_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-warning/70">Account Name:</span>
                    <span className="text-foreground font-medium">{paymentSettings.bank_account_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-warning/70">Account Number:</span>
                    <span className="text-foreground font-medium font-mono">{paymentSettings.bank_account_number}</span>
                  </div>
                  {paymentSettings.bank_branch && (
                    <div className="flex justify-between">
                      <span className="text-warning/70">Branch:</span>
                      <span className="text-foreground font-medium">{paymentSettings.bank_branch}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {hasMpesa && (
              <div className="p-4 bg-secondary-background rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Smartphone className="h-5 w-5 text-green-400" />
                  <h4 className="text-foreground font-semibold">M-Pesa Payment</h4>
                </div>
                <div className="space-y-2 text-sm">
                  {paymentSettings.mpesa_paybill_number && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-warning/70">Paybill Number:</span>
                        <span className="text-foreground font-medium font-mono">{paymentSettings.mpesa_paybill_number}</span>
                      </div>
                      {paymentSettings.mpesa_paybill_account && (
                        <div className="flex justify-between">
                          <span className="text-warning/70">Account Number:</span>
                          <span className="text-foreground font-medium">{paymentSettings.mpesa_paybill_account}</span>
                        </div>
                      )}
                    </>
                  )}
                  {paymentSettings.mpesa_till_number && (
                    <div className="flex justify-between">
                      <span className="text-warning/70">Till Number (Buy Goods):</span>
                      <span className="text-foreground font-medium font-mono">{paymentSettings.mpesa_till_number}</span>
                    </div>
                  )}
                  {paymentSettings.mpesa_phone_number && (
                    <div className="flex justify-between">
                      <span className="text-warning/70">Phone (Send Money):</span>
                      <span className="text-foreground font-medium font-mono">{paymentSettings.mpesa_phone_number}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {selectedInvoice && (
              <div className="p-3 bg-warning/6 rounded-lg border border-warning/15">
                <div className="flex justify-between items-center">
                  <span className="text-warning/70">Invoice Reference:</span>
                  <span className="text-foreground font-mono font-bold">{selectedInvoice.invoice_number}</span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-warning/70">Amount Due:</span>
                  <span className="text-foreground font-bold text-lg">KES {Number(selectedInvoice.amount).toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentInfoDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const handlePayWithStripe = async (invoice: ManagerInvoice) => {
    setIsProcessingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-manager-invoice-checkout', {
        body: {
          invoiceId: invoice.id,
          amount: invoice.amount,
          description: invoice.description || 'Manager Platform Fee',
        },
      });

      if (error) throw error;
      if (data?.url) window.open(data.url, '_blank');
    } catch (error) {
      toast({
        title: 'Payment failed',
        description: error instanceof Error ? error.message : 'Failed to initiate payment',
        variant: 'destructive',
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handlePayWithMpesa = async () => {
    if (!selectedInvoice || !phoneNumber) {
      toast({ title: 'Validation Error', description: 'Please enter your M-Pesa phone number', variant: 'destructive' });
      return;
    }

    setIsProcessingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke('initiate-manager-paystack-payment', {
        body: {
          invoiceId: selectedInvoice.id,
          amount: selectedInvoice.amount,
          phoneNumber,
          description: selectedInvoice.description || 'Manager Platform Fee',
        },
      });

      if (error) throw error;
      
      toast({
        title: 'Paystack M-Pesa charge initiated',
        description: data.display_text || 'Check your phone for the STK push prompt',
      });
      
      setPaymentDialogOpen(false);
      setPhoneNumber('');
      setSelectedInvoice(null);
    } catch (error) {
      toast({
        title: 'Payment failed',
        description: error instanceof Error ? error.message : 'Failed to initiate M-Pesa payment',
        variant: 'destructive',
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const getManagerName = (userId: string) => {
    const manager = managers?.find(m => m.user_id === userId);
    return manager?.full_name || manager?.email || 'Unknown';
  };

  

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge className="bg-warning/20 text-warning border-warning/30">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'overdue':
        return (
          <Badge className="bg-destructive/20 text-destructive border-destructive/30">
            <AlertCircle className="h-3 w-3 mr-1" />
            Overdue
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getInvoiceTypeBadge = (type: string) => {
    if (type === 'registration') {
      return (
        <Badge className="bg-[hsl(214_73%_45%/0.2)] text-[hsl(214_73%_58%)] border-[hsl(214_73%_45%/0.3)]">
          <Users className="h-3 w-3 mr-1" />
          Registration
        </Badge>
      );
    }
    return (
      <Badge className="bg-warning/12 text-warning border-warning/20">
        <Percent className="h-3 w-3 mr-1" />
        Subscription
      </Badge>
    );
  };

  const selectedCount = selectedIds.size;
  const totalSelectedAmount = getSelectedInvoices().reduce((sum, inv) => sum + Number(inv.amount), 0);

  return (
    <div className="space-y-6">
      {/* Bulk Actions Bar */}
      {selectedCount > 0 && (
        <Card className="bg-card border-border/60">
          <CardContent className="py-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Badge className="bg-[hsl(218_58%_40%)] text-white">
                  {selectedCount} selected
                </Badge>
                <span className="text-warning/80 text-sm">
                  Total: KES {totalSelectedAmount.toLocaleString()}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-[hsl(218_58%_40%)] text-warning/70 hover:bg-[hsl(218_58%_40%/0.2)]"
                  onClick={bulkSendReminders}
                  disabled={bulkActionLoading}
                >
                  <Send className="h-4 w-4 mr-1" />
                  Send Reminders
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-green-600 text-green-300 hover:bg-green-600/20"
                  onClick={() => {
                    setBulkSmsMessage('Dear {name}, you have {count} pending invoice(s) totaling {amount}. Invoice(s): {invoices}. Please pay to avoid service interruption. - CALQULUS PMS');
                    setBulkSmsDialogOpen(true);
                  }}
                  disabled={bulkActionLoading}
                >
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Send SMS
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-success text-success hover:bg-success/20"
                  onClick={bulkMarkAsPaid}
                  disabled={bulkActionLoading}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Mark as Paid
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-600 text-destructive hover:bg-destructive/20"
                  onClick={bulkCancel}
                  disabled={bulkActionLoading}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-warning"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-warning/15">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-warning" />
              Pending Invoices
            </CardTitle>
            <CardDescription className="text-warning/70">
              Outstanding invoices awaiting payment
            </CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline" 
              className="border-[hsl(218_58%_40%)] text-warning hover:bg-[hsl(218_58%_40%/0.2)]"
              onClick={handleGenerateInvoices}
              disabled={isGeneratingInvoices}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isGeneratingInvoices ? 'animate-spin' : ''}`} />
              {isGeneratingInvoices ? 'Generating...' : 'Generate Monthly'}
            </Button>
            <Button
              variant="outline"
              className="border-amber-600 text-warning hover:bg-warning/20"
              onClick={handleRunEscalation}
              disabled={isEscalating}
              title="Run overdue escalation — marks overdue, sends warnings, suspends at 30 days"
            >
              <AlertTriangle className={`h-4 w-4 mr-2 ${isEscalating ? 'animate-spin' : ''}`} />
              {isEscalating ? 'Running...' : 'Run Escalation'}
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Invoice
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-warning/15 max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="text-foreground">Create Manager Invoice</DialogTitle>
                  <DialogDescription className="text-warning/70">
                    Create a registration, subscription, or custom invoice with line items
                  </DialogDescription>
                </DialogHeader>
                <ManualInvoiceForm
                  managers={managers}
                  billingConfig={billingConfig}
                  onSubmit={handleFormSubmit}
                  isPending={createInvoice.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-secondary-background rounded"></div>
              ))}
            </div>
          ) : pendingInvoices.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-warning/12 hover:bg-transparent">
                  <TableHead className="text-warning/70 w-12">
                    <Checkbox
                      checked={selectedIds.size === pendingInvoices.length && pendingInvoices.length > 0}
                      onCheckedChange={toggleAllSelection}
                      className="border-[hsl(218_58%_40%)] data-[state=checked]:bg-[hsl(218_58%_40%)]"
                    />
                  </TableHead>
                  <TableHead className="text-warning/70">Invoice #</TableHead>
                  <TableHead className="text-warning/70">Type</TableHead>
                  <TableHead className="text-warning/70">Manager</TableHead>
                  <TableHead className="text-warning/70">Amount</TableHead>
                  <TableHead className="text-warning/70">Due Date</TableHead>
                  <TableHead className="text-warning/70">Status</TableHead>
                  <TableHead className="text-warning/70 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvoices.map((invoice) => (
                  <TableRow 
                    key={invoice.id} 
                    className={`border-warning/12 hover:bg-[hsl(218_58%_16%/0.2)] ${selectedIds.has(invoice.id) ? 'bg-[hsl(218_58%_16%/0.3)]' : ''}`}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(invoice.id)}
                        onCheckedChange={() => toggleSelection(invoice.id)}
                        className="border-[hsl(218_58%_40%)] data-[state=checked]:bg-[hsl(218_58%_40%)]"
                      />
                    </TableCell>
                    <TableCell className="text-foreground font-mono">{invoice.invoice_number}</TableCell>
                    <TableCell>{getInvoiceTypeBadge(invoice.invoice_type || 'subscription')}</TableCell>
                    <TableCell className="text-warning/80">{getManagerName(invoice.manager_user_id)}</TableCell>
                    <TableCell className="text-foreground font-semibold">KES {Number(invoice.amount).toLocaleString()}</TableCell>
                    <TableCell className="text-warning/70">{format(new Date(invoice.due_date), 'dd/MM/yy')}</TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-warning hover:text-warning/70">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-card border-warning/20">
                          <DropdownMenuItem
                            onClick={() => sendReminder.mutate(invoice.id)}
                            className="text-warning/70 hover:bg-[hsl(218_58%_16%/0.5)] cursor-pointer"
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Send Reminder
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handlePayWithStripe(invoice)}
                            className="text-[hsl(214_73%_65%)] hover:bg-[hsl(214_73%_25%/0.5)] cursor-pointer"
                          >
                            <CreditCard className="h-4 w-4 mr-2" />
                            Pay with Card
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setPaymentDialogOpen(true);
                            }}
                            className="text-green-300 hover:bg-green-900/50 cursor-pointer"
                          >
                            <Smartphone className="h-4 w-4 mr-2" />
                            Pay with M-Pesa
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setPaymentInfoDialogOpen(true);
                            }}
                            className="text-warning hover:bg-warning/25 cursor-pointer"
                          >
                            <Info className="h-4 w-4 mr-2" />
                            View Payment Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-[hsl(218_58%_32%/0.5)]" />
                          <DropdownMenuItem
                            onClick={() => markAsPaid.mutate(invoice.id)}
                            className="text-success hover:bg-success/20 cursor-pointer"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Mark as Paid
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => cancelInvoice.mutate(invoice.id)}
                            className="text-destructive hover:bg-destructive/20 cursor-pointer"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Cancel Invoice
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-warning">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No pending invoices</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* M-Pesa Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="bg-card border-warning/15">
          <DialogHeader>
            <DialogTitle className="text-foreground">M-Pesa Payment</DialogTitle>
            <DialogDescription className="text-warning/70">
              Enter your M-Pesa phone number to receive the STK push
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedInvoice && (
              <div className="p-4 bg-warning/6 rounded-lg border border-warning/15">
                <div className="flex justify-between text-sm">
                  <span className="text-warning/70">Invoice:</span>
                  <span className="text-foreground">{selectedInvoice.invoice_number}</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-warning/70">Amount:</span>
                  <span className="text-foreground font-bold">KES {Number(selectedInvoice.amount).toLocaleString()}</span>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-warning/80">Phone Number</Label>
              <Input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="254712345678"
                className="bg-card border-warning/20 text-foreground"
              />
              <p className="text-xs text-warning">Format: 254XXXXXXXXX</p>
            </div>
            <Button
              onClick={handlePayWithMpesa}
              disabled={isProcessingPayment || !phoneNumber}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {isProcessingPayment ? 'Processing...' : 'Send STK Push'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk SMS Dialog */}
      <Dialog open={bulkSmsDialogOpen} onOpenChange={setBulkSmsDialogOpen}>
        <DialogContent className="bg-card border-warning/15">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-green-400" />
              Send Bulk SMS
            </DialogTitle>
            <DialogDescription className="text-warning/70">
              Send SMS reminders to {selectedCount} selected invoice(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-warning/6 rounded-lg border border-warning/15">
              <p className="text-sm text-warning/70 mb-2">Available placeholders:</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-warning/70 border-[hsl(218_58%_40%)]">{'{name}'}</Badge>
                <Badge variant="outline" className="text-warning/70 border-[hsl(218_58%_40%)]">{'{amount}'}</Badge>
                <Badge variant="outline" className="text-warning/70 border-[hsl(218_58%_40%)]">{'{invoices}'}</Badge>
                <Badge variant="outline" className="text-warning/70 border-[hsl(218_58%_40%)]">{'{count}'}</Badge>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-warning/80">Message</Label>
              <Textarea
                value={bulkSmsMessage}
                onChange={(e) => setBulkSmsMessage(e.target.value)}
                placeholder="Enter your SMS message..."
                className="bg-card border-warning/20 text-foreground min-h-[120px]"
                maxLength={160}
              />
              <p className="text-xs text-warning">{bulkSmsMessage.length}/160 characters</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkSmsDialogOpen(false)}
              className="border-[hsl(218_58%_40%)] text-warning/70"
            >
              Cancel
            </Button>
            <Button
              onClick={sendBulkSms}
              disabled={isSendingBulkSms || !bulkSmsMessage.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSendingBulkSms ? 'Sending...' : `Send to ${selectedCount} Manager(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Details Dialog */}
      {renderPaymentDetails()}
    </div>
  );
};

export default ManagerInvoices;
