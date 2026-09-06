// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import { format } from "date-fns";
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/shared/components/ui/alert-dialog';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { UserPlus, Trash2, CheckCircle, Clock, XCircle, Banknote, Mail, User } from 'lucide-react';
import PropertyAuthorityPanel from '@/features/properties/components/PropertyAuthorityPanel';
import { BillingDueConfigPanel } from '@/features/billing/components/BillingDueConfigPanel';

interface PropertyLandlordTabProps {
  propertyId: string;
}

interface LandlordLinkData {
  id: string;
  landlord_user_id: string;
  revenue_share_pct: number;
  assigned_at: string;
  operating_model: string | null;
  payment_destination: string | null;
  management_fee_pct: number | null;
  allows_delegated_manager: boolean | null;
  delegated_manager_id: string | null;
  agency_service_model: string | null;
  agency_fee_model: string | null;
  agency_fee_value: number | null;
  agency_payment_arrangements_enabled: boolean | null;
  agency_enforcement_enabled: boolean | null;
  agency_service_notes: string | null;
  agency_mandate_effective_from: string | null;
}

interface LandlordProfile {
  full_name: string | null;
  email: string | null;
  phone: string | null;
}

interface PayoutRequest {
  id: string;
  property_id: string;
  amount: number;
  status: string;
  period_start: string;
  period_end: string;
  notes: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  management_fee_pct: number | null;
  management_fee_amt: number | null;
  net_amount: number | null;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
}

interface PayoutUpdateExtra {
  payment_method?: string | null;
  payment_reference?: string | null;
  management_fee_pct?: number | null;
  management_fee_amt?: number | null;
  net_amount?: number | null;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n);

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  approved: 'bg-[hsl(214_73%_48%/0.12)] text-[hsl(214_73%_35%)] border-[hsl(214_73%_48%/0.25)]',
  paid: 'bg-green-100 text-green-700 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
};

const PropertyLandlordTab: React.FC<PropertyLandlordTabProps> = ({ propertyId }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [inviteEmail, setInviteEmail] = useState('');
  const [revenueShare, setRevenueShare] = useState('100');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState<string | null>(null);

  // ── Fetch current landlord for this property ─────────────────────
  const { data: landlordLinks = [], isLoading } = useQuery({
    queryKey: ['property-landlords', propertyId],
    queryFn: async () => {
      const { data, error } = await supabase.from('property_landlords').select('id, landlord_user_id, revenue_share_pct, assigned_at, operating_model, payment_destination, management_fee_pct, allows_delegated_manager, delegated_manager_id, agency_service_model, agency_fee_model, agency_fee_value, agency_payment_arrangements_enabled, agency_enforcement_enabled, agency_service_notes, agency_mandate_effective_from').eq('property_id', propertyId).order('assigned_at');
      if (error) throw error;
      const rows = data ?? [];
      return Promise.all(rows.map(async (link: any) => {
        const { data: profile } = await supabase.from('profiles').select('full_name, email, phone').eq('id', link.landlord_user_id).maybeSingle();
        return { ...link, profile: profile as LandlordProfile | null };
      }));
    },
  });

  // ── Fetch payout requests for this property ──────────────────────
  const { data: payouts = [], isLoading: payoutsLoading } = useQuery({
    queryKey: ['property-payouts', propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payout_requests')
        .select('*')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as PayoutRequest[];
    },
  });

  // ── Invite / link landlord ───────────────────────────────────────
  const inviteLandlord = useMutation({
    mutationFn: async () => {
      if (!inviteEmail.trim()) throw new Error('Email is required');
      const share = parseFloat(revenueShare);
      if (isNaN(share) || share < 0 || share > 100) throw new Error('Revenue share must be 0–100');

      // Check if a user with this email has landlord role
      const { data: existingRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'landlord');

      if (existingRoles && existingRoles.length > 0) {
        const userIds = existingRoles.map((r: { user_id: string }) => r.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', userIds)
          .eq('email', inviteEmail.trim().toLowerCase());

        if (profiles && profiles.length > 0) {
          const landlordUserId = profiles[0].id;
          const { error } = await supabase.rpc('link_landlord_atomic' as never, {
            p_property_id: propertyId, p_landlord_user_id: landlordUserId, p_revenue_share_pct: share
          });
          if (error) throw error;
          return { type: 'linked' };
        }
      }

      // No existing landlord user — create invitation
      const { error } = await supabase.rpc('create_landlord_invitation_atomic' as never, {
        p_property_id: propertyId, p_email: inviteEmail.trim().toLowerCase()
      });
      if (error) throw error;
      return { type: 'invited' };
    },
    onSuccess: ({ type }) => {
      queryClient.invalidateQueries({ queryKey: ['property-landlords', propertyId] });
      toast({
        title: type === 'linked' ? 'Landlord linked' : 'Invitation sent',
        description: type === 'linked'
          ? 'The landlord has been linked to this property.'
          : `An invitation has been sent to ${inviteEmail}`,
      });
      setInviteDialogOpen(false);
      setInviteEmail('');
      setRevenueShare('100');
    },
    onError: (err: unknown) => toast({ title: 'Failed', description: (err as Error).message, variant: 'destructive' }),
  });

  // ── Unlink landlord ──────────────────────────────────────────────
  const unlinkLandlord = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase.rpc('unlink_landlord_atomic' as never, { p_link_id: linkId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-landlords', propertyId] });
      toast({ title: 'Landlord unlinked' });
      setUnlinkTarget(null);
    },
    onError: (err: unknown) => toast({ title: 'Failed', description: (err as Error).message, variant: 'destructive' }),
  });

  // ── Approve / reject / mark paid payout ─────────────────────────
  const [payDialogOpen, setPayDialogOpen] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState('mpesa');
  const [payRef, setPayRef] = useState('');
  const [mgmtFeePct, setMgmtFeePct] = useState('');

  const updatePayout = useMutation({
    mutationFn: async ({ id, status, extra }: { id: string; status: string; extra?: PayoutUpdateExtra }) => {
      const { error } = await supabase.rpc('transition_payout_request_atomic', {
        p_payout_id: id,
        p_target_status: status,
        p_payment_method: extra?.payment_method as string | null ?? null,
        p_payment_reference: extra?.payment_reference as string | null ?? null,
        p_payment_proof_url: extra?.payment_proof_url as string | null ?? null,
        p_rejection_reason: extra?.rejection_reason as string | null ?? null,
        p_management_fee_pct: extra?.management_fee_pct as number | null ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-payouts', propertyId] });
      toast({ title: 'Payout request updated' });
      setPayDialogOpen(null);
      setPayRef(''); setPayMethod('mpesa'); setMgmtFeePct('');
    },
    onError: (err: unknown) => toast({ title: 'Failed', description: (err as Error).message, variant: 'destructive' }),
  });

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  return (
    <div className="space-y-6">
      {/* ── Linked Landlords ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div><CardTitle className="text-base">Property Landlords</CardTitle><CardDescription>Shared ownership is supported. Each owner can have a separate revenue share and billing policy.</CardDescription></div>
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild><Button size="sm" variant="outline"><UserPlus className="h-4 w-4 mr-2" />Link Landlord</Button></DialogTrigger>
            <DialogContent><DialogHeader><DialogTitle>Link a Landlord</DialogTitle><DialogDescription>Add another owner without replacing existing owners.</DialogDescription></DialogHeader>
              <div className="space-y-4"><div><Label>Landlord email</Label><Input type="email" placeholder="owner@example.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} /></div><div><Label>Revenue share %</Label><Input type="number" min="0" max="100" step="0.5" value={revenueShare} onChange={e => setRevenueShare(e.target.value)} /><p className="text-xs text-muted-foreground mt-1">All property owner shares together must not exceed 100%.</p></div></div>
              <DialogFooter><Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Cancel</Button><Button onClick={() => inviteLandlord.mutate()} disabled={inviteLandlord.isPending}>{inviteLandlord.isPending ? 'Linking...' : 'Link Landlord'}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-4">
          {landlordLinks.length === 0 ? <div className="py-10 text-center text-muted-foreground"><User className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No landlord linked to this property yet</p></div> : landlordLinks.map((link: any) => <div key={link.id} className="space-y-3">
            <div className="flex items-center justify-between gap-4 p-3 bg-muted/30 rounded-lg"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center"><span className="text-warning font-semibold text-sm">{(link.profile?.full_name || link.profile?.email || 'L')[0].toUpperCase()}</span></div><div><p className="font-medium text-sm">{link.profile?.full_name || 'Landlord'}</p><p className="text-xs text-muted-foreground">{link.profile?.email}</p>{link.profile?.phone && <p className="text-xs text-muted-foreground">{link.profile.phone}</p>}</div></div><div className="text-right"><Badge variant="outline" className="mb-2 border-amber-300 text-warning bg-amber-50">{link.revenue_share_pct}% revenue share</Badge><div className="text-xs text-muted-foreground">Since {format(new Date(link.assigned_at), 'dd/MM/yy')}</div><Button variant="ghost" size="sm" className="mt-1 text-destructive hover:text-destructive hover:bg-destructive/10 h-7 text-xs" onClick={() => setUnlinkTarget(link.id)}><Trash2 className="h-3 w-3 mr-1" />Unlink</Button></div></div>
            <BillingDueConfigPanel scope="landlord" scopeId={link.landlord_user_id} propertyId={propertyId} title={`Billing policy for ${link.profile?.full_name || 'this landlord'}`} compact />
            {<div className="rounded-xl border border-border/70 bg-background/60 p-1"><div className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Service mandate for {link.profile?.full_name || 'this owner'}</div><PropertyAuthorityPanel propertyId={propertyId} link={{
              id: link.id,
              landlord_user_id: link.landlord_user_id,
              operating_model: link.operating_model,
              payment_destination: link.payment_destination,
              revenue_share_pct: link.revenue_share_pct,
              management_fee_pct: link.management_fee_pct,
              allows_delegated_manager: link.allows_delegated_manager,
              delegated_manager_id: link.delegated_manager_id,
              agency_service_model: link.agency_service_model,
              agency_fee_model: link.agency_fee_model,
              agency_fee_value: link.agency_fee_value,
              agency_payment_arrangements_enabled: link.agency_payment_arrangements_enabled,
              agency_enforcement_enabled: link.agency_enforcement_enabled,
              agency_service_notes: link.agency_service_notes,
              agency_mandate_effective_from: link.agency_mandate_effective_from,
            }} /></div>}
          </div>)}
        </CardContent>
      </Card>

      {/* ── Payout Requests ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payout Requests</CardTitle>
          <CardDescription>Revenue payout requests from the landlord</CardDescription>
        </CardHeader>
        <CardContent>
          {payoutsLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : payouts.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Banknote className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No payout requests for this property</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((payout: PayoutRequest) => (
                  <TableRow key={payout.id}>
                    <TableCell className="text-sm">
                      {format(new Date(payout.period_start), 'dd/MM')}
                      {' – '}
                      {format(new Date(payout.period_end), 'dd/MM/yy')}
                    </TableCell>
                    <TableCell className="font-semibold">{fmt(payout.amount)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {payout.notes || '—'}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${statusColors[payout.status]}`}>
                        {payout.status === 'paid' && <CheckCircle className="h-3 w-3" />}
                        {payout.status === 'pending' && <Clock className="h-3 w-3" />}
                        {payout.status === 'rejected' && <XCircle className="h-3 w-3" />}
                        {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {payout.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-green-300 text-green-700 hover:bg-green-50"
                              onClick={() => updatePayout.mutate({ id: payout.id, status: 'approved' })}
                              disabled={updatePayout.isPending}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-destructive hover:bg-destructive/10"
                              onClick={() => updatePayout.mutate({ id: payout.id, status: 'rejected' })}
                              disabled={updatePayout.isPending}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {payout.status === 'approved' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-[hsl(214_73%_48%/0.35)] text-[hsl(214_73%_35%)] hover:bg-[hsl(214_73%_48%/0.06)]"
                            onClick={() => {
                              setPayDialogOpen(payout.id);
                              setMgmtFeePct('');
                              setPayRef('');
                            }}
                            disabled={updatePayout.isPending}
                          >
                            Mark Paid
                          </Button>
                        )}
                        {payout.status === 'paid' && payout.payment_reference && (
                          <span className="text-xs font-mono text-muted-foreground">{payout.payment_reference}</span>
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

      {/* Mark Paid dialog */}
      {payDialogOpen && (() => {
        const payout = payouts.find((p: PayoutRequest) => p.id === payDialogOpen);
        if (!payout) return null;
        const feePct = parseFloat(mgmtFeePct) || 0;
        const feeAmt = payout.amount * feePct / 100;
        const netAmt = payout.amount - feeAmt;
        return (
          <Dialog open={!!payDialogOpen} onOpenChange={open => !open && setPayDialogOpen(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Record payout payment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="p-3 rounded-lg bg-muted/30 text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-muted-foreground">Requested amount</span>
                    <span className="font-medium">{fmt(payout.amount)}</span>
                  </div>
                  {feePct > 0 && (
                    <>
                      <div className="flex justify-between mb-1">
                        <span className="text-muted-foreground">Management fee ({feePct}%)</span>
                        <span className="text-red-600">– {fmt(feeAmt)}</span>
                      </div>
                      <div className="flex justify-between font-semibold border-t border-border pt-1 mt-1">
                        <span>Net to landlord</span>
                        <span className="text-green-700">{fmt(netAmt)}</span>
                      </div>
                    </>
                  )}
                </div>
                <div>
                  <Label className="text-xs">Management fee % (optional deduction)</Label>
                  <Input type="number" min="0" max="100" value={mgmtFeePct} onChange={e => setMgmtFeePct(e.target.value)} placeholder="e.g. 10" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Payment method</Label>
                  <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="mt-1 w-full border border-border rounded-md p-2 text-sm bg-background">
                    <option value="mpesa">M-Pesa</option>
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="cheque">Cheque</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Transaction reference</Label>
                  <Input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="M-Pesa code or bank ref" className="mt-1 font-mono" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPayDialogOpen(null)}>Cancel</Button>
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white gap-2"
                  onClick={() => updatePayout.mutate({
                    id: payout.id,
                    status: 'paid',
                    extra: {
                      payment_method:     payMethod,
                      payment_reference:  payRef || null,
                      management_fee_pct: feePct || null,
                      management_fee_amt: feePct > 0 ? feeAmt : null,
                      net_amount:         feePct > 0 ? netAmt : payout.amount,
                    },
                  })}
                  disabled={updatePayout.isPending}
                >
                  {updatePayout.isPending ? 'Saving…' : 'Confirm payment'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Unlink confirm dialog */}
      <AlertDialog open={!!unlinkTarget} onOpenChange={open => !open && setUnlinkTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink landlord?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the landlord from this property. They will lose access to this property's data.
              Payout requests will remain for record keeping.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => unlinkTarget && unlinkLandlord.mutate(unlinkTarget)}
            >
              Unlink
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};


export default PropertyLandlordTab;
