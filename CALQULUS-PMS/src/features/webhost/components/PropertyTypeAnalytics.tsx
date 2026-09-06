// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Building2, TrendingUp } from 'lucide-react';
import { CATEGORY_BY_KEY, GROUP_LABELS, GROUP_COLORS, getCategoryGroup } from '@/shared/constants/propertyTypes';
import { CALQULUS_COLOR } from '@/shared/theme/tokens';

const GROUP_CHART_COLORS: Record<string, string> = {
  residential: CALQULUS_COLOR.primary,
  commercial:  CALQULUS_COLOR.warning,
  industrial:  CALQULUS_COLOR.textMuted,
  mixed:       CALQULUS_COLOR.info,
  land:        CALQULUS_COLOR.success,
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(n);

const PropertyTypeAnalytics: React.FC = () => {

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ['webhost-property-type-breakdown'],
    queryFn: async () => {
      const { data } = await supabase
        .from('properties')
        .select('id, name, category_key, property_type, units, occupied, revenue, manager_id')
        .eq('status', 'active');
      return (data || []) as any[];
    },
  });

  // Compute breakdowns
  const byGroup: Record<string, { count: number; units: number; occupied: number; revenue: number }> = {};
  const byCategory: Record<string, { count: number; units: number; revenue: number }> = {};

  for (const p of properties) {
    const catKey  = p.category_key || (p.property_type === 'commercial' ? 'commercial_office' : 'residential_flat');
    const group   = getCategoryGroup(catKey);
    const cat     = CATEGORY_BY_KEY[catKey];

    // Group totals
    if (!byGroup[group]) byGroup[group] = { count: 0, units: 0, occupied: 0, revenue: 0 };
    byGroup[group].count++;
    byGroup[group].units    += p.units ?? 0;
    byGroup[group].occupied += p.occupied ?? 0;
    byGroup[group].revenue  += Number(p.revenue ?? 0);

    // Category totals
    const catName = cat?.name ?? catKey;
    if (!byCategory[catName]) byCategory[catName] = { count: 0, units: 0, revenue: 0 };
    byCategory[catName].count++;
    byCategory[catName].units  += p.units ?? 0;
    byCategory[catName].revenue += Number(p.revenue ?? 0);
  }

  const pieData = Object.entries(byGroup).map(([group, stats]) => ({
    name:  GROUP_LABELS[group] ?? group,
    value: stats.count,
    group,
    units: stats.units,
    occupied: stats.occupied,
  }));

  const barData = Object.entries(byCategory)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 12)
    .map(([name, stats]) => ({ name: name.length > 20 ? name.slice(0, 18) + '…' : name, count: stats.count, units: stats.units }));

  const totalProperties = properties.length;
  const totalUnits = properties.reduce((s, p) => s + (p.units ?? 0), 0);
  const totalOccupied = properties.reduce((s, p) => s + (p.occupied ?? 0), 0);
  const occupancyRate = totalUnits > 0 ? Math.round((totalOccupied / totalUnits) * 100) : 0;

  if (isLoading) return <Skeleton className="h-64 w-full bg-secondary-background" />;

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total properties',    value: String(totalProperties),    color: 'text-warning' },
          { label: 'Total units',         value: String(totalUnits),         color: 'text-[hsl(214_73%_58%)]' },
          { label: 'Occupied units',      value: String(totalOccupied),      color: 'text-green-400' },
          { label: 'Platform occupancy',  value: `${occupancyRate}%`,         color: occupancyRate >= 75 ? 'text-green-400' : 'text-warning' },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-warning/12 bg-secondary-background p-3">
            <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
            <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pie: by group */}
        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4 text-warning"/>
              Properties by category group
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-center text-muted-foreground/70 text-sm py-8">No properties yet</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}
                      label={({ name, percent }) => percent > 0.05 ? `${name.split(' ')[0]} ${(percent*100).toFixed(0)}%` : ''}
                      labelLine={false}>
                      {pieData.map((d, i) => (
                        <Cell key={i} fill={GROUP_CHART_COLORS[d.group] ?? '#6b7280'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number, name: string) => [v + ' properties', name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {pieData.map(d => (
                    <div key={d.group} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: GROUP_CHART_COLORS[d.group] }}/>
                        <span className="text-foreground/90">{d.name}</span>
                      </div>
                      <div className="flex gap-3 text-muted-foreground">
                        <span>{d.value} props</span>
                        <span>{d.units} units</span>
                        <span className="text-green-400">
                          {d.units > 0 ? Math.round((d.occupied / d.units) * 100) : 0}% occ.
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Bar: top categories */}
        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-warning"/>
              Top property types
            </CardTitle>
          </CardHeader>
          <CardContent>
            {barData.length === 0 ? (
              <p className="text-center text-muted-foreground/70 text-sm py-8">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-20" horizontal={false}/>
                  <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false}/>
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={120}/>
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    itemStyle={{ color: "hsl(var(--muted-foreground))" }}
                  />
                  <Bar dataKey="count" name="Properties" fill={CALQULUS_COLOR.primary} radius={[0,3,3,0]}/>
                  <Bar dataKey="units"  name="Units"      fill={CALQULUS_COLOR.info} radius={[0,3,3,0]}/>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Table: group breakdown */}
      <Card className="bg-card border-warning/15">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-foreground">Category group breakdown</CardTitle>
          <CardDescription className="text-muted-foreground">Platform-wide property distribution and occupancy</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(byGroup).sort((a, b) => b[1].count - a[1].count).map(([group, stats]) => {
              const occ = stats.units > 0 ? Math.round((stats.occupied / stats.units) * 100) : 0;
              return (
                <div key={group} className="flex items-center gap-3 p-2.5 rounded-lg bg-card border border-[hsl(218_58%_24%/0.2)]">
                  <Badge variant="outline" className={`text-xs shrink-0 ${GROUP_COLORS[group]}`}>
                    {GROUP_LABELS[group]}
                  </Badge>
                  <div className="flex-1 h-2 bg-secondary-background rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{
                      width: `${totalProperties > 0 ? (stats.count / totalProperties) * 100 : 0}%`,
                      backgroundColor: GROUP_CHART_COLORS[group],
                    }}/>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground shrink-0">
                    <span className="text-foreground font-medium">{stats.count}</span>
                    <span>{stats.units} units</span>
                    <span className={occ >= 75 ? 'text-green-400' : 'text-warning'}>{occ}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PropertyTypeAnalytics;
