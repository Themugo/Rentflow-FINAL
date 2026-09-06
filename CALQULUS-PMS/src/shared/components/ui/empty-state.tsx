import * as React from "react";
import { FolderOpen } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { CALQULUS_ICON, CALQULUS_TYPE } from "@/shared/theme/tokens";
import { Button } from "./button";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ElementType;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon = FolderOpen,
  title,
  description,
  actionLabel,
  onAction,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center bg-card",
        className
      )}
      {...props}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground mb-4">
        <Icon className={CALQULUS_ICON.lg} />
      </div>
      <h3 className={cn(CALQULUS_TYPE.cardTitle, "text-foreground mb-1")}>{title}</h3>
      {description && (
        <p className="type-body text-muted-foreground max-w-sm mb-4">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button size="sm" className="min-h-11" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
