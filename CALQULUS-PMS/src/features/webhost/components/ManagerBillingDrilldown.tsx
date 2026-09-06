// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/shared/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Input } from '@/shared/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/shared/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  ChevronRight, ChevronDown, Search, CheckCircle, AlertTriangle, Clock,
  Building2, Users, Home, TrendingUp, Ban, UserCheck, ExternalLink,
  Plus, Loader2
} from 'lucide-react';
import { Label } from '@/shared/components/ui/label';
import { format } from 'date-fns';
import { onActivateKey } from "@/shared/lib/a11y";
import { errorToast } from "@/shared/lib/errorToast";

const fmt = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n);

const STATUS_STYLE: Record<string, string> = {
  pending:   'bg-warning/10 text-warning border-amber-200',
  paid:      'bg-green-100 text-green-800 border-green-200',
  overdue:   'bg-destructive/15 text-destructive border-red-200',
  cancelled: 'bg-secondary-background text-muted-foreground/70 border-border',
};

interface ManagerRow {
  user_id: string;
  email: string;
  full_name: string | null;
  agency_name: string | null;
  subscription_tier: string | null;
  property_count: number;
  status: string;
  total_billed: number;
  total_paid: number;
  outstanding: number;
  last_invoice_date: string | null;
}

const ManagerBillingDrilldown: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newInvoiceFor, setNewInvoiceFor] = useState<ManagerRow | null>(null);
  const [newAmount, setNewAmount] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // All managers with invoice summary
  const { data: managers = [], isLoading } = useQuery({
    queryKey: ['manager-billing-drilldown'],
    queryFn: async () => {
      const { data: roles } = await supabase.from('user_roles')
        .select('user_id').eq('role', 'manager').eq('approval_status', 'approved');
      if (!roles?.length) return [];

      return Promise.all((roles || []).map(async r => {
        const [profileRes, mpRes, agencyRes, invoicesRes] = await Promise.all([
          supabase.from('profiles').select('email, full_name').eq('id', r.user_id).maybeSingle(),
          (supabase.from('manager_profiles').select('subscription_tier, property_count, status').eq('manager_user_id', r.user_id).maybeSingle()),
          supabase.from('agencies').select('name').eq('manager_id', r.user_id).maybeSingle(),
          supabase.from('manager_invoices').select('amount, status, created_at').eq('manager_user_id', r.user_id),
        ]);
        const mp = mpRes.data as { subscription_tier: string | null; property_count: number; status: string } | null;
        const invs = (invoicesRes.data || []) as { amount: number; status: string; created_at: string }[];
        const total_billed = invs.reduce((s, i) => s + Number(i.amount), 0);
        const total_paid   = invs.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0);
        const outstanding  = invs.filter(i => i.status !== 'paid' && i.status !== 'cancelled').reduce((s, i) => s + Number(i.amount), 0);
        const last = invs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        return {
          user_id: r.user_id,
          email:   (profileRes.data as { email: string } | null)?.email ?? '—',
          full_name: (profileRes.data as { full_name: string | null } | null)?.full_name ?? null,
          agency_name: (agencyRes.data as { name: string } | null)?.name ?? null,
          subscription_tier: mp?.subscription_tier ?? 'starter',
          property_count: mp?.property_count ?? 0,
          status: mp?.status ?? 'approved',
          total_billed, total_paid, outstanding,
          last_invoice_date: last?.created_at ?? null,
        } as ManagerRow;
      }));
    },
  });

  const filtered = managers.filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (m.email?.toLowerCase().includes(q)) ||
      (m.full_name?.toLowerCase().includes(q)) ||
      (m.agency_name?.toLowerCase().includes(q))
    );
  });

  // Create ad-hoc invoice for specific manager
  const createAdhocInvoice = useMutation({
    mutationFn: async () => {
      if (!newInvoiceFor || !newAmount) throw new Error('Amount required');
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);
      const { data, error } = await supabase.rpc('create_manager_invoice_atomic', {
        p_manager_user_id: newInvoiceFor.user_id,
        p_amount: parseFloat(newAmount),
        p_due_date: dueDate.toISOString().slice(0, 10),
        p_description: newDesc || 'Ad-hoc platform charge',
        p_invoice_type: 'other',
      });
      if (error) throw error;
      if (!data?.success) throw new Error('Invoice creation did not complete');
    },
    onSuccess: () => {
      toast({ title: 'Invoice created', description: `Invoice sent to ${newInvoiceFor?.email}` });
      queryClient.invalidateQueries({ queryKey: ['manager-billing-drilldown', 'manager-invoices'] });
      setNewInvoiceFor(null); setNewAmount(''); setNewDesc('');
    },
    onError: (e: Error) => errorToast('Failed', e),
  });

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total billed (all time)', value: fmt(managers.reduce((s, m) => s + m.total_billed, 0)), color: 'text-warning' },
          { label: 'Total collected',         value: fmt(managers.reduce((s, m) => s + m.total_paid,   0)), color: 'text-foreground' },
          { label: 'Outstanding',             value: fmt(managers.reduce((s, m) => s + m.outstanding,  0)), color: 'text-warning' },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-warning/12 bg-secondary-background p-3">
            <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
            <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, agency…"
          className="pl-9 bg-card border-border/60 text-foreground" />
      </div>

      {/* Manager rows */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-14 w-full bg-secondary-background"/>)}</div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(m => (
            <div key={m.user_id} className="rounded-xl border border-[hsl(218_58%_24%/0.2)] bg-secondary-background/50 overflow-hidden">
              {/* Manager row */}
              <div
                role="button"
                tabIndex={0}
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-[hsl(218_58%_16%/0.1)] transition-colors"
                onClick={() => setExpanded(expanded === m.user_id ? null : m.user_id)}
                onKeyDown={onActivateKey(() => setExpanded(expanded === m.user_id ? null : m.user_id))}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground">{m.full_name ?? m.email}</p>
                    {m.subscription_tier && (
                      <Badge variant="outline" className="text-xs capitalize border-warning/20 text-warning/70">{m.subscription_tier}</Badge>
                    )}
                    {m.status === 'suspended_nonpayment' && (
                      <Badge variant="outline" className="text-xs bg-destructive/15 text-destructive border-red-200">Suspended — non-payment</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{m.agency_name ?? m.email}</p>
                </div>
                <div className="flex items-center gap-4 shrink-0 text-xs">
                  <div className="text-center hidden sm:block">
                    <p className="text-muted-foreground">Properties</p>
                    <p className="font-medium text-foreground">{m.property_count}</p>
                  </div>
                  <div className="text-center hidden sm:block">
                    <p className="text-muted-foreground">Outstanding</p>
                    <p className={`font-semibold ${m.outstanding > 0 ? 'text-warning' : 'text-foreground'}`}>{fmt(m.outstanding)}</p>
                  </div>
                  <div className="text-center hidden md:block">
                    <p className="text-muted-foreground">Collected</p>
                    <p className="font-medium text-foreground">{fmt(m.total_paid)}</p>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-warning/70 gap-1"
                    onClick={e => { e.stopPropagation(); setNewInvoiceFor(m); setNewAmount(''); setNewDesc(''); }}>
                    <Plus className="h-3.5 w-3.5" />Invoice
                  </Button>
                  {expanded === m.user_id
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>

              {/* Expanded: invoice history */}
              {expanded === m.user_id && (
                <ManagerInvoiceHistory managerId={m.user_id} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Ad-hoc invoice dialog */}
      <Dialog open={!!newInvoiceFor} onOpenChange={open => !open && setNewInvoiceFor(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create invoice</DialogTitle>
            <DialogDescription>{newInvoiceFor?.full_name ?? newInvoiceFor?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Amount (KES)</Label>
              <Input type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="500" className="mt-1" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="e.g. May 2026 subscription" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewInvoiceFor(null)}>Cancel</Button>
            <Button onClick={() => createAdhocInvoice.mutate()} disabled={!newAmount || createAdhocInvoice.isPending}>
              {createAdhocInvoice.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Inline invoice history for a single manager
const ManagerInvoiceHistory: React.FC<{ managerId: string }> = ({ managerId }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['manager-invoice-history', managerId],
    queryFn: async () => {
      const { data } = await supabase.from('manager_invoices')
        .select('*').eq('manager_user_id', managerId)
        .order('created_at', { ascending: false });
      return (data || []) as { id: string; invoice_number: string; invoice_type: string; amount: number; due_date: string; paid_date: string | null; status: string; created_at: string }[];
    },
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const invoice = invoices.find((item: { id: string; amount: number; }) => item.id === id);
      if (!invoice) throw new Error('Invoice not found');
      const { data, error } = await supabase.rpc('record_platform_invoice_payment_atomic', {
        p_manager_invoice_id: id,
        p_manager_user_id: managerId,
        p_amount: Number(invoice.amount),
        p_reference: `WEBHOST-${id}`,
        p_payment_method: 'manual',
      });
      if (error) throw error;
      if (!data?.success) throw new Error('Payment settlement did not complete');
    },
    onSuccess: () => {
      toast({ title: 'Marked as paid' });
      queryClient.invalidateQueries({ queryKey: ['manager-invoice-history', managerId] });
      queryClient.invalidateQueries({ queryKey: ['manager-billing-drilldown'] });
      queryClient.invalidateQueries({ queryKey: ['webhost-managers-rich'] });
    },
  });

  if (isLoading) return <div className="p-3"><Skeleton className="h-20 w-full bg-secondary-background" /></div>;
  if (!invoices.length) return <p className="p-3 text-xs text-muted-foreground/70">No invoices yet.</p>;

  return (
    <div className="border-t border-[hsl(218_58%_24%/0.2)] bg-secondary-background px-3 pb-3 pt-2">
      <Table>
        <TableHeader>
          <TableRow className="border-[hsl(218_58%_24%/0.2)] hover:bg-transparent">
            {['Invoice #', 'Type', 'Amount', 'Due', 'Paid', 'Status', ''].map(h => (
              <TableHead key={h} className="text-warning text-xs py-1">{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv: { id: string; invoice_number: string; invoice_type: string; amount: number; due_date: string; paid_date: string | null; status: string }) => (
            <TableRow key={inv.id} className="border-[hsl(218_58%_24%/0.1)] hover:bg-[hsl(218_58%_16%/0.05)]">
              <TableCell className="font-mono text-xs text-foreground/90 py-1.5">{inv.invoice_number}</TableCell>
              <TableCell className="text-xs text-muted-foreground py-1.5 capitalize">{inv.invoice_type?.replace(/_/g, ' ')}</TableCell>
              <TableCell className="text-sm font-medium text-foreground py-1.5">{fmt(Number(inv.amount))}</TableCell>
              <TableCell className="text-xs text-muted-foreground py-1.5">{format(new Date(inv.due_date), 'dd/MM/yy')}</TableCell>
              <TableCell className="text-xs text-muted-foreground py-1.5">{inv.paid_date ? format(new Date(inv.paid_date), 'dd/MM/yy') : '—'}</TableCell>
              <TableCell className="py-1.5">
                <Badge variant="outline" className={`text-xs ${STATUS_STYLE[inv.status] ?? ''}`}>{inv.status}</Badge>
              </TableCell>
              <TableCell className="py-1.5">
                {(inv.status === 'pending' || inv.status === 'overdue') && (
                  <Button size="sm" className="h-6 text-xs bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => markPaid.mutate(inv.id)} disabled={markPaid.isPending}>
                    Paid
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};


export default ManagerBillingDrilldown;
