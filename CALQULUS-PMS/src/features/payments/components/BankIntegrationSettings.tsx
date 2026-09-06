import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Switch } from '@/shared/components/ui/switch';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/shared/components/ui/select';
import { errorToast } from "@/shared/lib/errorToast";
import {
  Landmark, Plus, Trash2, Copy, CheckCircle,
  Loader2, Zap
} from 'lucide-react';

const BANKS = [
  { value: 'equity',  label: 'Equity Bank' },
  { value: 'kcb',     label: 'KCB Bank' },
  { value: 'ncba',    label: 'NCBA Bank' },
  { value: 'coop',    label: 'Co-operative Bank' },
  { value: 'absa',    label: 'ABSA Bank Kenya' },
  { value: 'stanbic', label: 'Stanbic Bank' },
  { value: 'other',   label: 'Other bank' },
];

const MATCH_BY_OPTIONS = [
  { value: 'amount_and_unit', label: 'Amount + unit number in reference' },
  { value: 'reference',       label: 'Invoice number in reference' },
  { value: 'amount_only',     label: 'Amount only (use with care)' },
  { value: 'manual',          label: 'Manual only (no auto-matching)' },
];

interface BankIntegration {
  id: string;
  bank_name: string;
  property_id: string | null;
  account_number: string | null;
  account_name: string | null;
  is_active: boolean;
  auto_reconcile: boolean;
  match_by: string;
  paybill_number: string | null;
}

const BankIntegrationSettings: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState<string | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, string>>({});
  const [secretBusy, setSecretBusy] = useState<string | null>(null);

  const [form, setForm] = useState({
    property_id: '' as string,
    bank_name: '',
    account_number: '',
    account_name: '',
    paybill_number: '',
    webhook_secret: crypto.randomUUID().replace(/-/g, '').slice(0, 24),
    auto_reconcile: true,
    match_by: 'amount_and_unit',
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['bank-integration-properties', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('properties')
        .select('id, name')
        .eq('manager_id', user!.id)
        .order('name');
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';

  const webhookUrl = (bankName: string, managerId: string) =>
    `${SUPABASE_URL}/functions/v1/bank-webhook?manager_id=${managerId}&bank=${bankName}`;

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ['bank-integrations', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_integration_settings')
        .select('id, bank_name, property_id, account_number, account_name, is_active, auto_reconcile, match_by, paybill_number')
        .eq('manager_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as BankIntegration[];
    },
    enabled: !!user?.id,
  });

  const { data: unmatchedCount } = useQuery({
    queryKey: ['unmatched-bank-tx-count', user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('bank_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('manager_id', user!.id)
        .eq('matched', false);
      return count ?? 0;
    },
    enabled: !!user?.id,
  });

  const createIntegration = useMutation({
    mutationFn: async () => {
      if (!form.bank_name) throw new Error('Select a bank');
      const { data: result, error } = await supabase.rpc('create_bank_integration_atomic', {
        p_manager_id: user!.id,
        p_bank_name: form.bank_name,
        p_account_number: form.account_number || null,
        p_account_name: form.account_name || null,
        p_paybill_number: form.paybill_number || null,
        p_webhook_secret: form.webhook_secret,
        p_auto_reconcile: form.auto_reconcile,
        p_match_by: form.match_by,
        p_property_id: form.property_id && form.property_id !== 'default' ? form.property_id : null,
      });
      if (error) throw error;
      if (!result?.success) throw new Error('Bank integration creation did not complete');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-integrations'] });
      toast({ title: 'Bank integration added' });
      setDialogOpen(false);
      setForm(f => ({
        ...f,
        property_id: '',
        bank_name: '',
        account_number: '',
        account_name: '',
        paybill_number: '',
        webhook_secret: crypto.randomUUID().replace(/-/g, '').slice(0, 24),
      }));
    },
    onError: (err: Error) => errorToast('Failed', err),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { data: result, error } = await supabase.rpc('set_bank_integration_active_atomic', {
        p_bank_integration_id: id,
        p_is_active: active,
      });
      if (error) throw error;
      if (!result?.success) throw new Error('Bank integration status update did not complete');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bank-integrations'] }),
    onError: (err: Error) => errorToast('Failed', err),
  });

  const revealSecret = async (id: string) => {
    setSecretBusy(id);
    try {
      const { data, error } = await supabase.rpc('get_bank_webhook_secret_atomic', {
        p_bank_integration_id: id,
      });
      if (error) throw error;
      const secret = data?.webhook_secret as string | undefined;
      if (!secret) throw new Error('Webhook secret was not returned');
      setRevealedSecrets(prev => ({ ...prev, [id]: secret }));
    } catch (err) {
      errorToast('Failed to reveal webhook secret', err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setSecretBusy(null);
    }
  };

  const rotateSecret = async (id: string) => {
    setSecretBusy(id);
    try {
      const { data, error } = await supabase.rpc('rotate_bank_webhook_secret_atomic', {
        p_bank_integration_id: id,
      });
      if (error) throw error;
      const secret = data?.webhook_secret as string | undefined;
      if (!secret) throw new Error('New webhook secret was not returned');
      setRevealedSecrets(prev => ({ ...prev, [id]: secret }));
      toast({ title: 'Webhook secret rotated', description: 'Update your bank webhook configuration with the new secret.' });
    } catch (err) {
      errorToast('Failed to rotate webhook secret', err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setSecretBusy(null);
    }
  };

  const deleteIntegration = useMutation({
    mutationFn: async (id: string) => {
      const { data: result, error } = await supabase.rpc('delete_bank_integration_atomic', {
        p_bank_integration_id: id,
      });
      if (error) throw error;
      if (!result?.success) throw new Error('Bank integration removal did not complete');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-integrations'] });
      toast({ title: 'Integration removed' });
    },
    onError: (err: Error) => errorToast('Failed', err),
  });

  const copyWebhook = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedWebhook(id);
    setTimeout(() => setCopiedWebhook(null), 2000);
    toast({ title: 'Webhook URL copied' });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Landmark className="h-4 w-4" />
              Bank integrations
            </CardTitle>
            <CardDescription>
              Per-property bank webhooks — link each property to its own account, or use company default.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {unmatchedCount !== undefined && unmatchedCount > 0 && (
              <Badge variant="outline" className="border-amber-300 text-warning bg-amber-50">
                {unmatchedCount} unmatched
              </Badge>
            )}
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add bank
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
            <p className="font-medium mb-1 flex items-center gap-1"><Zap className="h-3.5 w-3.5" />How bank integration works</p>
            <p>Your bank sends a real-time notification to your CALQULUS PMS webhook URL whenever a payment lands. CALQULUS PMS matches it to a pending invoice by amount + unit number in the reference, marks it paid, and sends the tenant a receipt — instantly, with no manual work.</p>
          </div>

          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : integrations.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Landmark className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No bank integrations yet</p>
              <p className="text-xs mt-1 opacity-70">Add your bank to start receiving automatic payment notifications</p>
            </div>
          ) : (
            <div className="space-y-3">
              {integrations.map((intg: BankIntegration) => {
                const wUrl = webhookUrl(intg.bank_name, user!.id);
                return (
                  <div key={intg.id} className="p-4 rounded-lg border border-border bg-muted/20">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Landmark className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">
                          {BANKS.find(b => b.value === intg.bank_name)?.label ?? intg.bank_name}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {intg.property_id
                            ? properties.find((p) => p.id === intg.property_id)?.name ?? 'Property'
                            : 'Company default'}
                        </Badge>
                        {intg.account_number && (
                          <span className="text-xs text-muted-foreground">·{intg.account_number}</span>
                        )}
                        <Badge variant={intg.is_active ? 'default' : 'secondary'} className="text-xs">
                          {intg.is_active ? 'Active' : 'Paused'}
                        </Badge>
                        {intg.auto_reconcile && (
                          <Badge variant="outline" className="text-xs border-green-300 text-green-700 bg-green-50">
                            Auto-reconcile
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={intg.is_active}
                          onCheckedChange={v => toggleActive.mutate({ id: intg.id, active: v })}
                        />
                        <Button
                          variant="ghost" size="icon"
                          aria-label="Delete integration"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => deleteIntegration.mutate(intg.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground mb-1">Configure your bank to send payment notifications to this URL:</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs bg-background border border-border rounded px-2 py-1.5 truncate text-muted-foreground">
                          {wUrl}
                        </code>
                        <Button
                          variant="outline" size="sm"
                          className="h-7 shrink-0"
                          onClick={() => copyWebhook(wUrl, intg.id)}
                        >
                          {copiedWebhook === intg.id
                            ? <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                            : <Copy className="h-3.5 w-3.5" />
                          }
                        </Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>Required header:</span>
                        {revealedSecrets[intg.id] ? (
                          <code className="bg-background border border-border rounded px-1.5 py-1">x-webhook-secret: {revealedSecrets[intg.id]}</code>
                        ) : (
                          <span className="font-medium">Secret hidden</span>
                        )}
                        <Button variant="outline" size="sm" className="h-7" disabled={secretBusy === intg.id} onClick={() => revealSecret(intg.id)}>
                          {secretBusy === intg.id ? <Loader2 className="h-3.5 w-3.5 mr-1" /> : null}
                          {revealedSecrets[intg.id] ? 'Reveal again' : 'Reveal secret'}
                        </Button>
                        <Button variant="outline" size="sm" className="h-7" disabled={secretBusy === intg.id} onClick={() => rotateSecret(intg.id)}>
                          Rotate
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Match strategy: <span className="font-medium">{MATCH_BY_OPTIONS.find(m => m.value === intg.match_by)?.label}</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add bank dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add bank integration</DialogTitle>
            <DialogDescription>
              Connect a bank account to auto-capture rent payments via webhook.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Property scope</Label>
              <Select
                value={form.property_id || 'default'}
                onValueChange={(v) => setForm((f) => ({ ...f, property_id: v }))}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Company default (all properties without own bank)</SelectItem>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bank</Label>
              <Select value={form.bank_name} onValueChange={v => setForm(f => ({ ...f, bank_name: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select your bank" /></SelectTrigger>
                <SelectContent>
                  {BANKS.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Account number</Label>
                <Input value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Account name</Label>
                <Input value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Paybill number (optional)</Label>
              <Input value={form.paybill_number} onChange={e => setForm(f => ({ ...f, paybill_number: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Auto-reconciliation matching strategy</Label>
              <Select value={form.match_by} onValueChange={v => setForm(f => ({ ...f, match_by: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MATCH_BY_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-reconcile payments</Label>
                <p className="text-xs text-muted-foreground">Automatically match and process payments without manual review</p>
              </div>
              <Switch
                checked={form.auto_reconcile}
                onCheckedChange={v => setForm(f => ({ ...f, auto_reconcile: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => createIntegration.mutate()} disabled={createIntegration.isPending || !form.bank_name}>
              {createIntegration.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Add integration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BankIntegrationSettings;
