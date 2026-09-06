import { Skeleton } from "@/shared/components/ui/skeleton";
import { Link } from "react-router-dom";
import { CALQULUS_COLOR } from "@/shared/theme/tokens";
import { useDashboardProperties } from "@/features/dashboard/hooks/useDashboardData";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface PropertyOccupancy {
  id: string;
  name: string;
  displayName: string;
  occupied: number;
  vacant: number;
  total: number;
  rate: number;
}

interface OccupancyTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: { name: string; occupied: number; vacant: number; rate: number } }>;
}

function OccupancyCustomTooltip({ active, payload }: OccupancyTooltipProps) {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
        <p className="font-medium text-foreground mb-2">{item.name}</p>
        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Occupied:</span>
            <span className="font-medium text-success">{item.occupied} units</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Vacant:</span>
            <span className="font-medium text-destructive">{item.vacant} units</span>
          </div>
          <div className="flex items-center justify-between gap-4 pt-1 border-t border-border">
            <span className="text-muted-foreground">Occupancy:</span>
            <span className="font-semibold text-foreground">{item.rate}%</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

export function OccupancyChart() {
  const { data: properties = [], isPending: loading } = useDashboardProperties();
  const data: PropertyOccupancy[] = properties.map((p) => ({
    id: p.id,
    name: p.name,
    displayName: p.name.length > 15 ? p.name.substring(0, 15) + "..." : p.name,
    occupied: p.occupied,
    vacant: Math.max(0, p.units - p.occupied),
    total: p.units,
    rate: p.units > 0 ? Math.round((p.occupied / p.units) * 100) : 0,
  }));

  const getBarColor = (rate: number) => {
    if (rate >= 90) return CALQULUS_COLOR.success;
    if (rate >= 70) return CALQULUS_COLOR.warning;
    return CALQULUS_COLOR.danger;
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 card-shadow animate-fade-in">
        <Skeleton className="h-5 sm:h-6 w-32 sm:w-40 mb-4" />
        <Skeleton className="h-[180px] sm:h-[200px] w-full" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 card-shadow animate-fade-in">
        <h3 className="font-heading text-base sm:text-lg font-semibold text-card-foreground mb-4">
          Property Occupancy
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground text-center py-6 sm:py-8">
          No properties found
        </p>
      </div>
    );
  }

  const totalUnits = data.reduce((sum, p) => sum + p.total, 0);
  const totalOccupied = data.reduce((sum, p) => sum + p.occupied, 0);
  const overallRate = totalUnits > 0 ? Math.round((totalOccupied / totalUnits) * 100) : 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-6 card-shadow animate-fade-in">
      <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <h3 className="font-heading text-base sm:text-lg font-semibold text-card-foreground">
            Property Occupancy
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground">By property</p>
        </div>
        <div className="text-right">
          <p className="text-xl sm:text-2xl font-bold text-foreground">{overallRate}%</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            {totalOccupied} of {totalUnits} units
          </p>
        </div>
      </div>

      <div className="chart-frame h-[180px] sm:h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 5, left: -15, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={CALQULUS_COLOR.border}
              vertical={false}
            />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: CALQULUS_COLOR.textMuted, fontSize: 11 }}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={50}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: CALQULUS_COLOR.textMuted, fontSize: 12 }}
              tickFormatter={(value) => `${value}%`}
              domain={[0, 100]}
            />
            <Tooltip content={<OccupancyCustomTooltip />} cursor={{ fill: CALQULUS_COLOR.secondary, opacity: 0.3 }} />
            <Bar dataKey="rate" radius={[4, 4, 0, 0]} maxBarSize={50}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.rate)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 border-t border-border pt-3 space-y-1.5">
        {data
          .slice()
          .sort((a, b) => a.rate - b.rate)
          .slice(0, 3)
          .map((property) => (
            <div key={property.id} className="flex items-center justify-between gap-3 text-xs">
              <span className="truncate text-muted-foreground">{property.displayName}</span>
              <Link
                to={`/properties/${property.id}`}
                className="shrink-0 font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                {property.occupied}/{property.total} occupied
              </Link>
            </div>
          ))}
      </div>

      <div className="flex justify-center gap-3 sm:gap-6 mt-3 sm:mt-4 text-[10px] sm:text-xs">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-success flex-shrink-0" />
          <span className="text-muted-foreground">90%+</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-warning flex-shrink-0" />
          <span className="text-muted-foreground">70-89%</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-destructive flex-shrink-0" />
          <span className="text-muted-foreground">&lt;70%</span>
        </div>
      </div>
    </div>
  );
}
