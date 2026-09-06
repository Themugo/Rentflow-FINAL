import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { useToast } from '@/shared/hooks/use-toast';
import { Globe, Shield, Eye, EyeOff, ChevronRight, Lock, Crown, BarChart3 } from 'lucide-react';
import { ensureSignedInRole, sanitizeAuthError } from '@/features/auth/lib/authFlow';
import { BrandMark } from '@/shared/components/branding/BrandMark';
import { AuthLoadingScreen } from '@/features/auth/components/AuthHeroChrome';
import { PortalAccentBar, portalSurfaceProps } from '@/core/design';
import { usePortalIdentity } from "@/core/product/PortalIdentityProvider";

const isRecommendedWebhostHost = () => {
  const host = window.location.hostname;
  return host.startsWith('admin.') || host.endsWith('.calqulus.site') || host === 'localhost' || host === '127.0.0.1';
};

const features = [
  { icon: Globe,    text: 'Full platform oversight — managers, properties, and billing. No tenant records.' },
  { icon: Crown,    text: 'Tier management, billing enforcement & subscription control' },
  { icon: BarChart3, text: 'Platform-wide revenue analytics and audit trails' },
  { icon: Shield,   text: 'Security logs, access control & compliance reporting' },
];

const WebhostAuth = () => {
  const { identity } = usePortalIdentity();
  const navigate = useNavigate();
  const { user, signIn, loading, userRole } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      if (userRole?.role === 'webhost') navigate('/webhost');
      else if (userRole?.role === 'manager') navigate('/');
      else if (userRole?.role === 'tenant') navigate('/portal');
    }
  }, [user, loading, userRole, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const { error } = await signIn(email, password);
    if (error) {
      toast({ title: 'Login failed', description: sanitizeAuthError(error.message), variant: 'destructive' });
      setIsSubmitting(false);
      return;
    }
    const roleCheck = await ensureSignedInRole(['webhost']);
    if (!roleCheck.ok) {
      const roles = roleCheck.roles;
      if (roles.includes('tenant')) { navigate('/portal'); return; }
      if (roles.includes('manager')) { navigate('/'); return; }
      if (roles.includes('landlord')) { navigate('/landlord/dashboard'); return; }
      toast({ title: 'Access denied', description: roleCheck.message, variant: 'destructive' });
      setIsSubmitting(false);
      return;
    }
    navigate('/webhost');
  };

  if (loading) {
    return <AuthLoadingScreen />;
  }

  return (
    <div className="relative min-h-screen flex bg-background text-foreground hero-gradient" {...portalSurfaceProps("platform_admin")}>
      <PortalAccentBar className="absolute top-0 left-0 right-0 z-20" />
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[55%] flex-col relative overflow-hidden">
        <div className="relative z-10 flex flex-col h-full p-12">
          <div className="flex items-center gap-4 mb-16">
            <BrandMark size="hero" forcePlatform />
            <div>
              <p className="font-heading font-bold text-xl text-foreground leading-none">CALQULUS</p>
              <p className="text-[11px] text-primary font-semibold tracking-[0.25em] uppercase mt-1">{identity.name}</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-destructive/30 bg-destructive/15 mb-6 self-start">
              <Shield className="h-3.5 w-3.5 text-destructive" />
              <span className="text-xs text-destructive font-semibold">Restricted Access — Authorized Personnel Only</span>
            </div>

            <h1 className="page-title mb-6">
              <span className="text-foreground">{identity.tagline}</span>
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed max-w-md mb-12">
              Super-admin access for platform-wide management, billing enforcement, security, and compliance.
            </p>

            <div className="space-y-4">
              {features.map((f, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <f.icon className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-muted-foreground text-sm font-medium">{f.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-8 border-t border-border">
            <p className="text-muted-foreground text-xs">calqulus.site · Internal use only</p>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="w-full lg:w-[45%] flex items-center justify-center px-4 sm:px-8 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex justify-center mb-8">
            <BrandMark size="hero" forcePlatform />
          </div>

          <div className="rounded-lg border border-border bg-card p-6 sm:p-8 shadow-sm">
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-primary/20 bg-primary/10 mb-4">
                <Globe className="h-3 w-3 text-primary" />
                <span className="text-[11px] text-primary font-semibold tracking-wider uppercase">{identity.shortName} Portal</span>
              </div>
              <h2 className="font-heading text-2xl font-bold text-foreground mb-1">Administrator login</h2>
              <p className="text-muted-foreground text-sm">Authorized access only</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-muted-foreground text-sm font-medium">Email address</Label>
                <Input
                  id="email" type="email" placeholder="admin@calqulus.site"
                  value={email} onChange={e => setEmail(e.target.value)} required
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-muted-foreground text-sm font-medium">Password</Label>
                <div className="relative">
                  <Input
                    id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                    value={password} onChange={e => setPassword(e.target.value)} required
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 h-11 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex min-h-11 min-w-11 h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full h-11 btn-brand text-sm font-bold mt-2">
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-navy-deep/30 border-t-navy-deep animate-spin" />
                    Signing in…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Lock className="h-4 w-4" /> Sign in to Admin Portal <ChevronRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </form>

            {/* Security notice */}
            <div className="mt-5 p-3.5 rounded-xl border border-primary/20 bg-primary/10">
              <div className="flex items-start gap-2.5">
                <Shield className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-xs text-foreground leading-relaxed">
                  This portal is for authorized administrators only. All access is logged and audited.
                </p>
              </div>
            </div>

            {/* Bootstrap notice */}
            <div className="mt-3 p-3 rounded-xl border border-border bg-muted">
              <p className="text-xs text-muted-foreground text-center leading-relaxed">
                First time? Run the{' '}
                <code className="text-foreground bg-card px-1 rounded font-semibold">bootstrap-webhost</code>
                {' '}edge function to create the admin account.
              </p>
            </div>

            {!isRecommendedWebhostHost() && (
              <div className="mt-3 p-3 rounded-xl border border-primary/20 bg-primary/10">
                <p className="text-xs text-foreground text-center">
                  Tip: use an <code className="bg-card px-1 rounded font-semibold">admin.</code> subdomain for production access.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebhostAuth;
