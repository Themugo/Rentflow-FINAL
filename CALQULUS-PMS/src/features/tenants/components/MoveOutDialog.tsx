import React, { useState } from 'react';
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { useRBAC } from '@/shared/hooks/useRBAC';
import { useToast } from '@/shared/hooks/use-toast';
import { errorToast } from '@/shared/lib/errorToast';
import { invalidateDashboardQueries } from '@/shared/lib/invalidateDashboards';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Badge } from '@/shared/components/ui/badge';
import { Switch } from '@/shared/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/shared/components/ui/select';
import {
  Archive, AlertTriangle, CheckCircle, Loader2,
  User, Home, FileSignature, Wrench, CalendarX, Info
} from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  unit: string | null;
  unit_id: string | null;
  property: string | null;
  property_id: string | null;
  monthly_rent: number | null;
  deposit_balance: number | null;
}

interface MoveOutDialogProps {
  tenant: Tenant;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const MOVE_OUT_REASONS = [
  { value: 'notice_given',       label: 'Tenant gave notice' },
  { value: 'lease_expired',      label: 'Lease expired naturally' },
  { value: 'mutual_agreement',   label: 'Mutual agreement' },
  { value: 'eviction',           label: 'Eviction / early termination' },
  { value: 'transferred',        label: 'Transferred to another unit' },
  { value: 'other',              label: 'Other' },
];

const MoveOutDialog: React.FC<MoveOutDialogProps> = ({
  tenant, open, onOpenChange, onSuccess,
}) => {
  const { user } = useAuth();
  const { can } = useRBAC();
  const { managerId } = useManagerScope();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [moveOutDate, setMoveOutDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('notice_given');
  const [notes, setNotes] = useState('');
  const [grantPortalAccess, setGrantPortalAccess] = useState(true);
  const [portalDays, setPortalDays] = useState('90');
  const [step, setStep] = useState<'confirm' | 'summary'>('confirm');
  const [result, setResult] = useState<any>(null);

  const moveOut = useMutation({
    mutationFn: async () => {
      if (!tenant.unit_id) throw new Error('Tenant has no unit linked');

      // Call the complete_unit_moveout SQL function
      const { data, error } = await supabase.rpc('complete_unit_moveout' as any, {
        p_unit_id:           tenant.unit_id,
        p_tenant_id:         tenant.id,
        p_manager_id:        managerId ?? user!.id,
        p_move_out_date:     moveOutDate,
        p_reason:            reason,
        p_notes:             notes || null,
        p_notice_id:         null,
        p_grant_portal_days: grantPortalAccess ? parseInt(portalDays) : 0,
      });

      if (error) throw error;

      return { tenancyId: data };
    },
    onSuccess: (data) => {
      setResult(data);
      setStep('summary');
      queryClient.invalidateQueries({ queryKey: ['unit-tenancy-history', tenant.unit_id] });
      queryClient.invalidateQueries({ queryKey: ['unit-activity-log', tenant.unit_id] });
      queryClient.invalidateQueries({ queryKey: ['manager-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-invoices'] });
      invalidateDashboardQueries(queryClient);
    },
    onError: (err: Error) => {
      errorToast('Move-out failed', err);
    },
  });

  const handleClose = () => {
    setStep('confirm');
    setResult(null);
    setNotes('');
    setReason('notice_given');
    onOpenChange(false);
    if (step === 'summary') onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        {step === 'confirm' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Archive className="h-5 w-5 text-warning" />
                Process move-out
              </DialogTitle>
              <DialogDescription>
                This will archive the tenancy and free the unit. All history is preserved — nothing is deleted.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Tenant summary */}
              <div className="p-3 rounded-lg bg-muted/40 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-amber-400/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-warning" />
                </div>
                <div>
                  <p className="text-sm font-medium">{tenant.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {tenant.unit} · {tenant.property}
                  </p>
                </div>
                {tenant.deposit_balance !== null && tenant.deposit_balance > 0 && (
                  <Badge className="ml-auto bg-amber-100 text-amber-800 border-amber-200">
                    KES {tenant.deposit_balance.toLocaleString()} deposit held
                  </Badge>
                )}
              </div>

              {/* What will happen */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">What happens on move-out</p>
                {[
                  { icon: Archive,       text: 'Active lease archived (not deleted) — status set to terminated' },
                  { icon: FileSignature, text: 'Active contracts archived — tenant retains signed copies in portal' },
                  { icon: Home,          text: 'Unit status set to vacant and available for new tenant' },
                  { icon: CheckCircle,   text: 'Full tenancy record preserved — rent paid, arrears, dates all kept' },
                  { icon: Wrench,        text: 'Maintenance history stays linked to unit (not the tenant)' },
                  { icon: User,          text: 'Tenant\'s portal history remains accessible for configured days' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <item.icon className="h-3.5 w-3.5 shrink-0 mt-0.5 text-green-600" />
                    {item.text}
                  </div>
                ))}
              </div>

              {/* Move-out details */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Move-out date</Label>
                  <Input
                    type="date"
                    value={moveOutDate}
                    onChange={e => setMoveOutDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Reason</Label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MOVE_OUT_REASONS.map(r => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Manager notes</Label>
                <Textarea
                  placeholder="Any notes about the move-out condition, outstanding issues, etc."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="mt-1 resize-none"
                  rows={2}
                />
              </div>

              {/* Portal access toggle */}
              <div className="p-3 rounded-lg border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Grant tenant continued portal access</p>
                    <p className="text-xs text-muted-foreground">
                      Tenant can view their invoice history, receipts, and contracts in read-only mode
                    </p>
                  </div>
                  <Switch checked={grantPortalAccess} onCheckedChange={setGrantPortalAccess} />
                </div>
                {grantPortalAccess && (
                  <div>
                    <Label className="text-xs">Access duration (days)</Label>
                    <Select value={portalDays} onValueChange={setPortalDays}>
                      <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 days</SelectItem>
                        <SelectItem value="60">60 days</SelectItem>
                        <SelectItem value="90">90 days (recommended)</SelectItem>
                        <SelectItem value="180">6 months</SelectItem>
                        <SelectItem value="365">1 year</SelectItem>
                        <SelectItem value="3650">Indefinite (10 years)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Deposit warning */}
              {tenant.deposit_balance !== null && tenant.deposit_balance > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>Deposit of KES {tenant.deposit_balance.toLocaleString()} is still held.</strong> Process the
                    deposit refund separately from the tenant's profile after completing move-out.
                  </span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={moveOut.isPending}>
                Cancel
              </Button>
              <Button
                onClick={() => moveOut.mutate()}
                disabled={moveOut.isPending || !tenant.unit_id}
                className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
              >
                {moveOut.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Processing…</>
                  : <><Archive className="h-4 w-4" />Complete move-out</>
                }
              </Button>
            </DialogFooter>
          </>
        ) : (
          /* Summary screen */
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-5 w-5" />
                Move-out complete
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-lg bg-green-50 border border-green-200 space-y-2">
                <p className="text-sm font-medium text-green-900">
                  {tenant.name} has been successfully moved out of {tenant.unit}
                </p>
                <div className="text-xs text-green-800 space-y-1">
                  <p>✓ Lease archived</p>
                  <p>✓ Active contracts archived</p>
                  <p>✓ Unit status set to vacant</p>
                  <p>✓ Tenancy record preserved in unit history</p>
                  <p>✓ Tenant portal access granted for {grantPortalAccess ? portalDays : 0} days</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  To view the full unit history including this tenancy, go to the unit's history panel.
                  To process the deposit refund, open the tenant's profile.
                </span>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleClose} className="gap-2">
                <CheckCircle className="h-4 w-4" />
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MoveOutDialog;
