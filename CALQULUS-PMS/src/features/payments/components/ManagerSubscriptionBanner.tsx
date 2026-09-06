import React from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Progress } from '@/shared/components/ui/progress';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Building2, Home, AlertTriangle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useManagerCommercialStatus } from '@/features/payments/hooks/useManagerCommercialStatus';
import { displayNameForTier } from '@/shared/lib/commercialCatalog';

const TIER_COLORS: Record<string, string> = {
  lite: 'border-slate-300 bg-slate-50',
  pro: 'border-blue-300 bg-blue-50',
  enterprise: 'border-amber-300 bg-amber-50',
};

const TIER_BADGE: Record<string, string> = {
  lite: 'bg-slate-100 text-slate-700 border-slate-300',
  pro: 'bg-blue-100 text-blue-800 border-blue-300',
  enterprise: 'bg-amber-100 text-amber-800 border-amber-300',
};

interface ManagerSubscriptionBannerProps {
  compact?: boolean;
}

const ManagerSubscriptionBanner: React.FC<ManagerSubscriptionBannerProps> = ({ compact = false }) => {
  const { data, isLoading } = useManagerCommercialStatus();

  if (isLoading) return compact ? null : <Skeleton className="h-20 w-full" />;
  if (!data?.profile) return null;

  const profile = data.profile;
  const tier = data.tierKey;
  const planName = displayNameForTier(profile.subscription_tier ?? tier);
  const maxProps = profile.max_properties ?? 10;
  const maxUnits = profile.max_units ?? 100;
  const usedProps = profile.property_count ?? 0;
  const usedUnits = profile.unit_count ?? 0;
  const propPct = maxProps < 999 ? Math.round((usedProps / maxProps) * 100) : 0;
  const unitPct = maxUnits < 9999 ? Math.round((usedUnits / maxUnits) * 100) : 0;
  const nearLimit = propPct >= 80 || unitPct >= 80;
  const atLimit = usedProps >= maxProps || usedUnits >= maxUnits;

  if (compact) {
    return (
      <div className={`rounded-lg border p-3 ${atLimit ? 'border-red-300 bg-red-50' : nearLimit ? 'border-amber-300 bg-amber-50' : TIER_COLORS[tier]}`}>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-xs ${TIER_BADGE[tier]}`}>{planName}</Badge>
            <span className="text-[10px] text-muted-foreground">{data.health.label}</span>
            {(atLimit || nearLimit || data.health.recovery) && <AlertTriangle className={`h-3.5 w-3.5 ${atLimit || data.health.health === 'suspended' ? 'text-red-600' : 'text-warning'}`} />}
          </div>
          <Link to="/platform-billing">
            <Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
              Billing <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-muted-foreground">Properties</span>
              <span className={`font-medium ${propPct >= 80 ? 'text-red-600' : ''}`}>
                {usedProps}/{maxProps < 999 ? maxProps : '∞'}
              </span>
            </div>
            {maxProps < 999 && <Progress value={propPct} className={`h-1.5 ${propPct >= 80 ? '[&>div]:bg-red-500' : ''}`} />}
          </div>
          <div>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-muted-foreground">Units</span>
              <span className={`font-medium ${unitPct >= 80 ? 'text-red-600' : ''}`}>
                {usedUnits}/{maxUnits < 9999 ? maxUnits : '∞'}
              </span>
            </div>
            {maxUnits < 9999 && <Progress value={unitPct} className={`h-1.5 ${unitPct >= 80 ? '[&>div]:bg-red-500' : ''}`} />}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className={`border-2 ${atLimit ? 'border-red-300 bg-red-50/40' : nearLimit ? 'border-amber-300 bg-amber-50/40' : TIER_COLORS[tier]}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm">{planName} plan</p>
              <Badge variant="outline" className={`text-xs ${TIER_BADGE[tier]}`}>{data.health.label}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.rateLabel} · billed monthly
            </p>
          </div>
          <Link to="/platform-billing">
            <Button size="sm" variant={data.openInvoice ? 'default' : 'outline'} className="gap-1.5">
              {data.openInvoice ? 'Pay invoice' : 'View billing'}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: 'Properties', used: usedProps, max: maxProps, pct: propPct, icon: Building2 },
            { label: 'Units', used: usedUnits, max: maxUnits, pct: unitPct, icon: Home },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <stat.icon className="h-3 w-3" />{stat.label}
                </span>
                <span className={`font-medium ${stat.pct >= 100 ? 'text-red-600' : stat.pct >= 80 ? 'text-warning' : ''}`}>
                  {stat.used} {stat.max < 999 ? `/ ${stat.max}` : ''}
                </span>
              </div>
              {stat.max < 999 && (
                <Progress value={Math.min(100, stat.pct)}
                  className={`h-2 ${stat.pct >= 100 ? '[&>div]:bg-red-500' : stat.pct >= 80 ? '[&>div]:bg-warning' : ''}`}
                />
              )}
            </div>
          ))}
        </div>

        {data.health.recovery && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {data.health.recovery}
          </div>
        )}
        {atLimit && (
          <div className="mt-3 flex items-center gap-2 text-xs text-red-700 font-medium">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            You have reached your {usedProps >= maxProps ? 'property' : 'unit'} capacity. Open billing to discuss a larger block.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ManagerSubscriptionBanner;
