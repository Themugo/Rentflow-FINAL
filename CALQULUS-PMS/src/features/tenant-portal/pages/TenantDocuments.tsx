// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/shared/hooks/use-toast';
import { useCurrency } from '@/shared/hooks/useCurrency';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  FileText,
  Receipt,
  ClipboardCheck,
  Star,
  RefreshCw,
  Download,
  CheckCircle,
  Clock,
  AlertTriangle,
  Plus,
  Loader2,
  Droplets,
  PawPrint,
  CreditCard,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { format } from 'date-fns';
import TenantWaterPortal from '@/features/tenant-portal/components/TenantWaterPortal';
import TenantPetsVehicles from '@/features/tenant-portal/components/TenantPetsVehicles';
import TenantPaymentSchedule from '@/features/tenant-portal/components/TenantPaymentSchedule';
import UnitInspectionChecklist from '@/features/units/components/UnitInspectionChecklist';
import { onActivateKey } from '@/shared/lib/a11y';
import TenantLayout from '@/features/tenant-portal/components/TenantLayout';
import { errorToast } from "@/shared/lib/errorToast";

const fmt = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n);

const CONDITION_COLORS: Record<string, string> = {
  excellent: 'text-success bg-success/20',
  good: 'text-primary bg-primary/20',
  fair: 'text-warning bg-warning/20',
  poor: 'text-destructive bg-destructive/20',
};

interface ChecklistItem {
  status: string;
  name: string;
  notes?: string;
}

interface ChecklistRoom {
  room: string;
  items: ChecklistItem[];
}

interface ChecklistData {
  rooms?: ChecklistRoom[];
  utilities?: ChecklistItem[];
  fixtures?: ChecklistItem[];
}

interface UnitInspection {
  id: string;
  inspection_type: string;
  inspection_date?: string;
  created_at?: string;
  overall_condition?: string;
  tenant_agreed?: boolean;
  unit_id: string;
  tenant_id: string;
  checklist_items?: ChecklistData | null;
  damage_found?: boolean;
  damage_description?: string;
  notes?: string;
}

const TenantDocuments: React.FC = () => {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const tenantId = userRole?.tenant_id;

  const [refRequestOpen, setRefRequestOpen] = useState(false);
  const [refForm, setRefForm] = useState({ issued_to: '', issued_to_email: '', purpose: 'new_rental', message: '' });
  const [renewalOpen, setRenewalOpen] = useState<{ id: string; decision: string } | null>(null);
  const [renewalForm, setRenewalForm] = useState({ decision: '', counter_rent: '', counter_term: '', message: '' });
  const [expandedInspectionIds, setExpandedInspectionIds] = useState<Record<string, boolean>>({});

  // Physical invoices (tenant sees invoices raised against them)
  const { data: physicalInvoices = [], isLoading: piLoading } = useQuery({
    queryKey: ['tenant-physical-invoices', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from('physical_invoices')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('invoice_date', { ascending: false });
      return (data || []) as Array<{
        id: string;
        invoice_date: string;
        invoice_number: string;
        amount: number;
        status: string;
        description?: string;
      }>;
    },
    enabled: !!tenantId,
  });

  // Physical receipts (tenant sees receipts of their payments)
  const { data: physicalReceipts = [], isLoading: prLoading } = useQuery({
    queryKey: ['tenant-physical-receipts', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from('physical_receipts')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('receipt_date', { ascending: false });
      return (data || []) as Array<{
        id: string;
        receipt_date: string;
        receipt_number: string;
        amount: number;
        payment_method: string;
      }>;
    },
    enabled: !!tenantId,
  });

  // Inspection reports
  const { data: inspections = [], isLoading: inspLoading } = useQuery({
    queryKey: ['tenant-inspections', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from('unit_inspections')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('inspection_date', { ascending: false });
      return (data || []) as UnitInspection[];
    },
    enabled: !!tenantId,
  });

  // Reference letters
  const { data: references = [] } = useQuery({
    queryKey: ['tenant-references', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from('tenant_references')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      return (data || []) as Array<{ id: string; created_at: string; document_type: string; file_url: string }>;
    },
    enabled: !!tenantId,
  });

  // Reference requests
  const { data: refRequests = [] } = useQuery({
    queryKey: ['tenant-ref-requests', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from('tenant_reference_requests')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      return (data || []) as Array<{ id: string; created_at: string; notice_type: string; content: string }>;
    },
    enabled: !!tenantId,
  });

  // Lease renewal notices pending response
  const { data: renewalNotices = [] } = useQuery({
    queryKey: ['tenant-renewal-notices', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from('tenant_notices')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('notice_type', 'lease_renewal')
        .order('created_at', { ascending: false });
      return (data || []) as Array<{
        id: string;
        created_at: string;
        notice_type: string;
        content: string;
        lease_end_date?: string;
      }>;
    },
    enabled: !!tenantId,
  });

  // Submit reference request
  const submitRefRequest = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('create_tenant_reference_request_atomic', {
        p_issued_to: refForm.issued_to,
        p_issued_to_email: refForm.issued_to_email,
        p_purpose: refForm.purpose,
        p_message: refForm.message,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-ref-requests'] });
      toast({ title: 'Reference request sent', description: 'Your manager will be notified.' });
      setRefRequestOpen(false);
      setRefForm({ issued_to: '', issued_to_email: '', purpose: 'new_rental', message: '' });
    },
    onError: (err: Error) => errorToast('Failed', err),
  });

  // Submit lease renewal response
  const submitRenewal = useMutation({
    mutationFn: async () => {
      if (!renewalOpen) return;
      const { error } = await supabase.rpc('submit_tenant_renewal_response_atomic', {
        p_notice_id: renewalOpen.id,
        p_decision: renewalForm.decision,
        p_counter_rent: renewalForm.counter_rent ? Number(renewalForm.counter_rent) : null,
        p_counter_term: renewalForm.counter_term ? Number(renewalForm.counter_term) : null,
        p_message: renewalForm.message || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-renewal-notices'] });
      toast({ title: 'Lease renewal response sent' });
      setRenewalOpen(null);
      setRenewalForm({ decision: '', counter_rent: '', counter_term: '', message: '' });
    },
    onError: (err: Error) => errorToast('Failed', err),
  });

  return (
    <TenantLayout title="Documents" description="Files for your home.">
      <div className="mx-auto w-full max-w-2xl space-y-4">
      {/* Lease renewal banner */}
      {renewalNotices.filter((n) => !n.tenant_acknowledged).length > 0 && (
        <div className="p-4 rounded-xl border-2 border-success/40 bg-success/20">
          <p className="font-semibold text-success flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Lease renewal offer — action required
          </p>
          {renewalNotices
            .filter((n) => !n.tenant_acknowledged)
            .map((n) => (
              <div key={n.id} className="mt-2 flex items-center justify-between gap-3">
                <p className="text-sm text-success">{n.title}</p>
                <Button
                  size="sm"
                  className="bg-success hover:bg-success text-white"
                  onClick={() => {
                    setRenewalOpen(n);
                    setRenewalForm({ decision: '', counter_rent: '', counter_term: '', message: '' });
                  }}
                >
                  Respond
                </Button>
              </div>
            ))}
        </div>
      )}

      <Tabs defaultValue="receipts">
        <TabsList className="flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="receipts" className="text-xs">
            <Receipt className="h-3.5 w-3.5 mr-1.5" />
            Receipts ({physicalReceipts.length})
          </TabsTrigger>
          <TabsTrigger value="invoices" className="text-xs">
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Invoices ({physicalInvoices.length})
          </TabsTrigger>
          <TabsTrigger value="inspections" className="text-xs">
            <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" />
            Inspections ({inspections.length})
          </TabsTrigger>
          <TabsTrigger value="water" className="text-xs">
            <Droplets className="h-3.5 w-3.5 mr-1.5" />
            Water
          </TabsTrigger>
          <TabsTrigger value="pets" className="text-xs">
            <PawPrint className="h-3.5 w-3.5 mr-1.5" />
            Pets & Vehicles
          </TabsTrigger>
          <TabsTrigger value="schedule" className="text-xs">
            <CreditCard className="h-3.5 w-3.5 mr-1.5" />
            Payment Schedule
          </TabsTrigger>
          <TabsTrigger value="references" className="text-xs">
            <Star className="h-3.5 w-3.5 mr-1.5" />
            References ({references.length})
          </TabsTrigger>
        </TabsList>

        {/* Physical receipts */}
        <TabsContent value="receipts" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Physical receipts</CardTitle>
              <CardDescription>Paper receipts recorded by your manager</CardDescription>
            </CardHeader>
            <CardContent>
              {prLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : physicalReceipts.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  <Receipt className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No physical receipts yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {physicalReceipts.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div>
                        <p className="text-sm font-medium">{r.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.receipt_number} · {r.payment_method} {r.reference ? `· Ref: ${r.reference}` : ''}
                          {r.receipt_date ? ` · ${format(new Date(r.receipt_date), 'dd/MM/yy')}` : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">{fmt(Number(r.amount))}</p>
                        {r.document_url && (
                          <a
                            href={r.document_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1 justify-end mt-0.5"
                          >
                            <Download className="h-3 w-3" />
                            Download
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Physical invoices */}
        <TabsContent value="invoices" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Physical invoices</CardTitle>
              <CardDescription>Paper invoices issued by your manager</CardDescription>
            </CardHeader>
            <CardContent>
              {piLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : physicalInvoices.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No physical invoices yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {physicalInvoices.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div>
                        <p className="text-sm font-medium">{inv.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {inv.invoice_number}
                          {inv.invoice_date ? ` · ${format(new Date(inv.invoice_date), 'dd/MM/yy')}` : ''}
                          {inv.due_date ? ` · Due: ${format(new Date(inv.due_date), 'dd/MM/yy')}` : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">{fmt(Number(inv.total_amount || inv.amount))}</p>
                        <Badge
                          variant="outline"
                          className={`text-xs mt-0.5 capitalize ${inv.status === 'paid' ? 'border-success/40 text-success' : 'border-warning/40 text-warning'}`}
                        >
                          {inv.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inspections — expandable with full checklist view */}
        <TabsContent value="inspections" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" />
                Unit inspections
              </CardTitle>
              <CardDescription>
                Move-in and move-out condition reports — items listed as not working at move-in are pre-existing and
                cannot be charged to your deposit.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {inspLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : inspections.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  <ClipboardCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No inspection reports yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {inspections.map((insp: UnitInspection) => {
                    const expanded = !!expandedInspectionIds[insp.id];
                    const checklist = insp.checklist_items as {
                      rooms?: Array<{ room: string; items: Array<{ status: string; name: string; notes?: string }> }>;
                      utilities?: Array<{ status: string; name: string; notes?: string }>;
                      fixtures?: Array<{ status: string; name: string; notes?: string }>;
                    } | null;
                    const allIssues = checklist
                      ? [
                          ...(checklist.rooms || []).flatMap((r) =>
                            r.items
                              .filter((i) => i.status === 'not_working' || i.status === 'needs_repair')
                              .map((i) => ({ ...i, room: r.room })),
                          ),
                          ...(checklist.utilities || [])
                            .filter((i) => i.status === 'not_working' || i.status === 'needs_repair')
                            .map((i) => ({ ...i, room: 'Utilities' })),
                          ...(checklist.fixtures || [])
                            .filter((i) => i.status === 'not_working' || i.status === 'needs_repair')
                            .map((i) => ({ ...i, room: 'Fixtures' })),
                        ]
                      : [];

                    return (
                      <div key={insp.id} className="rounded-lg border border-border overflow-hidden">
                        <div
                          role="button"
                          tabIndex={0}
                          className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30"
                          onClick={() =>
                            setExpandedInspectionIds((current) => ({
                              ...current,
                              [insp.id]: !current[insp.id],
                            }))
                          }
                          onKeyDown={onActivateKey(() =>
                            setExpandedInspectionIds((current) => ({
                              ...current,
                              [insp.id]: !current[insp.id],
                            })),
                          )}
                        >
                          <div className="flex items-center gap-3 flex-wrap">
                            <Badge variant="outline" className="text-xs capitalize">
                              {insp.inspection_type?.replace('_', ' ')}
                            </Badge>
                            {insp.overall_condition && (
                              <span
                                className={`text-xs font-medium px-2 py-0.5 rounded-full ${CONDITION_COLORS[insp.overall_condition] || ''}`}
                              >
                                {insp.overall_condition}
                              </span>
                            )}
                            {allIssues.length > 0 && (
                              <span className="text-xs text-warning font-medium">
                                {allIssues.length} pre-existing issue{allIssues.length > 1 ? 's' : ''}
                              </span>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {insp.inspection_date ? format(new Date(insp.inspection_date), 'dd/MM/yy') : '—'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {insp.tenant_agreed === true && <CheckCircle className="h-4 w-4 text-success" />}
                            {expanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>

                        {expanded && (
                          <div className="border-t border-border p-4 bg-muted/10">
                            {/* Pre-existing issues summary */}
                            {allIssues.length > 0 && (
                              <div className="mb-4 p-3 bg-warning/20 border border-warning/30 rounded-lg">
                                <p className="text-xs font-semibold text-warning mb-2">
                                  Pre-existing issues at {insp.inspection_type === 'move_in' ? 'move-in' : 'move-out'}{' '}
                                  (recorded {format(new Date(insp.inspection_date || insp.created_at), 'dd/MM/yy')}):
                                </p>
                                <div className="space-y-1">
                                  {allIssues.map(
                                    (
                                      issue: { status: string; room: string; name: string; notes?: string },
                                      i: number,
                                    ) => (
                                      <div key={i} className="text-xs text-warning flex items-start gap-1.5">
                                        <span className="shrink-0 mt-0.5">
                                          {issue.status === 'not_working' ? '✗' : '⚠'}
                                        </span>
                                        <span>
                                          <span className="font-medium">{issue.room}:</span> {issue.name}
                                          {issue.notes ? ` — ${issue.notes}` : ''}
                                        </span>
                                      </div>
                                    ),
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Full checklist in read-only mode */}
                            {checklist ? (
                              <UnitInspectionChecklist
                                unitId={insp.unit_id}
                                tenantId={insp.tenant_id}
                                inspectionType={insp.inspection_type}
                                existingChecklist={checklist}
                                readOnly={true}
                              />
                            ) : (
                              <div>
                                {insp.damage_found && (
                                  <div className="flex items-start gap-2 p-2 bg-destructive/20 rounded-lg text-xs text-destructive mb-2">
                                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                    <span>{insp.damage_description}</span>
                                  </div>
                                )}
                                {insp.notes && <p className="text-xs text-muted-foreground">{insp.notes}</p>}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Water portal */}
        <TabsContent value="water" className="mt-4">
          <TenantWaterPortal />
        </TabsContent>

        {/* Pets & vehicles */}
        <TabsContent value="pets" className="mt-4">
          <TenantPetsVehicles />
        </TabsContent>

        {/* Payment schedule */}
        <TabsContent value="schedule" className="mt-4">
          <TenantPaymentSchedule />
        </TabsContent>

        {/* References */}
        <TabsContent value="references" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-sm">Reference letters</CardTitle>
                <CardDescription>Letters issued by your manager</CardDescription>
              </div>
              <Button size="sm" onClick={() => setRefRequestOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                Request reference
              </Button>
            </CardHeader>
            <CardContent>
              {references.length === 0 && refRequests.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Star className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No reference letters yet</p>
                  <p className="text-xs mt-1 opacity-70">Request one from your manager above</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {refRequests.map((rr) => (
                    <div key={rr.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div>
                        <p className="text-sm font-medium">Reference request</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {rr.purpose?.replace('_', ' ')} {rr.issued_to ? `· For ${rr.issued_to}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground">{format(new Date(rr.created_at), 'dd/MM/yy')}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-xs capitalize ${rr.status === 'issued' ? 'border-success/40 text-success' : rr.status === 'declined' ? 'border-destructive/40 text-destructive' : 'border-warning/40 text-warning'}`}
                      >
                        {rr.status === 'pending' ? (
                          <Clock className="h-3 w-3 mr-1 inline" />
                        ) : rr.status === 'issued' ? (
                          <CheckCircle className="h-3 w-3 mr-1 inline" />
                        ) : null}
                        {rr.status}
                      </Badge>
                    </div>
                  ))}
                  {references.map((ref) => (
                    <div
                      key={ref.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-success/40 bg-success/20"
                    >
                      <div>
                        <p className="text-sm font-medium text-success">Reference letter</p>
                        <p className="text-xs text-success">
                          {ref.tenancy_period} {ref.issued_to ? `· For ${ref.issued_to}` : ''}
                        </p>
                        {ref.overall_rating && (
                          <div className="flex gap-0.5 mt-0.5">
                            {Array.from({ length: ref.overall_rating }).map((_, i) => (
                              <Star key={i} className="h-3 w-3 fill-warning text-warning" />
                            ))}
                          </div>
                        )}
                      </div>
                      {ref.document_url && (
                        <a href={ref.document_url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="gap-1 h-7 text-xs">
                            <Download className="h-3 w-3" />
                            Download
                          </Button>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reference request dialog */}
      <Dialog open={refRequestOpen} onOpenChange={setRefRequestOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request a reference letter</DialogTitle>
            <DialogDescription>Your manager will issue a formal reference letter for your tenancy.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Purpose</Label>
              <Select value={refForm.purpose} onValueChange={(v) => setRefForm((p) => ({ ...p, purpose: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new_rental">New rental application</SelectItem>
                  <SelectItem value="employment">Employment verification</SelectItem>
                  <SelectItem value="bank_loan">Bank loan application</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Send to (new landlord name)</Label>
              <Input
                value={refForm.issued_to}
                onChange={(e) => setRefForm((p) => ({ ...p, issued_to: e.target.value }))}
                placeholder="New landlord / company"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Their email (optional)</Label>
              <Input
                type="email"
                value={refForm.issued_to_email}
                onChange={(e) => setRefForm((p) => ({ ...p, issued_to_email: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Message to manager (optional)</Label>
              <Textarea
                value={refForm.message}
                onChange={(e) => setRefForm((p) => ({ ...p, message: e.target.value }))}
                rows={2}
                className="mt-1 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefRequestOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => submitRefRequest.mutate()} disabled={submitRefRequest.isPending}>
              {submitRefRequest.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lease renewal response dialog */}
      <Dialog open={!!renewalOpen} onOpenChange={(open) => !open && setRenewalOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Respond to lease renewal offer</DialogTitle>
            <DialogDescription>{renewalOpen?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Your decision</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {[
                  { v: 'accept', l: 'Accept', c: 'border-success/40 text-success' },
                  { v: 'negotiate', l: 'Negotiate', c: 'border-warning/40 text-warning' },
                  { v: 'decline', l: 'Decline', c: 'border-destructive/40 text-destructive' },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setRenewalForm((p) => ({ ...p, decision: opt.v }))}
                    className={`py-2 rounded-lg border text-sm font-medium transition-colors ${renewalForm.decision === opt.v ? opt.c + ' bg-opacity-10' : 'border-border text-muted-foreground'}`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
            {renewalForm.decision === 'negotiate' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Counter rent (KES)</Label>
                  <Input
                    type="number"
                    value={renewalForm.counter_rent}
                    onChange={(e) => setRenewalForm((p) => ({ ...p, counter_rent: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Term (months)</Label>
                  <Input
                    type="number"
                    value={renewalForm.counter_term}
                    onChange={(e) => setRenewalForm((p) => ({ ...p, counter_term: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>
            )}
            <div>
              <Label>Message to manager</Label>
              <Textarea
                value={renewalForm.message}
                onChange={(e) => setRenewalForm((p) => ({ ...p, message: e.target.value }))}
                rows={3}
                className="mt-1 resize-none"
                placeholder="Any additional comments..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewalOpen(null)}>
              Cancel
            </Button>
            <Button onClick={() => submitRenewal.mutate()} disabled={!renewalForm.decision || submitRenewal.isPending}>
              {submitRenewal.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit response
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </TenantLayout>
  );
};

export default TenantDocuments;
