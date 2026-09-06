import { format } from "date-fns";
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/shared/hooks/use-toast';
import { Card, CardContent } from '@/shared/components/ui/card';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import {
  Home, Search, CheckCircle, Clock, XCircle,
  Banknote, Building, Info, AlertTriangle, RefreshCw,
  ChevronDown, ChevronUp, Users, Unlink, Loader2,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { onActivateKey } from '@/shared/lib/a11y';
import { errorToast } from "@/shared/lib/errorToast";

// System landlords are landlords whose property_landlords.manager_id IS NULL
// These landlords are NOT under any manager/agency — they fall under webhost oversight.
// Managed landlords (manager_id IS NOT NULL) are NEVER shown here.

interface SystemLandlordLink {
  id: string;
  landlord_user_id: string;
  property_id: string;
  property_name: string;
  property_address: string;
  property_units: number;
  property_occupied: number;
  property_status: string;
  revenue_share_pct: number;
  assigned_at: string;
}

interface LandlordProfile {
  full_name: string | null;
  email: string;
  phone: string | null;
  created_at: string | null;
}

interface LandlordGroup {
  landlord_user_id: string;
  profile: LandlordProfile | null;
  links: SystemLandlordLink[];
}

interface PayoutRequest {
  id: string;
  property_id: string;
  property_name: string;
  landlord_user_id: string;
  landlord_email: string;
  amount: number;
  period_start: string;
  period_end: string;
  notes: string | null;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  created_at: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n);

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-[hsl(214_73%_48%/0.12)] text-[hsl(214_73%_35%)] border-[hsl(214_73%_48%/0.25)]',
  paid: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-destructive/15 text-destructive border-red-200',
};

const SystemLandlordManagement: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [activeTab, setActiveTab] = useState<'landlords' | 'payouts'>('landlords');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [payoutDialog, setPayoutDialog] = useState<{ id: string; status: string; label: string } | null>(null);

  // ── Fetch system landlords (manager_id IS NULL only) ─────────────
  const { data: landlordGroups = [], isLoading, isError, error, refetch } = useQuery<LandlordGroup[]>({
    queryKey: ['system-landlords'],
    queryFn: async () => {
      // CRITICAL: Only fetch where manager_id IS NULL (webhost oversight scope)
      const { data: links, error } = await supabase
        .from('property_landlords')
        .select('id, landlord_user_id, property_id, revenue_share_pct, assigned_at')
        .is('manager_id', null);

      if (error) throw error;
      if (!links || links.length === 0) return [];

      const propIds = (links as { property_id: string }[]).map(l => l.property_id);
      const userIds = (links as { landlord_user_id: string }[]).map(l => l.landlord_user_id);

      const [propertiesRes, profilesRes] = await Promise.all([
        supabase.from('properties').select('id, name, address, units, occupied, status').in('id', propIds),
        supabase.from('profiles').select('id, full_name, email, phone, created_at').in('id', userIds),
      ]);

      const propMap = new Map((propertiesRes.data || []).map((p: { id: string; name: string; address: string; units: number; occupied: number; status: string }) => [p.id, p]));
      const profileMap = new Map((profilesRes.data || []).map((p: { id: string; full_name: string | null; email: string; phone: string | null; created_at: string | null }) => [p.id, p]));

      const linkRows = (links as { id: string; landlord_user_id: string; property_id: string; revenue_share_pct: number; assigned_at: string }[]).map(link => {
        const prop = propMap.get(link.property_id);
        return {
          id: link.id,
          landlord_user_id: link.landlord_user_id,
          property_id: link.property_id,
          property_name: prop?.name ?? 'Unknown property',
          property_address: prop?.address ?? '',
          property_units: prop?.units ?? 0,
          property_occupied: prop?.occupied ?? 0,
          property_status: prop?.status ?? 'unknown',
          revenue_share_pct: link.revenue_share_pct,
          assigned_at: link.assigned_at,
        } as SystemLandlordLink;
      });

      // Group by landlord
      const groupMap = new Map<string, LandlordGroup>();
      for (const link of linkRows) {
        if (!groupMap.has(link.landlord_user_id)) {
          groupMap.set(link.landlord_user_id, {
            landlord_user_id: link.landlord_user_id,
            profile: profileMap.get(link.landlord_user_id) ?? null,
            links: [],
          });
        }
        groupMap.get(link.landlord_user_id)!.links.push(link);
      }
      return Array.from(groupMap.values());
    },
  });

  // ── Fetch payout requests routed to webhost ───────────────────────
  const { data: payouts = [], isLoading: payoutsLoading, isError: payoutsError, refetch: refetchPayouts } = useQuery({
    queryKey: ['webhost-payout-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payout_requests')
        .select('*')
        .eq('recipient_type', 'webhost')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const rows = (data || []) as { id: string; property_id: string; landlord_user_id: string; amount: number; period_start: string; period_end: string; notes: string | null; status: 'pending' | 'approved' | 'paid' | 'rejected'; created_at: string }[];

      const propIds = [...new Set(rows.map(r => r.property_id))];
      const landlordIds = [...new Set(rows.map(r => r.landlord_user_id))];

      const [propsRes, profilesRes] = await Promise.all([
        supabase.from('properties').select('id, name').in('id', propIds),
        supabase.from('profiles').select('id, email').in('id', landlordIds),
      ]);

      const propMap2 = new Map((propsRes.data || []).map((p: { id: string; name: string }) => [p.id, p.name]));
      const profileMap2 = new Map((profilesRes.data || []).map((p: { id: string; email: string }) => [p.id, p.email]));

      return rows.map(r => ({
        ...r,
        property_name: propMap2.get(r.property_id) ?? 'Property',
        landlord_email: profileMap2.get(r.landlord_user_id) ?? 'Unknown',
      })) as PayoutRequest[];
    },
  });

  // ── Approve / reject / mark paid payout ──────────────────────────
  const updatePayout = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.rpc('transition_payout_request_atomic', {
        p_payout_id: id,
        p_target_status: status,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['webhost-payout-requests'] });
      toast({ title: `Payout ${vars.status}` });
      setPayoutDialog(null);
    },
    onError: (err: Error) => errorToast('Failed', err),
  });

  const pendingPayouts = payouts.filter(p => p.status === 'pending').length;

  // ── Real derived totals (system-landlord scope only) ─────────────
  const totalLandlords = landlordGroups.length;
  const totalLinks = landlordGroups.reduce((s, g) => s + g.links.length, 0);
  const landlordHasActive = (g: LandlordGroup) => g.links.some(l => l.property_status === 'active');
  const withActiveCount = landlordGroups.filter(landlordHasActive).length;
  const withInactiveCount = landlordGroups.filter(g => !landlordHasActive(g)).length;

  // ── Search + filter (client-side over fetched data) ──────────────
  const searchQ = search.trim().toLowerCase();
  const filteredLandlords = landlordGroups.filter(g => {
    if (statusFilter === 'active' && !landlordHasActive(g)) return false;
    if (statusFilter === 'inactive' && landlordHasActive(g)) return false;
    if (!searchQ) return true;
    return (
      (g.profile?.email?.toLowerCase().includes(searchQ) ?? false) ||
      (g.profile?.full_name?.toLowerCase().includes(searchQ) ?? false) ||
      g.links.some(l => l.property_name.toLowerCase().includes(searchQ))
    );
  });

  const refresh = () => { refetch(); refetchPayouts(); };

  const summaryCards = [
    { key: 'total', label: 'Total Landlords', count: totalLandlords, icon: Users, cls: 'border-border bg-secondary-background text-secondary-foreground' },
    { key: 'active', label: 'With Active Property', count: withActiveCount, icon: CheckCircle, cls: 'border-success/40 bg-success/10 text-success' },
    { key: 'inactive', label: 'With Inactive Property', count: withInactiveCount, icon: Clock, cls: 'border-warning/40 bg-warning/10 text-warning' },
    { key: 'links', label: 'Properties Linked', count: totalLinks, icon: Building, cls: 'border-primary/40 bg-primary/10 text-primary' },
  ] as const;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 enterprise-card p-4 sm:p-5">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Home className="h-5 w-5 text-warning" />
            Landlord Account &amp; Portfolio Oversight Console
          </h2>
          <p className="text-muted-foreground text-xs mt-1">
            System landlords under platform oversight and their payout requests. Managed landlords are visible only to their manager.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 lg:w-56">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email, property..."
              className="pl-8 h-9 rounded-xl bg-card border-border text-foreground placeholder:text-muted-foreground text-xs"
              aria-label="Search landlords"
            />
          </div>
          <Button variant="outline" size="sm" className="border-border text-muted-foreground hover:bg-secondary-background hover:text-foreground h-9 rounded-xl text-xs" onClick={refresh} aria-label="Refresh landlords">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh
          </Button>
        </div>
      </div>

      {/* Scope banner — preserves the hard access-rule explanation */}
      <div className="flex items-start gap-3 p-3.5 rounded-xl border border-warning/30 bg-warning/5">
        <Info className="h-4 w-4 text-warning shrink-0 mt-0.5" />
        <p className="text-xs text-warning/90">
          <strong className="text-warning">System landlords only.</strong> This view shows landlords whose properties are not linked to any manager or agency (property_landlords.manager_id IS NULL). Landlords under a manager are managed exclusively by that manager and are not visible here.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {summaryCards.map(({ key, label, count, icon: Icon, cls }) => (
          <div key={key} className={cn('flex items-center justify-between gap-2 p-3 rounded-xl border text-left', cls)}>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wide opacity-80 block">{label}</span>
              <strong className="font-['Outfit'] text-xl font-bold text-foreground">{count}</strong>
            </div>
            <Icon className="h-5 w-5 shrink-0 opacity-80" />
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {[
          { key: 'landlords', label: `Landlord Registry (${totalLandlords})` },
          { key: 'payouts', label: `Payout Requests${pendingPayouts > 0 ? ` (${pendingPayouts} pending)` : ''}` },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as 'landlords' | 'payouts')}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab.key
                ? 'border-amber-400 text-warning'
                : 'border-transparent text-secondary-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Landlord registry ── */}
      {activeTab === 'landlords' && (
        <Card className="border-border">
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
              <p className="text-xs text-muted-foreground">Click a landlord to inspect their portfolio and property relationships.</p>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="h-8 w-40 text-xs bg-card border-border text-foreground" aria-label="Filter by property status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Landlords</SelectItem>
                  <SelectItem value="active" className="text-xs">With Active Property</SelectItem>
                  <SelectItem value="inactive" className="text-xs">Inactive Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : isError ? (
              <div className="p-8 text-center">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
                <p className="text-sm font-semibold text-destructive">Unable to load landlords.</p>
                <p className="text-xs text-muted-foreground mt-1 mb-3">{(error as Error)?.message ?? 'Try again.'}</p>
                <Button variant="outline" size="sm" onClick={refresh} className="border-destructive/40 text-destructive hover:bg-destructive/10">
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
                </Button>
              </div>
            ) : filteredLandlords.length === 0 ? (
              <EmptyState icon={Home} title={totalLandlords === 0 ? 'No landlords registered.' : (searchQ || statusFilter !== 'all') ? 'No landlords match the current filters.' : 'No landlords registered.'} />
            ) : (
              <div className="divide-y divide-slate-800">
                <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground bg-secondary-background">
                  <div className="col-span-4">Landlord</div>
                  <div className="col-span-2 text-center">Properties</div>
                  <div className="col-span-2 text-center">Units</div>
                  <div className="col-span-2 text-center">Portfolio</div>
                  <div className="col-span-2 text-right">Since</div>
                </div>
                {filteredLandlords.map(g => {
                  const expanded = expandedId === g.landlord_user_id;
                  const propCount = g.links.length;
                  const unitCount = g.links.reduce((s, l) => s + l.property_units, 0);
                  const hasActive = landlordHasActive(g);
                  const since = g.links.map(l => l.assigned_at).sort()[0];
                  return (
                    <div key={g.landlord_user_id}>
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : g.landlord_user_id)}
                        onKeyDown={onActivateKey(() => setExpandedId(expanded ? null : g.landlord_user_id))}
                        aria-expanded={expanded}
                        aria-label={`View landlord ${g.profile?.full_name ?? g.profile?.email ?? 'landlord'}`}
                        className="w-full text-left grid grid-cols-1 md:grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-secondary-background transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-inset"
                      >
                        <div className="md:col-span-4 min-w-0 flex items-center gap-2">
                          <Home className="h-3.5 w-3.5 text-warning shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm text-foreground truncate font-medium">{g.profile?.full_name || 'Landlord'}</p>
                            <p className="text-xs text-muted-foreground truncate">{g.profile?.email ?? '—'}</p>
                          </div>
                        </div>
                        <div className="md:col-span-2 md:text-center flex items-center gap-1 md:justify-center">
                          <Building className="h-3 w-3 text-muted-foreground md:hidden" />
                          <span className="text-xs text-foreground">{propCount}</span>
                        </div>
                        <div className="md:col-span-2 md:text-center text-xs text-foreground">{unitCount}</div>
                        <div className="md:col-span-2 md:text-center flex items-center gap-1.5 md:justify-center">
                          <Badge variant="outline" className={cn('text-[10px]', hasActive ? 'bg-success/10 text-success border-success/30' : 'bg-warning/10 text-warning border-warning/30')}>
                            {hasActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="md:col-span-2 md:text-right flex items-center justify-between md:justify-end gap-1 text-xs text-muted-foreground">
                          <span>{since ? format(new Date(since), 'dd MMM yyyy') : '—'}</span>
                          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </button>
                      {expanded && (
                        <div className="px-4 py-4 bg-card border-t border-border space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-muted-foreground">Email</span>
                              <span className="text-foreground truncate">{g.profile?.email ?? '—'}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-muted-foreground">Phone</span>
                              <span className="text-foreground">{g.profile?.phone ?? '—'}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-muted-foreground">Account created</span>
                              <span className="text-foreground">{g.profile?.created_at ? format(new Date(g.profile.created_at), 'dd MMM yyyy') : '—'}</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Properties (Landlord -&gt; Property -&gt; Manager)</p>
                            <div className="space-y-1.5">
                              {g.links.map(l => {
                                const occPct = l.property_units > 0 ? Math.round((l.property_occupied / l.property_units) * 100) : 0;
                                const incomplete = l.property_name === 'Unknown property';
                                return (
                                  <div key={l.id} className={cn('flex items-center gap-2 p-2 rounded-lg border text-xs', incomplete ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-secondary-background')}>
                                    <Building className={cn('h-3.5 w-3.5 shrink-0', incomplete ? 'text-destructive' : 'text-warning')} />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-foreground truncate">{l.property_name}</p>
                                      <p className="text-[10px] text-muted-foreground truncate">{l.property_address || '—'} · {l.property_units} units · {occPct}% occupied</p>
                                    </div>
                                    <Badge variant="outline" className="text-[9px] capitalize border-border text-muted-foreground">{l.property_status}</Badge>
                                    <Badge variant="outline" className="text-[9px] border-warning/30 text-warning bg-warning/10">{l.revenue_share_pct}%</Badge>
                                    {incomplete && (
                                      <span className="text-[9px] text-destructive flex items-center gap-1 shrink-0"><AlertTriangle className="h-3 w-3" />Missing</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                              <Unlink className="h-3 w-3" />No manager assigned — these properties fall under platform oversight.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Payout requests ── */}
      {activeTab === 'payouts' && (
        <Card className="border-border">
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold text-foreground">Payout requests from system landlords</p>
              <p className="text-xs text-muted-foreground mt-0.5">Review and approve revenue payout requests. State changes require confirmation.</p>
            </div>
            {payoutsLoading ? (
              <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : payoutsError ? (
              <div className="p-8 text-center">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
                <p className="text-sm font-semibold text-destructive">Unable to load payout requests.</p>
                <Button variant="outline" size="sm" onClick={refresh} className="border-destructive/40 text-destructive hover:bg-destructive/10 mt-3">
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
                </Button>
              </div>
            ) : payouts.length === 0 ? (
              <EmptyState icon={Banknote} title="No payout requests routed to you yet." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Landlord</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">{p.landlord_email}</TableCell>
                      <TableCell className="text-sm font-medium">{p.property_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(p.period_start), 'dd/MM')}
                        {' – '}
                        {format(new Date(p.period_end), 'dd/MM/yy')}
                      </TableCell>
                      <TableCell className="font-semibold">{fmt(p.amount)}</TableCell>
                      <TableCell>
                        <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border', STATUS_STYLES[p.status])}>
                          {p.status === 'paid' && <CheckCircle className="h-3 w-3" />}
                          {p.status === 'pending' && <Clock className="h-3 w-3" />}
                          {p.status === 'rejected' && <XCircle className="h-3 w-3" />}
                          {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {p.status === 'pending' && (
                            <>
                              <Button size="sm" variant="outline" className="h-7 text-xs border-green-300 text-green-700 hover:bg-green-50" onClick={() => setPayoutDialog({ id: p.id, status: 'approved', label: 'Approve this payout request?' })}>Approve</Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:bg-destructive/10" onClick={() => setPayoutDialog({ id: p.id, status: 'rejected', label: 'Reject this payout request?' })}>Reject</Button>
                            </>
                          )}
                          {p.status === 'approved' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs border-[hsl(214_73%_48%/0.35)] text-[hsl(214_73%_35%)] hover:bg-[hsl(214_73%_48%/0.06)]" onClick={() => setPayoutDialog({ id: p.id, status: 'paid', label: 'Mark this payout as paid?' })}>Mark Paid</Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payout confirmation dialog */}
      <Dialog open={!!payoutDialog} onOpenChange={open => !open && setPayoutDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm payout action</DialogTitle>
            <DialogDescription>{payoutDialog?.label}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayoutDialog(null)}>Cancel</Button>
            <Button
              onClick={() => payoutDialog && updatePayout.mutate({ id: payoutDialog.id, status: payoutDialog.status })}
              disabled={updatePayout.isPending}
              className={cn(
                payoutDialog?.status === 'rejected' ? 'bg-destructive hover:bg-destructive/90 text-white' : 'bg-primary hover:bg-primary/90 text-primary-foreground',
              )}
            >
              {updatePayout.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {payoutDialog?.status === 'approved' ? 'Approve' : payoutDialog?.status === 'rejected' ? 'Reject' : 'Mark Paid'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SystemLandlordManagement;
