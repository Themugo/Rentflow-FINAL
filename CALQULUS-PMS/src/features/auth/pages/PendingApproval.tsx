import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Clock, LogOut, Mail, RefreshCw, Building2, CreditCard } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BrandMark } from "@/shared/components/branding/BrandMark";
import { trackCommercialEvent } from '@/features/dashboard/lib/commercialMetrics';

interface ManagerProfileData {
  approval_status?: string;
  status?: string;
  rejection_reason?: string;
  suspension_reason?: string;
}

const PendingApproval = () => {
  const { signOut, user, userRole } = useAuth();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isRejected = userRole?.approval_status === 'rejected';
  const isSuspended = userRole?.approval_status === 'suspended';
  const isTerminal = isRejected || isSuspended;

  // Auto-poll every 30 seconds to detect approval
  useEffect(() => {
    if (isTerminal) return;

    const checkApproval = async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('approval_status')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (data?.approval_status === 'approved') {
        navigate('/');
      }
    };

    setCountdown(30);
    cdRef.current = setInterval(() => {
      setCountdown(p => {
        if (p <= 1) { checkApproval(); return 30; }
        return p - 1;
      });
    }, 1000);

    pollRef.current = setInterval(checkApproval, 30_000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (cdRef.current) clearInterval(cdRef.current);
    };
  }, [isTerminal, user?.id, navigate]);

  // Fetch manager profile to check if suspended (vs simply rejected)
  const { data: managerProfile } = useQuery({
    queryKey: ['pending-manager-profile', user?.id],
    queryFn: async (): Promise<ManagerProfileData | null> => {
      const { data } = await supabase.from('manager_profiles')
        .select('status, rejection_reason, suspension_reason')
        .eq('manager_user_id', user!.id).maybeSingle();
      return data as ManagerProfileData | null;
    },
    enabled: !!user?.id && (isRejected || isSuspended),
  });

  const isNonPaymentSuspension = isSuspended || (isRejected && managerProfile?.status === 'suspended_nonpayment');
  const suspensionReason = managerProfile?.suspension_reason;
  const rejectionReason = managerProfile?.rejection_reason;

  useEffect(() => {
    if (isNonPaymentSuspension) {
      trackCommercialEvent("churn", { managerId: user?.id, properties: { reason: "nonpayment" } });
    }
  }, [isNonPaymentSuspension, user]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    window.location.reload();
  };

  // Show the countdown + auto-refresh info only when pending (not rejected/suspended)

  return (
    <div className="min-h-screen flex items-center justify-center hero-gradient px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <BrandMark size="lg" />
          </div>
          <div className="flex items-center justify-center gap-2 text-warning mb-2">
            <Building2 className="h-5 w-5" />
            <span className="text-sm font-medium">Property Manager Portal</span>
          </div>
        </div>

        <Card className="w-full border-border bg-muted backdrop-blur-xl shadow-sm">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className={`h-16 w-16 rounded-full flex items-center justify-center ${isSuspended ? 'bg-orange-500/10' : isRejected ? 'bg-red-500/10' : 'bg-warning/10'}`}>
                <Clock className={`h-8 w-8 ${isSuspended ? 'text-warning' : isRejected ? 'text-destructive' : 'text-warning'}`} />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">
              {isSuspended ? (isNonPaymentSuspension ? 'Account Suspended — Payment Required' : 'Account Suspended') : isRejected ? 'Account Not Approved' : 'Account Pending Approval'}
            </CardTitle>
            <CardDescription className="text-muted-foreground mt-2">
              {isSuspended
                ? 'Your account has been temporarily suspended by the platform administrator'
                : isRejected
                ? 'Your account application was not approved by the platform administrator'
                : 'Your property manager account is awaiting approval'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              {isSuspended ? (
                <div>
                  {isNonPaymentSuspension ? (
                    <>
                      <p className="text-muted-foreground text-sm mb-3">
                        Your account has been suspended due to an outstanding platform invoice.
                        Pay the outstanding balance to restore access immediately.
                      </p>
                      {suspensionReason && (
                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-left mb-3">
                          <p className="text-xs text-red-600 font-medium mb-1">Details:</p>
                          <p className="text-sm text-red-200">{suspensionReason}</p>
                        </div>
                      )}
                      <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-left">
                        <p className="text-xs text-primary font-semibold mb-2 uppercase tracking-wide">How to restore access</p>
                        <ol className="text-sm text-muted-foreground space-y-1">
                          <li>1. Open Platform Billing and pay the outstanding invoice.</li>
                          <li>2. Access returns when payment is confirmed — there is no extra approval step.</li>
                          <li>3. If you already paid, wait a moment and tap Check now.</li>
                        </ol>
                      </div>
                      <Button asChild className="mt-4 w-full">
                        <Link to="/platform-billing">
                          <CreditCard className="h-4 w-4 mr-2" />
                          Pay outstanding invoice
                        </Link>
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-muted-foreground text-sm mb-3">
                        Access to your account has been suspended. Please contact the platform administrator to resolve this.
                      </p>
                      {suspensionReason && (
                        <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 text-left">
                          <p className="text-xs text-orange-400 font-medium mb-1">Reason given:</p>
                          <p className="text-sm text-orange-200">{suspensionReason}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : isRejected ? (
                <div>
                  <p className="text-muted-foreground text-sm mb-3">
                    Unfortunately, your account application was not approved.
                    If you believe this was a mistake, please contact our support team for assistance.
                  </p>
                  {rejectionReason && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-left">
                      <p className="text-xs text-red-600 font-medium mb-1">Reason given:</p>
                      <p className="text-sm text-red-200">{rejectionReason}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm mb-4">
                  Thank you for registering as a property manager!
                  Your account is currently under review by our team.
                  You will receive access once your account has been approved.
                </p>
              )}
              
              {user?.email && (
                <div className="flex items-center justify-center gap-2 text-primary/70 text-sm bg-primary/10 py-3 px-4 rounded-lg border border-primary/20 mb-4">
                  <Mail className="h-4 w-4" />
                  {user.email}
                </div>
              )}

              <p className="text-muted-foreground text-xs">
                {isRejected 
                  ? 'Contact support@calqulus.site for more information.'
                  : 'This usually takes 24-48 hours. If you have any questions, please contact support.'
                }
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {(!isRejected || isNonPaymentSuspension) && (
                <>
                  <div className="text-center text-xs text-muted-foreground">
                    Auto-checking in {countdown}s…
                  </div>
                  <Button
                    onClick={handleRefresh}
                    variant="outline"
                    className="w-full border-border text-muted-foreground hover:bg-muted"
                    disabled={isRefreshing}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Check Now
                  </Button>
                </>
              )}
              
              <Button
                onClick={signOut}
                variant="ghost"
                className="w-full text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PendingApproval;
