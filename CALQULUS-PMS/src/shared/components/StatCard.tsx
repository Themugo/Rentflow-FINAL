import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/shared/components/ui/card";

interface StatCardProps {
  icon: LucideIcon;
  /** Tailwind classes for the icon's circular background, e.g. "bg-success/10" */
  iconBgClass: string;
  /** Tailwind classes for the icon color, e.g. "text-success" */
  iconColorClass: string;
  label: string;
  value: React.ReactNode;
}

/**
 * Small metric card (icon + label + value) used throughout billing,
 * payments, and dashboard screens. Extracted from several near-identical
 * copies that had accumulated across ManagerPlatformBilling.tsx and others.
 */
export function StatCard({ icon: Icon, iconBgClass, iconColorClass, label, value }: StatCardProps) {
  return (
    <Card className="bg-card border-border/80 hover:border-border transition-all">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-3.5">
          <div className={`h-10 w-10 rounded-lg ${iconBgClass} border border-border/40 flex items-center justify-center shrink-0`}>
            <Icon className={`h-5 w-5 ${iconColorClass}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
            <p className="text-xl font-bold text-foreground tracking-tight mt-0.5">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
