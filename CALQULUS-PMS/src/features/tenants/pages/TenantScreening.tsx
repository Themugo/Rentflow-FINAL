import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/shared/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useRBAC } from '@/shared/hooks/useRBAC';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import { Textarea } from '@/shared/components/ui/textarea';
import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  Plus, Search, UserX, RotateCcw, Calendar, Phone, Mail,
  IdCard, Banknote, FileWarning, ShieldCheck,
} from 'lucide-react';
import { format } from 'date-fns';
import { errorToast } from "@/shared/lib/errorToast";

interface BlacklistEntry {
  id: string;
  manager_id: string;
  tenant_id: string | null;
  property_id: string | null;
  tenant_name: string | null;
  tenant_email: string | null;
  tenant_phone: string | null;
  national_id: string | null;
  reason: string;
  category: string;
  severity: string;
  incident_date: string | null;
  amount_owed: number;
  evidence_urls: string[] | null;
  notes: string | null;
  is_active: boolean;
  expires_at: string | null;
  removed_at: string | null;
  removed_reason: string | null;
  created_at: string;
}

const CATEGORIES = [
  { value: 'rent_default', label: 'Rent default' },
  { value: 'property_damage', label: 'Property damage' },
  { value: 'antisocial', label: 'Antisocial behavior' },
  { value: 'fraud', label: 'Fraud' },
  { value: 'lease_breach', label: 'Lease breach' },
  { value: 'other', label: 'Other' },
];

// Severity kept as a real escalating scale — red/orange/amber/blue, matching
// every other severity indicator in the app. Not a place to use brand colors.
const SEVERITY_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  critical: { label: 'Critical', badgeClass: 'bg-red-600 text-white border-red-700' },
  high:     { label: 'High',     badgeClass: 'bg-orange-500 text-white border-orange-600' },
  medium:   { label: 'Medium',   badgeClass: 'bg-amber-400 text-amber-950 border-warning' },
  low:      { label: 'Low',      badgeClass: 'bg-[hsl(214_73%_48%)] text-white border-[hsl(214_73%_40%)]' },
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n);

const emptyForm = {
  tenant_name: '', tenant_email: '', tenant_phone: '', national_id: '',
  reason: '', category: 'other', severity: 'medium',
  incident_date: '', amount_owed: '', notes: '', expires_at: '',
};

export default function TenantScreening() {
  const { user } = useAuth();
  const { can, whoAmI } = useRBAC();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const effectiveManagerId = whoAmI.managerId ?? user?.id ?? '';
  const canWrite = can('edit_tenants');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [removeTarget, setRemoveTarget] = useState<BlacklistEntry | null>(null);
  const [removeReason, setRemoveReason] = useState('');

  const { data: entries, isLoading } = useQuery({
    queryKey: ['tenant-blacklist', effectiveManagerId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('tenant_blacklist') as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as BlacklistEntry[];
    },
    enabled: !!effectiveManagerId,
  });

  const filtered = (entries || []).filter((e) => {
    if (statusFilter === 'active' && !e.is_active) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.tenant_name?.toLowerCase().includes(q) ||
      e.tenant_email?.toLowerCase().includes(q) ||
      e.tenant_phone?.toLowerCase().includes(q) ||
      e.national_id?.toLowerCase().includes(q)
    );
  });

  const addEntry = useMutation({
    mutationFn: async () => {
      if (!form.reason.trim()) throw new Error('A reason is required');
      if (!form.tenant_name.trim() && !form.tenant_email.trim() && !form.tenant_phone.trim() && !form.national_id.trim()) {
        throw new Error('Provide at least a name, email, phone, or national ID to identify who this flag is about');
      }
      const { error } = await supabase.rpc('create_tenant_blacklist_atomic' as never, {
        p_tenant_id: null,
        p_property_id: null,
        p_tenant_name: form.tenant_name.trim() || null,
        p_tenant_email: form.tenant_email.trim() || null,
        p_tenant_phone: form.tenant_phone.trim() || null,
        p_national_id: form.national_id.trim() || null,
        p_reason: form.reason.trim(),
        p_category: form.category,
        p_severity: form.severity,
        p_incident_date: form.incident_date || null,
        p_amount_owed: form.amount_owed ? Number(form.amount_owed) : 0,
        p_notes: form.notes.trim() || null,
        p_expires_at: form.expires_at || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-blacklist'] });
      toast({ title: 'Flag added', description: 'The record has been added to your screening list.' });
      setAddOpen(false);
      setForm(emptyForm);
    },
    onError: (err: Error) => errorToast('Failed to add flag', err),
  });

  const removeEntry = useMutation({
    mutationFn: async () => {
      if (!removeTarget) return;
      const { error } = await supabase.rpc('remove_tenant_blacklist_atomic' as never, {
        p_entry_id: removeTarget.id,
        p_reason: removeReason.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-blacklist'] });
      toast({ title: 'Flag removed' });
      setRemoveTarget(null);
      setRemoveReason('');
    },
    onError: (err: Error) => errorToast('Failed to remove flag', err),
  });

  const activeCount = (entries || []).filter((e) => e.is_active).length;
  const criticalCount = (entries || []).filter((e) => e.is_active && e.severity === 'critical').length;

  return (
    <Layout
      title="Tenant Screening"
      subtitle="Check applicants against your own screening list, and flag tenants who've caused problems in the past."
      headerActions={canWrite ? (
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add a flag
        </Button>
      ) : undefined}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Active flags</p>
              <p className="text-2xl font-bold">{activeCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Critical</p>
              <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
            </CardContent>
          </Card>
          <Card className="col-span-2 sm:col-span-1">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total (incl. removed)</p>
              <p className="text-2xl font-bold">{(entries || []).length}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, phone, or national ID…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v: 'active' | 'all') => setStatusFilter(v)}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active only</SelectItem>
                  <SelectItem value="all">All records</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <ShieldCheck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium">
                  {search.trim() ? 'No matches found' : 'No flags on your screening list'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {search.trim()
                    ? 'This name, email, phone, or national ID isn\u2019t on your list.'
                    : 'Records you add here are private to your own portfolio \u2014 nothing is shared across managers.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((entry) => {
                  const sev = SEVERITY_CONFIG[entry.severity] ?? SEVERITY_CONFIG.medium;
                  const category = CATEGORIES.find((c) => c.value === entry.category)?.label ?? entry.category;
                  return (
                    <div
                      key={entry.id}
                      className={`rounded-lg border p-4 ${!entry.is_active ? 'opacity-60 bg-muted/30' : 'bg-card'}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <p className="font-semibold">{entry.tenant_name || 'Unnamed record'}</p>
                            <Badge className={sev.badgeClass}>{sev.label}</Badge>
                            <Badge variant="outline">{category}</Badge>
                            {!entry.is_active && <Badge variant="outline" className="text-muted-foreground">Removed</Badge>}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-2">
                            {entry.tenant_email && (
                              <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{entry.tenant_email}</span>
                            )}
                            {entry.tenant_phone && (
                              <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{entry.tenant_phone}</span>
                            )}
                            {entry.national_id && (
                              <span className="flex items-center gap-1"><IdCard className="h-3 w-3" />{entry.national_id}</span>
                            )}
                            {entry.incident_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />{format(new Date(entry.incident_date), 'dd MMM yyyy')}
                              </span>
                            )}
                            {entry.amount_owed > 0 && (
                              <span className="flex items-center gap-1 text-red-600">
                                <Banknote className="h-3 w-3" />{fmt(entry.amount_owed)} owed
                              </span>
                            )}
                          </div>
                          <p className="text-sm">{entry.reason}</p>
                          {entry.notes && <p className="text-xs text-muted-foreground mt-1">{entry.notes}</p>}
                          {!entry.is_active && entry.removed_reason && (
                            <p className="text-xs text-muted-foreground mt-1 italic">Removed: {entry.removed_reason}</p>
                          )}
                        </div>
                        {canWrite && entry.is_active && (
                          <Button
                            variant="ghost" size="sm"
                            className="gap-1.5 text-muted-foreground shrink-0"
                            onClick={() => setRemoveTarget(entry)}
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add flag dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserX className="h-5 w-5" /> Add a screening flag</DialogTitle>
            <DialogDescription>
              This is private to your own portfolio. Provide at least one identifier (name, email, phone, or national ID).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Full name</Label>
                <Input value={form.tenant_name} onChange={(e) => setForm((p) => ({ ...p, tenant_name: e.target.value }))} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.tenant_email} onChange={(e) => setForm((p) => ({ ...p, tenant_email: e.target.value }))} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.tenant_phone} onChange={(e) => setForm((p) => ({ ...p, tenant_phone: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label>National ID</Label>
                <Input value={form.national_id} onChange={(e) => setForm((p) => ({ ...p, national_id: e.target.value }))} />
              </div>
            </div>

            <div>
              <Label>Reason <span className="text-destructive">*</span></Label>
              <Textarea
                value={form.reason}
                onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                placeholder="What happened?"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Severity</Label>
                <Select value={form.severity} onValueChange={(v) => setForm((p) => ({ ...p, severity: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SEVERITY_CONFIG).map(([value, cfg]) => (
                      <SelectItem key={value} value={value}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Incident date</Label>
                <Input type="date" value={form.incident_date} onChange={(e) => setForm((p) => ({ ...p, incident_date: e.target.value }))} />
              </div>
              <div>
                <Label>Amount owed (KES)</Label>
                <Input type="number" min="0" value={form.amount_owed} onChange={(e) => setForm((p) => ({ ...p, amount_owed: e.target.value }))} />
              </div>
            </div>

            <div>
              <Label className="flex items-center gap-1.5"><FileWarning className="h-3.5 w-3.5" /> Notes (optional)</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>

            <div>
              <Label>Expires on (optional)</Label>
              <Input type="date" value={form.expires_at} onChange={(e) => setForm((p) => ({ ...p, expires_at: e.target.value }))} />
              <p className="text-xs text-muted-foreground mt-1">Leave blank for a flag that never automatically expires.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => addEntry.mutate()} disabled={addEntry.isPending}>
              {addEntry.isPending ? 'Adding…' : 'Add flag'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirmation */}
      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this flag?</AlertDialogTitle>
            <AlertDialogDescription>
              This marks the record as inactive rather than deleting it, so there's still a history of why it was removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label>Reason for removing (optional)</Label>
            <Textarea value={removeReason} onChange={(e) => setRemoveReason(e.target.value)} rows={2} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRemoveReason('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => removeEntry.mutate()} disabled={removeEntry.isPending}>
              {removeEntry.isPending ? 'Removing…' : 'Remove flag'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
