// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import { Textarea } from '@/shared/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Switch } from '@/shared/components/ui/switch';
import { errorToast } from "@/shared/lib/errorToast";
import {
  User, Briefcase, Phone, AlertTriangle, Home,
  ShieldAlert, CheckCircle, Save, Edit2, Loader2,
  Building2, Users, Flag
} from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  unit: string | null;
  unit_id: string | null;
  property: string | null;
  property_id: string | null;
  status: string;
}

interface TenantProfileRecord {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  national_id: string | null;
  id_type: string | null;
  date_of_birth: string | null;
  gender: string | null;
  nationality: string | null;
  employment_status: string | null;
  employer_name: string | null;
  employer_phone: string | null;
  employer_address: string | null;
  occupation: string | null;
  monthly_income: number | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  previous_landlord_name: string | null;
  previous_landlord_phone: string | null;
  previous_address: string | null;
  adults_count: number;
  children_count: number;
  move_in_date: string | null;
  risk_flag: string;
  risk_reason: string | null;
}

interface UnitLinkUnit {
  unit_number: string | null;
  label: string | null;
}

interface UnitLinkProperty {
  name: string | null;
}

interface TenantUnitLink {
  id: string;
  link_type: string;
  move_in_date: string | null;
  monthly_rent: number | null;
  units: UnitLinkUnit | null;
  properties: UnitLinkProperty | null;
}

interface TenantGuarantor {
  id: string;
  name: string;
  phone: string;
  relationship: string | null;
  guarantee_type: string;
  guarantee_amount: number | null;
}

interface SelectOption {
  value: string;
  label: string;
}

interface FieldProps {
  label: string;
  field: keyof TenantProfileRecord;
  type?: string;
  disabled?: boolean;
}

interface SelectFieldProps {
  label: string;
  field: keyof TenantProfileRecord;
  options: SelectOption[];
}

interface TenantProfilePanelProps {
  tenant: Tenant;
  onUpdate?: () => void;
}


interface FieldRenderProps extends FieldProps {
  editing: boolean;
  form: Partial<TenantProfileRecord>;
  profile: TenantProfileRecord | undefined;
  onChange: (field: keyof TenantProfileRecord) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

function Field({ label, field, type = 'text', disabled = false, editing, form, profile, onChange }: FieldRenderProps) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {editing && !disabled ? (
        <Input type={type} value={String(form[field] ?? '')} onChange={onChange(field)} className="mt-1 h-8 text-sm" />
      ) : (
        <p className="text-sm mt-0.5 font-medium">{String(profile?.[field] || ''  ) || <span className="text-muted-foreground">—</span>}</p>
      )}
    </div>
  );
}

interface SelectFieldRenderProps extends SelectFieldProps {
  editing: boolean;
  form: Partial<TenantProfileRecord>;
   
  profile: TenantProfileRecord | undefined;
  onSelect: (field: keyof TenantProfileRecord, value: string) => void;
}

function SelectField({ label, field, options, editing, form, profile, onSelect }: SelectFieldRenderProps) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {editing ? (
        <Select value={String(form[field] ?? '')} onValueChange={v => onSelect(field, v)}>
          <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>{options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      ) : (
        <p className="text-sm mt-0.5 font-medium">{options.find(o => o.value === profile?.[field])?.label || String(profile?.[field] || '') || <span className="text-muted-foreground">—</span>}</p>
      )}
    </div>
  );
}

const RISK_COLORS: Record<string, string> = {
  clear:       'bg-green-100 text-green-800 border-green-200',
  caution:     'bg-amber-100 text-amber-800 border-amber-200',
  blacklisted: 'bg-red-100 text-red-800 border-red-200',
};

const TenantProfilePanel: React.FC<TenantProfilePanelProps> = ({ tenant, onUpdate }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  // Fetch extended profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ['tenant-extended-profile', tenant.id],
    queryFn: async () => {
      const { data } = await supabase.from('tenants').select('*').eq('id', tenant.id).single();
      return data as TenantProfileRecord;
    },
  });

  const [form, setForm] = useState<Partial<TenantProfileRecord>>({});

  React.useEffect(() => {
    if (profile) setForm(profile);
  }, [profile?.id, profile?.updated_at]);

  const f = (k: keyof TenantProfileRecord) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p: Partial<TenantProfileRecord>) => ({ ...p, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: async () => {
      const updates: Partial<TenantProfileRecord> = {
        national_id:                  form.national_id,
        id_type:                      form.id_type,
        date_of_birth:                form.date_of_birth || null,
        gender:                       form.gender,
        nationality:                  form.nationality,
        employment_status:            form.employment_status,
        employer_name:                form.employer_name,
        employer_phone:               form.employer_phone,
        employer_address:             form.employer_address,
        occupation:                   form.occupation,
        monthly_income:               form.monthly_income ? Number(form.monthly_income) : null,
        emergency_contact_name:       form.emergency_contact_name,
        emergency_contact_phone:      form.emergency_contact_phone,
        emergency_contact_relationship: form.emergency_contact_relationship,
        previous_landlord_name:       form.previous_landlord_name,
        previous_landlord_phone:      form.previous_landlord_phone,
        previous_address:             form.previous_address,
        adults_count:                 form.adults_count ? Number(form.adults_count) : 1,
        children_count:               form.children_count ? Number(form.children_count) : 0,
        risk_flag:                    form.risk_flag || 'clear',
        risk_reason:                  form.risk_reason,
      };
      const { error } = await supabase.rpc('update_tenant_profile_atomic' as any, { p_tenant_id: tenant.id, p_payload: updates });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Profile updated' });
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['tenant-extended-profile', tenant.id] });
      onUpdate?.();
    },
    onError: (err: Error) => errorToast('Failed', err),
  });

  // Fetch multi-unit links
  const { data: unitLinks = [] } = useQuery({
    queryKey: ['tenant-unit-links', tenant.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('tenant_unit_links')
        .select('*, units(unit_number, label), properties(name)')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true);
      return (data || []) as TenantUnitLink[];
    },
  });

  // Fetch guarantors
  const { data: guarantors = [] } = useQuery({
    queryKey: ['tenant-guarantors', tenant.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('tenant_guarantors')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true);
      return (data || []) as TenantGuarantor[];
    },
  });

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {profile?.risk_flag && profile.risk_flag !== 'clear' && (
            <Badge className={`text-xs ${RISK_COLORS[profile.risk_flag]}`}>
              <ShieldAlert className="h-3 w-3 mr-1" />
              {profile.risk_flag.charAt(0).toUpperCase() + profile.risk_flag.slice(1)}
            </Badge>
          )}
          {profile?.risk_flag === 'clear' && (
            <Badge className="text-xs bg-green-100 text-green-800 border-green-200">
              <CheckCircle className="h-3 w-3 mr-1" />Clear
            </Badge>
          )}
        </div>
        <Button
          size="sm" variant={editing ? 'default' : 'outline'}
          onClick={() => editing ? save.mutate() : setEditing(true)}
          disabled={save.isPending}
        >
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : editing ? <Save className="h-4 w-4 mr-2" /> : <Edit2 className="h-4 w-4 mr-2" />}
          {editing ? 'Save changes' : 'Edit profile'}
        </Button>
      </div>

      <Tabs defaultValue="identity">
        <TabsList className="flex-wrap h-auto gap-1 p-1 text-xs">
          <TabsTrigger value="identity" className="gap-1 text-xs"><User className="h-3 w-3" />Identity</TabsTrigger>
          <TabsTrigger value="employment" className="gap-1 text-xs"><Briefcase className="h-3 w-3" />Employment</TabsTrigger>
          <TabsTrigger value="emergency" className="gap-1 text-xs"><Phone className="h-3 w-3" />Emergency</TabsTrigger>
          <TabsTrigger value="occupancy" className="gap-1 text-xs"><Home className="h-3 w-3" />Occupancy</TabsTrigger>
          <TabsTrigger value="risk" className="gap-1 text-xs"><Flag className="h-3 w-3" />Risk & ref</TabsTrigger>
          {unitLinks.length > 0 && <TabsTrigger value="units" className="gap-1 text-xs"><Building2 className="h-3 w-3" />Units ({unitLinks.length})</TabsTrigger>}
          {guarantors.length > 0 && <TabsTrigger value="guarantors" className="gap-1 text-xs"><Users className="h-3 w-3" />Guarantors ({guarantors.length})</TabsTrigger>}
        </TabsList>

        {/* ── Identity ── */}
        <TabsContent value="identity" className="mt-4">
          <Card><CardContent className="p-4 grid grid-cols-2 gap-4">
            <Field editing={editing} form={form} profile={profile} onChange={f} label="Full name" field="name" disabled />
            <Field editing={editing} form={form} profile={profile} onChange={f} label="Email" field="email" disabled />
            <Field editing={editing} form={form} profile={profile} onChange={f} label="Phone" field="phone" />
            <Field editing={editing} form={form} profile={profile} onChange={f} label="WhatsApp" field="whatsapp" />
            <SelectField editing={editing} form={form} profile={profile} onSelect={(field, v) => setForm(p => ({ ...p, [field]: v }))} label="ID type" field="id_type" options={[
              { value: 'national_id', label: 'National ID' },
              { value: 'passport', label: 'Passport' },
              { value: 'alien_id', label: 'Alien ID' },
              { value: 'driving_license', label: "Driver's Licence" },
            ]} />
            <Field editing={editing} form={form} profile={profile} onChange={f} label="ID number" field="national_id" />
            <Field editing={editing} form={form} profile={profile} onChange={f} label="Date of birth" field="date_of_birth" type="date" />
            <SelectField editing={editing} form={form} profile={profile} onSelect={(field, v) => setForm(p => ({ ...p, [field]: v }))} label="Gender" field="gender" options={[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
              { value: 'other', label: 'Other' },
            ]} />
            <Field editing={editing} form={form} profile={profile} onChange={f} label="Nationality" field="nationality" />
          </CardContent></Card>
        </TabsContent>

        {/* ── Employment ── */}
        <TabsContent value="employment" className="mt-4">
          <Card><CardContent className="p-4 grid grid-cols-2 gap-4">
            <SelectField editing={editing} form={form} profile={profile} onSelect={(field, v) => setForm(p => ({ ...p, [field]: v }))} label="Employment status" field="employment_status" options={[
              { value: 'employed', label: 'Employed' },
              { value: 'self_employed', label: 'Self-employed' },
              { value: 'student', label: 'Student' },
              { value: 'retired', label: 'Retired' },
              { value: 'unemployed', label: 'Unemployed' },
            ]} />
            <Field editing={editing} form={form} profile={profile} onChange={f} label="Occupation / Job title" field="occupation" />
            <Field editing={editing} form={form} profile={profile} onChange={f} label="Employer / Company name" field="employer_name" />
            <Field editing={editing} form={form} profile={profile} onChange={f} label="Employer phone" field="employer_phone" />
            <div className="col-span-2">
              <Field editing={editing} form={form} profile={profile} onChange={f} label="Employer address" field="employer_address" />
            </div>
            <Field editing={editing} form={form} profile={profile} onChange={f} label="Monthly income (KES)" field="monthly_income" type="number" />
          </CardContent></Card>
        </TabsContent>

        {/* ── Emergency contact ── */}
        <TabsContent value="emergency" className="mt-4">
          <Card><CardContent className="p-4 grid grid-cols-2 gap-4">
            <Field editing={editing} form={form} profile={profile} onChange={f} label="Emergency contact name" field="emergency_contact_name" />
            <Field editing={editing} form={form} profile={profile} onChange={f} label="Phone" field="emergency_contact_phone" />
            <Field editing={editing} form={form} profile={profile} onChange={f} label="Relationship" field="emergency_contact_relationship" />
          </CardContent></Card>
        </TabsContent>

        {/* ── Occupancy details ── */}
        <TabsContent value="occupancy" className="mt-4">
          <Card><CardContent className="p-4 grid grid-cols-2 gap-4">
            <Field editing={editing} form={form} profile={profile} onChange={f} label="Number of adults" field="adults_count" type="number" />
            <Field editing={editing} form={form} profile={profile} onChange={f} label="Number of children" field="children_count" type="number" />
            <Field editing={editing} form={form} profile={profile} onChange={f} label="Move-in date" field="move_in_date" type="date" disabled />
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground">Previous address</Label>
              {editing ? (
                <Input value={form.previous_address ?? ''} onChange={f('previous_address')} className="mt-1 h-8 text-sm" />
              ) : (
                <p className="text-sm mt-0.5 font-medium">{profile?.previous_address || <span className="text-muted-foreground">—</span>}</p>
              )}
            </div>
            <Field editing={editing} form={form} profile={profile} onChange={f} label="Previous landlord name" field="previous_landlord_name" />
            <Field editing={editing} form={form} profile={profile} onChange={f} label="Previous landlord phone" field="previous_landlord_phone" />
          </CardContent></Card>
        </TabsContent>

        {/* ── Risk & Reference ── */}
        <TabsContent value="risk" className="mt-4">
          <Card><CardContent className="p-4 space-y-4">
            <SelectField editing={editing} form={form} profile={profile} onSelect={(field, v) => setForm(p => ({ ...p, [field]: v }))} label="Risk status" field="risk_flag" options={[
              { value: 'clear', label: '✓ Clear — no issues' },
              { value: 'caution', label: '⚠ Caution — monitor' },
              { value: 'blacklisted', label: '✗ Blacklisted — do not rent' },
            ]} />
            <div>
              <Label className="text-xs text-muted-foreground">Risk reason / notes</Label>
              {editing ? (
                <Textarea value={form.risk_reason ?? ''} onChange={f('risk_reason')} rows={3} className="mt-1 text-sm resize-none" />
              ) : (
                <p className="text-sm mt-0.5">{profile?.risk_reason || <span className="text-muted-foreground">—</span>}</p>
              )}
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* ── Multiple units ── */}
        {unitLinks.length > 0 && (
          <TabsContent value="units" className="mt-4">
            <div className="space-y-3">
              {unitLinks.map(link => (
                <Card key={link.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {link.units?.label || link.units?.unit_number} — {link.properties?.name}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">{link.link_type} unit</p>
                      {link.move_in_date && <p className="text-xs text-muted-foreground">Since {link.move_in_date}</p>}
                    </div>
                    {link.monthly_rent && (
                      <p className="text-sm font-semibold">
                        KES {Number(link.monthly_rent).toLocaleString()}/mo
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        )}

        {/* ── Guarantors ── */}
        {guarantors.length > 0 && (
          <TabsContent value="guarantors" className="mt-4">
            <div className="space-y-3">
              {guarantors.map(g => (
                <Card key={g.id}>
                  <CardContent className="p-4 grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground text-xs">Name</span><p className="font-medium">{g.name}</p></div>
                    <div><span className="text-muted-foreground text-xs">Phone</span><p className="font-medium">{g.phone}</p></div>
                    <div><span className="text-muted-foreground text-xs">Relationship</span><p>{g.relationship || '—'}</p></div>
                    <div><span className="text-muted-foreground text-xs">Type</span><p className="capitalize">{g.guarantee_type}</p></div>
                    {g.guarantee_amount && <div className="col-span-2"><span className="text-muted-foreground text-xs">Guarantee covers up to</span><p className="font-semibold text-foreground">KES {Number(g.guarantee_amount).toLocaleString()}</p></div>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default TenantProfilePanel;
