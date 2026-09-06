// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Save, Loader2, Smartphone, Landmark, Shield, CheckCircle } from 'lucide-react';
import { errorToast } from "@/shared/lib/errorToast";

const BANKS = [
  'Equity Bank', 'KCB Bank', 'NCBA Bank', 'Co-operative Bank',
  'ABSA Bank Kenya', 'Stanbic Bank', 'Standard Chartered', 'Citibank',
  'Bank of Africa', 'Diamond Trust Bank', 'Family Bank', 'I&M Bank',
  'Middle East Bank', 'National Bank of Kenya', 'Prime Bank', 'Sidian Bank',
];

const LandlordBankDetails: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    mpesa_number:        '',
    mpesa_name:          '',
    bank_name:           '',
    bank_account_number: '',
    bank_account_name:   '',
    bank_branch:         '',
    bank_code:           '',
    preferred_method:    'mpesa',
    minimum_payout:      '',
    auto_request:        false,
    auto_request_day:    '5',
    kra_pin:             '',
    vat_registered:      false,
    vat_number:          '',
  });

  const { data: details, isLoading } = useQuery({
    queryKey: ['landlord-bank-details', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('landlord_bank_details')
        .select('*')
        .eq('landlord_user_id', user!.id)
        .maybeSingle();
      return data as Record<string, unknown>;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (details) {
      setForm({
        mpesa_number:        details.mpesa_number ?? '',
        mpesa_name:          details.mpesa_name ?? '',
        bank_name:           details.bank_name ?? '',
        bank_account_number: details.bank_account_number ?? '',
        bank_account_name:   details.bank_account_name ?? '',
        bank_branch:         details.bank_branch ?? '',
        bank_code:           details.bank_code ?? '',
        preferred_method:    details.preferred_method ?? 'mpesa',
        minimum_payout:      details.minimum_payout ? String(details.minimum_payout) : '',
        auto_request:        details.auto_request ?? false,
        auto_request_day:    String(details.auto_request_day ?? 5),
        kra_pin:             details.kra_pin ?? '',
        vat_registered:      details.vat_registered ?? false,
        vat_number:          details.vat_number ?? '',
      });
    }
  }, [details]);

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('save_landlord_bank_details_atomic', {
        p_mpesa_number: form.mpesa_number || null, p_mpesa_name: form.mpesa_name || null,
        p_bank_name: form.bank_name || null, p_bank_account_number: form.bank_account_number || null,
        p_bank_account_name: form.bank_account_name || null, p_bank_branch: form.bank_branch || null,
        p_bank_code: form.bank_code || null, p_preferred_method: form.preferred_method,
        p_minimum_payout: form.minimum_payout ? Number(form.minimum_payout) : 0,
        p_auto_request: form.auto_request, p_auto_request_day: Number(form.auto_request_day),
        p_kra_pin: form.kra_pin || null, p_vat_registered: form.vat_registered, p_vat_number: form.vat_number || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landlord-bank-details'] });
      toast({ title: 'Bank details saved', description: 'Your payout details have been updated.' });
    },
    onError: (err: Error) => errorToast('Failed', err),
  });

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;

  return (
    <div className="space-y-6">
      {details?.verified && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
          <CheckCircle className="h-4 w-4" />
          Bank details verified by your property manager
        </div>
      )}

      {/* Preferred method */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Preferred payout method</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'mpesa',        label: 'M-Pesa',       icon: Smartphone },
              { value: 'bank_transfer',label: 'Bank Transfer', icon: Landmark },
              { value: 'cheque',       label: 'Cheque',        icon: Shield },
            ].map(m => (
              <button
                key={m.value} type="button"
                onClick={() => setForm(p => ({ ...p, preferred_method: m.value }))}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                  form.preferred_method === m.value
                    ? 'border-amber-400/50 bg-amber-400/8 ring-1 ring-amber-400'
                    : 'border-border hover:border-amber-400/40'
                }`}
              >
                <m.icon className={`h-5 w-5 ${form.preferred_method === m.value ? 'text-warning' : 'text-muted-foreground'}`} />
                <span className={`text-xs font-medium ${form.preferred_method === m.value ? 'text-warning' : 'text-muted-foreground'}`}>{m.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* M-Pesa details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-green-600" />
            M-Pesa details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">M-Pesa phone number</Label>
            <Input value={form.mpesa_number} onChange={f('mpesa_number')} placeholder="0712 345 678" className="mt-1 font-mono" />
          </div>
          <div>
            <Label className="text-xs">Name as registered on M-Pesa</Label>
            <Input value={form.mpesa_name} onChange={f('mpesa_name')} placeholder="Full name" className="mt-1" />
          </div>
        </CardContent>
      </Card>

      {/* Bank details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Landmark className="h-4 w-4 text-[hsl(214_73%_45%)]" />
            Bank account details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Bank name</Label>
            <Select value={form.bank_name} onValueChange={v => setForm(p => ({ ...p, bank_name: v }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select bank" /></SelectTrigger>
              <SelectContent>
                {BANKS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Account number</Label>
            <Input value={form.bank_account_number} onChange={f('bank_account_number')} placeholder="0123456789" className="mt-1 font-mono" />
          </div>
          <div>
            <Label className="text-xs">Account name</Label>
            <Input value={form.bank_account_name} onChange={f('bank_account_name')} placeholder="As on bank account" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Branch</Label>
            <Input value={form.bank_branch} onChange={f('bank_branch')} placeholder="e.g. Westlands" className="mt-1" />
          </div>
        </CardContent>
      </Card>

      {/* Payout preferences */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Payout preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Minimum payout amount (KES)</Label>
              <Input type="number" value={form.minimum_payout} onChange={f('minimum_payout')} placeholder="0 = no minimum" className="mt-1" />
            </div>
          </div>
          <div className="flex items-center justify-between py-1">
            <div>
              <Label className="text-sm">Auto-request payout monthly</Label>
              <p className="text-xs text-muted-foreground">Automatically submit a payout request each month</p>
            </div>
            <Switch checked={form.auto_request} onCheckedChange={v => setForm(p => ({ ...p, auto_request: v }))} />
          </div>
          {form.auto_request && (
            <div>
              <Label className="text-xs">Request on day of month</Label>
              <Input type="number" min="1" max="28" value={form.auto_request_day} onChange={f('auto_request_day')} className="mt-1 w-24" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tax info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Tax information</CardTitle>
          <CardDescription>Required for proper payout documentation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">KRA PIN</Label>
            <Input value={form.kra_pin} onChange={f('kra_pin')} placeholder="A000000000B" className="mt-1 uppercase font-mono" />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">VAT registered</Label>
            <Switch checked={form.vat_registered} onCheckedChange={v => setForm(p => ({ ...p, vat_registered: v }))} />
          </div>
          {form.vat_registered && (
            <div>
              <Label className="text-xs">VAT number</Label>
              <Input value={form.vat_number} onChange={f('vat_number')} className="mt-1 font-mono" />
            </div>
          )}
        </CardContent>
      </Card>

      <Button className="w-full gap-2" onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : <><Save className="h-4 w-4" />Save bank details</>}
      </Button>
    </div>
  );
};

export default LandlordBankDetails;
