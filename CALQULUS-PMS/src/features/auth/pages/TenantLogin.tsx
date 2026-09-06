import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/shared/components/ui/button';
import { useToast } from '@/shared/hooks/use-toast';
import { UserPlus, Link2, ShieldCheck, ArrowRight } from 'lucide-react';
import { setRememberMe, supabase } from '@/integrations/supabase/client';
import { ensureSignedInRole, sanitizeAuthError } from '@/features/auth/lib/authFlow';
import { AuthLoadingScreen } from '@/features/auth/components/AuthHeroChrome';
import { TenantPortalShell, TENANT_ACCENT } from '@/features/auth/components/TenantPortalChrome';
import { PortalLoginCard } from '@/features/auth/components/PortalLoginScreen';

const TenantLogin = () => {
  const navigate = useNavigate();
  const { user, signIn, signInWithGoogle, loading, userRole } = useAuth();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMeState] = useState(true);

  useEffect(() => {
    if (user && !loading && userRole) {
      // Only redirect tenants to portal - other roles should use their own login pages
      if (userRole.role === 'tenant') {
        navigate('/portal');
      }
      // Don't redirect managers/webhosts from tenant login - they're on the wrong page
    }
  }, [user, loading, userRole, navigate]);

  useEffect(() => {
    document.title = 'Tenant sign-in | CALQULUS PMS';
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setRememberMe(rememberMe);

    const { error } = await signIn(email, password);

    if (error) {
      toast({ title: 'Login failed', description: sanitizeAuthError(error.message), variant: 'destructive' });
      setIsSubmitting(false);
      return;
    }

    // A tenant who completed independent self-registration with email confirmation
    // may authenticate here later and still need the server-side tenant record created.
    const { data: signedInData } = await supabase.auth.getUser();
    const signedInUser = signedInData.user;
    const independentIntent = signedInUser?.user_metadata?.account_type === 'independent_tenant';
    if (independentIntent) {
      const { data: bootstrapResult, error: bootstrapError } = await supabase.rpc('self_register_tenant_atomic' as any, {
        p_name: signedInUser?.user_metadata?.full_name || email.split('@')[0],
        p_phone: signedInUser?.user_metadata?.phone || null,
        p_rental: (signedInUser?.user_metadata?.rental_record as Record<string, unknown> | null) ?? null,
      });
      if (bootstrapError && !/already registered as a tenant/i.test(bootstrapError.message)) {
        toast({ title: 'Account setup needs attention', description: bootstrapError.message, variant: 'destructive' });
        setIsSubmitting(false);
        return;
      }
      void bootstrapResult;
    }

    const roleCheck = await ensureSignedInRole(['tenant']);
    if (!roleCheck.ok) {
      const roles = roleCheck.roles;
      if (roles.includes('manager') || roles.includes('submanager')) {
        navigate('/');
      } else if (roles.includes('webhost')) {
        navigate('/webhost');
      } else if (roles.includes('landlord')) {
        navigate('/landlord/dashboard');
      } else if (roles.includes('agency')) {
        navigate('/agency');
      } else {
        toast({ title: 'No active role', description: roleCheck.message, variant: 'destructive' });
      }
      setIsSubmitting(false);
      return;
    }

    toast({ title: 'Welcome back!', description: 'You have been logged in successfully.' });
    setIsSubmitting(false);
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleSubmitting(true);
    setRememberMe(rememberMe);
    const { error } = await signInWithGoogle();
    if (error) {
      toast({ title: 'Google sign-in failed', description: sanitizeAuthError(error.message), variant: 'destructive' });
      setIsGoogleSubmitting(false);
    }
  };

  if (loading) {
    return <AuthLoadingScreen variant="light" />;
  }

  return (
    <TenantPortalShell>
      <PortalLoginCard
        accentHex={TENANT_ACCENT}
        portalLabel="tenant"
        email={email}
        onEmailChange={setEmail}
        password={password}
        onPasswordChange={setPassword}
        showPassword={showPassword}
        onToggleShowPassword={() => setShowPassword((v) => !v)}
        rememberMe={rememberMe}
        onRememberMeChange={setRememberMeState}
        onSubmit={handleLogin}
        isSubmitting={isSubmitting}
        onGoogleSignIn={handleGoogleSignIn}
        isGoogleSubmitting={isGoogleSubmitting}
        forgotPasswordVariant="tenant"
        footNote={
          <div className="space-y-4">
            <div className="rounded-xl border border-primary/15 bg-primary/5 p-3">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Your tenant record stays yours.</p>
                  <p className="mt-0.5 text-xs leading-4.5 text-muted-foreground">Join through a property manager, landlord or agency — or keep an independent rental record that can move with you later.</p>
                </div>
              </div>
            </div>
            <div>
              <p className="mb-2 text-center text-sm font-semibold text-foreground">How are you joining?</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Link to="/tenant/invitation" className="group">
                  <Button variant="outline" className="min-h-12 w-full justify-between px-4 font-semibold">
                    <span className="flex items-center gap-2"><Link2 className="h-4 w-4 text-primary" />I have an invitation</span>
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </Button>
                </Link>
                <Link to="/tenant/signup" className="group">
                  <Button variant="outline" className="min-h-12 w-full justify-between border-primary/20 px-4 font-semibold">
                    <span className="flex items-center gap-2"><UserPlus className="h-4 w-4 text-primary" />Keep my own rental record</span>
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </Button>
                </Link>
              </div>
            </div>
            <p className="text-center text-xs text-muted-foreground">Independent registration is free to join. Optional CALQULUS transaction services can be configured by the platform administrator.</p>
          </div>
        }
      />
    </TenantPortalShell>
  );
};

export default TenantLogin;
