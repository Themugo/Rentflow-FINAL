import * as React from "react";
import { cn } from "@/shared/lib/utils";

interface DataTableFrameProps extends React.HTMLAttributes<HTMLDivElement> {
  minWidth?: string;
  showMobileHint?: boolean;
}

export function DataTableFrame({ className, children, minWidth = "min-w-[760px]", showMobileHint = true, ...props }: DataTableFrameProps) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-card", className)} {...props}>
      {showMobileHint && (
        <p className="border-b border-border px-3 py-2 text-xs text-muted-foreground sm:hidden" role="note">
          Swipe horizontally to view all columns.
        </p>
      )}
      <div className="w-full overflow-x-auto overscroll-x-contain">
        <div className={minWidth}>{children}</div>
      </div>
    </div>
  );
}
