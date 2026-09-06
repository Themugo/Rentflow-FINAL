// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
/**
 * TenantMultiUnit
 *
 * Shown when a tenant has more than one active unit/lease.
 * Allows them to see all their units and switch which one is "active"
 * for the current session (affects what invoices, balance, etc. are shown).
 *
 * Also handles the case where a tenant has a normal tenancy (month-to-month)
 * AND a formal lease on a different unit, or a commercial tenancy alongside
 * a residential one.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Building2, Home, Calendar, CreditCard, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

const fmt = (n: number | null | undefined) =>
  n == null
    ? '—'
    : new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n);

const TENANCY_BADGE: Record<string, string> = {
  standard: 'bg-success/20 text-success border-success/30',
  formal_lease: 'bg-primary/20 text-primary border-primary/30',
  short_term: 'bg-warning/20 text-warning border-warning/30',
  commercial: 'bg-[hsl(218_58%_35%/0.12)] text-[hsl(218_58%_30%)] border-[hsl(218_58%_35%/0.25)]',
};

const TENANCY_LABELS: Record<string, string> = {
  standard: 'Standard tenancy',
  formal_lease: 'Formal lease',
  short_term: 'Short-term',
  commercial: 'Commercial',
};

interface TenantUnitLink {
  id: string;
  unit_id: string;
  is_primary: boolean;
  tenancy_type: string;
  monthly_rent: number | null;
  house_deposit: number | null;
  water_deposit: number | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  notes: string | null;
  units: {
    unit_number: string;
    label: string | null;
    floor_number: number | null;
    unit_type: string | null;
    properties: {
      id: string;
      name: string;
      address: string;
    } | null;
  } | null;
}

interface LeaseRow {
  id: string;
  property: string;
  unit: string;
  unit_id: string;
  property_id: string;
  monthly_rent: number | null;
  start_date: string;
  end_date: string;
  status: string;
  deposit: number | null;
}

interface TenantMultiUnitProps {
  tenantId: string;
  onUnitSelect?: (unitId: string, propertyId: string) => void;
}

const TenantMultiUnit: React.FC<TenantMultiUnitProps> = ({ tenantId, onUnitSelect }) => {
  const { user } = useAuth();

  // All active unit links for this tenant
  const { data: links = [], isLoading } = useQuery({
    queryKey: ['tenant-unit-links', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('tenant_unit_links')
        .select(
          `
 id, unit_id, is_primary, tenancy_type, monthly_rent,
 house_deposit, water_deposit, start_date, end_date, status, notes,
 units(unit_number, label, floor_number, unit_type,
 properties(name, address))
 `,
        )
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .order('is_primary', { ascending: false });
      return (data || []) as TenantUnitLink[];
    },
    enabled: !!tenantId,
  });

  // Also fetch leases linked to this tenant
  const { data: leases = [] } = useQuery({
    queryKey: ['tenant-leases', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('leases')
        .select('id, property, unit, unit_id, property_id, monthly_rent, start_date, end_date, status, deposit')
        .eq('tenant_id', user!.id)
        .in('status', ['active', 'signed'])
        .order('start_date', { ascending: false });
      return (data || []) as LeaseRow[];
    },
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (links.length <= 1 && leases.length <= 1) return null; // Only show if multi-unit

  return (
    <Card className="border-primary/30 bg-primary/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          Your units & tenancies
        </CardTitle>
        <CardDescription>
          You have {links.length + (leases.length > links.length ? leases.length - links.length : 0)} active{' '}
          {links.length + leases.length === 1 ? 'tenancy' : 'tenancies'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Unit links (standard/commercial tenancies) */}
        {links.map((link: TenantUnitLink) => {
          const unit = link.units;
          const prop = unit?.properties;
          return (
            <div
              key={link.id}
              className={`rounded-xl border p-3 ${link.is_primary ? 'border-primary/40 bg-white' : 'border-border bg-white/60'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${link.is_primary ? 'bg-primary/20' : 'bg-muted/20'}`}
                  >
                    <Home className={`h-4 w-4 ${link.is_primary ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{unit?.label || unit?.unit_number || 'Unit'}</p>
                      <Badge variant="outline" className={`text-xs ${TENANCY_BADGE[link.tenancy_type] ?? ''}`}>
                        {TENANCY_LABELS[link.tenancy_type] ?? link.tenancy_type}
                      </Badge>
                      {link.is_primary && (
                        <Badge className="text-xs bg-primary/20 text-primary border-primary/30">Primary</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {prop?.name}
                      {unit?.floor_number ? ` · Floor ${unit.floor_number}` : ''}
                    </p>
                    {link.start_date && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Calendar className="h-3 w-3" />
                        Since {format(new Date(link.start_date), 'dd/MM/yy')}
                        {link.end_date && ` · Until ${format(new Date(link.end_date), 'dd/MM/yy')}`}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {link.monthly_rent && <p className="text-sm font-semibold">{fmt(link.monthly_rent)}/mo</p>}
                  {onUnitSelect && unit?.properties && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs text-primary gap-1 mt-1"
                      onClick={() => onUnitSelect(link.unit_id, unit.properties?.id)}
                    >
                      View <ArrowRight className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Formal leases (from leases table) */}
        {leases.map((lease: LeaseRow) => (
          <div key={lease.id} className="rounded-xl border border-primary/30 bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                  <CreditCard className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">Unit {lease.unit}</p>
                    <Badge variant="outline" className="text-xs bg-primary/20 text-primary border-primary/30">
                      Formal lease
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-xs capitalize ${lease.status === 'active' ? 'bg-success/20 text-success' : ''}`}
                    >
                      {lease.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{lease.property}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(lease.start_date), 'dd/MM/yy')} → {format(new Date(lease.end_date), 'dd/MM/yy')}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold">{fmt(lease.monthly_rent)}/mo</p>
                {lease.deposit && <p className="text-xs text-muted-foreground">Deposit: {fmt(lease.deposit)}</p>}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default TenantMultiUnit;
