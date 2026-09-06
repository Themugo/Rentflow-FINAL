import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Building2, CreditCard, Copy, Check, Star, ClipboardList } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useToast } from '@/shared/hooks/use-toast';
import { Badge } from '@/shared/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { MpesaQRCode } from './MpesaQRCode';
import { PaymentInstructionsGuide } from './PaymentInstructionsGuide';
interface BankDetails {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  branch_name: string | null;
  swift_code: string | null;
  paybill_number: string | null;
  till_number: string | null;
  account_label: string | null;
  is_default: boolean;
  property_id: string | null;
}

interface DetailRowProps {
  label: string;
  value: string;
  fieldName: string;
  copiedField: string | null;
  onCopy: (value: string, fieldName: string) => void;
}

function DetailRow({ label, value, fieldName, copiedField, onCopy }: DetailRowProps) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={() => onCopy(value, fieldName)} className="h-8 w-8 p-0">
        {copiedField === fieldName ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

interface BankAccountCardProps {
  account: BankDetails;
  copiedField: string | null;
  copiedAll: boolean;
  onCopy: (value: string, fieldName: string) => void;
  onCopyAll: (account: BankDetails) => void;
}

function BankAccountCard({ account, copiedField, copiedAll, onCopy, onCopyAll }: BankAccountCardProps) {
  return (
    <div className="space-y-4">
      {/* Copy All Button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => onCopyAll(account)} className="gap-2">
          {copiedAll ? (
            <>
              <Check className="h-4 w-4 text-success" />
              Copied!
            </>
          ) : (
            <>
              <ClipboardList className="h-4 w-4" />
              Copy All Details
            </>
          )}
        </Button>
      </div>

      {/* Bank Details Section */}
      <div className="space-y-3">
        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Bank Transfer</h4>
        <DetailRow
          label="Bank Name"
          value={account.bank_name}
          fieldName={`Bank Name - ${account.id}`}
          copiedField={copiedField}
          onCopy={onCopy}
        />
        <DetailRow
          label="Account Name"
          value={account.account_name}
          fieldName={`Account Name - ${account.id}`}
          copiedField={copiedField}
          onCopy={onCopy}
        />
        <DetailRow
          label="Account Number"
          value={account.account_number}
          fieldName={`Account Number - ${account.id}`}
          copiedField={copiedField}
          onCopy={onCopy}
        />
        {account.branch_name && (
          <DetailRow
            label="Branch"
            value={account.branch_name}
            fieldName={`Branch - ${account.id}`}
            copiedField={copiedField}
            onCopy={onCopy}
          />
        )}
        {account.swift_code && (
          <DetailRow
            label="SWIFT Code"
            value={account.swift_code}
            fieldName={`SWIFT Code - ${account.id}`}
            copiedField={copiedField}
            onCopy={onCopy}
          />
        )}
      </div>

      {/* Mobile Money Section */}
      {(account.paybill_number || account.till_number) && (
        <div className="space-y-3 border-t pt-4">
          <h4 className="flex items-center gap-2 font-medium text-sm text-muted-foreground uppercase tracking-wide">
            <CreditCard className="h-4 w-4" />
            M-Pesa
          </h4>
          {account.paybill_number && (
            <DetailRow
              label="Paybill Number"
              value={account.paybill_number}
              fieldName={`Paybill - ${account.id}`}
              copiedField={copiedField}
              onCopy={onCopy}
            />
          )}
          {account.till_number && (
            <DetailRow
              label="Till Number"
              value={account.till_number}
              fieldName={`Till Number - ${account.id}`}
              copiedField={copiedField}
              onCopy={onCopy}
            />
          )}
        </div>
      )}

      {/* M-Pesa QR Codes */}
      {(account.paybill_number || account.till_number) && (
        <MpesaQRCode
          paybillNumber={account.paybill_number}
          tillNumber={account.till_number}
          accountNumber={account.account_number}
        />
      )}

      {/* Payment Instructions Guide */}
      <PaymentInstructionsGuide
        paybillNumber={account.paybill_number}
        tillNumber={account.till_number}
        accountReference={account.account_number}
        bankName={account.bank_name}
        accountNumber={account.account_number}
      />
    </div>
  );
}

interface ManagerBankDetailsProps {
  managerId?: string;
  propertyId?: string;
}

export const ManagerBankDetails = ({ managerId, propertyId }: ManagerBankDetailsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [bankAccounts, setBankAccounts] = useState<BankDetails[]>([]);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const fetchBankDetails = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('bank_details')
        .select('*')
        .eq('manager_id', managerId)
        .order('is_default', { ascending: false });

      if (error) throw error;

      const filtered = (data || []).filter((account) => {
        if (propertyId && account.property_id === propertyId) return true;
        if (!account.property_id) return true;
        return false;
      });

      setBankAccounts(filtered);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }, [managerId, propertyId]);

  useEffect(() => {
    if (managerId) {
      fetchBankDetails();
    }
  }, [managerId, propertyId, fetchBankDetails]);

  const copyToClipboard = async (value: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(fieldName);
      toast({
        title: 'Copied!',
        description: `${fieldName} copied to clipboard`,
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: 'Unable to copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  const copyAllDetails = async (account: BankDetails) => {
    const lines = [
      `Bank Name: ${account.bank_name}`,
      `Account Name: ${account.account_name}`,
      `Account Number: ${account.account_number}`,
    ];

    if (account.branch_name) {
      lines.push(`Branch: ${account.branch_name}`);
    }
    if (account.swift_code) {
      lines.push(`SWIFT Code: ${account.swift_code}`);
    }
    if (account.paybill_number) {
      lines.push(`M-Pesa Paybill: ${account.paybill_number}`);
    }
    if (account.till_number) {
      lines.push(`M-Pesa Till: ${account.till_number}`);
    }

    const allDetails = lines.join('\n');

    try {
      await navigator.clipboard.writeText(allDetails);
      setCopiedAll(true);
      toast({
        title: 'All Details Copied!',
        description: 'Bank details copied to clipboard',
      });
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: 'Unable to copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (bankAccounts.length === 0) {
    return null;
  }

  // If only one account, show it directly
  if (bankAccounts.length === 1) {
    const account = bankAccounts[0];
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-warning" />
            Payment Details
            {account.is_default && (
              <Badge variant="secondary" className="text-xs ml-2">
                <Star className="h-3 w-3 mr-1" />
                Default
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Use these details to make payments directly to your landlord</CardDescription>
        </CardHeader>
        <CardContent>
          <BankAccountCard
            account={account}
            copiedField={copiedField}
            copiedAll={copiedAll}
            onCopy={copyToClipboard}
            onCopyAll={copyAllDetails}
          />
        </CardContent>
      </Card>
    );
  }

  // Multiple accounts - use tabs
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="h-5 w-5 text-warning" />
          Payment Details
        </CardTitle>
        <CardDescription>Use these details to make payments directly to your landlord</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={bankAccounts[0]?.id} className="w-full">
          <TabsList className="w-full flex-wrap h-auto gap-1 mb-4">
            {bankAccounts.map((account) => (
              <TabsTrigger key={account.id} value={account.id} className="flex items-center gap-1">
                {account.account_label || account.bank_name}
                {account.is_default && <Star className="h-3 w-3" />}
              </TabsTrigger>
            ))}
          </TabsList>
          {bankAccounts.map((account) => (
            <TabsContent key={account.id} value={account.id}>
              <BankAccountCard
                account={account}
                copiedField={copiedField}
                copiedAll={copiedAll}
                onCopy={copyToClipboard}
                onCopyAll={copyAllDetails}
              />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};
