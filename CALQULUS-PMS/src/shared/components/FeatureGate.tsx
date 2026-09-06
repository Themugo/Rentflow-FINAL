import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useFeatureAccess, PlanFeature } from '@/shared/hooks/useFeatureAccess';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Lock } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui/skeleton';

interface FeatureGateProps {
  feature: PlanFeature;
  featureLabel: string;
  children: ReactNode;
}

/**
 * Wraps a feature's UI, showing an upgrade prompt in place of `children`
 * when the manager's plan doesn't include it.
 */
export function FeatureGate({ feature, featureLabel, children }: FeatureGateProps) {
  const { enabled, plan, isLoading } = useFeatureAccess(feature);

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (enabled) return <>{children}</>;

  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardContent className="p-6 text-center">
        <div className="h-10 w-10 rounded-md bg-warning/15 flex items-center justify-center mx-auto mb-3">
          <Lock className="h-5 w-5 text-warning" aria-hidden />
        </div>
        <p className="font-medium">{featureLabel} is not on your current plan</p>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Your {plan} plan does not include this. Upgrade to unlock it.
        </p>
        <Button size="sm" variant="outline" asChild>
          <Link to="/platform-billing">View plans</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
