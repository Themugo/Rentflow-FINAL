import { Button } from "@/shared/components/ui/button";
import { TableHead } from "@/shared/components/ui/table";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { PageSlice, SortDir } from "@/shared/lib/clientTable";

interface TablePagerProps<T> {
  page: PageSlice<T>;
  onPageChange: (page: number) => void;
  noun?: string;
}

export function TablePager<T>({ page, onPageChange, noun = "rows" }: TablePagerProps<T>) {
  if (page.total <= page.pageSize) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 border-t border-border bg-card">
      <p className="text-xs text-muted-foreground">
        Showing {page.start}–{page.end} of {page.total} {noun}
      </p>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          disabled={page.page <= 1}
          onClick={() => onPageChange(page.page - 1)}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Prev
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          disabled={page.page >= page.totalPages}
          onClick={() => onPageChange(page.page + 1)}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

interface SortableHeadProps {
  label: string;
  sortKey: string;
  currentKey: string;
  dir: SortDir;
  onSort: (key: string) => void;
  className?: string;
}

export function SortableHead({ label, sortKey, currentKey, dir, onSort, className }: SortableHeadProps) {
  const active = currentKey === sortKey;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 uppercase tracking-wider",
          active ? "text-foreground" : "hover:text-foreground",
        )}
      >
        {label}
        {active ? (
          dir === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
        ) : null}
      </button>
    </TableHead>
  );
}
