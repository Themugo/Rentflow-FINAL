import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/shared/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Badge } from '@/shared/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  Plus, CheckCircle, Clock, AlertTriangle, Home,
  FileText, Loader2, RefreshCw, User, Building2
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { errorToast } from "@/shared/lib/errorToast";

const fmt = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n);

const STATUS_STYLE: Record<string, string> = {
  pending:   'bg-warning/10 text-warning border-amber-200',
  paid:      'bg-green-100 text-green-800 border-green-200',
  overdue:   'bg-destructive/15 text-destructive border-red-200',
  cancelled: 'bg-secondary-background text-muted-foreground border-border',
  waived:    'bg-[hsl(214_73%_48%/0.12)] text-[hsl(214_73%_35%)] border-[hsl(214_73%_48%/0.25)]',
};

const INVOICE_TYPES = [
  { value: 'portal_access',    label: 'Portal access',     hint: 'Monthly landlord portal fee' },
  { value: 'property_listing', label: 'Property listing',  hint: 'Per-property listing fee' },
  { value: 'document_storage', label: 'Document storage',  hint: 'Document hosting fee' },
  { value: 'premium_reports',  label: 'Premium reports',   hint: 'Advanced reporting access' },
  { value: 'annual_membership',label: 'Annual membership', hint: 'Yearly membership fee' },
  { value: 'one_time',         label: 'One-time charge',   hint: 'Custom one-time fee' },
];

const LandlordBilling: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    landlord_user_id: '', amount: '', invoice_type: 'portal_access',
    description: '', due_date: format(addDays(new Date(), 14), 'yyyy-MM-dd'),
  });

  // All landlord invoices
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['landlord-invoices-webhost'],
    queryFn: async () => {
      const { data } = await (supabase.from('landlord_invoices')
        .select('*')
        .order('created_at', { ascending: false }));
      return (data || []) as { id: string; landlord_user_id: string; webhost_user_id: string; invoice_number: string; invoice_type: string; amount: number; description: string | null; due_date: string; status: string; paid_date: string | null; created_at: string }[];
    },
  });

  // All landlords for dropdown
  const { data: landlords = [] } = useQuery({
    queryKey: ['landlords-for-billing'],
    queryFn: async () => {
      const { data: roles } = await supabase.from('user_roles')
        .select('user_id').eq('role', 'landlord');
      if (!roles?.length) return [];
      return Promise.all((roles || []).map(async r => {
        const { data: p } = await supabase.from('profiles')
          .select('full_name, email').eq('id', r.user_id).maybeSingle();
        return { user_id: r.user_id, name: (p as { full_name: string | null } | null)?.full_name || 'Unnamed', email: (p as { email: string } | null)?.email || '' };
      }));
    },
  });

  const pending = invoices.filter((i: { status: string }) => i.status === 'pending' || i.status === 'overdue');
  const totalPending = pending.reduce((s: number, i: { amount: number }) => s + Number(i.amount), 0);
  const totalPaid = invoices.filter((i: { status: string }) => i.status === 'paid').reduce((s: number, i: { amount: number }) => s + Number(i.amount), 0);

  // Create invoice
  const createInvoice = useMutation({
    mutationFn: async () => {
      if (!form.landlord_user_id || !form.amount) throw new Error('Landlord and amount are required');
      const { error } = await supabase.rpc('create_landlord_invoice_atomic', {
        p_landlord_user_id: form.landlord_user_id,
        p_amount: parseFloat(form.amount),
        p_invoice_type: form.invoice_type,
        p_description: form.description || null,
        p_due_date: form.due_date,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Landlord invoice created' });
      queryClient.invalidateQueries({ queryKey: ['landlord-invoices-webhost'] });
      setCreateOpen(false);
      setForm({ landlord_user_id: '', amount: '', invoice_type: 'portal_access', description: '', due_date: format(addDays(new Date(), 14), 'yyyy-MM-dd') });
    },
    onError: (e: Error) => errorToast('Failed', e),
  });

  // Mark paid
  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('transition_landlord_invoice_atomic', {
        p_invoice_id: id, p_target_status: 'paid', p_payment_method: 'manual', p_payment_reference: `WEBHOST-${id}`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Invoice marked as paid' });
      queryClient.invalidateQueries({ queryKey: ['landlord-invoices-webhost'] });
    },
  });

  // Waive invoice
  const waiveInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('transition_landlord_invoice_atomic', {
        p_invoice_id: id, p_target_status: 'waived', p_payment_method: null, p_payment_reference: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Invoice waived' });
      queryClient.invalidateQueries({ queryKey: ['landlord-invoices-webhost'] });
    },
  });

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total landlords', value: String(landlords.length), icon: User, color: 'text-warning' },
          { label: 'Outstanding', value: fmt(totalPending), icon: AlertTriangle, color: 'text-warning' },
          { label: 'Collected', value: fmt(totalPaid), icon: CheckCircle, color: 'text-foreground' },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-warning/12 bg-secondary-background p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <k.icon className={`h-4 w-4 ${k.color}`} />
            </div>
            <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Landlord invoices</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="border-warning/30 text-warning/70 h-8 text-xs"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['landlord-invoices-webhost'] })}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" />Refresh
          </Button>
          <Button size="sm" className="bg-primary hover:bg-primary/90 text-white h-8 text-xs gap-1"
            onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />New invoice
          </Button>
        </div>
      </div>

      {/* Invoice table */}
      <Card className="bg-card border-warning/15">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-10 w-full bg-secondary-background"/>)}</div>
          ) : invoices.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No landlord invoices yet"
              description="Create an invoice to bill a landlord for portal access or services"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-warning/12 hover:bg-transparent">
                  {['Invoice #', 'Landlord', 'Type', 'Amount', 'Due', 'Status', 'Actions'].map(h => (
                    <TableHead key={h} className="text-warning/70 text-xs">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv: { id: string; invoice_number: string; invoice_type: string; amount: number; due_date: string; status: string; landlord_user_id: string }) => (
                  <TableRow key={inv.id} className="border-[hsl(218_58%_24%/0.2)] hover:bg-[hsl(218_58%_16%/0.1)]">
                    <TableCell className="font-mono text-xs text-foreground/90">{inv.invoice_number}</TableCell>
                    <TableCell className="text-xs text-foreground/90">{inv.landlord_user_id?.slice(0, 8)}…</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize border-warning/20 text-warning/70">
                        {inv.invoice_type?.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-foreground">{fmt(Number(inv.amount))}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(new Date(inv.due_date), 'dd/MM/yy')}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${STATUS_STYLE[inv.status] ?? ''}`}>
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {(inv.status === 'pending' || inv.status === 'overdue') && (
                        <div className="flex gap-1">
                          <Button size="sm" className="h-6 text-xs bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => markPaid.mutate(inv.id)}>Paid</Button>
                          <Button size="sm" variant="ghost" className="h-6 text-xs text-muted-foreground"
                            onClick={() => waiveInvoice.mutate(inv.id)}>Waive</Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create landlord invoice</DialogTitle>
            <DialogDescription>Bill a landlord for platform services</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Landlord</Label>
              <Select value={form.landlord_user_id} onValueChange={v => setForm(p => ({...p, landlord_user_id: v}))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select landlord" /></SelectTrigger>
                <SelectContent>
                  {landlords.map((l: { user_id: string; name: string; email: string }) => (
                    <SelectItem key={l.user_id} value={l.user_id}>{l.name} — {l.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Invoice type</Label>
              <Select value={form.invoice_type} onValueChange={v => setForm(p => ({...p, invoice_type: v}))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INVOICE_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      <div><span>{t.label}</span><span className="text-xs text-muted-foreground ml-2">— {t.hint}</span></div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount (KES)</Label>
                <Input type="number" value={form.amount} onChange={e => setForm(p => ({...p, amount: e.target.value}))} placeholder="200" className="mt-1" />
              </div>
              <div>
                <Label>Due date</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm(p => ({...p, due_date: e.target.value}))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))}
                placeholder="e.g. Monthly portal access — May 2026" rows={2} className="mt-1 resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createInvoice.mutate()} disabled={createInvoice.isPending || !form.landlord_user_id || !form.amount}>
              {createInvoice.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LandlordBilling;
