import type { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils";

type SearchFilterBarProps = {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  children?: ReactNode;
  activeFilterCount?: number;
  onClearFilters?: () => void;
  summary?: ReactNode;
  className?: string;
};

export function SearchFilterBar({
  value,
  onValueChange,
  placeholder,
  ariaLabel,
  children,
  activeFilterCount = 0,
  onClearFilters,
  summary,
  className,
}: SearchFilterBarProps) {
  const hasFilters = activeFilterCount > 0;

  return (
    <div className={cn("mb-4 space-y-2", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 w-full sm:flex-1 sm:min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder={placeholder}
            aria-label={ariaLabel}
            className="min-h-11 pl-9"
          />
          {value && (
            <button
              type="button"
              aria-label={`Clear ${ariaLabel.toLowerCase()}`}
              onClick={() => onValueChange("")}
              className="absolute right-2 top-1/2 inline-flex min-h-8 min-w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
        {children}
      </div>
      {(hasFilters || summary) && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
          {hasFilters && (
            <Badge variant="secondary" className="gap-1">
              {activeFilterCount} active {activeFilterCount === 1 ? "filter" : "filters"}
            </Badge>
          )}
          {summary && <span>{summary}</span>}
          {hasFilters && onClearFilters && (
            <Button type="button" variant="ghost" size="sm" onClick={onClearFilters} className="h-8 px-2 text-xs">
              Clear filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
