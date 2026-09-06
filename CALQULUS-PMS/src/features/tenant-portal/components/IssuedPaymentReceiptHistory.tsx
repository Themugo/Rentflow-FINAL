import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Download, FileCheck, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { useToast } from '@/shared/hooks/use-toast';
import { fetchIssuedPaymentReceipt, generateIssuedPaymentReceiptPDF } from '@/features/billing/lib/issuedPaymentReceiptPdf';

export const IssuedPaymentReceiptHistory: React.FC = () => {
  const { toast } = useToast();
  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ['issued-payment-receipts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('issued_payment_receipts' as any)
        .select('id, receipt_number, issued_at, total_amount, transaction_id')
        .order('issued_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; receipt_number: string; issued_at: string; total_amount: number; transaction_id: string }>;
    },
  });

  const downloadReceipt = async (id: string, receiptNumber: string) => {
    try {
      const payload = await fetchIssuedPaymentReceipt(id);
      const doc = await generateIssuedPaymentReceiptPDF(payload);
      doc.save(`${receiptNumber || id}.pdf`);
    } catch (error: any) {
      toast({ title: 'Could not generate receipt', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
  };

  if (isLoading) return <Card><CardContent className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></CardContent></Card>;
  if (!receipts.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileCheck className="h-5 w-5 text-success" />Issued payment receipts</CardTitle>
        <CardDescription>Official receipts for successful payments, including bulk unit allocations.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {receipts.map((receipt) => (
          <div key={receipt.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm">{receipt.receipt_number}</span><Badge variant="outline" className="text-success border-success/30">Paid</Badge></div>
              <p className="text-xs text-muted-foreground mt-1">{format(new Date(receipt.issued_at), 'dd MMM yyyy')} · KES {Number(receipt.total_amount).toLocaleString()}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => downloadReceipt(receipt.id, receipt.receipt_number)} className="gap-1 shrink-0"><Download className="h-3.5 w-3.5" />PDF receipt</Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
