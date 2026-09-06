import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { useToast } from '@/shared/hooks/use-toast';
import { CheckCircle, Eye, EyeOff, Home, Loader2, FileText, ShieldCheck, Wrench, ArrowLeft, ArrowRight } from 'lucide-react';
import { TenantPortalShell, TENANT_ACCENT } from '@/features/auth/components/TenantPortalChrome';
import { BrandMark } from '@/shared/components/branding/BrandMark';

const TenantSelfRegister = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<'profile' | 'rental' | 'done'>('profile');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [propertyName, setPropertyName] = useState('');
  const [unitLabel, setUnitLabel] = useState('');
  const [landlordName, setLandlordName] = useState('');
  const [landlordPhone, setLandlordPhone] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [moveInDate, setMoveInDate] = useState('');
  const [address, setAddress] = useState('');
  const [county, setCounty] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [signupEnabled, setSignupEnabled] = useState(true);
  const [checkingAvailability, setCheckingAvailability] = useState(true);

  useEffect(() => {
    document.title = 'Independent tenant record | CALQULUS PMS';
    void (async () => {
      const { data } = await supabase.rpc('get_tenant_signup_status' as any);
      if (typeof data === 'boolean') setSignupEnabled(data);
      setCheckingAvailability(false);
    })();
  }, []);

  useEffect(() => {
    if (user && !loading) navigate('/portal');
  }, [user, loading, navigate]);

  const passwordStrong = password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);

  const createAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!signupEnabled) {
      toast({ title: 'Independent registration is currently closed', description: 'Please use an invitation from your property manager, landlord or agency.' });
      return;
    }
    if (!passwordStrong) {
      toast({ title: 'Choose a stronger password', description: 'Use at least 8 characters, one uppercase letter, one lowercase letter and one number.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/tenant/login`,
          data: {
            full_name: fullName.trim(),
            phone: phone.trim() || null,
            account_type: 'independent_tenant',
            rental_record: {
              property_name: propertyName.trim() || null,
              unit_label: unitLabel.trim() || null,
              landlord_name: landlordName.trim() || null,
              landlord_phone: landlordPhone.trim() || null,
              monthly_rent: monthlyRent ? Number(monthlyRent) : null,
              move_in_date: moveInDate || null,
              address: address.trim() || null,
              county: county.trim() || null,
            },
          },
        },
      });
      if (error) throw error;
      if (!data.user) throw new Error('Account could not be created');

      if (data.session) {
        const { error: rpcError } = await supabase.rpc('self_register_tenant_atomic' as any, {
          p_name: fullName.trim(),
          p_phone: phone.trim() || null,
          p_rental: {
            property_name: propertyName.trim() || null,
            unit_label: unitLabel.trim() || null,
            landlord_name: landlordName.trim() || null,
            landlord_phone: landlordPhone.trim() || null,
            monthly_rent: monthlyRent ? Number(monthlyRent) : null,
            move_in_date: moveInDate || null,
            address: address.trim() || null,
            county: county.trim() || null,
          },
        });
        if (rpcError && !/already registered as a tenant/i.test(rpcError.message)) throw rpcError;
        setStep('done');
      } else {
        setVerificationRequired(true);
      }
    } catch (error) {
      toast({ title: 'Registration failed', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const content = verificationRequired ? (
    <div className="space-y-5 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary"><ShieldCheck className="h-8 w-8" /></div>
      <div><h2 className="font-heading text-xl font-semibold text-foreground">Check your email to continue</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Your independent tenant account is reserved. Confirm your email, then sign in from the Tenant Portal and CALQULUS will finish your portable record setup.</p></div>
      <Button className="w-full btn-brand" onClick={() => navigate('/tenant/login')}>Go to tenant login <ArrowRight className="ml-2 h-4 w-4" /></Button>
    </div>
  ) : step === 'done' ? (
    <div className="space-y-5 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success"><CheckCircle className="h-8 w-8" /></div>
      <div><h2 className="font-heading text-xl font-semibold text-foreground">Your portable rental record is ready</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Keep contracts, payment evidence, repairs and condition photos in one place. When your housing relationship changes, your CALQULUS history can move with you.</p></div>
      <Button className="w-full btn-brand" onClick={() => navigate('/portal')}>Open my tenant record <Home className="ml-2 h-4 w-4" /></Button>
    </div>
  ) : step === 'profile' ? (
    <form onSubmit={(e) => { e.preventDefault(); if (!fullName.trim() || !email.trim()) return; setStep('rental'); }} className="space-y-4">
      <div><p className="text-[10px] font-bold tracking-[0.2em] text-primary">INDEPENDENT TENANT</p><h2 className="mt-1 font-heading text-xl font-semibold text-foreground">Keep your rental record with you.</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Free to join. Your account is not tied to a landlord or manager until you choose to link it.</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="tenant-full-name">Full name</Label><Input id="tenant-full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Wanjiru" required /></div>
        <div className="space-y-1.5"><Label htmlFor="tenant-email">Email address</Label><Input id="tenant-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></div>
        <div className="space-y-1.5"><Label htmlFor="tenant-phone">Phone</Label><Input id="tenant-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="tenant-password">Password</Label><div className="relative"><Input id="tenant-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} placeholder="Choose a secure password" required /><button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>{password ? <p className={`text-xs ${passwordStrong ? 'text-success' : 'text-muted-foreground'}`}>{passwordStrong ? 'Strong enough to continue.' : 'Use 8+ characters with uppercase, lowercase and a number.'}</p> : null}</div>
      </div>
      <Button type="submit" className="w-full btn-brand min-h-11" disabled={checkingAvailability || !signupEnabled}>Continue <ArrowRight className="ml-2 h-4 w-4" /></Button>
      <p className="text-center text-xs text-muted-foreground">Already have an account? <button type="button" className="font-semibold text-primary" onClick={() => navigate('/tenant/login')}>Sign in</button></p>
    </form>
  ) : (
    <form onSubmit={createAccount} className="space-y-4">
      {!signupEnabled && !checkingAvailability ? <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">Independent self-registration is currently unavailable. Use a tenant invitation to join a managed property.</div> : null}
      <div><p className="text-[10px] font-bold tracking-[0.2em] text-primary">OPTIONAL STARTER RECORD</p><h2 className="mt-1 font-heading text-xl font-semibold text-foreground">Add your current rental details.</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">You can change these later. They help you start a useful rental history immediately.</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="property-name">Property / estate</Label><Input id="property-name" value={propertyName} onChange={(e) => setPropertyName(e.target.value)} placeholder="Greenfield Apartments" /></div>
        <div className="space-y-1.5"><Label htmlFor="unit-label">Unit</Label><Input id="unit-label" value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)} placeholder="A-204" /></div>
        <div className="space-y-1.5"><Label htmlFor="rent">Monthly rent (KES)</Label><Input id="rent" type="number" min="0" value={monthlyRent} onChange={(e) => setMonthlyRent(e.target.value)} placeholder="35000" /></div>
        <div className="space-y-1.5"><Label htmlFor="landlord-name">Landlord name</Label><Input id="landlord-name" value={landlordName} onChange={(e) => setLandlordName(e.target.value)} placeholder="Optional" /></div>
        <div className="space-y-1.5"><Label htmlFor="landlord-phone">Landlord phone</Label><Input id="landlord-phone" value={landlordPhone} onChange={(e) => setLandlordPhone(e.target.value)} placeholder="Optional" /></div>
        <div className="space-y-1.5"><Label htmlFor="move-in">Move-in date</Label><Input id="move-in" type="date" value={moveInDate} onChange={(e) => setMoveInDate(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="county">County</Label><Input id="county" value={county} onChange={(e) => setCounty(e.target.value)} placeholder="Nairobi" /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="address">Address / location</Label><Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Estate / building address" /></div>
      </div>
      <div className="rounded-xl border border-primary/15 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground"><div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>Your independent record is designed to remain portable. If you later join a managed property, your existing rental evidence can be linked rather than discarded.</span></div></div>
      <div className="flex gap-2"><Button type="button" variant="outline" className="min-h-11 flex-1" onClick={() => setStep('profile')}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button><Button type="submit" className="min-h-11 flex-1 btn-brand" disabled={isLoading}>{isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating</> : <>Create free record <ArrowRight className="ml-2 h-4 w-4" /></>}</Button></div>
    </form>
  );

  return <TenantPortalShell>{<div className="w-full max-w-xl rounded-[28px] border border-white/20 bg-white/96 p-2 shadow-[0_28px_90px_rgba(2,15,28,0.42)]"><div className="rounded-[24px] border border-slate-200 bg-white p-6 sm:p-8"><div className="mb-5 flex items-center gap-3"><BrandMark size="sm" showWordmark /><div><p className="text-sm font-semibold text-foreground">CALQULUS Tenant</p><p className="text-xs text-muted-foreground">Portable rental record</p></div></div>{content}</div></div>}</TenantPortalShell>;
};

export default TenantSelfRegister;
