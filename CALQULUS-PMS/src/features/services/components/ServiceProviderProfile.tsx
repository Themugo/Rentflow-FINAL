// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/shared/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Switch } from '@/shared/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Separator } from '@/shared/components/ui/separator';
import { errorToast } from "@/shared/lib/errorToast";
import {
  Plus, Save, Trash2, Star, CheckCircle, Briefcase,
  Phone, MapPin, Clock, Loader2, AlertTriangle, ToggleRight
} from 'lucide-react';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-KE', { minimumFractionDigits: 0 }).format(n);

const RATE_TYPES = [
  { value: 'per_job',    label: 'Per job / call-out' },
  { value: 'per_hour',   label: 'Per hour' },
  { value: 'per_day',    label: 'Per day' },
  { value: 'fixed',      label: 'Fixed price' },
  { value: 'quote_only', label: 'Quote on request' },
];

const COUNTIES = [
  'Nairobi','Mombasa','Kisumu','Nakuru','Eldoret','Kiambu','Machakos',
  'Kajiado','Nyeri','Meru','Embu','Thika','Kisii','Kakamega','Mombasa',
];

const ServiceProviderProfile: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Profile form
  const [form, setForm] = useState({
    business_name: '', contact_name: '', phone: '', whatsapp: '',
    email: '', bio: '', county: '', town: '',
    service_radius_km: '20', response_time_hrs: '24', is_available: true,
  });
  const [providerId, setProviderId] = useState<string | null>(null);

  // Rate card entries being edited
  const [rateEntries, setRateEntries] = useState<Array<{
    id?: string; category_key: string; rate_type: string;
    rate_min: string; rate_max: string; rate_notes: string;
  }>>([]);

  // Fetch existing provider profile
  const { data: provider, isLoading } = useQuery({
    queryKey: ['my-provider-profile', user?.id],
    queryFn: async () => {
      const { data } = await (supabase.from('service_providers')
        .select(`*, provider_services(*, service_categories(key, name, group_name))`)
        .eq('user_id', user!.id).maybeSingle());
      return data as {
        id: string; business_name: string | null; contact_name: string | null;
        phone: string | null; whatsapp: string | null; email: string | null;
        bio: string | null; county: string | null; town: string | null;
        service_radius_km: number | null; response_time_hrs: number | null;
        is_available: boolean | null; provider_services: {
          id: string; category_key: string; rate_type: string | null;
          rate_min: number | null; rate_max: number | null; rate_notes: string | null;
          service_categories: { key: string; name: string; group_name: string | null; } | null;
        }[];
      } | null;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (provider) {
      setProviderId(provider.id);
      setForm({
        business_name:     provider.business_name || '',
        contact_name:      provider.contact_name || '',
        phone:             provider.phone || '',
        whatsapp:          provider.whatsapp || '',
        email:             provider.email || '',
        bio:               provider.bio || '',
        county:            provider.county || '',
        town:              provider.town || '',
        service_radius_km: String(provider.service_radius_km || 20),
        response_time_hrs: String(provider.response_time_hrs || 24),
        is_available:      provider.is_available ?? true,
      });
      if (provider.provider_services) {
        setRateEntries(provider.provider_services.map((s: {
          id: string; category_key: string; rate_type: string | null;
          rate_min: number | null; rate_max: number | null; rate_notes: string | null;
        }) => ({
          id:           s.id,
          category_key: s.category_key,
          rate_type:    s.rate_type || 'per_job',
          rate_min:     String(s.rate_min || ''),
          rate_max:     String(s.rate_max || ''),
          rate_notes:   s.rate_notes || '',
        })));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider?.id, provider?.updated_at]);

  // Categories for picker
  const { data: categories = [] } = useQuery({
    queryKey: ['service-categories-list'],
    queryFn: async () => {
      const { data } = await (supabase.from('service_categories')
        .select('key, name, group_name').order('group_name,display_order'));
      return (data || []) as { key: string; name: string; group_name: string | null; }[];
    },
  });

  // Save profile
  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!form.business_name.trim()) throw new Error('Business name is required');

      const { data, error } = await supabase.rpc('save_service_provider_profile_atomic', {
        p_payload: {
          business_name: form.business_name.trim(),
          contact_name: form.contact_name || null,
          phone: form.phone || null,
          whatsapp: form.whatsapp || null,
          email: form.email || null,
          bio: form.bio || null,
          county: form.county || null,
          town: form.town || null,
          service_radius_km: parseInt(form.service_radius_km) || 20,
          response_time_hrs: parseInt(form.response_time_hrs) || 24,
          is_available: form.is_available,
        },
      });
      if (error) throw error;
      const id = (data as { provider_id: string }).provider_id;
      setProviderId(id);
      return id;
    },
    onSuccess: (id) => {
      toast({ title: 'Profile saved' });
      queryClient.invalidateQueries({ queryKey: ['my-provider-profile'] });
      // Now save rate card
      if (id) saveRateCard.mutate(id);
    },
    onError: (e: Error) => errorToast('Save failed', e),
  });

  // Save rate card
  const saveRateCard = useMutation({
    mutationFn: async (pid: string) => {
      for (const entry of rateEntries) {
        if (!entry.category_key) continue;
        const row = {
          provider_id:  pid,
          category_key: entry.category_key,
          rate_type:    entry.rate_type || 'per_job',
          rate_min:     entry.rate_min ? parseFloat(entry.rate_min) : null,
          rate_max:     entry.rate_max ? parseFloat(entry.rate_max) : null,
          rate_notes:   entry.rate_notes || null,
        };
        const { error } = await supabase.rpc('save_provider_service_atomic', {
          p_provider_id: pid,
          p_payload: row,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-provider-profile'] }),
    onError: (e: Error) => errorToast('Rate card save failed', e),
  });

  const deleteService = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_provider_service_atomic', { p_provider_service_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-provider-profile'] });
      setRateEntries(p => p.filter(e => e.id !== undefined));
    },
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      {/* Status banner */}
      {!provider && (
        <div className="rounded-xl border border-amber-300/50 bg-amber-50/20 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Complete your provider profile</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Fill in your details and rate card to appear in the service marketplace.
                Managers and tenants can then find and hire you for maintenance jobs.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Availability toggle */}
      {provider && (
        <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${form.is_available ? 'bg-green-500' : 'bg-slate-400'}`} />
            <div>
              <p className="font-medium text-sm">
                {form.is_available ? 'Available for new jobs' : 'Currently unavailable'}
              </p>
              <p className="text-xs text-muted-foreground">
                {form.is_available ? 'You appear in search results' : 'Hidden from new clients'}
              </p>
            </div>
          </div>
          <Switch
            checked={form.is_available}
            onCheckedChange={v => {
              setForm(p => ({ ...p, is_available: v }));
              if (providerId) {
                supabase.rpc('save_service_provider_profile_atomic', {
                  p_payload: { ...form, is_available: v, service_radius_km: parseInt(form.service_radius_km) || 20, response_time_hrs: parseInt(form.response_time_hrs) || 24 },
                }).then(({ error }) => {
                  if (error) errorToast('Availability update failed', error);
                  else queryClient.invalidateQueries({ queryKey: ['my-provider-profile'] });
                });
              }
            }}
          />
        </div>
      )}

      {/* Stats row */}
      {provider && (
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: 'Rating', value: provider.rating_count > 0 ? `${Number(provider.rating_avg).toFixed(1)} ★` : 'No ratings yet' },
            { label: 'Reviews', value: String(provider.rating_count || 0) },
            { label: 'Jobs done', value: String(provider.jobs_completed || 0) },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-border p-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="font-semibold">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Profile form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4" />Business details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Business / trading name *</Label>
            <Input value={form.business_name} onChange={e => setForm(p => ({...p, business_name: e.target.value}))}
              placeholder="e.g. Kamau Electrical Services" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Your name</Label>
              <Input value={form.contact_name} onChange={e => setForm(p => ({...p, contact_name: e.target.value}))}
                placeholder="Full name" className="mt-1" />
            </div>
            <div>
              <Label>Phone number</Label>
              <Input type="tel" value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))}
                placeholder="0712 345 678" className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>WhatsApp number</Label>
              <Input type="tel" value={form.whatsapp} onChange={e => setForm(p => ({...p, whatsapp: e.target.value}))}
                placeholder="0712 345 678" className="mt-1" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))}
                placeholder="you@email.com" className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>County</Label>
              <Select value={form.county} onValueChange={v => setForm(p => ({...p, county: v}))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select county" /></SelectTrigger>
                <SelectContent>
                  {COUNTIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Town / area</Label>
              <Input value={form.town} onChange={e => setForm(p => ({...p, town: e.target.value}))}
                placeholder="e.g. Westlands" className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Service radius (km)</Label>
              <Input type="number" value={form.service_radius_km}
                onChange={e => setForm(p => ({...p, service_radius_km: e.target.value}))}
                placeholder="20" className="mt-1" />
            </div>
            <div>
              <Label>Typical response time (hrs)</Label>
              <Input type="number" value={form.response_time_hrs}
                onChange={e => setForm(p => ({...p, response_time_hrs: e.target.value}))}
                placeholder="24" className="mt-1" />
            </div>
          </div>
          <div>
            <Label>About / Bio</Label>
            <Textarea value={form.bio} onChange={e => setForm(p => ({...p, bio: e.target.value}))}
              placeholder="Brief description of your experience, specialisations, and how you work…"
              rows={3} className="mt-1 resize-none" />
          </div>
        </CardContent>
      </Card>

      {/* Rate card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Rate card</CardTitle>
              <CardDescription>Set your prices for each service type</CardDescription>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() =>
              setRateEntries(p => [...p, { category_key: '', rate_type: 'per_job', rate_min: '', rate_max: '', rate_notes: '' }])
            }>
              <Plus className="h-3.5 w-3.5" />Add service
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {rateEntries.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Add the services you offer and your rates
            </p>
          )}
          {rateEntries.map((entry, idx) => (
            <div key={idx} className="rounded-xl border border-border p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Service</Label>
                  <Select value={entry.category_key}
                    onValueChange={v => setRateEntries(p => p.map((e, i) => i === idx ? {...e, category_key: v} : e))}>
                    <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="Select service" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c: { key: string; name: string }) => (
                        <SelectItem key={c.key} value={c.key} className="text-xs">{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Rate type</Label>
                  <Select value={entry.rate_type}
                    onValueChange={v => setRateEntries(p => p.map((e, i) => i === idx ? {...e, rate_type: v} : e))}>
                    <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RATE_TYPES.map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {entry.rate_type !== 'quote_only' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Min rate (KES)</Label>
                    <Input type="number" value={entry.rate_min}
                      onChange={e => setRateEntries(p => p.map((en, i) => i === idx ? {...en, rate_min: e.target.value} : en))}
                      placeholder="e.g. 500" className="mt-1 h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Max rate (optional)</Label>
                    <Input type="number" value={entry.rate_max}
                      onChange={e => setRateEntries(p => p.map((en, i) => i === idx ? {...en, rate_max: e.target.value} : en))}
                      placeholder="e.g. 2000" className="mt-1 h-8 text-xs" />
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Input value={entry.rate_notes}
                  onChange={e => setRateEntries(p => p.map((en, i) => i === idx ? {...en, rate_notes: e.target.value} : en))}
                  placeholder="Notes (e.g. materials extra)" className="h-7 text-xs flex-1" />
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" aria-label="Delete service"
                  onClick={() => {
                    if (entry.id) deleteService.mutate(entry.id);
                    else setRateEntries(p => p.filter((_, i) => i !== idx));
                  }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Save */}
      <Button
        onClick={() => saveProfile.mutate()}
        disabled={saveProfile.isPending || !form.business_name}
        className="w-full gap-2"
        size="lg"
      >
        {saveProfile.isPending
          ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
          : <><Save className="h-4 w-4" />Save provider profile</>
        }
      </Button>
    </div>
  );
};

export default ServiceProviderProfile;
