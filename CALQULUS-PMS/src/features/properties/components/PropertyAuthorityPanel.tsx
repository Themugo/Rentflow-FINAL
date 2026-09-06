import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/shared/hooks/use-toast';
import {
  AGENCY_SERVICE_MODELS,
  agencyServiceModelFromOperatingModel,
  getAgencyServiceModelMeta,
  OPERATING_MODELS,
  type AgencyServiceModel,
  type OperatingModel,
  paymentDestinationForModel,
} from '@/shared/constants/authorityModels';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Switch } from '@/shared/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Shield, Info } from 'lucide-react';
import { errorToast } from "@/shared/lib/errorToast";

export interface PropertyLandlordAuthorityRow {
  id: string;
  landlord_user_id: string;
  operating_model?: OperatingModel | string | null;
  payment_destination?: 'manager' | 'landlord' | null;
  revenue_share_pct?: number | null;
  management_fee_pct?: number | null;
  allows_delegated_manager?: boolean | null;
  delegated_manager_id?: string | null;
  agency_service_model?: AgencyServiceModel | string | null;
  agency_fee_model?: 'none' | 'percent_of_collections' | 'flat_monthly' | 'flat_per_invoice' | string | null;
  agency_fee_value?: number | string | null;
  agency_payment_arrangements_enabled?: boolean | null;
  agency_enforcement_enabled?: boolean | null;
  agency_service_notes?: string | null;
  agency_mandate_effective_from?: string | null;
}

interface PropertyAuthorityPanelProps {
  propertyId: string;
  link: PropertyLandlordAuthorityRow;
}

const PropertyAuthorityPanel: React.FC<PropertyAuthorityPanelProps> = ({ propertyId, link }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userRole } = useAuth();
  const isAgency = userRole?.role === 'agency';

  const [operatingModel, setOperatingModel] = useState<OperatingModel>(
    (link.operating_model as OperatingModel) || 'agency_collects_full_management',
  );
  const [revenueShare, setRevenueShare] = useState(String(link.revenue_share_pct ?? 100));
  const [mgmtFee, setMgmtFee] = useState(link.management_fee_pct != null ? String(link.management_fee_pct) : '');
  const [allowsDelegate, setAllowsDelegate] = useState(link.allows_delegated_manager ?? true);
  const [delegateEmail, setDelegateEmail] = useState('');
  const [agencyServiceModel, setAgencyServiceModel] = useState<AgencyServiceModel>(
    (link.agency_service_model as AgencyServiceModel) || agencyServiceModelFromOperatingModel(link.operating_model) || 'full_management',
  );
  const [agencyFeeModel, setAgencyFeeModel] = useState<'none' | 'percent_of_collections' | 'flat_monthly' | 'flat_per_invoice'>(
    (link.agency_fee_model as 'none' | 'percent_of_collections' | 'flat_monthly' | 'flat_per_invoice') || 'percent_of_collections',
  );
  const [agencyFeeValue, setAgencyFeeValue] = useState(link.agency_fee_value != null ? String(link.agency_fee_value) : '');
  const [paymentArrangementsEnabled, setPaymentArrangementsEnabled] = useState(link.agency_payment_arrangements_enabled ?? true);
  const [enforcementEnabled, setEnforcementEnabled] = useState(link.agency_enforcement_enabled ?? true);
  const [agencyNotes, setAgencyNotes] = useState(link.agency_service_notes ?? '');

  useEffect(() => {
    setOperatingModel((link.operating_model as OperatingModel) || 'agency_collects_full_management');
    setRevenueShare(String(link.revenue_share_pct ?? 100));
    setMgmtFee(link.management_fee_pct != null ? String(link.management_fee_pct) : '');
    setAllowsDelegate(link.allows_delegated_manager ?? true);
    setAgencyServiceModel((link.agency_service_model as AgencyServiceModel) || agencyServiceModelFromOperatingModel(link.operating_model) || 'full_management');
    setAgencyFeeModel((link.agency_fee_model as 'none' | 'percent_of_collections' | 'flat_monthly' | 'flat_per_invoice') || 'percent_of_collections');
    setAgencyFeeValue(link.agency_fee_value != null ? String(link.agency_fee_value) : '');
    setPaymentArrangementsEnabled(link.agency_payment_arrangements_enabled ?? true);
    setEnforcementEnabled(link.agency_enforcement_enabled ?? true);
    setAgencyNotes(link.agency_service_notes ?? '');

  }, [link.id, link.operating_model, link.revenue_share_pct, link.management_fee_pct, link.allows_delegated_manager, link.agency_service_model, link.agency_fee_model, link.agency_fee_value, link.agency_payment_arrangements_enabled, link.agency_enforcement_enabled, link.agency_service_notes]);

  const meta = OPERATING_MODELS.find((m) => m.id === operatingModel) ?? OPERATING_MODELS[2];
  const showMgmtFee = operatingModel === 'agency_manages_fee_from_landlord';
  const showDelegate = operatingModel === 'landlord_self_managed' || allowsDelegate;
  const agencyMeta = getAgencyServiceModelMeta(agencyServiceModel);

  const saveAuthority = useMutation({
    mutationFn: async () => {
      const share = parseFloat(revenueShare);
      if (isNaN(share) || share < 0 || share > 100) throw new Error('Revenue share must be 0–100');
      let managementFee: number | null = null;
      if (showMgmtFee && mgmtFee.trim()) {
        managementFee = parseFloat(mgmtFee);
        if (isNaN(managementFee) || managementFee < 0 || managementFee > 100) {
          throw new Error('Management fee must be 0–100');
        }
      }

      let delegatedManagerId: string | null = link.delegated_manager_id ?? null;
      if (showDelegate && delegateEmail.trim()) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', delegateEmail.trim().toLowerCase())
          .maybeSingle();
        if (!profile) throw new Error('No user found with that email. They must sign up as a manager first.');
        delegatedManagerId = profile.id;
      } else if (!allowsDelegate && operatingModel !== 'landlord_self_managed') {
        delegatedManagerId = null;
      }

      if (isAgency) {
        const feeValue = agencyFeeValue.trim() ? parseFloat(agencyFeeValue) : 0;
        if (Number.isNaN(feeValue) || feeValue < 0 || (agencyFeeModel === 'percent_of_collections' && feeValue > 100)) {
          throw new Error(agencyFeeModel === 'percent_of_collections' ? 'Agency fee percentage must be 0–100' : 'Agency fee must be a valid non-negative amount');
        }
        const { error: serviceError } = await supabase.rpc('save_agency_service_mandate_atomic' as never, {
          p_link_id: link.id,
          p_service_model: agencyServiceModel,
          p_fee_model: agencyFeeModel,
          p_fee_value: feeValue,
          p_payment_arrangements_enabled: paymentArrangementsEnabled,
          p_enforcement_enabled: enforcementEnabled,
          p_effective_from: new Date().toISOString().slice(0, 10),
          p_reason: 'Agency service model configuration',
          p_notes: agencyNotes.trim() || null,
        });
        if (serviceError) throw serviceError;
      } else {
        const { error: authorityError } = await supabase.rpc('update_landlord_authority_atomic' as never, {
          p_link_id: link.id, p_operating_model: operatingModel, p_revenue_share_pct: share,
          p_management_fee_pct: managementFee, p_allows_delegated_manager: allowsDelegate,
          p_delegated_manager_id: delegatedManagerId
        });
        if (authorityError) throw authorityError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-landlords', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
      toast({ title: 'Authority settings saved', description: isAgency ? agencyMeta.label : meta.title });
      setDelegateEmail('');
    },
    onError: (err: Error) => errorToast('Save failed', err),
  });

  return (
    <Card className="border-amber-400/20">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-2">
          <Shield className="h-5 w-5 text-warning mt-0.5" />
          <div>
            <CardTitle className="text-base">Authority & operating model</CardTitle>
            <CardDescription>
              {isAgency ? (
                <>Agency mandate · {agencyMeta.label}. Rent destination: <Badge variant="outline" className="mx-1 text-xs">{agencyMeta.paymentDestination === 'manager' ? 'Agency account' : 'Landlord account'}</Badge>.</>
              ) : (
                <>Who runs operations vs who collects rent — Category {meta.category}. Payments route to{' '}
                  <Badge variant="outline" className="mx-1 text-xs">{paymentDestinationForModel(operatingModel)}</Badge>.
                </>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAgency ? (
          <div className="space-y-3 rounded-xl border border-primary/15 bg-primary/5 p-3">
            <div>
              <Label>Agency service model</Label>
              <p className="mt-1 text-xs text-muted-foreground">Choose the commercial arrangement for this owner/property relationship. One agency can run all three models across different properties.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {AGENCY_SERVICE_MODELS.map((model) => {
                const selected = agencyServiceModel === model.id;
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => { setAgencyServiceModel(model.id); setOperatingModel(model.operatingModel); }}
                    className={`min-w-0 rounded-lg border p-3 text-left transition ${selected ? 'border-primary bg-background shadow-sm' : 'border-border bg-card hover:border-primary/40'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold">{model.label}</span>
                      <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${selected ? 'bg-primary ring-4 ring-primary/10' : 'bg-muted-foreground/30'}`} aria-hidden />
                    </div>
                    <p className="mt-1 text-[11px] font-medium text-primary">{model.slogan}</p>
                    <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{model.description}</p>
                  </button>
                );
              })}
            </div>
            <div className="grid gap-2 rounded-lg border border-border bg-background p-3 text-xs sm:grid-cols-5">
              <div><p className="text-muted-foreground">Operates</p><p className="font-medium">{agencyMeta.operates}</p></div>
              <div><p className="text-muted-foreground">Collects</p><p className="font-medium">{agencyMeta.collects}</p></div>
              <div><p className="text-muted-foreground">Enforces</p><p className="font-medium">{agencyMeta.enforces}</p></div>
              <div><p className="text-muted-foreground">Maintenance</p><p className="font-medium">{agencyMeta.maintenance}</p></div>
              <div><p className="text-muted-foreground">Destination</p><p className="font-medium">{agencyMeta.paymentDestination}</p></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
              <div>
                <Label>Agency fee model</Label>
                <Select value={agencyFeeModel} onValueChange={(value) => setAgencyFeeModel(value as typeof agencyFeeModel)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No agency fee</SelectItem>
                    <SelectItem value="percent_of_collections">% of collections</SelectItem>
                    <SelectItem value="flat_monthly">Flat monthly fee</SelectItem>
                    <SelectItem value="flat_per_invoice">Flat fee per invoice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {agencyFeeModel !== 'none' ? (
                <div>
                  <Label>{agencyFeeModel === 'percent_of_collections' ? (agencyServiceModel === 'managed_direct_landlord_collection' ? 'Management fee percentage' : 'Collection / management fee percentage') : (agencyServiceModel === 'managed_direct_landlord_collection' ? 'Management fee (KES)' : 'Collection / management fee (KES)')}</Label>
                  <Input className="mt-1" type="number" min="0" max={agencyFeeModel === 'percent_of_collections' ? '100' : undefined} step="0.01" value={agencyFeeValue} onChange={(event) => setAgencyFeeValue(event.target.value)} placeholder={agencyFeeModel === 'percent_of_collections' ? 'e.g. 10' : 'e.g. 2,500'} />
                </div>
              ) : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2"><span><span className="block text-sm font-medium">Payment arrangements</span><span className="block text-xs text-muted-foreground">Allow agency staff to set instalment/arrears arrangements.</span></span><Switch checked={paymentArrangementsEnabled} onCheckedChange={setPaymentArrangementsEnabled} /></label>
              <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2"><span><span className="block text-sm font-medium">Payment enforcement</span><span className="block text-xs text-muted-foreground">Allow notices, follow-ups and collection escalation.</span></span><Switch checked={enforcementEnabled} onCheckedChange={setEnforcementEnabled} /></label>
            </div>
            <div>
              <Label>Service notes</Label>
              <Input className="mt-1" value={agencyNotes} onChange={(event) => setAgencyNotes(event.target.value)} placeholder="Optional terms or instructions for this arrangement" />
            </div>
          </div>
        ) : null}

        {!isAgency ? <div>
          <Label>Operating model</Label>
          <Select value={operatingModel} onValueChange={(v) => setOperatingModel(v as OperatingModel)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPERATING_MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <span className="font-medium">{m.shortLabel}</span>
                  <span className="text-muted-foreground ml-2 text-xs">— Cat {m.category}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-2 flex gap-1">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            {meta.description}
          </p>
        </div> : null}

        {!isAgency ? <div className="grid sm:grid-cols-3 gap-3 text-xs rounded-lg bg-muted/40 p-3">
          <div>
            <p className="text-muted-foreground">Operates</p>
            <p className="font-medium">{meta.whoOperates}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Collects</p>
            <p className="font-medium">{meta.whoCollects}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Paid</p>
            <p className="font-medium">{meta.whoGetsPaid}</p>
          </div>
        </div> : null}

        {!isAgency ? <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Landlord revenue share %</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.5}
              className="mt-1"
              value={revenueShare}
              onChange={(e) => setRevenueShare(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">Used when agency collects and remits to landlord.</p>
          </div>
          {showMgmtFee && (
            <div>
              <Label>Management fee % (landlord pays agency)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                className="mt-1"
                value={mgmtFee}
                onChange={(e) => setMgmtFee(e.target.value)}
                placeholder="e.g. 10"
              />
            </div>
          )}
        </div> : null}

        {!isAgency ? <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Allow external manager / agency</Label>
                <p className="text-xs text-muted-foreground">
                  Keeps the door open to assign an outside operator without changing ownership.
                </p>
              </div>
              <Switch checked={allowsDelegate} onCheckedChange={setAllowsDelegate} />
            </div>
            {showDelegate && allowsDelegate && (
              <div>
                <Label>Delegated manager email (optional)</Label>
                <Input
                  type="email"
                  className="mt-1"
                  placeholder="agency@example.com"
                  value={delegateEmail}
                  onChange={(e) => setDelegateEmail(e.target.value)}
                />
                {link.delegated_manager_id && !delegateEmail && (
                  <p className="text-xs text-muted-foreground mt-1">A delegated manager is already linked.</p>
                )}
              </div>
            )}
        </div> : null}

        <Button onClick={() => saveAuthority.mutate()} disabled={saveAuthority.isPending}>
          {saveAuthority.isPending ? 'Saving…' : 'Save authority settings'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default PropertyAuthorityPanel;
