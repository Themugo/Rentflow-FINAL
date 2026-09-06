import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/shared/components/ui/dialog';
import { useToast } from '@/shared/hooks/use-toast';
import { sanitizeAuthError } from '@/features/auth/lib/authFlow';
import { Mail, CheckCircle, Lock } from 'lucide-react';

interface ForgotPasswordDialogProps {
  trigger?: React.ReactNode;
  variant?: 'default' | 'landlord' | 'tenant';
}

const ForgotPasswordDialog: React.FC<ForgotPasswordDialogProps> = ({
  trigger,
  variant = 'default',
}) => {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const portal = variant === 'tenant' ? 'tenant' : 'manager';
    const redirectUrl = `${window.location.origin}/reset-password?portal=${portal}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl });
    if (error) {
      toast({ title: 'Reset request failed', description: sanitizeAuthError(error.message), variant: 'destructive' });
    } else {
      setEmailSent(true);
    }
    setIsSubmitting(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => { setEmail(''); setEmailSent(false); }, 300);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <button type="button" className="text-primary hover:text-primary-hover text-sm font-medium">
            Forgot password?
          </button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
              {emailSent
                ? <CheckCircle className="h-6 w-6 text-success" />
                : <Mail className="h-6 w-6 text-primary" />
              }
            </div>
          </div>
          <DialogTitle className="text-center">
            {emailSent ? 'Check your email' : 'Reset your password'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {emailSent
              ? `We sent a reset link to ${email}`
              : "Enter your email and we'll send a link to reset your password."
            }
          </DialogDescription>
        </DialogHeader>

        {emailSent ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-center text-muted-foreground">
              Didn't receive it? Check your spam folder or try again.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1"
                onClick={() => setEmailSent(false)}>
                Try again
              </Button>
              <Button className="flex-1" onClick={handleClose}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleResetRequest} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="reset-email">
                Email address
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="reset-email" type="email" placeholder="you@example.com"
                  value={email} onChange={e => setEmail(e.target.value)} required
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline"
                className="flex-1"
                onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? 'Sending…' : 'Send reset link'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ForgotPasswordDialog;
