import React from "react";
import { cn } from "@/shared/lib/utils";

interface DashboardGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4 | 12;
  className?: string;
}

export function DashboardGrid({
  children,
  columns = 12,
  className,
}: DashboardGridProps) {
  const columnClasses = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
    12: "grid-cols-1 lg:grid-cols-12",
  };

  return (
    <div className={cn("grid min-w-0 gap-4 sm:gap-5", columnClasses[columns], className)}>
      {children}
    </div>
  );
}
