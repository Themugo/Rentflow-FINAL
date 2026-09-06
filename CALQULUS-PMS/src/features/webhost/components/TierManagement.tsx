// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/shared/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Separator } from '@/shared/components/ui/separator';
import { Switch } from '@/shared/components/ui/switch';
import { Label } from '@/shared/components/ui/label';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import {
  Building2, Briefcase, Cog, Layers, Map, Check, X, Save,
  Zap, Star, Crown, Info, ArrowRight, RefreshCw, ChevronDown, ChevronUp,
  AlertTriangle, Users, Pencil, Trash2, Power, Banknote, ScrollText, FileSignature, Loader2
} from 'lucide-react';
import {
  PROPERTY_CATEGORIES, CATEGORIES_BY_GROUP, GROUP_LABELS, GROUP_COLORS,
  TIER_NAMES, TIER_BADGE_COLORS, getCategoryGroup
} from '@/shared/constants/propertyTypes';
import { onActivateKey } from "@/shared/lib/a11y";
import { cn } from '@/shared/lib/utils';
import { errorToast } from "@/shared/lib/errorToast";

const TIER_ICONS: Record<string, React.ElementType> = {
  lite: Zap, pro: Star, enterprise: Crown,
};

const TIER_DESCRIPTIONS: Record<string, string> = {
  lite:       'For individual landlords and small managers. Residential properties only.',
  pro:        'For growing agencies. Unlocks commercial, mixed-use, and gated estates.',
  enterprise: 'For large agencies. Unlimited properties, industrial, hotels, custom pricing.',
};

const TIER_COLORS_FULL: Record<string, string> = {
  lite:       'border-border bg-secondary-background',
  pro:        'border-[hsl(214_73%_48%/0.35)] bg-[hsl(214_73%_48%/0.06)]',
  enterprise: 'border-amber-300 bg-warning/10',
};

const TIERS = ['lite', 'pro', 'enterprise'] as const;

type TierRow = {
  id: string;
  tier_key: string;
  name: string;
  description?: string | null;
  price_per_property?: number | null;
  price_flat?: number | null;
  max_properties?: number;
  max_units?: number;
  features?: unknown;
  is_active?: boolean;
  display_order?: number;
  created_at?: string;
};

type TierLimitRow = {
  id: string;
  tier_key: string;
  category_group: string;
  max_properties: number;
  price_multiplier: number;
  created_at?: string;
};

type CategoryRow = {
  id: string;
  key: string;
  name?: string;
  description?: string;
  color?: string;
  group?: string;
  display_order?: number;
  billing_multiplier?: number | null;
  requires_tier?: string | null;
  created_at?: string;
};

const TierManagement: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTier, setActiveTier] = useState<'lite' | 'pro' | 'enterprise'>('lite');
  const [editedLimits, setEditedLimits] = useState<Record<string, Record<string, { max: string; mult: string }>>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ residential: true });

  // Fetch all tier data (REAL — subscription_tiers table)
  const { data: tiers = [], isLoading: tiersLoading, isError: tiersError, error: tiersErr, refetch: refetchTiers } = useQuery({
    queryKey: ['tier-management-tiers'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('subscription_tiers')
        .select('*').order('display_order'));
      if (error) throw error;
      return (data || []) as TierRow[];
    },
  });

  // REAL subscriber counts — managers assigned to each tier (manager_profiles.subscription_tier)
  const { data: subscriberCounts = {}, isLoading: subsLoading } = useQuery<Record<string, number>>({
    queryKey: ['tier-subscriber-counts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('manager_profiles').select('subscription_tier');
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of (data || []) as { subscription_tier: string }[]) {
        counts[row.subscription_tier] = (counts[row.subscription_tier] ?? 0) + 1;
      }
      return counts;
    },
  });

  const { data: tierLimits = [], isLoading: limitsLoading } = useQuery({
    queryKey: ['tier-management-limits'],
    queryFn: async () => {
      const { data } = await (supabase.from('property_tier_limits')
        .select('*'));
      return (data || []) as TierLimitRow[];
    },
  });

  const { data: categoryData = [] } = useQuery({
    queryKey: ['property-categories-webhost'],
    queryFn: async () => {
      const { data } = await (supabase.from('property_categories')
        .select('*').order('display_order'));
      return (data || []) as CategoryRow[];
    },
  });

  // Group limits by tier
  const limitsByTier: Record<string, Record<string, TierLimitRow>> = {};
  for (const lim of tierLimits) {
    if (!limitsByTier[lim.tier_key]) limitsByTier[lim.tier_key] = {};
    limitsByTier[lim.tier_key][lim.category_group] = lim;
  }

  const currentTierData = tiers.find(t => t.tier_key === activeTier);
  const currentLimits = limitsByTier[activeTier] ?? {};

  // Parse features array
  const parseFeatures = (f: string | string[]): string[] => {
    if (Array.isArray(f)) return f;
    if (typeof f === 'string') { try { return JSON.parse(f); } catch { return []; } }
    return [];
  };

  // Save tier pricing + limits
  const saveTier = useMutation({
    mutationFn: async () => {
      const limits = editedLimits[activeTier] ?? {};
      for (const [group, vals] of Object.entries(limits)) {
        const max  = parseInt(vals.max) || 0;
        const mult = parseFloat(vals.mult) || 1.0;
        const { error } = await supabase.rpc('save_property_tier_limit_atomic', {
          p_tier_key: activeTier, p_category_group: group, p_max_properties: max, p_price_multiplier: mult,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: 'Tier limits saved' });
      queryClient.invalidateQueries({ queryKey: ['tier-management-limits'] });
      setEditedLimits(p => ({ ...p, [activeTier]: {} }));
    },
    onError: (e: Error) => errorToast('Failed', e),
  });

  // Save category billing multiplier
  const saveCategoryMultiplier = useMutation({
    mutationFn: async ({ key, multiplier }: { key: string; multiplier: number }) => {
      const current = categoryData.find(c => c.key === key);
      const { error } = await supabase.rpc('update_property_category_billing_atomic', {
        p_key: key, p_billing_multiplier: multiplier, p_requires_tier: current?.requires_tier ?? 'lite',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Category rate updated' });
      queryClient.invalidateQueries({ queryKey: ['property-categories-webhost'] });
    },
  });

  // Toggle category requires_tier
  const setRequiresTier = useMutation({
    mutationFn: async ({ key, tier }: { key: string; tier: string }) => {
      const current = categoryData.find(c => c.key === key);
      const { error } = await supabase.rpc('update_property_category_billing_atomic', {
        p_key: key, p_billing_multiplier: current?.billing_multiplier ?? 1, p_requires_tier: tier,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['property-categories-webhost'] }),
  });

  // ── Tier-row actions (REAL columns on subscription_tiers) ──
  const [editDialog, setEditDialog] = useState<TierRow | null>(null);
  const [editForm, setEditForm] = useState({
    name: '', description: '', price_per_property: '', max_properties: '', max_units: '',
    features: '', is_active: true,
  });
  const [confirmDialog, setConfirmDialog] = useState<{ kind: 'deactivate' | 'delete'; tier: TierRow } | null>(null);

  const openEdit = (tier: TierRow) => {
    const features = parseFeatures(tier.features);
    setEditForm({
      name: tier.name ?? '',
      description: tier.description ?? '',
      price_per_property: String(tier.price_per_property ?? 0),
      max_properties: String(tier.max_properties ?? 0),
      max_units: String(tier.max_units ?? 0),
      features: features.join('\n'),
      is_active: tier.is_active ?? true,
    });
    setEditDialog(tier);
  };

  // Update tier row — writes only real columns (name, description, price_per_property,
  // max_properties, max_units, features, is_active). No schema change.
  const updateTier = useMutation({
    mutationFn: async () => {
      if (!editDialog) return;
      const name = editForm.name.trim();
      if (!name) throw new Error('Tier name is required');
      const price = parseFloat(editForm.price_per_property);
      if (isNaN(price) || price < 0) throw new Error('Price must be a non-negative number');
      const maxP = parseInt(editForm.max_properties) || 0;
      const maxU = parseInt(editForm.max_units) || 0;
      const featuresArr = editForm.features.split('\n').map(f => f.trim()).filter(Boolean);
      const { error } = await supabase.rpc('save_subscription_tier_atomic', {
        p_tier_id: editDialog.id, p_name: name, p_description: editForm.description.trim() || null,
        p_price_per_property: price, p_price_flat: editDialog.price_flat ?? null, p_max_properties: maxP, p_max_units: maxU,
        p_features: featuresArr, p_is_active: editForm.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Tier updated' });
      queryClient.invalidateQueries({ queryKey: ['tier-management-tiers'] });
      setEditDialog(null);
    },
    onError: (e: Error) => errorToast('Failed to update tier', e),
  });

  // Activate / deactivate a tier — toggles is_active. Warns (via confirmDialog) when
  // deactivating a tier that has active subscribers (REAL subscriber-impact check).
  const toggleTierActive = useMutation({
    mutationFn: async ({ tier, activate }: { tier: TierRow; activate: boolean }) => {
      const { error } = await supabase.rpc('save_subscription_tier_atomic', {
        p_tier_id: tier.id, p_name: tier.name, p_description: tier.description ?? null,
        p_price_per_property: tier.price_per_property ?? 0, p_price_flat: tier.price_flat ?? null,
        p_max_properties: tier.max_properties ?? 0, p_max_units: tier.max_units ?? 0, p_features: tier.features ?? [], p_is_active: activate,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast({ title: vars.activate ? 'Tier activated' : 'Tier deactivated' });
      queryClient.invalidateQueries({ queryKey: ['tier-management-tiers'] });
      setConfirmDialog(null);
    },
    onError: (e: Error) => errorToast('Failed', e),
  });

  // Delete a tier. Blocked when the tier has subscribers (do not silently orphan
  // subscription assignments). The backend table supports delete; we add a safety gate.
  const deleteTier = useMutation({
    mutationFn: async (tier: TierRow) => {
      throw new Error('Tier deletion is disabled; deactivate the tier instead to preserve subscription history.');
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Tier deleted' });
      queryClient.invalidateQueries({ queryKey: ['tier-management-tiers'] });
      setConfirmDialog(null);
    },
    onError: (e: Error) => errorToast('Failed to delete', e),
  });

  const getEditedLimit = (group: string, field: 'max' | 'mult') => {
    return editedLimits[activeTier]?.[group]?.[field]
      ?? (field === 'max' ? String(currentLimits[group]?.max_properties ?? 0) : String(currentLimits[group]?.price_multiplier ?? 1.0));
  };

  const setEditedLimit = (group: string, field: 'max' | 'mult', val: string) => {
    setEditedLimits(p => ({
      ...p,
      [activeTier]: { ...p[activeTier], [group]: { ...p[activeTier]?.[group], [field]: val } },
    }));
  };

  const hasUnsavedChanges = Object.keys(editedLimits[activeTier] ?? {}).length > 0;

  const refresh = () => {
    refetchTiers();
    queryClient.invalidateQueries({ queryKey: ['tier-management-limits'] });
    queryClient.invalidateQueries({ queryKey: ['tier-subscriber-counts'] });
    queryClient.invalidateQueries({ queryKey: ['property-categories-webhost'] });
  };

  const fmtKES = (n: number) => n.toLocaleString('en-KE');

  if (tiersLoading || limitsLoading) return <div className="space-y-4">{[...Array(3)].map((_,i) => <Skeleton key={i} className="h-32 w-full bg-secondary-background"/>)}</div>;

  return (
    <div className="space-y-5">
      {/* Control-center header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 enterprise-card p-4 sm:p-5">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Layers className="h-5 w-5 text-warning" />
            Subscription Tier Management Console
          </h2>
          <p className="text-muted-foreground text-xs mt-1">
            Configure subscription plans, pricing, limits, and tier status. Changes apply to the subscription_tiers configuration.
          </p>
        </div>
        <Button variant="outline" size="sm" className="border-border text-muted-foreground hover:bg-secondary-background hover:text-foreground h-9 rounded-xl text-xs" onClick={refresh} aria-label="Refresh tiers">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh
        </Button>
      </div>

      {/* Billing-relationship navigation — connects the commercial controls without duplicating them */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Billing', desc: 'Monitors actual billing activity', icon: Banknote, current: false },
          { label: 'Tiers', desc: 'Define subscription plans', icon: Layers, current: true },
          { label: 'Billing Rules', desc: 'Define billing behaviour', icon: ScrollText, current: false },
          { label: 'Custom Pricing', desc: 'Account-specific pricing', icon: FileSignature, current: false },
        ].map(({ label, desc, icon: Icon, current }) => (
          <div key={label} className={cn('flex items-center gap-2 p-2.5 rounded-lg border text-left', current ? 'border-warning/40 bg-warning/10' : 'border-border bg-secondary-background opacity-70')}>
            <Icon className={cn('h-4 w-4 shrink-0', current ? 'text-warning' : 'text-secondary-foreground')} />
            <div className="min-w-0">
              <p className={cn('text-xs font-semibold truncate', current ? 'text-warning' : 'text-secondary-foreground')}>{label}{current && ' (here)'}</p>
              <p className="text-[10px] text-muted-foreground truncate">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tier registry — REAL subscription_tiers rows, dynamically read */}
      {tiersError ? (
        <div className="p-8 text-center rounded-2xl border border-destructive/30 bg-destructive/5">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
          <p className="text-sm font-semibold text-destructive">Unable to load tiers.</p>
          <p className="text-xs text-muted-foreground mt-1 mb-3">{(tiersErr as Error)?.message ?? 'Try again.'}</p>
          <Button variant="outline" size="sm" onClick={refresh} className="border-destructive/40 text-destructive hover:bg-destructive/10">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
        </div>
      ) : tiers.length === 0 ? (
        <div className="p-10 text-center rounded-2xl border border-border bg-secondary-background">
          <Layers className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No subscription tiers configured.</p>
          <p className="text-xs text-muted-foreground mt-1">Tiers will appear here once defined in subscription_tiers.</p>
        </div>
      ) : (
        <Card className="border-border">
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold text-foreground">Tier registry</p>
              <p className="text-xs text-muted-foreground mt-0.5">Name, price, status, limits, features, and subscriber impact. Pricing is per property / month.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-[10px] font-bold uppercase tracking-wide text-muted-foreground bg-secondary-background">
                    <th className="text-left px-4 py-2.5">Tier</th>
                    <th className="text-left px-4 py-2.5">Price</th>
                    <th className="text-center px-4 py-2.5">Limits</th>
                    <th className="text-center px-4 py-2.5">Subscribers</th>
                    <th className="text-center px-4 py-2.5">Status</th>
                    <th className="text-right px-4 py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {tiers.map(tier => {
                    const Icon = TIER_ICONS[tier.tier_key] ?? Layers;
                    const features = parseFeatures(tier.features);
                    const subs = subscriberCounts[tier.tier_key] ?? 0;
                    const isActive = tier.is_active ?? true;
                    return (
                      <tr key={tier.id} className="hover:bg-secondary-background">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-secondary-background shrink-0">
                              <Icon className="h-4 w-4 text-warning" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground truncate">{tier.name || TIER_NAMES[tier.tier_key] || tier.tier_key}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-xs">{tier.description || TIER_DESCRIPTIONS[tier.tier_key] || '—'}</p>
                              {features.length > 0 && (
                                <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-xs">{features.slice(0, 3).join(' · ')}{features.length > 3 ? ` +${features.length - 3}` : ''}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-foreground">KES {fmtKES(tier.price_per_property ?? 0)}</p>
                          <p className="text-[10px] text-muted-foreground">/ property / month</p>
                          {tier.price_flat ? <p className="text-[10px] text-muted-foreground">+ flat KES {fmtKES(tier.price_flat)}</p> : null}
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-foreground">
                          <p>{tier.max_properties ?? 0} props</p>
                          <p className="text-[10px] text-muted-foreground">{tier.max_units ?? 0} units</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {subsLoading ? (
                            <Skeleton className="h-5 w-8 mx-auto" />
                          ) : (
                            <span className={cn('inline-flex items-center gap-1 text-xs font-medium', subs > 0 ? 'text-success' : 'text-secondary-foreground')}>
                              <Users className="h-3 w-3" />{subs}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="outline" className={cn('text-[10px]', isActive ? 'bg-success/10 text-success border-success/30' : 'bg-secondary-foreground/10 text-secondary-foreground border-border/30')}>
                            {isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:bg-secondary-background" onClick={() => openEdit(tier)} aria-label={`Edit ${tier.name}`} title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {isActive ? (
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-warning hover:bg-warning/10" onClick={() => setConfirmDialog({ kind: 'deactivate', tier })} aria-label={`Deactivate ${tier.name}`} title="Deactivate">
                                <Power className="h-3.5 w-3.5" />
                              </Button>
                            ) : (
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-success hover:bg-success/10" onClick={() => toggleTierActive.mutate({ tier, activate: true })} aria-label={`Activate ${tier.name}`} title="Activate">
                                <Power className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10" onClick={() => setConfirmDialog({ kind: 'delete', tier })} aria-label={`Delete ${tier.name}`} title="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tier selector for limits configuration */}
      <div className="flex flex-wrap gap-2">
        {tiers.map(tier => {
          const Icon = TIER_ICONS[tier.tier_key] ?? Layers;
          const isActive = activeTier === tier.tier_key;
          return (
            <button key={tier.id} type="button" onClick={() => setActiveTier(tier.tier_key as 'lite' | 'pro' | 'enterprise')}
              className={cn('rounded-xl border-2 px-3 py-2 text-left transition-all flex items-center gap-2', isActive ? 'border-warning/50 bg-warning/8' : 'border-border bg-secondary-background hover:border-border')}>
              <Icon className={cn('h-4 w-4', isActive ? 'text-warning' : 'text-muted-foreground')} />
              <div>
                <p className="font-semibold text-foreground text-sm">{tier.name || TIER_NAMES[tier.tier_key]}</p>
                <p className="text-xs text-muted-foreground">KES {tier.price_per_property ?? '—'}/prop/mo</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active tier detail */}
      <Card className="bg-card border-warning/15">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {React.createElement(TIER_ICONS[activeTier], { className: 'h-5 w-5 text-warning' })}
              <CardTitle className="text-foreground">{TIER_NAMES[activeTier]} — property type limits</CardTitle>
            </div>
            {hasUnsavedChanges && (
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-white gap-1.5"
                onClick={() => saveTier.mutate()} disabled={saveTier.isPending}>
                <Save className="h-3.5 w-3.5"/>{saveTier.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            )}
          </div>
          <CardDescription className="text-muted-foreground">
            Set how many properties of each type this tier allows, and the pricing multiplier applied
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(CATEGORIES_BY_GROUP).map(([group, cats]) => {
            const isExpanded = expandedGroups[group] ?? false;
            const limit = currentLimits[group];
            const maxProps = editedLimits[activeTier]?.[group]?.max ?? String(limit?.max_properties ?? 0);
            const isAllowed = parseInt(maxProps) > 0;

            return (
              <div key={group} className={`rounded-xl border overflow-hidden ${isAllowed ? 'border-warning/12' : 'border-border/30'}`}>
                {/* Group header */}
                <div
                  role="button"
                  tabIndex={0}
                  className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${isAllowed ? 'bg-secondary-background/60 hover:bg-warning/6' : 'bg-secondary-background hover:bg-secondary-background/50'}`}
                  onClick={() => setExpandedGroups(p => ({ ...p, [group]: !isExpanded }))}
                  onKeyDown={onActivateKey(() => setExpandedGroups(p => ({ ...p, [group]: !isExpanded })))}
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={`text-xs ${GROUP_COLORS[group]}`}>
                      {GROUP_LABELS[group]}
                    </Badge>
                    {isAllowed
                      ? <span className="text-xs text-green-400">✓ Allowed — max {maxProps === '999' ? '∞' : maxProps}</span>
                      : <span className="text-xs text-destructive">✗ Not available on {TIER_NAMES[activeTier]}</span>
                    }
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Quick toggle */}
                    <div onClick={e => e.stopPropagation()}>
                      <Switch
                        checked={isAllowed}
                        onCheckedChange={v => setEditedLimit(group, 'max', v ? '10' : '0')}
                        className="data-[state=checked]:bg-primary"
                      />
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground"/> : <ChevronDown className="h-4 w-4 text-muted-foreground"/>}
                  </div>
                </div>

                {/* Expanded: per-category details + limit editing */}
                {isExpanded && (
                  <div className="p-3 border-t border-border/30 bg-secondary-background">
                    {/* Limit controls */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div>
                        <Label className="text-xs text-foreground/90">Max properties (0 = blocked, 999 = ∞)</Label>
                        <Input
                          type="number" min="0" max="999"
                          value={getEditedLimit(group, 'max')}
                          onChange={e => setEditedLimit(group, 'max', e.target.value)}
                          className="mt-1 bg-card border-border/60 text-foreground h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-foreground/90">Price multiplier (1.0 = base tier rate)</Label>
                        <Input
                          type="number" min="0" max="5" step="0.1"
                          value={getEditedLimit(group, 'mult')}
                          onChange={e => setEditedLimit(group, 'mult', e.target.value)}
                          className="mt-1 bg-card border-border/60 text-foreground h-8 text-sm"
                        />
                      </div>
                    </div>

                    {/* Category rows */}
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Property types in this group</p>
                    <div className="space-y-1.5">
                      {cats.map(cat => {
                        const dbCat = categoryData.find((c: CategoryRow) => c.key === cat.key);
                        const mult = dbCat?.billing_multiplier ?? cat.billingMultiplier;
                        const reqTier = dbCat?.requires_tier ?? cat.requiresTier;
                        return (
                          <div key={cat.key} className="flex items-center justify-between p-2 rounded-lg bg-card border border-border/20">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="h-6 w-6 rounded flex items-center justify-center shrink-0 bg-navy-mid/15">
                                <span className="text-xs">📋</span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-foreground truncate">{cat.name}</p>
                                <p className="text-xs text-muted-foreground/70 truncate">{cat.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              {/* Category multiplier */}
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <span>×</span>
                                <Input
                                  type="number" min="0.5" max="5" step="0.1"
                                  defaultValue={String(mult)}
                                  onBlur={e => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val) && val !== mult) {
                                      saveCategoryMultiplier.mutate({ key: cat.key, multiplier: val });
                                    }
                                  }}
                                  className="w-14 h-6 bg-card border-border text-foreground text-xs text-center p-1"
                                />
                              </div>
                              {/* Requires tier */}
                              <select
                                value={reqTier}
                                onChange={e => setRequiresTier.mutate({ key: cat.key, tier: e.target.value })}
                                className="text-xs bg-card border border-border text-foreground/90 rounded px-1 py-0.5 h-6"
                              >
                                <option value="lite">Lite+</option>
                                <option value="pro">Pro+</option>
                                <option value="enterprise">Enterprise</option>
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Info: how billing is calculated */}
      <Card className="bg-secondary-background/50 border-border/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5"/>
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground/90">How billing is calculated</p>
              <p>Monthly charge = Tier base rate × Group multiplier × Category multiplier</p>
              <p className="font-mono text-foreground/90">e.g. Pro office: KES 600 × 1.8 (commercial group) × 2.0 (office category) = KES 2,160/property/month</p>
              <p>The effective rate per property varies by both the tier the manager is on and the type of property they manage. Commercial and industrial properties always cost more than residential.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tier edit dialog — edits REAL columns on subscription_tiers */}
      <Dialog open={!!editDialog} onOpenChange={open => !open && setEditDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit tier{editDialog ? ` — ${editDialog.name || editDialog.tier_key}` : ''}</DialogTitle>
            <DialogDescription>Update plan name, pricing, limits, features, and status. Pricing is per property / month.</DialogDescription>
          </DialogHeader>
          {editDialog && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Name</Label>
                <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="mt-1 bg-card border-border text-foreground" />
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={2} className="mt-1 bg-card border-border text-foreground" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Price / prop / mo (KES)</Label>
                  <Input type="number" min="0" value={editForm.price_per_property} onChange={e => setEditForm(f => ({ ...f, price_per_property: e.target.value }))} className="mt-1 bg-card border-border text-foreground" />
                </div>
                <div>
                  <Label className="text-xs">Max properties</Label>
                  <Input type="number" min="0" value={editForm.max_properties} onChange={e => setEditForm(f => ({ ...f, max_properties: e.target.value }))} className="mt-1 bg-card border-border text-foreground" />
                </div>
                <div>
                  <Label className="text-xs">Max units</Label>
                  <Input type="number" min="0" value={editForm.max_units} onChange={e => setEditForm(f => ({ ...f, max_units: e.target.value }))} className="mt-1 bg-card border-border text-foreground" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Features (one per line)</Label>
                <Textarea value={editForm.features} onChange={e => setEditForm(f => ({ ...f, features: e.target.value }))} rows={3} placeholder="e.g. Residential properties only" className="mt-1 bg-card border-border text-foreground" />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <Label className="text-xs text-foreground">Active</Label>
                  <p className="text-[10px] text-muted-foreground">Inactive tiers are unavailable for new subscriptions.</p>
                </div>
                <Switch checked={editForm.is_active} onCheckedChange={v => setEditForm(f => ({ ...f, is_active: v }))} className="data-[state=checked]:bg-primary" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>Cancel</Button>
            <Button onClick={() => updateTier.mutate()} disabled={updateTier.isPending} className="bg-primary hover:bg-primary/90 text-white">
              {updateTier.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog for destructive actions (deactivate / delete) */}
      <Dialog open={!!confirmDialog} onOpenChange={open => !open && setConfirmDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              {confirmDialog?.kind === 'delete' ? 'Delete tier' : 'Deactivate tier'}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog && `"${confirmDialog.tier.name || confirmDialog.tier.tier_key}"`}
            </DialogDescription>
          </DialogHeader>
          {confirmDialog && (subscriberCounts[confirmDialog.tier.tier_key] ?? 0) > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg border border-warning/30 bg-warning/5">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <p className="text-xs text-warning">
                <strong className="text-warning">{subscriberCounts[confirmDialog.tier.tier_key]}</strong> manager{subscriberCounts[confirmDialog.tier.tier_key] !== 1 ? 's' : ''} currently use this tier.
                {confirmDialog.kind === 'delete'
                  ? ' Deleting it would orphan those subscription assignments — deletion is blocked.'
                  : ' Deactivating will prevent new subscriptions but existing assignments remain.'}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>Cancel</Button>
            {confirmDialog?.kind === 'delete' ? (
              (subscriberCounts[confirmDialog.tier.tier_key] ?? 0) > 0 ? (
                <Button disabled className="bg-destructive/40 text-destructive/70 cursor-not-allowed">Cannot delete — subscribers exist</Button>
              ) : (
                <Button onClick={() => deleteTier.mutate(confirmDialog.tier)} disabled={deleteTier.isPending} className="bg-destructive hover:bg-destructive/90 text-white">
                  {deleteTier.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Delete permanently
                </Button>
              )
            ) : (
              <Button onClick={() => toggleTierActive.mutate({ tier: confirmDialog.tier, activate: false })} disabled={toggleTierActive.isPending} className="bg-primary hover:bg-primary/90 text-white">
                {toggleTierActive.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Deactivate
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TierManagement;
