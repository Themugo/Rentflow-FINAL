import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/components/ui/dialog';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useToast } from '@/shared/hooks/use-toast';
import { useAuth } from '@/features/auth/AuthContext';
import { DollarSign, Plus, Pencil, Tag, Shield, Ban, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import { useActivityLog } from '@/shared/hooks/useActivityLog';
import { format, isBefore } from 'date-fns';
import { cn } from '@/shared/lib/utils';
import { errorToast } from "@/shared/lib/errorToast";

interface CustomerBillingBlock {
  id: string;
  customer_id: string;
  customer_type: 'manager' | 'landlord' | 'agency';
  agency_id: string | null;
  price_per_unit: number | null;
  unit_count_locked: boolean;
  registration_fee_waived: boolean;
  registration_fee_amount: number;
  monthly_discount_pct: number;
  monthly_discount_flat: number;
  discount_label: string | null;
  discount_expires_at: string | null;
  zero_registration: boolean;
  custom_block_name: string | null;
  custom_block_price: number | null;
  custom_block_units: number | null;
  custom_block_notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

interface CustomerOption {
  user_id: string;
  email: string;
  full_name: string | null;
  type: 'manager' | 'landlord';
}

const CustomerBillingBlocks = () => {
  const { toast } = useToast();
  const { isPlatformOwner, isPlatformBusiness, isSuperAdmin, hasWebhostPermission, user } = useAuth();
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<CustomerBillingBlock | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerBillingBlock | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Write access — matches the RLS policy `webhost_manage_billing_blocks`
  // (platform_admins admin_type IN ('owner','business'), not suspended).
  const canManage = isPlatformOwner || isPlatformBusiness;
  // Read access — matches the tab visibility gate in WebhostDashboard
  // (`isSuperAdmin || canViewBilling`). Super admins / billing viewers can see
  // the read-only registry; only owner/business can create/edit/delete.
  const canView = isSuperAdmin || hasWebhostPermission('can_manage_billing') || canManage;

  const [form, setForm] = useState({
    customer_id: '',
    customer_type: 'manager' as 'manager' | 'landlord' | 'agency',
    price_per_unit: '',
    unit_count_locked: false,
    registration_fee_waived: false,
    registration_fee_amount: '0',
    monthly_discount_pct: '0',
    monthly_discount_flat: '0',
    discount_label: '',
    discount_expires_at: '',
    zero_registration: false,
    custom_block_name: '',
    custom_block_price: '',
    custom_block_units: '',
    custom_block_notes: '',
  });

  const { data: blocks, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['customer-billing-blocks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_billing_blocks')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CustomerBillingBlock[];
    },
    enabled: canView,
  });

  // Standard tier price map (tier_key → price_per_unit) — REAL, read-only.
  // Used to derive STANDARD PRICE → CUSTOM PRICE → DIFFERENCE (§3, §5).
  const { data: tierPriceMap = {} } = useQuery<Record<string, number>>({
    queryKey: ['tier-price-per-unit'],
    queryFn: async () => {
      const { data, error } = await supabase.from('subscription_tiers').select('tier_key, price_per_unit');
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of (data || []) as { tier_key: string; price_per_unit: number | null }[]) {
        if (r.price_per_unit != null) map[r.tier_key] = Number(r.price_per_unit);
      }
      return map;
    },
    enabled: canView,
  });

  // Manager → subscription_tier map (REAL) so we can resolve a manager customer's
  // standard tier price. No new pricing engine — a read of existing data.
  const { data: managerTierMap = {} } = useQuery<Record<string, string>>({
    queryKey: ['manager-tier-map'],
    queryFn: async () => {
      const { data, error } = await supabase.from('manager_profiles').select('manager_user_id, subscription_tier');
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const r of (data || []) as { manager_user_id: string; subscription_tier: string }[]) {
        map[r.manager_user_id] = r.subscription_tier;
      }
      return map;
    },
    enabled: canView,
  });

  // Resolve standard price for a block's customer (managers only — others have no
  // subscription tier, so standard price is honestly "—").
  const getStandardPrice = (b: CustomerBillingBlock): number | null => {
    if (b.customer_type !== 'manager') return null;
    const tierKey = managerTierMap[b.customer_id];
    if (!tierKey) return null;
    const price = tierPriceMap[tierKey];
    return price != null ? price : null;
  };

  const { data: customers } = useQuery({
    queryKey: ['customer-options'],
    queryFn: async () => {
      const [managers, landlords] = await Promise.all([
        supabase.from('user_roles').select('user_id').eq('role', 'manager'),
        supabase.from('user_roles').select('user_id').eq('role', 'landlord'),
      ]);
      const allIds = [
        ...(managers.data || []).map(r => ({ user_id: r.user_id, type: 'manager' as const })),
        ...(landlords.data || []).map(r => ({ user_id: r.user_id, type: 'landlord' as const })),
      ];
      const results: CustomerOption[] = [];
      for (const { user_id, type } of allIds) {
        const { data: profile } = await supabase.from('profiles').select('email, full_name').eq('id', user_id).single();
        if (profile) results.push({ user_id, email: profile.email, full_name: profile.full_name, type });
      }
      return results;
    },
    enabled: canView,
    staleTime: 60000,
  });

  const resetForm = () => {
    setForm({
      customer_id: '', customer_type: 'manager', price_per_unit: '',
      unit_count_locked: false, registration_fee_waived: false,
      registration_fee_amount: '0', monthly_discount_pct: '0',
      monthly_discount_flat: '0', discount_label: '',
      discount_expires_at: '', zero_registration: false,
      custom_block_name: '', custom_block_price: '', custom_block_units: '',
      custom_block_notes: '',
    });
    setEditingBlock(null);
    setValidationError(null);
  };

  const openEdit = (block: CustomerBillingBlock) => {
    setForm({
      customer_id: block.customer_id,
      customer_type: block.customer_type,
      price_per_unit: block.price_per_unit?.toString() || '',
      unit_count_locked: block.unit_count_locked,
      registration_fee_waived: block.registration_fee_waived,
      registration_fee_amount: block.registration_fee_amount.toString(),
      monthly_discount_pct: block.monthly_discount_pct.toString(),
      monthly_discount_flat: block.monthly_discount_flat.toString(),
      discount_label: block.discount_label || '',
      discount_expires_at: block.discount_expires_at || '',
      zero_registration: block.zero_registration,
      custom_block_name: block.custom_block_name || '',
      custom_block_price: block.custom_block_price?.toString() || '',
      custom_block_units: block.custom_block_units?.toString() || '',
      custom_block_notes: block.custom_block_notes || '',
    });
    setEditingBlock(block);
    setValidationError(null);
    setIsDialogOpen(true);
  };

  const saveBlock = useMutation({
    mutationFn: async () => {
      if (!form.customer_id) throw new Error('Select a customer');
      const pricePerUnit = form.price_per_unit ? parseFloat(form.price_per_unit) : null;
      if (pricePerUnit != null && (isNaN(pricePerUnit) || pricePerUnit < 0)) throw new Error('Price per unit must be a non-negative number');
      const regFee = parseFloat(form.registration_fee_amount);
      if (isNaN(regFee) || regFee < 0) throw new Error('Registration fee must be a non-negative number');
      const discPct = parseFloat(form.monthly_discount_pct);
      if (isNaN(discPct) || discPct < 0 || discPct > 100) throw new Error('Discount % must be between 0 and 100');
      const discFlat = parseFloat(form.monthly_discount_flat);
      if (isNaN(discFlat) || discFlat < 0) throw new Error('Flat discount must be a non-negative number');
      const blockPrice = form.custom_block_price ? parseFloat(form.custom_block_price) : null;
      if (blockPrice != null && (isNaN(blockPrice) || blockPrice < 0)) throw new Error('Block price must be a non-negative number');
      const blockUnits = form.custom_block_units ? parseInt(form.custom_block_units) : null;
      if (blockUnits != null && (isNaN(blockUnits) || blockUnits < 0)) throw new Error('Block units must be a non-negative integer');

      const payload = {
        customer_id: form.customer_id,
        customer_type: form.customer_type,
        price_per_unit: pricePerUnit,
        unit_count_locked: form.unit_count_locked,
        registration_fee_waived: form.registration_fee_waived,
        registration_fee_amount: regFee,
        monthly_discount_pct: discPct,
        monthly_discount_flat: discFlat,
        discount_label: form.discount_label || null,
        discount_expires_at: form.discount_expires_at || null,
        zero_registration: form.zero_registration,
        custom_block_name: form.custom_block_name || null,
        custom_block_price: blockPrice,
        custom_block_units: blockUnits,
        custom_block_notes: form.custom_block_notes || null,
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      };

      if (editingBlock) {
        const { error } = await supabase.rpc('save_customer_billing_block_atomic', { p_block_id: editingBlock.id, p_payload: payload as any });
        if (error) throw error;
        logActivity({ action: 'Updated Customer Billing Block', entityType: 'customer_billing_blocks', entityId: editingBlock.id });
      } else {
        const { data, error } = await supabase.rpc('save_customer_billing_block_atomic', { p_block_id: null, p_payload: payload as any });
        if (error) throw error;
        logActivity({ action: 'Created Customer Billing Block', entityType: 'customer_billing_blocks', entityId: data.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-billing-blocks'] });
      toast({ title: editingBlock ? 'Billing block updated' : 'Billing block created' });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (err: Error) => {
      setValidationError(err.message);
      errorToast('Failed', err);
    },
  });

  const deleteBlock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_customer_billing_block_atomic', { p_block_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-billing-blocks'] });
      toast({ title: 'Billing block removed' });
      setDeleteTarget(null);
    },
    onError: (err: Error) => errorToast('Failed', err),
  });

  const getCustomerName = (customerId: string) => {
    const c = customers?.find(c => c.user_id === customerId);
    return c ? (c.full_name || c.email) : customerId.slice(0, 8) + '...';
  };

  const fmtKES = (n: number) => n.toLocaleString('en-KE', { minimumFractionDigits: 0 });

  // Read-only derivation of discount lifecycle from discount_expires_at.
  // No automatic expiration logic is created — this only labels the existing date.
  type DiscountStatus = 'none' | 'active' | 'expiring' | 'expired';
  const getDiscountStatus = (b: CustomerBillingBlock): DiscountStatus => {
    if (!b.discount_expires_at) return 'none';
    const expiry = new Date(b.discount_expires_at);
    const now = new Date();
    if (isBefore(expiry, now)) return 'expired';
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    if (expiry.getTime() - now.getTime() <= sevenDays) return 'expiring';
    return 'active';
  };

  const refresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['tier-price-per-unit'] });
    queryClient.invalidateQueries({ queryKey: ['manager-tier-map'] });
    queryClient.invalidateQueries({ queryKey: ['customer-options'] });
  };

  // STANDARD → CUSTOM → DIFFERENCE preview for the form (managers only).
  const formStandardPrice = (): number | null => {
    if (form.customer_type !== 'manager' || !form.customer_id) return null;
    const tierKey = managerTierMap[form.customer_id];
    if (!tierKey) return null;
    return tierPriceMap[tierKey] ?? null;
  };

  return (
    <div className="space-y-5">
      <Card>
      <CardHeader>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-warning" />
              Custom Pricing & Commercial Exceptions Console
            </CardTitle>
            <CardDescription>
              Per-unit pricing overrides, waivers, discounts, and custom negotiated blocks per customer. {canManage ? 'Only owner and business-level admins can manage billing blocks.' : 'You have read-only access — only owner and business-level admins can create or edit billing blocks.'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canView && (
              <Button variant="outline" size="sm" onClick={refresh} aria-label="Refresh" className="border-border text-muted-foreground hover:bg-secondary-background hover:text-foreground h-9 rounded-xl text-xs">
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh
              </Button>
            )}
            {canManage && (
            <Dialog open={isDialogOpen} onOpenChange={v => { setIsDialogOpen(v); if (!v) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={resetForm} className="bg-primary hover:bg-primary/90 text-white h-9 rounded-xl text-xs"><Plus className="h-3.5 w-3.5 mr-1.5" />New Billing Block</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingBlock ? 'Edit' : 'New'} Billing Block</DialogTitle>
                  <DialogDescription>Configure custom pricing for a customer.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {validationError && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg border border-destructive/30 bg-destructive/5">
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                      <p className="text-xs text-destructive">{validationError}</p>
                    </div>
                  )}
                  {/* STANDARD → CUSTOM → DIFFERENCE preview (managers only, read-only derivation) */}
                  {form.customer_type === 'manager' && form.customer_id && (() => {
                    const std = formStandardPrice();
                    const custom = form.price_per_unit ? parseFloat(form.price_per_unit) : null;
                    if (std == null && custom == null) return null;
                    const diff = (std != null && custom != null) ? custom - std : null;
                    return (
                      <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-warning mb-1.5">Pricing impact</p>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-[10px] text-muted-foreground">Standard</p>
                            <p className="text-xs font-semibold text-foreground">{std != null ? `KES ${fmtKES(std)}` : '—'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Custom</p>
                            <p className="text-xs font-semibold text-foreground">{custom != null ? `KES ${fmtKES(custom)}` : 'Tier default'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Difference</p>
                            <p className={cn('text-xs font-semibold', diff == null ? 'text-secondary-foreground' : diff < 0 ? 'text-success' : diff > 0 ? 'text-destructive' : 'text-secondary-foreground')}>
                              {diff != null ? `${diff < 0 ? '−' : diff > 0 ? '+' : ''}KES ${fmtKES(Math.abs(diff))}` : '—'}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="space-y-2">
                    <Label>Customer</Label>
                    <Select
                      value={form.customer_id}
                      onValueChange={v => setForm(f => ({ ...f, customer_id: v }))}
                      disabled={!!editingBlock}
                    >
                      <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                      <SelectContent>
                        {customers?.map(c => (
                          <SelectItem key={c.user_id} value={c.user_id}>
                            {c.full_name || c.email} ({c.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Customer Type</Label>
                    <Select value={form.customer_type} onValueChange={(v: 'manager' | 'landlord' | 'agency') => setForm(f => ({ ...f, customer_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="landlord">Landlord</SelectItem>
                        <SelectItem value="agency">Agency</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium mb-2">Per-Unit Pricing</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Price per unit (KES)</Label>
                        <Input type="number" value={form.price_per_unit} onChange={e => setForm(f => ({ ...f, price_per_unit: e.target.value }))} placeholder="Leave empty for tier default" />
                      </div>
                      <div className="space-y-2 flex items-end pb-2">
                        <Label className="flex items-center gap-2">
                          <Switch checked={form.unit_count_locked} onCheckedChange={v => setForm(f => ({ ...f, unit_count_locked: v }))} />
                          Lock unit count
                        </Label>
                      </div>
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium mb-2">Registration Fee</h4>
                    <div className="space-y-3">
                      <Label className="flex items-center gap-2">
                        <Switch checked={form.registration_fee_waived} onCheckedChange={v => setForm(f => ({ ...f, registration_fee_waived: v }))} />
                        Waive registration fee
                      </Label>
                      {!form.registration_fee_waived && (
                        <div className="space-y-2">
                          <Label>Registration fee amount (KES)</Label>
                          <Input type="number" value={form.registration_fee_amount} onChange={e => setForm(f => ({ ...f, registration_fee_amount: e.target.value }))} />
                        </div>
                      )}
                      <Label className="flex items-center gap-2">
                        <Switch checked={form.zero_registration} onCheckedChange={v => setForm(f => ({ ...f, zero_registration: v }))} />
                        Zero registration (fully exempt)
                      </Label>
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium mb-2">Monthly Discounts</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Discount %</Label>
                        <Input type="number" value={form.monthly_discount_pct} onChange={e => setForm(f => ({ ...f, monthly_discount_pct: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Flat discount (KES)</Label>
                        <Input type="number" value={form.monthly_discount_flat} onChange={e => setForm(f => ({ ...f, monthly_discount_flat: e.target.value }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div className="space-y-2">
                        <Label>Discount label</Label>
                        <Input value={form.discount_label} onChange={e => setForm(f => ({ ...f, discount_label: e.target.value }))} placeholder="e.g. Early adopter" />
                      </div>
                      <div className="space-y-2">
                        <Label>Expires</Label>
                        <Input type="date" value={form.discount_expires_at?.split('T')[0] || ''} onChange={e => setForm(f => ({ ...f, discount_expires_at: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium mb-2">Custom Negotiated Block</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Block name</Label>
                        <Input value={form.custom_block_name} onChange={e => setForm(f => ({ ...f, custom_block_name: e.target.value }))} placeholder="e.g. Bulk deal Q3" />
                      </div>
                      <div className="space-y-2">
                        <Label>Block price (KES)</Label>
                        <Input type="number" value={form.custom_block_price} onChange={e => setForm(f => ({ ...f, custom_block_price: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Block units</Label>
                        <Input type="number" value={form.custom_block_units} onChange={e => setForm(f => ({ ...f, custom_block_units: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-2 mt-3">
                      <Label>Notes</Label>
                      <Input value={form.custom_block_notes} onChange={e => setForm(f => ({ ...f, custom_block_notes: e.target.value }))} placeholder="Internal notes about this negotiation" />
                    </div>
                  </div>
                  <DialogFooter className="pt-2">
                    <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>Cancel</Button>
                    <Button onClick={() => saveBlock.mutate()} disabled={saveBlock.isPending || !form.customer_id} className="bg-primary hover:bg-primary/90 text-white">
                      {saveBlock.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      {saveBlock.isPending ? 'Saving...' : editingBlock ? 'Update Block' : 'Create Block'}
                    </Button>
                  </DialogFooter>
                </div>
              </DialogContent>
            </Dialog>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!canView ? (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>You do not have access to view custom pricing.</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : isError ? (
          <div className="p-8 text-center rounded-xl border border-destructive/30 bg-destructive/5">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
            <p className="text-sm font-semibold text-destructive">Unable to load custom pricing.</p>
            <p className="text-xs text-muted-foreground mt-1 mb-3">{(error as Error)?.message ?? 'Try again.'}</p>
            <Button variant="outline" size="sm" onClick={refresh} className="border-destructive/40 text-destructive hover:bg-destructive/10">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
            </Button>
          </div>
        ) : !blocks || blocks.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Tag className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No custom pricing configured.</p>
            <p className="text-xs text-muted-foreground mt-1">{canManage ? 'Create a billing block to override default tier pricing for a customer.' : 'Only owner and business-level admins can create billing blocks.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Standard</TableHead>
                <TableHead>Custom</TableHead>
                <TableHead>Diff</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Reg. Fee</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blocks.map(block => {
                const std = getStandardPrice(block);
                const custom = block.price_per_unit;
                const diff = (std != null && custom != null) ? custom - std : null;
                const dStatus = getDiscountStatus(block);
                return (
                <TableRow key={block.id}>
                  <TableCell>
                    <p className="font-medium text-foreground text-sm">{getCustomerName(block.customer_id)}</p>
                    {block.custom_block_name && <p className="text-[10px] text-muted-foreground">{block.custom_block_name}</p>}
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] border-border text-muted-foreground capitalize">{block.customer_type}</Badge></TableCell>
                  <TableCell>
                    <p className="text-xs text-muted-foreground">{std != null ? `KES ${fmtKES(std)}` : <span className="text-muted-foreground">—</span>}</p>
                    <p className="text-[10px] text-muted-foreground">/unit</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs font-semibold text-foreground">{custom != null ? `KES ${fmtKES(custom)}` : <span className="text-muted-foreground">Tier default</span>}</p>
                    <p className="text-[10px] text-muted-foreground">/unit</p>
                  </TableCell>
                  <TableCell>
                    {diff != null ? (
                      <span className={cn('text-xs font-semibold', diff < 0 ? 'text-success' : diff > 0 ? 'text-destructive' : 'text-secondary-foreground')}>
                        {diff < 0 ? '−' : diff > 0 ? '+' : ''}KES {fmtKES(Math.abs(diff))}
                      </span>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell>
                    {block.monthly_discount_pct > 0 || block.monthly_discount_flat > 0 ? (
                      <Badge className="bg-success/10 text-success border-success/30 text-[10px]">
                        {block.monthly_discount_pct > 0 && `${block.monthly_discount_pct}%`}
                        {block.monthly_discount_pct > 0 && block.monthly_discount_flat > 0 && ' + '}
                        {block.monthly_discount_flat > 0 && `KES ${fmtKES(block.monthly_discount_flat)}`}
                      </Badge>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                    {dStatus !== 'none' && (
                      <Badge variant="outline" className={cn('text-[9px] ml-1', dStatus === 'active' ? 'border-success/30 text-success' : dStatus === 'expiring' ? 'border-warning/30 text-warning' : 'border-destructive/30 text-destructive')}>
                        {dStatus === 'active' ? 'Active' : dStatus === 'expiring' ? 'Expiring' : 'Expired'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {block.registration_fee_waived || block.zero_registration ? (
                      <Badge className="bg-warning/10 text-warning border-warning/30 text-[10px]">Waived</Badge>
                    ) : <span className="text-xs text-foreground">KES {fmtKES(block.registration_fee_amount)}</span>}
                  </TableCell>
                  <TableCell>
                    {block.discount_expires_at ? (
                      <span className={cn('text-xs', dStatus === 'expired' ? 'text-destructive' : dStatus === 'expiring' ? 'text-warning' : 'text-secondary-foreground')}>
                        {format(new Date(block.discount_expires_at), 'dd MMM yyyy')}
                      </span>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell>
                    <p className="text-xs text-muted-foreground">{block.updated_at ? format(new Date(block.updated_at), 'dd MMM yyyy') : '—'}</p>
                    {block.approved_at && <p className="text-[10px] text-muted-foreground">approved {format(new Date(block.approved_at), 'dd MMM')}</p>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canManage ? (
                        <>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:bg-secondary-background" onClick={() => openEdit(block)} aria-label="Edit block"><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(block)} aria-label="Delete block"><Ban className="h-3.5 w-3.5" /></Button>
                        </>
                      ) : (
                        <span className="text-[10px] text-muted-foreground pr-2">Read-only</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        )}
      </CardContent>
    </Card>

      {/* Delete confirmation (destructive, billing-impacting) */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" />Remove custom pricing?</DialogTitle>
            <DialogDescription>This will remove the custom billing block for {deleteTarget ? getCustomerName(deleteTarget.customer_id) : ''}.</DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">The customer will revert to standard tier pricing. This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteTarget && deleteBlock.mutate(deleteTarget.id)} disabled={deleteBlock.isPending}>
              {deleteBlock.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {deleteBlock.isPending ? 'Removing…' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerBillingBlocks;
