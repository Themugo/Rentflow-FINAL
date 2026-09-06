import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { useToast } from '@/shared/hooks/use-toast';
import { errorToast } from '@/shared/lib/errorToast';
import { Shield, CheckCircle, Eye, EyeOff, Lock } from 'lucide-react';
import { BrandMark } from '@/shared/components/branding/BrandMark';
import { AuthLoadingScreen } from '@/features/auth/components/AuthHeroChrome';
import { PortalAccentBar, portalSurfaceProps } from '@/core/design';
import {
  ADMIN_INVITATION_STATE_COPY,
  buildAdminInvitationSummary,
  isAdminPasswordStrong,
  normalizeAdminInvitationState,
  type AdminInvitationState,
} from '@/features/auth/lib/adminInvitation';

interface AdminInvitation {
  id: string;
  email: string;
  display_name: string;
  inviter_name: string | null;
  admin_type: string | null;
  status: string;
  expires_at: string;
}

/**
 * CALQULUS ADMIN invitation acceptance (Phase 8).
 *
 * Invitation → identity verification (invited email) → credential setup
 * (invitee-chosen password, ≥10 chars) → accept admin role → admin
 * console. The granted role is decided server-side; this page never
 * sends a role. There is no public admin registration.
 */
const AdminInviteAccept = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const token = searchParams.get('token');

  const [invitation, setInvitation] = useState<AdminInvitation | null>(null);
  const [tokenState, setTokenState] = useState<AdminInvitationState | null>(null);
  const [isLoading, setIsLoading] = useState(!!token);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) { setTokenState('invalid'); setIsLoading(false); return; }
    void (async () => {
      const { data, error } = await supabase.rpc('validate_admin_invitation_token', { token_value: token });
      if (error || !data || data.length === 0) {
        const { data: stateData } = await supabase.rpc('admin_invitation_token_state', { token_value: token });
        setTokenState(normalizeAdminInvitationState(stateData));
        setIsLoading(false);
        return;
      }
      setInvitation(data[0]);
      setTokenState('pending');
      setIsLoading(false);
    })();
  }, [token]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation) return;
    if (!isAdminPasswordStrong(password)) {
      toast({ title: 'Password too short', description: 'Admin passwords must be at least 10 characters.', variant: 'destructive' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: 'Passwords do not match', description: 'Re-enter the same password to confirm.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('accept-admin-invitation', {
        body: { token, password },
      });
      if (error) throw new Error(data?.error ?? error.message);
      setAccepted(true);
    } catch (err) {
      errorToast('Could not accept invitation', err, 'Something went wrong. Try again or ask for a new invitation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <AuthLoadingScreen />;

  // Accepted — hand off to the admin console
  if (accepted) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-background text-foreground hero-gradient px-4" {...portalSurfaceProps("platform_admin")}>
        <PortalAccentBar className="absolute top-0 left-0 right-0 z-20" />
        <Card className="w-full max-w-md border-primary/20 bg-card/95 backdrop-blur-sm shadow-sm">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-success/15 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">CALQULUS ADMIN</CardTitle>
            <CardDescription className="text-muted-foreground mt-2">
              Your admin role is active, {invitation?.display_name}. Sign in to the console with the credentials you just set.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground text-center">
              For stronger security, enable two-factor authentication from Account Security after your first sign in.
            </p>
            <Button className="w-full min-h-11 btn-brand" onClick={() => navigate('/webhost/login')}>
              Go to CALQULUS ADMIN sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Expired / used / revoked / invalid — one honest screen per state
  if (tokenState && tokenState !== 'pending') {
    const copy = ADMIN_INVITATION_STATE_COPY[tokenState];
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-background text-foreground hero-gradient px-4" {...portalSurfaceProps("platform_admin")}>
        <PortalAccentBar className="absolute top-0 left-0 right-0 z-20" />
        <Card className="w-full max-w-md border-primary/20 bg-card/95 backdrop-blur-sm shadow-sm">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4"><BrandMark size="hero" forcePlatform /></div>
            <p className="text-[11px] text-primary font-semibold tracking-[0.25em] uppercase mb-2">CALQULUS ADMIN</p>
            <CardTitle className="text-2xl font-bold text-foreground">{copy.title}</CardTitle>
            <CardDescription className="text-muted-foreground mt-2">{copy.body}</CardDescription>
          </CardHeader>
          {copy.cta && (
            <CardContent>
              <Button className="w-full min-h-11" onClick={() => navigate(copy.cta!.href)}>{copy.cta.label}</Button>
            </CardContent>
          )}
        </Card>
      </div>
    );
  }

  // Valid invitation — identity card + credential setup
  const summaryRows = buildAdminInvitationSummary({
    email: invitation?.email ?? null,
    displayName: invitation?.display_name ?? null,
    inviterName: invitation?.inviter_name ?? null,
    adminType: invitation?.admin_type ?? null,
  });

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background text-foreground hero-gradient px-4 py-8" {...portalSurfaceProps("platform_admin")}>
      <PortalAccentBar className="absolute top-0 left-0 right-0 z-20" />
      <Card className="w-full max-w-md border-primary/20 bg-card/95 backdrop-blur-sm shadow-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4"><BrandMark size="hero" forcePlatform /></div>
          <div className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-full border border-destructive/30 bg-destructive/15 mb-3 self-center">
            <Shield className="h-3.5 w-3.5 text-destructive" />
            <span className="text-xs text-destructive font-semibold">Restricted — invitation only</span>
          </div>
          <p className="text-[11px] text-primary font-semibold tracking-[0.25em] uppercase">CALQULUS ADMIN</p>
          <CardTitle className="text-2xl font-bold text-foreground mt-1">Accept your admin role</CardTitle>
          <CardDescription className="text-muted-foreground mt-2">
            Verify your identity and set your credentials to activate platform administration.
          </CardDescription>
          <dl className="mt-4 rounded-lg border border-primary/20 bg-primary/10 divide-y divide-primary/10 text-left">
            {summaryRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between px-3 py-2">
                <dt className="text-xs text-muted-foreground">{row.label}</dt>
                <dd className="text-sm font-medium text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAccept} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-password">Create password</Label>
              <div className="relative">
                <Input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 10 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={10}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password-confirm">Confirm password</Label>
              <Input
                id="admin-password-confirm"
                type={showPassword ? 'text' : 'password'}
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={10}
              />
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
              <Lock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                Only you set this password — it is never sent to or seen by the administrator who invited you.
              </p>
            </div>
            <Button type="submit" disabled={isSubmitting} className="w-full min-h-11 btn-brand">
              {isSubmitting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : (
                'Accept admin role'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminInviteAccept;
