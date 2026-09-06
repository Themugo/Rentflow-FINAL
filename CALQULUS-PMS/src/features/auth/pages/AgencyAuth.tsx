import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/shared/hooks/use-toast';
import { setRememberMe } from '@/integrations/supabase/client';
import { sanitizeAuthError } from '@/features/auth/lib/authFlow';
import { AuthLoadingScreen } from '@/features/auth/components/AuthHeroChrome';
import { AgencyPortalShell, AGENCY_ACCENT } from '@/features/auth/components/AgencyPortalChrome';
import { PortalLoginCard } from '@/features/auth/components/PortalLoginScreen';

const AgencyAuth = () => {
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
      if (userRole.role === 'agency') navigate('/agency');
      else if (userRole.role === 'manager') navigate('/');
      else if (userRole.role === 'landlord') navigate('/landlord/dashboard');
      else if (userRole.role === 'tenant') navigate('/portal');
      else if (userRole.role === 'webhost') navigate('/webhost');
    }
  }, [user, loading, userRole, navigate]);

  useEffect(() => {
    document.title = 'Agency sign-in | CALQULUS PMS';
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsSubmitting(true);
    setRememberMe(rememberMe);
    const { error } = await signIn(email, password);
    if (error) {
      toast({ title: 'Login failed', description: sanitizeAuthError(error.message), variant: 'destructive' });
    }
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
    <AgencyPortalShell>
      <PortalLoginCard
        accentHex={AGENCY_ACCENT}
        accentTextHex={AGENCY_ACCENT}
        portalLabel="agency"
        emailPlaceholder="agent@agency.com"
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
        footNote={
          <p className="text-center text-xs text-muted-foreground">
            This portal is for agencies. Your webhost or platform team provisions the account.
          </p>
        }
      />
    </AgencyPortalShell>
  );
};

export default AgencyAuth;
