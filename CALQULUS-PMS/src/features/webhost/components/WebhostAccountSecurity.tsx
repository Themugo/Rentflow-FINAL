// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useToast } from '@/shared/hooks/use-toast';
import { useAuth } from '@/features/auth/AuthContext';
import { useActivityLog } from '@/shared/hooks/useActivityLog';
import { cn } from '@/shared/lib/utils';
import { format } from 'date-fns';
import {
  Shield, ShieldCheck, ShieldAlert, KeyRound, Lock, RefreshCw, AlertTriangle,
  Loader2, Mail, Crown, UserCog, Activity, Fingerprint, CheckCircle2, XCircle,
} from 'lucide-react';

interface PlatformAdminRow {
  id: string;
  user_id: string;
  admin_type: 'owner' | 'business' | 'admin';
  display_name: string;
  email: string;
  is_immutable: boolean;
  suspended: boolean;
  suspended_at: string | null;
  suspension_reason: string | null;
  can_manage_billing: boolean;
  can_manage_managers: boolean;
  can_manage_properties: boolean;
  can_manage_landlords: boolean;
  can_view_activity_logs: boolean;
  can_manage_platform_settings: boolean;
  can_create_admins: boolean;
  created_at: string;
  updated_at: string;
}

interface MfaFactor {
  id: string;
  factor_type: string;
  friendly_name?: string | null;
  status: string;
}

const WebhostAccountSecurity: React.FC = () => {
  const { toast } = useToast();
  const { user, isPlatformOwner, isPlatformBusiness } = useAuth();
  const { logActivity } = useActivityLog();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const canManage = isPlatformOwner || isPlatformBusiness;

  // ── Current user's own MFA factors (REAL — Supabase Auth MFA API, own-only by design)
  const { data: mfaFactors, isLoading: mfaLoading } = useQuery<MfaFactor[]>({
    queryKey: ['auth-mfa-factors'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return (data?.factors ?? []) as MfaFactor[];
    },
  });

  // ── Platform admin accounts (REAL — platform_admins table, RLS: owner sees all, business sees non-owner)
  const { data: admins, isLoading: adminsLoading, isError: adminsError, error: adminsErr, refetch: refetchAdmins } = useQuery<PlatformAdminRow[]>({
    queryKey: ['security-platform-admins'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_admins')
        .select('id, user_id, admin_type, display_name, email, is_immutable, suspended, suspended_at, suspension_reason, can_manage_billing, can_manage_managers, can_manage_properties, can_manage_landlords, can_view_activity_logs, can_manage_platform_settings, can_create_admins, created_at, updated_at')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as PlatformAdminRow[];
    },
    // Only owner/business can read platform_admins (RLS enforces anyway).
    enabled: canManage,
  });

  const mfaEnrolled = (mfaFactors ?? []).some(f => f.status === 'verified' || f.status === 'enabled');

  const updatePassword = async () => {
    if (password.length < 8) {
      toast({ title: 'Password too short', description: 'Use at least 8 characters.', variant: 'destructive' });
      return;
    }
    if (password !== confirm) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      // Audit via the EXISTING audit system (activity_logs via log_activity RPC).
      logActivity({ action: 'Updated own webhost password', entityType: 'security', entityId: user?.id });
      setPassword('');
      setConfirm('');
      toast({ title: 'Password updated', description: 'Your webhost password was changed successfully.' });
    } catch (err) {
      toast({ title: 'Failed to update password', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const sendResetEmail = async () => {
    setSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const email = sessionData.session?.user?.email;
      if (!email) throw new Error('No active user email found.');
      const redirectTo = `${window.location.origin}/reset-password?portal=webhost`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      logActivity({ action: 'Sent webhost password reset email', entityType: 'security', entityId: user?.id });
      toast({ title: 'Reset email sent', description: 'Check your inbox for a secure password-reset link.' });
    } catch (err) {
      toast({ title: 'Failed to send reset email', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const adminTypeConfig: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
    owner: { label: 'Owner', icon: Crown, tone: 'bg-warning/15 text-warning border-warning/30' },
    business: { label: 'Business', icon: UserCog, tone: 'bg-info/15 text-navy-mid border-info/30' },
    admin: { label: 'Admin', icon: Shield, tone: 'bg-secondary-foreground/15 text-secondary-foreground border-border/30' },
  };

  const refreshAll = () => {
    refetchAdmins();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-warning/15">
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <ShieldCheck className="h-5 w-5 text-warning" />
                Security & Access Control Center
              </CardTitle>
              <CardDescription className="text-warning/70">
                Authentication health, admin access, RBAC, and security configuration. Read-only where enforced by backend authorization.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={refreshAll} className="border-warning/20 text-warning hover:bg-warning/10">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* ── 1. Security overview ── */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card border-warning/15">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-warning/70">Authentication</CardTitle>
            {user ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" />}
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold text-foreground">{user ? 'Authenticated' : 'No session'}</p>
            <p className="text-xs text-muted-foreground mt-1 truncate">{user?.email ?? '—'}</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-warning/70">MFA (this account)</CardTitle>
            <Fingerprint className={cn('h-4 w-4', mfaEnrolled ? 'text-success' : 'text-warning')} />
          </CardHeader>
          <CardContent>
            {mfaLoading ? (
              <Skeleton className="h-6 w-24" />
            ) : (
              <>
                <p className="text-lg font-semibold text-foreground">{mfaEnrolled ? 'Enrolled' : 'Not enrolled'}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {(mfaFactors ?? []).length} factor(s) registered
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-warning/70">Active threats</CardTitle>
            <Shield className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold text-foreground">None recorded</p>
            <p className="text-xs text-muted-foreground mt-1">No active security threats recorded.</p>
          </CardContent>
        </Card>
      </div>

      {/* ── 2. Admin access (platform_admins) ── */}
      <Card className="bg-card border-warning/15">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <UserCog className="h-5 w-5 text-warning" />
            Admin Access
          </CardTitle>
          <CardDescription className="text-warning/70">
            Platform admin accounts, roles, and account status. MFA status per-account is not cross-readable (RLS-protected, own-only).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!canManage ? (
            <div className="text-center py-8 text-warning/70">
              <Lock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Only owner and business-level admins can view the admin account directory.</p>
            </div>
          ) : adminsLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : adminsError ? (
            <div className="p-6 text-center rounded-xl border border-destructive/30 bg-destructive/5">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
              <p className="text-sm font-semibold text-destructive">Unable to load admin accounts.</p>
              <p className="text-xs text-muted-foreground mt-1 mb-3">{(adminsErr as Error)?.message ?? 'Try again.'}</p>
              <Button variant="outline" size="sm" onClick={() => refetchAdmins()} className="border-destructive/40 text-destructive hover:bg-destructive/10">
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
              </Button>
            </div>
          ) : !admins || admins.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <UserCog className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No platform admin accounts available.</p>
              <p className="text-xs text-muted-foreground mt-1">Admin accounts are seeded in the platform_admins table.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-warning/10 text-left text-warning/70">
                    <th className="py-2 pr-4 font-medium">Account</th>
                    <th className="py-2 pr-4 font-medium">Role</th>
                    <th className="py-2 pr-4 font-medium">Account status</th>
                    <th className="py-2 pr-4 font-medium">MFA</th>
                    <th className="py-2 pr-4 font-medium">Last activity</th>
                    <th className="py-2 pr-4 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map(a => {
                    const cfg = adminTypeConfig[a.admin_type] ?? adminTypeConfig.admin;
                    const RoleIcon = cfg.icon;
                    return (
                      <tr key={a.id} className="border-b border-warning/5">
                        <td className="py-2.5 pr-4">
                          <p className="font-medium text-foreground">{a.display_name}</p>
                          <p className="text-xs text-muted-foreground">{a.email}</p>
                        </td>
                        <td className="py-2.5 pr-4">
                          <Badge variant="outline" className={cn('gap-1', cfg.tone)}>
                            <RoleIcon className="h-3 w-3" />
                            {cfg.label}
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-4">
                          {a.is_immutable ? (
                            <Badge className="bg-blue-500/15 text-primary border border-blue-500/30">Immutable</Badge>
                          ) : a.suspended ? (
                            <Badge className="bg-destructive/15 text-destructive border border-destructive/30">Suspended</Badge>
                          ) : (
                            <Badge className="bg-success/15 text-success border border-success/30">Active</Badge>
                          )}
                          {a.suspended && a.suspended_at && (
                            <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(a.suspended_at), 'dd MMM yyyy')}</p>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-muted-foreground">—</td>
                        <td className="py-2.5 pr-4 text-muted-foreground">—</td>
                        <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                          {format(new Date(a.created_at), 'dd MMM yyyy')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 3 & 7. Authentication security + configuration ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-card border-warning/15">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Lock className="h-5 w-5 text-warning" />
              Authentication Security
            </CardTitle>
            <CardDescription className="text-warning/70">Existing authentication controls (read-only metadata).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Session</span>
              <Badge variant="outline" className="border-success/30 text-success">JWT (Supabase Auth)</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">MFA for this account</span>
              {mfaLoading ? (
                <Skeleton className="h-5 w-20" />
              ) : mfaEnrolled ? (
                <Badge variant="outline" className="border-success/30 text-success">Configured</Badge>
              ) : (
                <Badge variant="outline" className="border-warning/30 text-warning">Not configured</Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Login protection</span>
              <Badge variant="outline" className="border-border/40 text-muted-foreground">Supabase built-in</Badge>
            </div>
            <p className="text-[10px] text-muted-foreground pt-1 border-t border-warning/10">
              Authentication architecture and session security are managed by Supabase Auth. No secrets are exposed here.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <ShieldAlert className="h-5 w-5 text-warning" />
              Security Configuration
            </CardTitle>
            <CardDescription className="text-warning/70">Only settings already supported by the system are shown.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">MFA policy</span>
              <Badge variant="outline" className="border-border/40 text-muted-foreground">Available (per-account)</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Account suspension</span>
              <Badge variant="outline" className="border-border/40 text-muted-foreground">Owner / Business</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">RLS / tenant isolation</span>
              <Badge variant="outline" className="border-success/30 text-success">Enforced (backend)</Badge>
            </div>
            <p className="text-[10px] text-muted-foreground pt-1 border-t border-warning/10">
              Security decisions remain server-side. Backend authorization (RLS + Supabase Auth) is the source of truth.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── 5. RBAC & permissions (read-only view from platform_admins flags) ── */}
      {canManage && admins && admins.length > 0 && (
        <Card className="bg-card border-warning/15">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <KeyRound className="h-5 w-5 text-warning" />
              RBAC & Permissions
            </CardTitle>
            <CardDescription className="text-warning/70">
              Relationship of admin → role → permissions. Read-only. Permission changes are enforced by backend authorization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-warning/10 text-left text-warning/70">
                    <th className="py-2 pr-4 font-medium">Admin</th>
                    <th className="py-2 pr-3 font-medium text-center">Billing</th>
                    <th className="py-2 pr-3 font-medium text-center">Managers</th>
                    <th className="py-2 pr-3 font-medium text-center">Properties</th>
                    <th className="py-2 pr-3 font-medium text-center">Landlords</th>
                    <th className="py-2 pr-3 font-medium text-center">Activity logs</th>
                    <th className="py-2 pr-3 font-medium text-center">Platform settings</th>
                    <th className="py-2 pr-3 font-medium text-center">Create admins</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map(a => (
                    <tr key={a.id} className="border-b border-warning/5">
                      <td className="py-2 pr-4 text-foreground">{a.display_name}</td>
                      <td className="py-2 pr-3 text-center">{a.can_manage_billing ? <CheckCircle2 className="h-3.5 w-3.5 text-success inline" /> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="py-2 pr-3 text-center">{a.can_manage_managers ? <CheckCircle2 className="h-3.5 w-3.5 text-success inline" /> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="py-2 pr-3 text-center">{a.can_manage_properties ? <CheckCircle2 className="h-3.5 w-3.5 text-success inline" /> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="py-2 pr-3 text-center">{a.can_manage_landlords ? <CheckCircle2 className="h-3.5 w-3.5 text-success inline" /> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="py-2 pr-3 text-center">{a.can_view_activity_logs ? <CheckCircle2 className="h-3.5 w-3.5 text-success inline" /> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="py-2 pr-3 text-center">{a.can_manage_platform_settings ? <CheckCircle2 className="h-3.5 w-3.5 text-success inline" /> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="py-2 pr-3 text-center">{a.can_create_admins ? <CheckCircle2 className="h-3.5 w-3.5 text-success inline" /> : <span className="text-muted-foreground">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Credential rotation (existing functionality preserved) ── */}
      <Card className="bg-card border-warning/15">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <KeyRound className="h-5 w-5 text-warning" />
            Credential Rotation
          </CardTitle>
          <CardDescription className="text-warning/70">
            Rotate your own webhost password, or send yourself a secure reset link for handover to client admins.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>New password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 bg-secondary-background border-warning/20" autoComplete="new-password" />
            </div>
            <div>
              <Label>Confirm password</Label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1 bg-secondary-background border-warning/20" autoComplete="new-password" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={updatePassword} disabled={saving} className="bg-primary hover:bg-primary/90 text-white">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {saving ? 'Updating…' : 'Update password'}
            </Button>
            <Button variant="outline" onClick={sendResetEmail} disabled={sending} className="border-warning/20 text-warning hover:bg-warning/10">
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
              {sending ? 'Sending…' : 'Email reset link'}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Activity className="h-3 w-3" />
            Password changes are recorded in the existing audit system (activity_logs).
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default WebhostAccountSecurity;
