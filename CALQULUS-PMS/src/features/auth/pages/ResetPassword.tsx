import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { useToast } from '@/shared/hooks/use-toast';
import { KeyRound, CheckCircle, XCircle } from 'lucide-react';
import { portalLoginPath, sanitizeAuthError } from '@/features/auth/lib/authFlow';

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const portal = new URLSearchParams(window.location.search).get('portal');
  const loginPath = portalLoginPath(portal);

  useEffect(() => {
    const paramsFromHash = () => new URLSearchParams(window.location.hash.replace(/^#/, ''));

    const checkSession = async () => {
      const hashParams = paramsFromHash();
      const queryParams = new URLSearchParams(window.location.search);
      const errorDescription = hashParams.get('error_description') || queryParams.get('error_description');
      if (errorDescription) {
        toast({
          title: 'Invalid or expired link',
          description: errorDescription,
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      if (accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        const cleaned = `${window.location.pathname}${window.location.search}`;
        window.history.replaceState(null, '', cleaned);
      }

      const sessionResult = await supabase.auth.getSession();
      if (sessionResult.data.session) {
        setIsValidSession(true);
      } else {
        toast({
          title: 'Invalid or expired link',
          description: 'Please request a new password reset link.',
          variant: 'destructive',
        });
      }
      setIsLoading(false);
    };

    const timer = window.setTimeout(checkSession, 150);
    return () => window.clearTimeout(timer);
  }, [toast]);

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

  const passwordStrength = getPasswordStrength(password);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please make sure both passwords are the same.',
        variant: 'destructive',
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 8 characters long.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast({
        title: 'Password reset failed',
        description: sanitizeAuthError(error.message),
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Password updated!',
        description: 'Your password has been successfully reset.',
      });
      // Sign out and redirect to login
      await supabase.auth.signOut();
      navigate(loginPath);
    }

    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isValidSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md card-shadow">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-destructive" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">Link Expired</CardTitle>
            <CardDescription>
              This password reset link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate(loginPath)} className="w-full">
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md card-shadow">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
              <KeyRound className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
          <CardDescription>
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
              {password && (
                <div className="text-xs space-y-1 mt-2 p-2 bg-muted rounded">
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
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  Passwords do not match
                </p>
              )}
              {confirmPassword && password === confirmPassword && (
                <p className="text-xs text-success flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Passwords match
                </p>
              )}
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting || password !== confirmPassword}
            >
              {isSubmitting ? 'Resetting...' : 'Reset Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
