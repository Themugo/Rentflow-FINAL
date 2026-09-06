import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { useToast } from '@/shared/hooks/use-toast';
import { Upload, CheckCircle2, Loader2, Receipt, Calendar, Sparkles, RefreshCw, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/shared/components/ui/badge';

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  description: string | null;
}

interface ReceiptUploadProps {
  tenantId: string;
  managerId?: string | null;
  propertyName?: string | null;
  unit?: string | null;
  invoices: Invoice[];
  onUploadComplete?: () => void;
}

interface ExtractedData {
  amount?: number | null;
  payment_date?: string | null;
  payment_method?: string | null;
  reference_number?: string | null;
  notes?: string | null;
}

export const ReceiptUpload = ({
  tenantId,
  managerId,
  propertyName,
  unit,
  invoices,
  onUploadComplete,
}: ReceiptUploadProps) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentMethod, setPaymentMethod] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [autoFilled, setAutoFilled] = useState(false);
  const [isPdf, setIsPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix to get pure base64
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const parseReceiptWithAI = async (file: File) => {
    setParsing(true);
    try {
      let requestBody: { imageBase64?: string; mimeType?: string; textContent?: string } = {};

      if (file.type === 'application/pdf') {
        // For PDFs, we'll extract text content from the file name and ask user to paste text
        // Since we can't parse PDFs directly with vision, we'll use text extraction
        setIsPdf(true);
        toast({
          title: 'PDF detected',
          description:
            'For best results, please screenshot your receipt or paste the transaction text in the notes field.',
        });
        setParsing(false);
        return;
      } else {
        // For images, use vision
        const imageBase64 = await fileToBase64(file);
        requestBody = { imageBase64, mimeType: file.type };
      }

      const { data, error } = await supabase.functions.invoke('parse-receipt', {
        body: requestBody,
      });

      if (error) {
        toast({
          title: 'Could not auto-fill',
          description: 'Please enter the details manually.',
          variant: 'destructive',
        });
        return;
      }

      if (data?.success && data?.data) {
        applyExtractedData(data.data);
      } else {
        toast({
          title: 'Could not read receipt',
          description: 'Please enter the details manually or try rescanning.',
        });
      }
    } catch (error) {
      toast({
        title: 'Auto-fill failed',
        description: 'Please enter the details manually.',
      });
    } finally {
      setParsing(false);
    }
  };

  const applyExtractedData = (extracted: ExtractedData) => {
    if (extracted.amount) {
      setAmount(extracted.amount.toString());
    }
    if (extracted.payment_date) {
      setPaymentDate(extracted.payment_date);
    }
    if (extracted.payment_method) {
      setPaymentMethod(extracted.payment_method);
    }
    if (extracted.reference_number) {
      setReferenceNumber(extracted.reference_number);
    }
    if (extracted.notes) {
      setNotes(extracted.notes);
    }

    setAutoFilled(true);
    toast({
      title: 'Receipt scanned!',
      description: 'Details have been auto-filled. Please verify and adjust if needed.',
    });
  };

  const handleRescan = async () => {
    if (!selectedFile) return;

    // Clear previous auto-filled data
    setAmount('');
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
    setPaymentMethod('');
    setReferenceNumber('');
    setNotes('');
    setAutoFilled(false);

    await parseReceiptWithAI(selectedFile);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Please upload a file smaller than 5MB',
          variant: 'destructive',
        });
        return;
      }

      setSelectedFile(file);
      setAutoFilled(false);
      setIsPdf(file.type === 'application/pdf');

      // Parse both images and PDFs (PDFs will show guidance)
      await parseReceiptWithAI(file);
    }
  };

  const handleInvoiceSelect = (invoiceId: string) => {
    setSelectedInvoice(invoiceId);
    const invoice = invoices.find((i) => i.id === invoiceId);
    if (invoice && !amount) {
      setAmount(invoice.amount.toString());
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !amount || !paymentDate || !paymentMethod) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all required fields and select a file',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      // Upload file to storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${tenantId}/${Date.now()}.${fileExt}`;

      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('payment-receipts')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Store the file path - we'll generate signed URLs when displaying
      // This is more secure as URLs expire and can't be shared permanently
      const receiptPath = fileName;

      // Create receipt record with the file path
      const { error: insertError } = await supabase.rpc('submit_payment_receipt_atomic', {
        p_tenant_id: tenantId, p_invoice_id: selectedInvoice || null, p_receipt_url: receiptPath,
        p_amount: parseFloat(amount), p_payment_date: paymentDate, p_payment_method: paymentMethod,
        p_reference_number: referenceNumber || null, p_notes: notes || null,
      });
      if (insertError) throw insertError;

      // Notify manager about the new receipt upload
      if (managerId) {
        try {
          // Get tenant info for notification
          const { data: tenantData } = await supabase.from('tenants').select('name, email').eq('id', tenantId).single();

          if (tenantData) {
            await supabase.functions.invoke('notify-manager-receipt-upload', {
              body: {
                managerId,
                tenantName: tenantData.name,
                tenantEmail: tenantData.email,
                propertyName: propertyName || 'Property',
                unit: unit || undefined,
                amount: parseFloat(amount),
                paymentDate,
                paymentMethod,
                referenceNumber: referenceNumber || undefined,
              },
            });
          }
        } catch (notifyError) {
          // Don't fail the upload if notification fails
        }
      }

      toast({
        title: 'Receipt uploaded!',
        description: 'Your payment receipt has been submitted for verification.',
      });

      // Reset form
      setSelectedFile(null);
      setSelectedInvoice('');
      setAmount('');
      setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
      setPaymentMethod('');
      setReferenceNumber('');
      setNotes('');
      setAutoFilled(false);
      setIsPdf(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      onUploadComplete?.();
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload receipt',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-warning" />
          Upload Payment Receipt
          <Badge variant="secondary" className="ml-2 gap-1">
            <Sparkles className="h-3 w-3" />
            AI Auto-fill
          </Badge>
        </CardTitle>
        <CardDescription>Upload a receipt image and we'll automatically extract the details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Upload - Move to top for better UX */}
        <div className="space-y-2">
          <Label>Receipt/Screenshot *</Label>
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              parsing ? 'border-warning/40 bg-warning' : 'hover:border-warning/40/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              className="hidden"
              id="receipt-upload"
              disabled={parsing}
            />
            <label htmlFor="receipt-upload" className={`cursor-pointer ${parsing ? 'pointer-events-none' : ''}`}>
              {parsing ? (
                <div className="space-y-2">
                  <Loader2 className="h-8 w-8 mx-auto text-warning animate-spin" />
                  <p className="text-sm text-warning font-medium">Scanning receipt with AI...</p>
                  <p className="text-xs text-muted-foreground">Extracting payment details automatically</p>
                </div>
              ) : selectedFile ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-success">
                    {isPdf ? <FileText className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                    <span className="font-medium">{selectedFile.name}</span>
                  </div>
                  {autoFilled && (
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      Details auto-filled from receipt
                    </p>
                  )}
                  {isPdf && !autoFilled && (
                    <p className="text-xs text-muted-foreground">
                      PDF uploaded - please enter details manually or screenshot the receipt
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Click to upload receipt image or PDF</p>
                  <p className="text-xs text-muted-foreground">We'll auto-extract payment details • Max 5MB</p>
                </div>
              )}
            </label>
          </div>

          {/* Rescan Button */}
          {selectedFile && !parsing && !isPdf && (
            <Button type="button" variant="outline" size="sm" onClick={handleRescan} className="w-full mt-2 gap-2">
              <RefreshCw className="h-4 w-4" />
              Rescan Receipt
            </Button>
          )}
        </div>

        {/* Auto-filled notice */}
        {autoFilled && (
          <div className="flex items-start gap-2 p-3 bg-success/10 border border-success/30 rounded-lg">
            <Sparkles className="h-4 w-4 text-success mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-success">Details auto-filled!</p>
              <p className="text-muted-foreground">Please verify the information below and adjust if needed.</p>
            </div>
          </div>
        )}

        {/* Invoice Selection (Optional) */}
        <div className="space-y-2">
          <Label>Link to Invoice (Optional)</Label>
          <Select value={selectedInvoice} onValueChange={handleInvoiceSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Select an invoice to link" />
            </SelectTrigger>
            <SelectContent>
              {invoices.map((invoice) => (
                <SelectItem key={invoice.id} value={invoice.id}>
                  {invoice.invoice_number} - KES {invoice.amount.toLocaleString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Amount */}
        <div className="space-y-2">
          <Label htmlFor="amount">Amount Paid *</Label>
          <Input
            id="amount"
            type="number"
            placeholder="Enter amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        {/* Payment Date */}
        <div className="space-y-2">
          <Label htmlFor="paymentDate">Payment Date *</Label>
          <div className="relative">
            <Input id="paymentDate" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Payment Method */}
        <div className="space-y-2">
          <Label>Payment Method *</Label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger>
              <SelectValue placeholder="Select payment method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mpesa_paybill">M-Pesa Paybill</SelectItem>
              <SelectItem value="mpesa_till">M-Pesa Till/Buy Goods</SelectItem>
              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="cheque">Cheque</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reference Number */}
        <div className="space-y-2">
          <Label htmlFor="reference">Transaction/Reference Number</Label>
          <Input
            id="reference"
            placeholder="e.g., M-Pesa code or bank reference"
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
          />
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Additional Notes</Label>
          <Textarea
            id="notes"
            placeholder="Any additional information..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleUpload}
          disabled={uploading || parsing || !selectedFile || !amount || !paymentMethod}
          className="w-full"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Submit Receipt
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
