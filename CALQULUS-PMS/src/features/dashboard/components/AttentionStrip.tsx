import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { AttentionItem } from "@/features/dashboard/lib/attentionItems";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

const TONE_DOT: Record<AttentionItem["tone"], string> = {
  danger: "bg-destructive",
  warning: "bg-warning",
  info: "bg-primary",
};

const TONE_SURFACE: Record<AttentionItem["tone"], string> = {
  danger: "border-destructive/20 bg-destructive/[0.035]",
  warning: "border-warning/20 bg-warning/[0.035]",
  info: "border-primary/15 bg-primary/[0.025]",
};

interface AttentionStripProps {
  items: AttentionItem[];
  loading?: boolean;
}

/**
 * Compact operational priority queue from live stats only.
 * Zero-count items are never passed in — `buildAttentionItems` already omits them.
 */
export function AttentionStrip({ items, loading = false }: AttentionStripProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading attention items">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[76px] rounded-xl" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-success/20 bg-success/[0.035] px-3.5 py-3 text-sm text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-success shrink-0" aria-hidden />
        <span><strong className="font-medium text-foreground">All clear.</strong> Nothing needs attention right now.</span>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {items.length} active {items.length === 1 ? "priority" : "priorities"}, ranked by urgency.
        </p>
        <span className="text-[11px] font-medium text-muted-foreground">{items.reduce((sum, item) => sum + item.count, 0)} affected</span>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label="Items that need attention">
        {items.map((item) => (
          <li key={item.id}>
            <div className={cn("flex min-h-[76px] items-center gap-3 rounded-xl border px-3.5 py-3", TONE_SURFACE[item.tone])}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background/80 text-sm font-bold text-foreground ring-1 ring-border/70" aria-label={`${item.count} affected`}>
                {item.count}
              </div>
              <span className={cn("h-2 w-2 shrink-0 rounded-full", TONE_DOT[item.tone])} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{item.label}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.detail}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-9 shrink-0 px-2 text-xs font-semibold"
                onClick={() => navigate(item.href)}
                aria-label={`${item.cta}: ${item.label}`}
              >
                {item.cta}
                <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
