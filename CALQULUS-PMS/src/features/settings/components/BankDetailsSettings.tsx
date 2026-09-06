import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateManagerActivation } from '@/features/dashboard/hooks/useManagerActivation';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { useToast } from '@/shared/hooks/use-toast';
import { logError, toUserFacingError } from '@/shared/lib/errorLogger';
import { Building2, CreditCard, Loader2, Save, Plus, Trash2, Star, CheckCircle2, XCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/components/ui/dialog';
import { Badge } from '@/shared/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/components/ui/accordion';

// Major banks in Kenya
const KENYA_BANKS = [
  'Kenya Commercial Bank (KCB)',
  'Equity Bank Kenya',
  'Co-operative Bank of Kenya',
  'ABSA Bank Kenya',
  'Standard Chartered Bank Kenya',
  'Diamond Trust Bank (DTB)',
  'Stanbic Bank Kenya',
  'I&M Bank Kenya',
  'NCBA Bank Kenya',
  'Family Bank',
  'National Bank of Kenya',
  'Bank of Africa Kenya',
  'Prime Bank Kenya',
  'Victoria Commercial Bank',
  'Guaranty Trust Bank (Kenya)',
  'Ecobank Kenya',
  'Bank of Baroda Kenya',
  'Citibank Kenya',
  'HFC Bank Kenya',
  'Credit Bank',
  'Gulf African Bank',
  'First Community Bank',
  'Sidian Bank',
  'M-Oriental Bank',
  'Guardian Bank',
  'Middle East Bank Kenya',
  'Paramount Universal Bank',
  'Consolidated Bank of Kenya',
  'Development Bank of Kenya',
  'Other',
];

// Account number validation patterns for Kenya banks
const BANK_ACCOUNT_PATTERNS: Record<string, { pattern: RegExp; description: string; example: string }> = {
  'Kenya Commercial Bank (KCB)': { pattern: /^\d{13}$/, description: '13 digits', example: '1234567890123' },
  'Equity Bank Kenya': { pattern: /^\d{13}$/, description: '13 digits', example: '0123456789012' },
  'Co-operative Bank of Kenya': { pattern: /^\d{14}$/, description: '14 digits', example: '01234567890123' },
  'ABSA Bank Kenya': { pattern: /^\d{10,12}$/, description: '10-12 digits', example: '0123456789' },
  'Standard Chartered Bank Kenya': { pattern: /^\d{11}$/, description: '11 digits', example: '01234567890' },
  'Diamond Trust Bank (DTB)': { pattern: /^\d{10,14}$/, description: '10-14 digits', example: '0123456789' },
  'Stanbic Bank Kenya': { pattern: /^\d{13}$/, description: '13 digits', example: '0123456789012' },
  'I&M Bank Kenya': { pattern: /^\d{14}$/, description: '14 digits', example: '01234567890123' },
  'NCBA Bank Kenya': { pattern: /^\d{12,14}$/, description: '12-14 digits', example: '012345678901' },
  'Family Bank': { pattern: /^\d{12}$/, description: '12 digits', example: '012345678901' },
  'National Bank of Kenya': { pattern: /^\d{10}$/, description: '10 digits', example: '0123456789' },
};

const DEFAULT_ACCOUNT_PATTERN = { pattern: /^\d{8,20}$/, description: '8-20 digits', example: '012345678' };

function validateAccountNumber(bankName: string, accountNumber: string): { valid: boolean; message: string } {
  if (!bankName || !accountNumber) return { valid: false, message: '' };
  const bankPattern = BANK_ACCOUNT_PATTERNS[bankName] || DEFAULT_ACCOUNT_PATTERN;
  const cleanedNumber = accountNumber.replace(/\s/g, '');
  if (!bankPattern.pattern.test(cleanedNumber)) {
    return { valid: false, message: `Expected: ${bankPattern.description} (e.g., ${bankPattern.example})` };
  }
  return { valid: true, message: 'Valid account number' };
}

function getValidationStatus(bankName: string, accountNumber: string) {
  if (!accountNumber || accountNumber.length === 0) return null;
  return validateAccountNumber(bankName, accountNumber);
}

function ValidationIndicator({ bankName, accountNumber }: { bankName: string; accountNumber: string }) {
  const status = getValidationStatus(bankName, accountNumber);
  if (!status) return null;
  return (
    <div className={`flex items-center gap-1 text-xs mt-1 ${status.valid ? 'text-green-600' : 'text-destructive'}`}>
      {status.valid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      <span>{status.message}</span>
    </div>
  );
}

const MOBILE_MONEY_PROVIDERS = [
  { id: 'mpesa', name: 'Safaricom M-Pesa', type: 'paybill' },
  { id: 'mpesa_till', name: 'Safaricom M-Pesa Till', type: 'till' },
  { id: 'airtel', name: 'Airtel Money', type: 'paybill' },
  { id: 'tkash', name: 'T-Kash (Telkom)', type: 'paybill' },
  { id: 'equitel', name: 'Equitel Money', type: 'paybill' },
];

interface BankDetails {
  id?: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  branch_name: string;
  swift_code: string;
  paybill_number: string;
  till_number: string;
  property_id: string | null;
  unit_id: string | null;
  account_label: string;
  is_default: boolean;
}

interface BankDetailsRow {
  id: string;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  branch_name: string | null;
  swift_code: string | null;
  paybill_number: string | null;
  till_number: string | null;
  property_id: string | null;
  unit_id: string | null;
  account_label: string | null;
  is_default: boolean | null;
}

interface Property {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  unit_number: string;
  property_id: string;
}

const emptyBankDetails: BankDetails = {
  bank_name: '',
  account_name: '',
  account_number: '',
  branch_name: '',
  swift_code: '',
  paybill_number: '',
  till_number: '',
  property_id: null,
  unit_id: null,
  account_label: '',
  is_default: false,
};

interface BankDetailsSettingsProps {
  propertyId?: string;
  /** When true (and no propertyId), only show company-wide accounts (property_id null). */
  defaultScopeOnly?: boolean;
}

export const BankDetailsSettings = ({ propertyId, defaultScopeOnly }: BankDetailsSettingsProps = {}) => {
  const { user, isManager } = useAuth();
  const queryClient = useQueryClient();
  const scoped = !!propertyId || !!defaultScopeOnly;
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankDetails[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [allUnits, setAllUnits] = useState<Unit[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newAccount, setNewAccount] = useState<BankDetails>(emptyBankDetails);

  const fetchData = useCallback(async () => {
    try {
      const baseQuery = supabase
        .from('bank_details')
        .select('*')
        .eq('manager_id', user?.id)
        .order('is_default', { ascending: false });

      let bankQuery = baseQuery;
      if (propertyId) bankQuery = baseQuery.eq('property_id', propertyId);
      else if (defaultScopeOnly) bankQuery = baseQuery.is('property_id', null);

      const [bankResult, propertiesResult, unitsResult] = await Promise.all([
        bankQuery,
        supabase
          .from('properties')
          .select('id, name')
          .eq('manager_id', user?.id)
          .order('name'),
        supabase
          .from('units')
          .select('id, unit_number, property_id')
          .in('property_id', (await supabase.from('properties').select('id').eq('manager_id', user?.id)).data?.map(p => p.id) || [])
          .neq('status', 'inactive')
          .order('unit_number'),
      ]);

      if (bankResult.error) throw bankResult.error;
      if (propertiesResult.error) throw propertiesResult.error;

      setBankAccounts(
         
        (bankResult.data || []).map((d: BankDetailsRow) => ({
          id: d.id,
          bank_name: d.bank_name || '',
          account_name: d.account_name || '',
          account_number: d.account_number || '',
          branch_name: d.branch_name || '',
          swift_code: d.swift_code || '',
          paybill_number: d.paybill_number || '',
          till_number: d.till_number || '',
          property_id: d.property_id,
          unit_id: d.unit_id || null,
          account_label: d.account_label || '',
          is_default: d.is_default || false,
        }))
      );
      setProperties(propertiesResult.data || []);
      setAllUnits((unitsResult.data ?? []) as Unit[]);
      if (propertyId) setNewAccount(prev => ({ ...prev, property_id: propertyId }));
    } catch {
    } finally {
      setLoading(false);
    }
  }, [user, propertyId, defaultScopeOnly]);

  useEffect(() => {
    if (user && isManager) {
      fetchData();
    }
  }, [user, isManager, fetchData]);
  const getUnitsForProperty = (propertyId: string | null) => {
    if (!propertyId) return [];
    return allUnits.filter(u => u.property_id === propertyId);
  };

  const sendNotifications = async (account: BankDetails, isNew: boolean) => {
    try {
      const { data: tenants } = await supabase
        .from('tenants')
        .select('phone, name, email')
        .in('property_id', properties.map((p) => p.id));

      if (!tenants || tenants.length === 0) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user?.id)
        .single();

      const accountLabel = account.account_label || account.bank_name;

      const tenantsWithPhone = tenants.filter((t) => t.phone);
      if (tenantsWithPhone.length > 0) {
        const message = isNew
          ? `Your landlord has added new bank details${accountLabel ? ` for ${accountLabel}` : ''}. Please check the tenant portal for updated payment information.`
          : `Your landlord has updated bank details${accountLabel ? ` for ${accountLabel}` : ''}. Please check the tenant portal for updated payment information.`;

        supabase.functions.invoke('send-bulk-sms', {
          body: {
            recipients: tenantsWithPhone.map((t) => ({ phoneNumber: t.phone, name: t.name })),
            message,
          },
        }).catch((err) => logError('BankDetailsSettings.smsSend', err));
      }

      const tenantsWithEmail = tenants.filter((t) => t.email);
      if (tenantsWithEmail.length > 0 && account.id) {
        // Note: the edge function re-fetches the bank details by accountId and
        // re-verifies every recipient is actually one of the caller's own
        // tenants server-side — it does not trust tenantEmails/bankDetails
        // content from this call, they're just a convenience hint.
        supabase.functions.invoke('send-bank-details-notification', {
          body: {
            accountId: account.id,
            tenantEmails: tenantsWithEmail.map((t) => ({ email: t.email, name: t.name })),
            managerName: profile?.full_name || '',
            accountLabel,
            isNew,
          },
        }).catch((err) => logError('BankDetailsSettings.emailSend', err));
      }
    } catch (error) {
    }
  };

  const handleSave = async (account: BankDetails, isNew: boolean = false) => {
    if (!user) return;

    if (!account.bank_name || !account.account_name || !account.account_number) {
      toast({ title: 'Missing Required Fields', description: 'Please fill in bank name, account name, and account number.', variant: 'destructive' });
      return;
    }

    const validation = validateAccountNumber(account.bank_name, account.account_number);
    if (!validation.valid) {
      toast({ title: 'Invalid Account Number', description: validation.message, variant: 'destructive' });
      return;
    }

    setSaving(account.id || 'new');
    try {
      const payload = {
        manager_id: user.id,
        bank_name: account.bank_name,
        account_name: account.account_name,
        account_number: account.account_number,
        branch_name: account.branch_name || null,
        swift_code: account.swift_code || null,
        paybill_number: account.paybill_number || null,
        till_number: account.till_number || null,
        property_id: account.property_id || null,
        unit_id: account.unit_id || null,
        account_label: account.account_label || null,
        is_default: account.is_default,
      };

      const { data, error } = await supabase.rpc('save_manager_bank_details_atomic', {
        p_id: account.id || null,
        p_payload: payload,
      });
      if (error) throw error;
      const savedAccount = { ...account, id: account.id || data };
      if (!account.id) {
        setBankAccounts((prev) => [...prev, savedAccount]);
        setDialogOpen(false);
        setNewAccount(emptyBankDetails);
      }

      sendNotifications(savedAccount, isNew);
      toast({ title: 'Bank Details Saved', description: 'Bank details updated and tenants notified via SMS & email.' });
      invalidateManagerActivation(queryClient);
      if (!isNew) fetchData();
    } catch (err) {
      toast({ title: 'Could not save bank details', description: toUserFacingError(err, 'Your details are still here. Check the fields and try again.'), variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const { error } = await supabase.rpc('delete_manager_bank_details_atomic', { p_id: id });
      if (error) throw error;
      setBankAccounts((prev) => prev.filter((a) => a.id !== id));
      toast({ title: 'Bank Account Deleted', description: 'The bank account has been removed.' });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to delete bank details.', variant: 'destructive' });
    } finally {
      setDeleting(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const account = bankAccounts.find((a) => a.id === id);
      if (!account) throw new Error('Bank account not found');
      const { error } = await supabase.rpc('save_manager_bank_details_atomic', { p_id: id, p_payload: { ...account, is_default: true } });
      if (error) throw error;
      setBankAccounts((prev) => prev.map((a) => ({ ...a, is_default: a.id === id })));
      toast({ title: 'Default Account Updated', description: 'This account is now the default for payments.' });
    } catch (error) {
    }
  };

  const updateAccount = <K extends keyof BankDetails>(id: string, field: K, value: BankDetails[K]) => {
    setBankAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, [field]: value } : a)));
  };

  const getAssignmentLabel = (propertyId: string | null, unitId: string | null) => {
    if (unitId) {
      const unit = allUnits.find(u => u.id === unitId);
      const property = properties.find(p => p.id === propertyId);
      return `${property?.name || 'Unknown'} → House ${unit?.unit_number || 'Unknown'}`;
    }
    if (propertyId) {
      return properties.find((p) => p.id === propertyId)?.name || 'Unknown Property';
    }
    return 'All Properties';
  };

  const renderAssignmentSelect = (account: BankDetails, onChange: (propertyId: string | null, unitId: string | null) => void) => {
    const units = getUnitsForProperty(account.property_id);
    return (
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>Assign to Property</Label>
          <Select
            value={account.property_id || 'all-properties'}
            onValueChange={(v) => {
              const pid = v === 'all-properties' ? null : v;
              onChange(pid, null); // reset unit when property changes
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Properties (Default)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-properties">All Properties (Default)</SelectItem>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {account.property_id && units.length > 0 && (
          <div className="space-y-2">
            <Label>Assign to House (Unit)</Label>
            <Select
              value={account.unit_id || 'all-units'}
              onValueChange={(v) => onChange(account.property_id, v === 'all-units' ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Houses in Property" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-units">All Houses in Property</SelectItem>
                {units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>House {u.unit_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Assign this bank account to a specific house for targeted payment instructions.
            </p>
          </div>
        )}
      </div>
    );
  };

  if (!isManager) return null;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Bank Details
            </CardTitle>
            <CardDescription>
              Manage bank accounts per house. Tenants will be notified via SMS when details are updated.
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Account
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Bank Account</DialogTitle>
                <DialogDescription>Add a new bank account and assign it to a specific house.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Account Label</Label>
                    <Input
                      placeholder="e.g., Main Account, House A1 Account"
                      value={newAccount.account_label}
                      onChange={(e) => setNewAccount((prev) => ({ ...prev, account_label: e.target.value }))}
                    />
                  </div>
                  <div />
                </div>

                {renderAssignmentSelect(newAccount, (propertyId, unitId) =>
                  setNewAccount((prev) => ({ ...prev, property_id: propertyId, unit_id: unitId }))
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Bank Name *</Label>
                    <Select
                      value={newAccount.bank_name}
                      onValueChange={(v) => setNewAccount((prev) => ({ ...prev, bank_name: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a bank" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-lg z-50 max-h-[300px]">
                        {KENYA_BANKS.map((bank) => (
                          <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Account Name *</Label>
                    <Input
                      placeholder="e.g., ABC Properties Ltd"
                      value={newAccount.account_name}
                      onChange={(e) => setNewAccount((prev) => ({ ...prev, account_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Number *</Label>
                    <div className="relative">
                      <Input
                        placeholder={
                          newAccount.bank_name && BANK_ACCOUNT_PATTERNS[newAccount.bank_name]
                            ? `e.g., ${BANK_ACCOUNT_PATTERNS[newAccount.bank_name].example}`
                            : 'e.g., 1234567890'
                        }
                        value={newAccount.account_number}
                        onChange={(e) => setNewAccount((prev) => ({ ...prev, account_number: e.target.value }))}
                        className={newAccount.account_number ? (getValidationStatus(newAccount.bank_name, newAccount.account_number)?.valid ? 'border-green-500 focus-visible:ring-green-500' : 'border-destructive focus-visible:ring-destructive') : ''}
                      />
                    </div>
                    <ValidationIndicator bankName={newAccount.bank_name} accountNumber={newAccount.account_number} />
                  </div>
                  <div className="space-y-2">
                    <Label>Branch Name</Label>
                    <Input
                      placeholder="e.g., Westlands Branch"
                      value={newAccount.branch_name}
                      onChange={(e) => setNewAccount((prev) => ({ ...prev, branch_name: e.target.value }))}
                    />
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <h4 className="mb-3 flex items-center gap-2 font-medium text-sm">
                    <CreditCard className="h-4 w-4" />
                    Mobile Money Options
                  </h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>M-Pesa Paybill Number</Label>
                      <Input
                        placeholder="e.g., 123456"
                        value={newAccount.paybill_number}
                        onChange={(e) => setNewAccount((prev) => ({ ...prev, paybill_number: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>M-Pesa Till Number</Label>
                      <Input
                        placeholder="e.g., 789012"
                        value={newAccount.till_number}
                        onChange={(e) => setNewAccount((prev) => ({ ...prev, till_number: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => handleSave(newAccount, true)} disabled={saving === 'new'}>
                  {saving === 'new' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Account
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {bankAccounts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No bank accounts added yet.</p>
            <p className="text-sm">Add your first bank account so tenants can pay easily.</p>
          </div>
        ) : (
          <Accordion type="single" collapsible className="space-y-2">
            {bankAccounts.map((account, index) => (
              <AccordionItem key={account.id} value={account.id || `account-${index}`} className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 text-left">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{account.account_label || account.bank_name}</span>
                        {account.is_default && (
                          <Badge variant="secondary" className="text-xs">
                            <Star className="h-3 w-3 mr-1" />
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{getAssignmentLabel(account.property_id, account.unit_id)}</p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Account Label</Label>
                        <Input
                          value={account.account_label}
                          onChange={(e) => updateAccount(account.id!, 'account_label', e.target.value)}
                        />
                      </div>
                      <div />
                    </div>

                    {renderAssignmentSelect(account, (propertyId, unitId) => {
                      updateAccount(account.id!, 'property_id', propertyId);
                      updateAccount(account.id!, 'unit_id', unitId);
                    })}

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Bank Name *</Label>
                        <Select
                          value={account.bank_name}
                          onValueChange={(v) => updateAccount(account.id!, 'bank_name', v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a bank" />
                          </SelectTrigger>
                          <SelectContent className="bg-background border shadow-lg z-50 max-h-[300px]">
                            {KENYA_BANKS.map((bank) => (
                              <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Account Name *</Label>
                        <Input
                          value={account.account_name}
                          onChange={(e) => updateAccount(account.id!, 'account_name', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Account Number *</Label>
                        <Input
                          value={account.account_number}
                          onChange={(e) => updateAccount(account.id!, 'account_number', e.target.value)}
                          className={account.account_number ? (getValidationStatus(account.bank_name, account.account_number)?.valid ? 'border-green-500 focus-visible:ring-green-500' : 'border-destructive focus-visible:ring-destructive') : ''}
                        />
                        <ValidationIndicator bankName={account.bank_name} accountNumber={account.account_number} />
                      </div>
                      <div className="space-y-2">
                        <Label>Branch Name</Label>
                        <Input
                          value={account.branch_name}
                          onChange={(e) => updateAccount(account.id!, 'branch_name', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="mb-3 flex items-center gap-2 font-medium text-sm">
                        <CreditCard className="h-4 w-4" />
                        Mobile Money Options
                      </h4>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>M-Pesa Paybill Number</Label>
                          <Input
                            value={account.paybill_number}
                            onChange={(e) => updateAccount(account.id!, 'paybill_number', e.target.value)}
                            placeholder="e.g., 123456"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>M-Pesa Till Number</Label>
                          <Input
                            value={account.till_number}
                            onChange={(e) => updateAccount(account.id!, 'till_number', e.target.value)}
                            placeholder="e.g., 789012"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="flex gap-2">
                        {!account.is_default && (
                          <Button variant="outline" size="sm" onClick={() => handleSetDefault(account.id!)}>
                            <Star className="h-4 w-4 mr-2" />
                            Set as Default
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(account.id!)}
                          disabled={deleting === account.id}
                        >
                          {deleting === account.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                      <Button onClick={() => handleSave(account)} disabled={saving === account.id} size="sm">
                        {saving === account.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Save Changes
                      </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
};
