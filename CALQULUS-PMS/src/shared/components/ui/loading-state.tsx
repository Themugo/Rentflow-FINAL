import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Skeleton } from "./skeleton";

export interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  size?: "sm" | "md" | "lg";
  variant?: "spinner" | "skeleton" | "inline";
  rows?: number;
}

export function LoadingState({
  label = "Loading…",
  size = "md",
  variant = "spinner",
  rows = 4,
  className,
  ...props
}: LoadingStateProps) {
  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  if (variant === "inline") {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className={cn("flex min-h-16 items-center justify-center gap-2 px-4 py-5 text-sm text-muted-foreground", className)}
        {...props}
      >
        <Loader2 className={cn("animate-spin", iconSizes[size])} aria-hidden="true" />
        {label && <span>{label}</span>}
      </div>
    );
  }

  if (variant === "skeleton") {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className={cn("space-y-2 p-4", className)}
        {...props}
      >
        <span className="sr-only">{label}</span>
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "flex min-h-[180px] flex-col items-center justify-center p-6 text-center text-muted-foreground",
        className
      )}
      {...props}
    >
      <Loader2 className={cn("animate-spin text-primary mb-3", iconSizes[size])} />
      {label && <p className="text-xs font-medium text-muted-foreground">{label}</p>}
    </div>
  );
}
