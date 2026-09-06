import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Home, FileText, Wrench, FileSignature, CheckCircle, Clock, Archive, Calendar } from 'lucide-react';
import { format, differenceInMonths } from 'date-fns';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n);

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-success/20 text-success border-success/30',
  archived: 'bg-muted/20 text-muted-foreground border-muted/30',
  paid: 'bg-success/20 text-success border-success/30',
  pending: 'bg-warning/20 text-warning border-warning/30',
  overdue: 'bg-destructive/20 text-destructive border-destructive/30',
  completed: 'bg-success/20 text-success border-success/30',
  open: 'bg-warning/20 text-warning border-warning/30',
  in_progress: 'bg-primary/20 text-primary border-primary/30',
};

interface TenancyRecord {
  id: string;
  tenant_id: string;
  move_in_date: string;
  move_out_date: string | null;
  status: string;
  monthly_rent: number;
  move_out_reason: string | null;
  total_paid: number;
  arrears_at_moveout: number;
  tenant_name: string;
}

interface InvoiceRecord {
  id: string;
  invoice_number: string;
  amount: number;
  paid_amount: number | null;
  balance_due: number | null;
  status: string;
  due_date: string | null;
  paid_date: string | null;
  description: string | null;
}

interface ContractRecord {
  id: string;
  title: string;
  status: string;
  created_at: string;
  tenant_signed_at: string | null;
  manager_signed_at: string | null;
  archived_at: string | null;
}

interface MaintenanceRecord {
  id: string;
  title: string;
  status: string;
  priority: string;
  category: string | null;
  requested_date: string | null;
  completion_date: string | null;
  property_name: string | null;
  unit_number: string | null;
}

const TenantPortableHistory: React.FC = () => {
  const { user } = useAuth();

  // All tenancies this person has ever had
  const { data: tenancies = [], isLoading: tenanciesLoading } = useQuery({
    queryKey: ['my-tenancy-history', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unit_tenancy_history')
        .select('*')
        .eq('tenant_id', user!.id)
        .order('move_in_date', { ascending: false });
      if (error) throw error;
      return (data || []) as TenancyRecord[];
    },
    enabled: !!user?.id,
  });

  // All invoices — all time, across all tenancies
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['my-all-invoices', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, amount, paid_amount, balance_due, status, due_date, paid_date, description')
        .eq('tenant_id', user!.id)
        .order('due_date', { ascending: false });
      if (error) throw error;
      return (data || []) as InvoiceRecord[];
    },
    enabled: !!user?.id,
  });

  // All contracts — all time
  const { data: contracts = [], isLoading: contractsLoading } = useQuery({
    queryKey: ['my-all-contracts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('id, title, status, created_at, tenant_signed_at, manager_signed_at, archived_at')
        .eq('tenant_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ContractRecord[];
    },
    enabled: !!user?.id,
  });

  // All maintenance requests ever raised by this tenant
  const { data: maintenance = [], isLoading: maintLoading } = useQuery({
    queryKey: ['my-all-maintenance', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_requests')
        .select('id, title, status, priority, category, requested_date, completion_date, property_name, unit_number')
        .eq('tenant_email', user!.email)
        .order('requested_date', { ascending: false });
      if (error) throw error;
      return (data || []) as MaintenanceRecord[];
    },
    enabled: !!user?.id,
  });

  const totalPaid = invoices
    .filter((i) => i.status === 'paid')
    .reduce((s, i) => s + Number(i.paid_amount ?? i.amount), 0);
  const totalUnits = tenancies.length;
  const currentTenancy = tenancies.find((t) => t.status === 'active');

  if (tenanciesLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border p-3 bg-muted/20">
          <p className="text-xs text-muted-foreground mb-1">Units lived in</p>
          <p className="text-xl font-semibold">{totalUnits}</p>
        </div>
        <div className="rounded-lg border border-border p-3 bg-muted/20">
          <p className="text-xs text-muted-foreground mb-1">Total rent paid</p>
          <p className="text-lg font-semibold text-success">{fmt(totalPaid)}</p>
        </div>
        <div className="rounded-lg border border-border p-3 bg-muted/20">
          <p className="text-xs text-muted-foreground mb-1">Contracts signed</p>
          <p className="text-xl font-semibold">{contracts.filter((c) => c.tenant_signed_at).length}</p>
        </div>
        <div className="rounded-lg border border-border p-3 bg-muted/20">
          <p className="text-xs text-muted-foreground mb-1">Maintenance raised</p>
          <p className="text-xl font-semibold">{maintenance.length}</p>
        </div>
      </div>

      <Tabs defaultValue="units">
        <TabsList>
          <TabsTrigger value="units" className="gap-1.5 text-xs">
            <Home className="h-3.5 w-3.5" />
            My Units ({tenancies.length})
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-1.5 text-xs">
            <FileText className="h-3.5 w-3.5" />
            All Invoices ({invoices.length})
          </TabsTrigger>
          <TabsTrigger value="contracts" className="gap-1.5 text-xs">
            <FileSignature className="h-3.5 w-3.5" />
            Contracts ({contracts.length})
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="gap-1.5 text-xs">
            <Wrench className="h-3.5 w-3.5" />
            Maintenance ({maintenance.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Tenancy history ── */}
        <TabsContent value="units" className="mt-4 space-y-3">
          {tenancies.length === 0 ? (
            <EmptyState
              icon={Home}
              title="No tenancy history yet"
              description="Your rental history will appear here once linked by your manager"
            />
          ) : (
            tenancies.map((t: TenancyRecord) => {
              const months = t.move_out_date
                ? differenceInMonths(new Date(t.move_out_date), new Date(t.move_in_date))
                : differenceInMonths(new Date(), new Date(t.move_in_date));
              return (
                <Card key={t.id} className={t.status === 'active' ? 'border-success/30' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${t.status === 'active' ? 'bg-success/20' : 'bg-muted/20'}`}
                        >
                          <Home
                            className={`h-4 w-4 ${t.status === 'active' ? 'text-success' : 'text-muted-foreground'}`}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-medium text-sm">{t.tenant_name}'s Unit</p>
                            <Badge variant="outline" className={`text-xs ${STATUS_COLORS[t.status] || ''}`}>
                              {t.status === 'active' ? 'Current' : 'Past'}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            <p className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {t.move_in_date ? format(new Date(t.move_in_date), 'dd/MM/yy') : '—'}
                              {t.move_out_date ? ` → ${format(new Date(t.move_out_date), 'dd/MM/yy')}` : ' → Present'}
                              <span className="ml-1 text-foreground font-medium">({months} months)</span>
                            </p>
                            {t.monthly_rent && <p>Rent: {fmt(t.monthly_rent)}/month</p>}
                            {t.move_out_reason && (
                              <p className="capitalize">Exit: {t.move_out_reason.replace(/_/g, ' ')}</p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {t.total_paid > 0 && (
                          <div className="mb-1">
                            <p className="text-xs text-muted-foreground">Paid</p>
                            <p className="text-sm font-semibold text-success">{fmt(t.total_paid)}</p>
                          </div>
                        )}
                        {t.arrears_at_moveout > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground">Arrears at exit</p>
                            <p className="text-sm font-medium text-destructive">{fmt(t.arrears_at_moveout)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ── All invoices ── */}
        <TabsContent value="invoices" className="mt-4">
          {invoicesLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : invoices.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">No invoices found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                      {inv.description || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {inv.due_date ? format(new Date(inv.due_date), 'dd/MM/yy') : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {inv.paid_date ? format(new Date(inv.paid_date), 'dd/MM/yy') : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">{fmt(Number(inv.amount))}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs capitalize ${STATUS_COLORS[inv.status] || ''}`}>
                        {inv.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        {/* ── Contracts ── */}
        <TabsContent value="contracts" className="mt-4">
          {contractsLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : contracts.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">No contracts found</div>
          ) : (
            <div className="space-y-3">
              {contracts.map((c) => (
                <Card key={c.id} className={c.archived_at ? 'opacity-75' : ''}>
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-8 w-8 rounded-lg flex items-center justify-center ${c.archived_at ? 'bg-muted/20' : 'bg-primary/10'}`}
                      >
                        {c.archived_at ? (
                          <Archive className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <FileSignature className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{c.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Created {format(new Date(c.created_at), 'dd/MM/yy')}
                          {c.archived_at && ' · Archived on move-out'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={`text-xs ${STATUS_COLORS[c.status] || ''}`}>
                        {c.status.replace(/_/g, ' ')}
                      </Badge>
                      {c.tenant_signed_at && (
                        <Badge variant="outline" className="text-xs border-success/40 text-success bg-success/20">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Signed
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Maintenance ── */}
        <TabsContent value="maintenance" className="mt-4">
          {maintLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : maintenance.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">No maintenance requests found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Issue</TableHead>
                  <TableHead>Property / Unit</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Raised</TableHead>
                  <TableHead>Resolved</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {maintenance.map((m: MaintenanceRecord) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{m.title}</p>
                        {m.category && <p className="text-xs text-muted-foreground capitalize">{m.category}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.property_name}
                      {m.unit_number ? ` · ${m.unit_number}` : ''}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {m.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs capitalize ${STATUS_COLORS[m.status] || ''}`}>
                        {m.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.requested_date ? format(new Date(m.requested_date), 'dd/MM/yy') : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.completion_date ? format(new Date(m.completion_date), 'dd/MM/yy') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TenantPortableHistory;
