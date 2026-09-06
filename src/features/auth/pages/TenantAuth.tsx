import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams, Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/shared/components/ui/card';
import { useToast } from '@/shared/hooks/use-toast';
import { CheckCircle, XCircle, Mail, LogIn } from 'lucide-react';
import { signupSchema, formatValidationErrors, isValidKenyanPhone } from '@/shared/lib/validations';
import { supabase } from '@/integrations/supabase/client';
import { logError } from '@/shared/lib/errorLogger';
import { sanitizeAuthError } from '@/features/auth/lib/authFlow';
import { BrandMark } from '@/shared/components/branding/BrandMark';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import {
  INVITATION_STATE_COPY,
  buildInvitationSummary,
  buildLeaseSummary,
  normalizeInvitationState,
  type InvitationState,
} from '@/features/auth/lib/tenantInvitation';
import { formatCurrency } from '@/shared/lib/formatCurrency';
import { TenantPortalShell } from '@/features/auth/components/TenantPortalChrome';

interface Invitation {
  id: string;
  email: string;
  tenant_name: string;
  phone: string | null;
  property_id: string;
  property_name: string;
  unit: string | null;
  status: string;
  expires_at: string;
  invited_by: string;
  inviter_name: string | null;
  monthly_rent?: number | null;
  house_deposit?: number | null;
  water_deposit?: number | null;
}

interface ClaimedSummary {
  property: string | null;
  unit: string | null;
  monthlyRent: number | null;
  depositAmount: number | null;
}

const TenantAuth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const invitationToken = searchParams.get('invitation') || searchParams.get('token');
  const isMobile = useIsMobile();
  
  const { user, loading, userRole } = useAuth();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupFullName, setSignupFullName] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [isSelfRegistration, setIsSelfRegistration] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  
  // Invitation state
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [tokenState, setTokenState] = useState<InvitationState | null>(null);
  const [claimedSummary, setClaimedSummary] = useState<ClaimedSummary | null>(null);
  const [isLoadingInvitation, setIsLoadingInvitation] = useState(!!invitationToken);

  const validateEmail = (email: string): boolean => {
    if (!email) return true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailChange = (email: string) => {
    setSignupEmail(email);
    if (email && !validateEmail(email)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };

  // Load invitation if token is present - REQUIRED for signup unless self-registration
  useEffect(() => {
    const loadInvitation = async () => {
      if (!invitationToken) {
        setIsLoadingInvitation(false);
        return;
      }
      
      setIsLoadingInvitation(true);
      
      // Use secure RPC function instead of direct table query
      const { data, error } = await supabase
        .rpc('validate_invitation_token', { token_value: invitationToken });

      if (error || !data || data.length === 0) {
        // Classify the failure without exposing invitation contents:
        // expired / used / invalid each get their own screen.
        const { data: stateData } = await supabase
          .rpc('invitation_token_state', { token_value: invitationToken });
        setTokenState(normalizeInvitationState(stateData));
        setIsLoadingInvitation(false);
        return;
      }

      const invitationData = data[0];
      setInvitation(invitationData);
      setTokenState('pending');
      setSignupEmail(invitationData.email);
      setSignupFullName(invitationData.tenant_name);
      if (invitationData.phone) setSignupPhone(invitationData.phone);

      setIsLoadingInvitation(false);
    };
    
    loadInvitation();
  }, [invitationToken, toast]);

  useEffect(() => {
    if (user && !loading && userRole) {
      // Only redirect tenants to portal - this is a tenant-only signup page
      if (userRole.role === 'tenant') {
        navigate('/portal');
      }
      // Don't redirect other roles - they shouldn't be signing up here
    }
  }, [user, loading, userRole, navigate]);

  const validatePhone = (phone: string): boolean => {
    if (!phone) return true;
    return isValidKenyanPhone(phone.trim());
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const validationResult = signupSchema.safeParse({
      email: signupEmail,
      password: signupPassword,
      fullName: signupFullName,
    });
    if (!validationResult.success) {
      toast({ title: 'Validation Error', description: formatValidationErrors(validationResult.error), variant: 'destructive' });
      setIsSubmitting(false);
      return;
    }

    if (signupPhone && !validatePhone(signupPhone)) {
      toast({
        title: 'Invalid Phone Number',
        description: 'Phone must start with 07 (e.g., 0712345678) or +254 (e.g., +254712345678)',
        variant: 'destructive',
      });
      setIsSubmitting(false);
      return;
    }

    try {
      if (!invitationToken || !invitation) {
        toast({ title: 'Invitation required', description: 'Open the tenant invitation link sent by your property manager, landlord or agency.', variant: 'destructive' });
        setIsSubmitting(false);
        return;
      }

      let authUser = user;
      let hasSession = false;
      const redirectUrl = `${window.location.origin}/portal`;
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: { emailRedirectTo: redirectUrl, data: { full_name: signupFullName, phone: signupPhone || null } },
      });

      if (authError) {
        if (!authError.message.toLowerCase().includes('already registered')) {
          toast({ title: 'Signup failed', description: sanitizeAuthError(authError.message), variant: 'destructive' });
          setIsSubmitting(false);
          return;
        }
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email: signupEmail, password: signupPassword });
        if (signInError || !signInData.user) {
          toast({ title: 'Account already exists', description: 'Sign in with the existing tenant account, then open this invitation again.', variant: 'destructive' });
          setIsSubmitting(false);
          return;
        }
        authUser = signInData.user;
        hasSession = Boolean(signInData.session);
      } else if (authData.user) {
        authUser = authData.user;
        hasSession = Boolean(authData.session);
      }

      if (!authUser) throw new Error('Tenant account could not be resolved');

      const { data: claimResult, error: claimError } = await supabase.rpc('claim_tenant_invitation_atomic' as any, {
        p_token: invitationToken,
      });
      if (claimError) {
        logError('TenantAuth.handleSignup.claimInvitation', claimError.message);
        toast({ title: 'Invitation could not be linked', description: claimError.message, variant: 'destructive' });
        setIsSubmitting(false);
        return;
      }

      setRegisteredEmail(signupEmail);
      if (hasSession) {
        setClaimedSummary({
          property: claimResult?.property ?? invitation.property_name,
          unit: claimResult?.unit ?? invitation.unit,
          monthlyRent: claimResult?.monthly_rent ?? invitation.monthly_rent ?? null,
          depositAmount: claimResult?.deposit_amount ?? (invitation.house_deposit != null ? invitation.house_deposit + (invitation.water_deposit || 0) : null),
        });
      } else {
        setShowVerificationMessage(true);
      }

      supabase.functions.invoke('notify-manager-tenant-signup', {
        body: {
          managerId: invitation.invited_by,
          tenantName: signupFullName,
          tenantEmail: signupEmail,
          propertyName: invitation.property_name,
          unit: invitation.unit || undefined,
        },
      }).catch((err) => logError('TenantAuth.notifyManager', err));

      await supabase.auth.refreshSession();
    } catch (error) {
      logError('TenantAuth.handleSignup', error);
      toast({ title: 'Signup failed', description: error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.', variant: 'destructive' });
    }

    setIsSubmitting(false);
  };

  // Password strength indicator
  const getPasswordStrength = (password: string) => {
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    };
    return checks;
  };

  const passwordStrength = getPasswordStrength(signupPassword);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show verification confirmation screen
  if (showVerificationMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md border-primary/20 bg-card/95 backdrop-blur-sm shadow-sm">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-md bg-primary flex items-center justify-center">
                <Mail className="h-8 w-8 text-primary-foreground" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">Check Your Email</CardTitle>
            <CardDescription className="text-muted-foreground mt-2">
              We've sent a verification link to
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <p className="text-foreground font-medium text-lg bg-muted py-3 px-4 rounded-lg border border-border">
              {registeredEmail}
            </p>
            <div className="space-y-3 text-muted-foreground text-sm">
              <p>Click the link in the email to verify your account and complete registration.</p>
              <p>
                Didn't receive the email? Check your spam folder or{' '}
                <button 
                  onClick={() => setShowVerificationMessage(false)}
                  className="text-primary hover:underline"
                >
                  try again
                </button>
              </p>
            </div>
            <div className="pt-4 border-t border-border">
              <p className="text-muted-foreground text-sm">
                Already verified?{' '}
                <Link to="/tenant/login" className="text-primary hover:underline">
                  Sign in here
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Confirmation — account created from a valid invitation
  if (claimedSummary) {
    const summaryRows = buildInvitationSummary({
      propertyName: claimedSummary.property,
      unit: claimedSummary.unit,
      inviterName: invitation?.inviter_name ?? null,
    });
    const leaseRows = buildLeaseSummary(
      {
        propertyName: null,
        unit: null,
        inviterName: null,
        monthlyRent: claimedSummary.monthlyRent,
        houseDeposit: claimedSummary.depositAmount,
      },
      (n) => formatCurrency(n),
    );
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-4">
        <Card className="w-full max-w-md border-primary/20 bg-card/95 backdrop-blur-sm shadow-sm">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-success/15 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">Your account is ready</CardTitle>
            <CardDescription className="text-muted-foreground mt-2">
              Welcome, {signupFullName}. Your property account has been set up.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="rounded-lg border border-border bg-muted/50 divide-y divide-border">
              {[...summaryRows, ...leaseRows].map((row) => (
                <div key={row.label} className="flex items-center justify-between px-4 py-3">
                  <dt className="text-sm text-muted-foreground">{row.label}</dt>
                  <dd className="text-sm font-medium text-foreground">{row.value}</dd>
                </div>
              ))}
            </dl>
            <Button className="w-full min-h-11 btn-brand" onClick={() => navigate('/portal')}>
              Enter Tenant Portal
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Expired / used / invalid invitation — one honest screen per state
  if (invitationToken && !isLoadingInvitation && tokenState && tokenState !== 'pending') {
    const copy = INVITATION_STATE_COPY[tokenState];
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-4">
        <Card className="w-full max-w-md border-primary/20 bg-card/95 backdrop-blur-sm shadow-sm">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <BrandMark size="hero" />
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">{copy.title}</CardTitle>
            <CardDescription className="text-muted-foreground mt-2">{copy.body}</CardDescription>
          </CardHeader>
          {copy.cta && (
            <CardContent>
              <Button className="w-full min-h-11" onClick={() => navigate(copy.cta!.href)}>
                {copy.cta.label}
              </Button>
            </CardContent>
          )}
        </Card>
      </div>
    );
  }

  // The invitation route requires a real invitation token; independent tenants use /tenant/signup.
  if (!invitationToken && !isLoadingInvitation && !isSelfRegistration) {
    return <Navigate to="/tenant/signup" replace />;
  }

  // If self-registration mode, show self-registration form
  if (isSelfRegistration) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md border-primary/20 bg-card/95 backdrop-blur-sm shadow-sm">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <BrandMark size="hero" />
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">Self-Registration</CardTitle>
            <CardDescription className="text-muted-foreground mt-2">
              Register to manage your rental records for accounting purposes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  value={signupFullName}
                  onChange={(e) => setSignupFullName(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={signupEmail}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  required
                />
                {emailError && <p className="text-sm text-destructive">{emailError}</p>}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number (Optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+254 700 000000"
                  value={signupPhone}
                  onChange={(e) => setSignupPhone(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Format: 0712345678 or +254712345678</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  required
                />
                <div className="space-y-1">
                  {Object.entries(passwordStrength).map(([key, valid]) => (
                    <div key={key} className="flex items-center gap-2 text-xs">
                      {valid ? <CheckCircle className="h-3 w-3 text-success" /> : <XCircle className="h-3 w-3 text-muted-foreground" />}
                      <span className={valid ? 'text-success' : 'text-muted-foreground'}>
                        {key === 'length' && 'At least 8 characters'}
                        {key === 'uppercase' && 'One uppercase letter'}
                        {key === 'lowercase' && 'One lowercase letter'}
                        {key === 'number' && 'One number'}
                        {key === 'special' && 'One special character'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                ) : (
                  'Create Account'
                )}
              </Button>
            </form>
            
            <div className="mt-4 pt-4 border-t border-border text-center">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsSelfRegistration(false)}
                className="text-sm"
              >
                ← Back to registration options
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TenantPortalShell>
      <div className={`min-h-screen flex items-center justify-center bg-background px-4 py-4 ${isMobile ? 'items-start pt-8' : ''}`}>
      <Card className="w-full max-w-md border-primary/20 bg-card/95 backdrop-blur-sm shadow-sm max-h-[calc(100vh-2rem)] overflow-y-auto">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <BrandMark size="hero" />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">
            {invitation ? "You're invited to access your property account." : 'Create Tenant Account'}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {invitation ? `Welcome, ${invitation.tenant_name}! Complete your registration.` : 'Sign up to access your rental portal'}
          </CardDescription>
          {invitation && (
            <dl className="mt-3 rounded-lg border border-primary/20 bg-primary/10 divide-y divide-primary/10 text-left">
              {buildInvitationSummary({
                propertyName: invitation.property_name,
                unit: invitation.unit,
                inviterName: invitation.inviter_name,
              }).map((row) => (
                <div key={row.label} className="flex items-center justify-between px-3 py-2">
                  <dt className="text-xs text-muted-foreground">{row.label}</dt>
                  <dd className="text-sm font-medium text-foreground">{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-name">Full Name</Label>
              <Input
                id="signup-name"
                type="text"
                placeholder="John Doe"
                value={signupFullName}
                onChange={(e) => setSignupFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-email">Email</Label>
              <Input
                id="signup-email"
                type="email"
                placeholder="you@example.com"
                value={signupEmail}
                onChange={(e) => handleEmailChange(e.target.value)}
                required
                readOnly={!!invitation}
                aria-readonly={!!invitation}
                className={`${invitation ? 'bg-muted text-muted-foreground' : ''} ${emailError ? 'border-destructive focus:border-destructive focus:ring-destructive' : ''}`}
              />
              {invitation ? (
                <p className="text-xs text-muted-foreground">This email is linked to your invitation.</p>
              ) : emailError ? (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  {emailError}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-phone">Phone (Optional)</Label>
              <Input
                id="signup-phone"
                type="tel"
                placeholder="0712345678 or +254712345678"
                value={signupPhone}
                onChange={(e) => setSignupPhone(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Format: 07XXXXXXXX, +254XXXXXXXXX or 254XXXXXXXXX</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password">Password</Label>
              <Input
                id="signup-password"
                type="password"
                placeholder="••••••••"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                required
                minLength={8}
              />
              {signupPassword && (
                <div className="text-xs space-y-1 mt-2 p-2 bg-muted rounded border border-border">
                  <p className="font-medium text-muted-foreground">Password requirements:</p>
                  <div className="grid grid-cols-2 gap-1">
                    <div className={`flex items-center gap-1 ${passwordStrength.length ? 'text-success' : 'text-muted-foreground'}`}>
                      {passwordStrength.length ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      8+ characters
                    </div>
                    <div className={`flex items-center gap-1 ${passwordStrength.uppercase ? 'text-success' : 'text-muted-foreground'}`}>
                      {passwordStrength.uppercase ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      Uppercase
                    </div>
                    <div className={`flex items-center gap-1 ${passwordStrength.lowercase ? 'text-success' : 'text-muted-foreground'}`}>
                      {passwordStrength.lowercase ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      Lowercase
                    </div>
                    <div className={`flex items-center gap-1 ${passwordStrength.number ? 'text-success' : 'text-muted-foreground'}`}>
                      {passwordStrength.number ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      Number
                    </div>
                    <div className={`flex items-center gap-1 ${passwordStrength.special ? 'text-success' : 'text-muted-foreground'}`}>
                      {passwordStrength.special ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      Special char
                    </div>
                  </div>
                </div>
              )}
            </div>
            <Button 
              type="submit" 
              className="w-full btn-brand" 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="border-t border-border pt-6">
          <div className="text-center w-full">
            <p className="text-muted-foreground text-sm">
              Already have an account?{' '}
              <Link to="/tenant/login" className="text-primary hover:underline font-medium">
                Sign In
              </Link>
            </p>
          </div>
        </CardFooter>
        </Card>
      </div>
    </TenantPortalShell>
  );
};

export default TenantAuth;