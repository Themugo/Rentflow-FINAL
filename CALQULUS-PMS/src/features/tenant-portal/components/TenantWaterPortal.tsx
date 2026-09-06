// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import { Textarea } from '@/shared/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  Droplets,
  Camera,
  Upload,
  CheckCircle,
  Clock,
  AlertTriangle,
  Calculator,
  Info,
  Loader2,
  Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import { errorToast } from "@/shared/lib/errorToast";

const fmt = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n);

const TenantWaterPortal: React.FC = () => {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const photoRef = useRef<HTMLInputElement>(null);

  const tenantId = userRole?.tenant_id;

  const [submitOpen, setSubmitOpen] = useState(false);
  const [currentReading, setCurrentReading] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [disputeOpen, setDisputeOpen] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [uploading, setUploading] = useState(false);

  type TenantRow = {
    id: string;
    name: string;
    unit_id: string;
    property_id: string;
    unit: string;
    property: string;
    manager_id: string;
  };
  type WaterConfigRow = {
    property_id: string;
    is_active: boolean;
    rate_per_unit: number;
    water_provider: string;
    billing_method: string;
    meter_number?: string;
  };
  type MeterConfigRow = { unit_id: string; meter_number?: string };
  type WaterCompanyRow = {
    short_code: string;
    company_name: string;
    paybill_number?: string;
    domestic_rate?: number;
    standing_charge?: number;
    sewerage_pct?: number;
    payment_note?: string;
  };
  type WaterReadingRow = {
    id: string;
    reading_date?: string;
    previous_reading: number;
    current_reading: number;
    total_amount?: number;
    rate_per_unit?: number;
    disputed?: boolean;
    submitted_by_tenant?: boolean;
    manager_verified?: boolean;
    tenant_photo_url?: string;
  };

  // Tenant's unit and water config
  const { data: tenantInfo } = useQuery({
    queryKey: ['tenant-water-info', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data: _tenant } = await supabase
        .from('tenants')
        .select('id, name, unit_id, property_id, unit, property, manager_id')
        .eq('id', tenantId)
        .maybeSingle();
      const tenant = _tenant as TenantRow | null;
      if (!tenant) return null;

      const { data: _waterConfig } = await supabase
        .from('water_billing_config')
        .select('*')
        .eq('property_id', tenant.property_id)
        .eq('is_active', true)
        .maybeSingle();
      const waterConfig = _waterConfig as WaterConfigRow | null;

      const { data: _meterConfig } = await supabase
        .from('unit_water_config')
        .select('*')
        .eq('unit_id', tenant.unit_id)
        .maybeSingle();
      const meterConfig = _meterConfig as MeterConfigRow | null;

      const provider = waterConfig?.water_provider;
      let waterCompany: WaterCompanyRow | null = null;
      if (provider) {
        const { data: _co } = await supabase
          .from('kenya_water_companies')
          .select('*')
          .eq('short_code', provider)
          .maybeSingle();
        waterCompany = _co as WaterCompanyRow | null;
      }

      return { tenant, waterConfig, meterConfig, waterCompany };
    },
    enabled: !!tenantId,
  });

  // Water readings for this tenant's unit
  const { data: readings = [], isLoading: readingsLoading } = useQuery({
    queryKey: ['tenant-water-readings', tenantInfo?.tenant?.unit_id],
    queryFn: async () => {
      if (!tenantInfo?.tenant?.unit_id) return [];
      const { data } = await supabase
        .from('water_meter_readings')
        .select('*')
        .eq('unit_id', tenantInfo!.tenant.unit_id)
        .order('reading_date', { ascending: false })
        .limit(12);
      return (data || []) as WaterReadingRow[];
    },
    enabled: !!tenantInfo?.tenant?.unit_id,
  });

  const lastReading = readings[0];

  // Submit tenant meter reading with photo
  const submitReading = useMutation({
    mutationFn: async () => {
      if (!currentReading || isNaN(Number(currentReading))) throw new Error('Enter a valid reading');
      const curr = Number(currentReading);
      const prev = Number(lastReading?.current_reading ?? 0);
      if (curr < prev) throw new Error(`Reading must be ≥ previous reading (${prev})`);

      setUploading(true);
      let photoUrl: string | null = null;

      if (photoFile) {
        const path = `water-meters/${tenantInfo!.tenant.unit_id}/${Date.now()}.${photoFile.name.split('.').pop()}`;
        const { error: upErr } = await supabase.storage
          .from('maintenance-photos')
          .upload(path, photoFile, { upsert: true });
        if (!upErr) {
          const {
            data: { publicUrl },
          } = supabase.storage.from('maintenance-photos').getPublicUrl(path);
          photoUrl = publicUrl;
        }
      }
      setUploading(false);

      const wc = tenantInfo?.waterConfig;
      const consumption = curr - prev;
      const rate = Number(wc?.rate_per_unit ?? 60);
      const total = consumption * rate;

      const { error } = await supabase.rpc('create_water_meter_reading_atomic', {
        p_property_id: tenantInfo!.tenant.property_id,
        p_unit_id: tenantInfo!.tenant.unit_id,
        p_previous_reading: prev,
        p_current_reading: curr,
        p_rate_per_unit: rate,
        p_reading_date: new Date().toISOString().slice(0, 10),
        p_billing_period_start: null,
        p_billing_period_end: null,
        p_notes: 'Self-reported by tenant',
        p_submitted_by_tenant: true,
        p_tenant_user_id: user!.id,
        p_tenant_photo_url: photoUrl,
      });
      if (error) throw error;

      await supabase.rpc('notify_manager_of_tenant_meter_reading_atomic' as never, {
        p_unit_id: tenantInfo!.tenant.unit_id,
        p_reading: curr,
        p_consumption: consumption,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-water-readings'] });
      toast({ title: 'Reading submitted', description: 'Your manager will verify and generate your water invoice.' });
      setSubmitOpen(false);
      setCurrentReading('');
      setPhotoFile(null);
      setPhotoPreview(null);
    },
    onError: (err: Error) => errorToast('Failed', err),
  });

  // Dispute a reading
  const disputeReading = useMutation({
    mutationFn: async (readingId: string) => {
      const { error } = await supabase.rpc('transition_water_meter_reading_atomic', {
        p_reading_id: readingId,
        p_action: 'dispute',
        p_invoice_id: null,
        p_dispute_reason: disputeReason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-water-readings'] });
      toast({ title: 'Dispute submitted', description: 'Your manager has been notified.' });
      setDisputeOpen(null);
      setDisputeReason('');
    },
  });

  const wc = tenantInfo?.waterConfig;
  const waterCompany = tenantInfo?.waterCompany;
  const meterNo = tenantInfo?.meterConfig?.meter_number ?? wc?.meter_number ?? 'Not assigned';

  // Live bill preview from current reading input
  const previewConsumption =
    currentReading && lastReading ? Math.max(0, Number(currentReading) - Number(lastReading.current_reading)) : 0;
  const previewBill = previewConsumption * Number(wc?.rate_per_unit ?? 60);

  return (
    <div className="space-y-4">
      {/* Header card */}
      <Card className="border-[hsl(195_60%_42%/0.3)] bg-[hsl(195_60%_42%/0.06)]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[hsl(195_60%_42%/0.12)] flex items-center justify-center">
                <Droplets className="h-5 w-5 text-[hsl(195_60%_32%)]" />
              </div>
              <div>
                <p className="font-semibold text-sm">Water billing</p>
                <p className="text-xs text-muted-foreground">
                  {waterCompany ? waterCompany.company_name : (wc?.water_provider ?? 'Provider not set')}
                  {meterNo !== 'Not assigned' && ` · Meter: ${meterNo}`}
                </p>
                {waterCompany?.paybill_number ? (
                  <p className="text-xs text-[hsl(195_60%_32%)]">
                    M-Pesa Paybill: <strong>{waterCompany.paybill_number}</strong>
                  </p>
                ) : waterCompany?.payment_note ? (
                  <p className="text-xs text-warning">{waterCompany.payment_note}</p>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {lastReading && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Last reading</p>
                  <p className="font-bold text-sm">{lastReading.current_reading} m³</p>
                  <p className="text-xs text-muted-foreground">
                    {lastReading.reading_date ? format(new Date(lastReading.reading_date), 'dd/MM/yy') : '—'}
                  </p>
                </div>
              )}
              <Button
                size="sm"
                className="bg-[hsl(195_60%_38%)] hover:bg-[hsl(195_60%_32%)] text-white gap-1.5"
                onClick={() => setSubmitOpen(true)}
              >
                <Camera className="h-4 w-4" />
                Submit reading
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rate info */}
      {(waterCompany || wc) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: 'Rate per m³',
              value: wc?.rate_per_unit
                ? fmt(wc.rate_per_unit)
                : waterCompany?.domestic_rate
                  ? fmt(waterCompany.domestic_rate)
                  : '—',
            },
            {
              label: 'Standing charge',
              value: waterCompany?.standing_charge ? fmt(waterCompany.standing_charge) : '—',
            },
            { label: 'Sewerage', value: waterCompany?.sewerage_pct ? `${waterCompany.sewerage_pct}%` : 'None' },
            {
              label: 'Billing method',
              value:
                wc?.billing_method === 'meter'
                  ? 'Metered'
                  : wc?.billing_method === 'flat_rate'
                    ? 'Flat rate'
                    : 'Metered',
            },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border p-3 bg-muted/20">
              <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
              <p className="text-sm font-semibold">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Reading history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Reading history & bills</CardTitle>
          <CardDescription>Your water consumption and bills over time</CardDescription>
        </CardHeader>
        <CardContent>
          {readingsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : readings.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Droplets className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No water readings recorded yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {readings.map((r: WaterReadingRow) => {
                const consumption = Number(r.current_reading) - Number(r.previous_reading);
                const bill = Number(r.total_amount ?? consumption * Number(r.rate_per_unit));
                return (
                  <div
                    key={r.id}
                    className={`rounded-lg border p-3 flex items-center justify-between gap-3 ${r.disputed ? 'border-orange-300 bg-orange-50/40' : r.submitted_by_tenant && !r.manager_verified ? 'border-[hsl(195_60%_42%/0.3)] bg-[hsl(195_60%_42%/0.06)]' : 'border-border'}`}
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground shrink-0 pt-0.5 w-20">
                        {r.reading_date ? format(new Date(r.reading_date), 'dd/MM/yy') : '—'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">
                            {Number(r.previous_reading)} → {Number(r.current_reading)} m³
                            <span className="text-muted-foreground ml-1">({consumption} m³ used)</span>
                          </p>
                          {r.submitted_by_tenant && (
                            <Badge
                              variant="outline"
                              className="text-xs border-[hsl(195_60%_42%/0.35)] text-[hsl(195_60%_32%)] bg-[hsl(195_60%_42%/0.08)]"
                            >
                              Self-reported
                            </Badge>
                          )}
                          {!r.manager_verified && r.submitted_by_tenant && (
                            <Badge variant="outline" className="text-xs border-warning/40 text-warning">
                              <Clock className="h-2.5 w-2.5 mr-1" />
                              Awaiting verification
                            </Badge>
                          )}
                          {r.manager_verified && (
                            <Badge variant="outline" className="text-xs border-success/40 text-success bg-success/20">
                              <CheckCircle className="h-2.5 w-2.5 mr-1" />
                              Verified
                            </Badge>
                          )}
                          {r.disputed && (
                            <Badge variant="outline" className="text-xs border-orange-300 text-orange-700">
                              Disputed
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.tenant_photo_url && (
                        <a href={r.tenant_photo_url} target="_blank" rel="noopener noreferrer">
                          <img src={r.tenant_photo_url} alt="meter" className="h-10 w-12 object-cover rounded border" />
                        </a>
                      )}
                      <div className="text-right">
                        <p className="text-sm font-bold">{fmt(bill)}</p>
                        {!r.disputed && !r.manager_verified && (
                          <button
                            type="button"
                            className="text-xs text-orange-600 hover:underline mt-0.5"
                            onClick={() => {
                              setDisputeOpen(r.id);
                              setDisputeReason('');
                            }}
                          >
                            Dispute
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit reading dialog */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Droplets className="h-5 w-5 text-[hsl(195_60%_38%)]" />
              Submit meter reading
            </DialogTitle>
            <DialogDescription>
              Take a photo of your meter and enter the reading. Your manager will verify it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Photo upload */}
            <div>
              <Label>Meter photo (required for verification)</Label>
              <div
                role="button"
                tabIndex={0}
                className="mt-1 border-2 border-dashed border-border rounded-xl overflow-hidden cursor-pointer hover:border-[hsl(195_60%_50%)] transition-colors"
                onClick={() => photoRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    photoRef.current?.click();
                  }
                }}
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="meter" className="w-full h-40 object-cover" />
                ) : (
                  <div className="h-32 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <Camera className="h-8 w-8" />
                    <p className="text-xs">Tap to take/upload meter photo</p>
                  </div>
                )}
              </div>
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setPhotoFile(f);
                    setPhotoPreview(URL.createObjectURL(f));
                  }
                }}
              />
            </div>

            {/* Reading input */}
            <div>
              <Label>Current meter reading (m³)</Label>
              <Input
                type="number"
                step="0.001"
                min={lastReading?.current_reading ?? 0}
                value={currentReading}
                onChange={(e) => setCurrentReading(e.target.value)}
                placeholder={lastReading ? `Previous: ${lastReading.current_reading}` : 'Enter reading'}
                className="mt-1 text-lg font-mono"
              />
            </div>

            {/* Live calculation preview */}
            {previewConsumption > 0 && (
              <div className="p-3 rounded-lg bg-[hsl(195_60%_42%/0.08)] border border-[hsl(195_60%_42%/0.25)] text-sm">
                <div className="flex items-center gap-1 text-[hsl(195_60%_28%)] font-medium mb-2">
                  <Calculator className="h-4 w-4" />
                  Bill estimate
                </div>
                <div className="space-y-1 text-xs text-[hsl(195_60%_32%)]">
                  <div className="flex justify-between">
                    <span>Consumption</span>
                    <span className="font-medium">{previewConsumption.toFixed(3)} m³</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Rate × {fmt(Number(wc?.rate_per_unit ?? waterCompany?.domestic_rate ?? 60))}/m³</span>
                    <span className="font-medium">{fmt(previewBill)}</span>
                  </div>
                  {waterCompany?.standing_charge > 0 && (
                    <div className="flex justify-between">
                      <span>Standing charge</span>
                      <span className="font-medium">{fmt(waterCompany.standing_charge)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-[hsl(195_60%_42%/0.4)] pt-1 font-bold">
                    <span>Estimated total</span>
                    <span>{fmt(previewBill + (waterCompany?.standing_charge ?? 0))}</span>
                  </div>
                </div>
                <p className="text-xs text-[hsl(195_60%_38%)] mt-2 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Estimate — final bill set by manager after verification
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => submitReading.mutate()}
              disabled={submitReading.isPending || uploading || !currentReading}
              className="bg-[hsl(195_60%_38%)] hover:bg-[hsl(195_60%_32%)] text-white gap-2"
            >
              {submitReading.isPending || uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {uploading ? 'Uploading…' : 'Submitting…'}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Submit reading
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispute dialog */}
      <Dialog open={!!disputeOpen} onOpenChange={(open) => !open && setDisputeOpen(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Dispute this reading</DialogTitle>
            <DialogDescription>Explain why you believe this reading or bill is incorrect.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            rows={4}
            placeholder="e.g. My meter shows a different reading. I have a photo showing..."
            className="resize-none"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeOpen(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => disputeOpen && disputeReading.mutate(disputeOpen)}
              disabled={!disputeReason.trim() || disputeReading.isPending}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {disputeReading.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TenantWaterPortal;
