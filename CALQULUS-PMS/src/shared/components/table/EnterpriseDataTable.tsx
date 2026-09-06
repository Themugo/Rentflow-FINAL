import { useState, useMemo, ReactNode, ChangeEvent } from 'react';
import {
  Search,
  SlidersHorizontal,
  Download,
  Columns,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { EmptyState } from '@/shared/components/ui/empty-state';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/shared/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

export interface ColumnDef<T> {
  id: string;
  header: string | ReactNode;
  cell: (item: T, index: number) => ReactNode;
  sortable?: boolean;
  sortFn?: (a: T, b: T) => number;
  searchValue?: (item: T) => string;
  accessorKey?: keyof T;
  hideable?: boolean;
  defaultHidden?: boolean;
  align?: 'left' | 'center' | 'right';
  className?: string;
  headerClassName?: string;
}

export interface BulkAction<T> {
  id: string;
  label: string;
  icon?: ReactNode;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary';
  onClick: (selectedItems: T[]) => void | Promise<void>;
}

export interface EnterpriseDataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  getRowId: (item: T) => string | number;
  title?: string;
  description?: string;
  searchPlaceholder?: string;
  searchableKey?: (item: T) => string;
  bulkActions?: BulkAction<T>[];
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  filterControls?: ReactNode;
  initialSortColumn?: string;
  initialSortDirection?: 'asc' | 'desc';
  isLoading?: boolean;
  emptyState?: ReactNode;
  pageSizeOptions?: number[];
  defaultPageSize?: number;
  onRefresh?: () => void;
  exportFilename?: string;
  enableSelection?: boolean;
  className?: string;
}

export function EnterpriseDataTable<T>({
  data,
  columns,
  getRowId,
  title,
  description,
  searchPlaceholder = 'Search records...',
  searchableKey,
  bulkActions = [],
  primaryAction,
  secondaryActions,
  filterControls,
  initialSortColumn,
  initialSortDirection = 'asc',
  isLoading = false,
  emptyState,
  pageSizeOptions = [10, 25, 50, 100],
  defaultPageSize = 25,
  onRefresh,
  exportFilename = 'export_data',
  enableSelection = true,
  className = '',
}: EnterpriseDataTableProps<T>) {
  // Search State
  const [searchTerm, setSearchTerm] = useState('');

  // Sorting State
  const [sortColumn, setSortColumn] = useState<string | undefined>(initialSortColumn);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(initialSortDirection);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  // Density State ('compact' | 'normal' | 'relaxed')
  const [density, setDensity] = useState<'compact' | 'normal' | 'relaxed'>('normal');

  // Column Visibility State
  const [hiddenColumns, setHiddenColumns] = useState<Record<string, boolean>>(() => {
    const hidden: Record<string, boolean> = {};
    columns.forEach((col) => {
      if (col.defaultHidden) {
        hidden[col.id] = true;
      }
    });
    return hidden;
  });

  // Row Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

  // Filtered & Searched Data
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const query = searchTerm.toLowerCase().trim();

    return data.filter((item) => {
      if (searchableKey) {
        return searchableKey(item).toLowerCase().includes(query);
      }
      return columns.some((col) => {
        if (col.searchValue) {
          return col.searchValue(item).toLowerCase().includes(query);
        }
        if (col.accessorKey) {
          const val = item[col.accessorKey];
          if (val !== null && val !== undefined) {
            return String(val).toLowerCase().includes(query);
          }
        }
        return false;
      });
    });
  }, [data, searchTerm, searchableKey, columns]);

  // Sorted Data
  const sortedData = useMemo(() => {
    if (!sortColumn) return filteredData;
    const colDef = columns.find((c) => c.id === sortColumn);
    if (!colDef) return filteredData;

    return [...filteredData].sort((a, b) => {
      if (colDef.sortFn) {
        const res = colDef.sortFn(a, b);
        return sortDirection === 'asc' ? res : -res;
      }
      if (colDef.accessorKey) {
        const valA = a[colDef.accessorKey];
        const valB = b[colDef.accessorKey];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        const res = valA < valB ? -1 : 1;
        return sortDirection === 'asc' ? res : -res;
      }
      return 0;
    });
  }, [filteredData, sortColumn, sortDirection, columns]);

  // Paginated Data
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, validCurrentPage, pageSize]);

  // Active Visible Columns
  const visibleColumns = useMemo(() => {
    return columns.filter((col) => !hiddenColumns[col.id]);
  }, [columns, hiddenColumns]);

  // Selection Logic
  const allPageIds = useMemo(() => paginatedData.map((item) => getRowId(item)), [paginatedData, getRowId]);
  const isAllPageSelected = allPageIds.length > 0 && allPageIds.every((id) => selectedIds.has(id));
  const isSomePageSelected = allPageIds.some((id) => selectedIds.has(id)) && !isAllPageSelected;

  const toggleSelectAllPage = () => {
    const next = new Set(selectedIds);
    if (isAllPageSelected) {
      allPageIds.forEach((id) => next.delete(id));
    } else {
      allPageIds.forEach((id) => next.add(id));
    }
    setSelectedIds(next);
  };

  const toggleSelectRow = (id: string | number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const selectedItems = useMemo(() => {
    return data.filter((item) => selectedIds.has(getRowId(item)));
  }, [data, selectedIds, getRowId]);

  // Sorting Handler
  const handleSort = (colId: string) => {
    if (sortColumn === colId) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(undefined);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(colId);
      setSortDirection('asc');
    }
  };

  // Export to CSV Functionality
  const handleExportCSV = () => {
    const itemsToExport = selectedItems.length > 0 ? selectedItems : sortedData;
    if (itemsToExport.length === 0) return;

    const headers = visibleColumns.map((col) =>
      typeof col.header === 'string' ? col.header : col.id
    );

    const rows = itemsToExport.map((item) =>
      visibleColumns.map((col) => {
        let val = '';
        if (col.searchValue) {
          val = col.searchValue(item);
        } else if (col.accessorKey) {
          val = String(item[col.accessorKey] ?? '');
        }
        // Escape quotes & commas
        return `"${val.replace(/"/g, '""')}"`;
      })
    );

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${exportFilename}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Row padding based on density
  const pyClass =
    density === 'compact' ? 'py-2 text-xs' : density === 'relaxed' ? 'py-4 text-sm' : 'py-3 text-sm';

  return (
    <div className={`space-y-4 w-full ${className}`}>
      {/* Header & Toolbars */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between bg-card p-4 rounded-xl border border-border shadow-xs">
        {/* Title / Search */}
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {(title || description) && (
            <div className="mr-2">
              {title && <h3 className="font-semibold text-foreground text-base leading-tight">{title}</h3>}
              {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </div>
          )}

          {/* Quick Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 pr-8 h-10 text-xs sm:text-sm bg-muted/50 border-border"
              aria-label={searchPlaceholder}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {filterControls}
        </div>

        {/* Right Toolbar Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              title="Refresh Data"
              className="h-10 w-10 p-0"
              aria-label="Refresh data"
            >
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}

          {/* Export CSV */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-9 gap-1.5 text-xs font-medium"
          >
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
            Export
          </Button>

          {/* Density Toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1 text-xs">
                <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                Density
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Table Density</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setDensity('compact')}>
                {density === 'compact' && <Check className="h-3.5 w-3.5 mr-2" />}
                Compact
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDensity('normal')}>
                {density === 'normal' && <Check className="h-3.5 w-3.5 mr-2" />}
                Normal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDensity('relaxed')}>
                {density === 'relaxed' && <Check className="h-3.5 w-3.5 mr-2" />}
                Relaxed
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Column Toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
                <Columns className="h-3.5 w-3.5 text-muted-foreground" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columns
                .filter((col) => col.hideable !== false)
                .map((col) => {
                  const isVisible = !hiddenColumns[col.id];
                  return (
                    <DropdownMenuCheckboxItem
                      key={col.id}
                      checked={isVisible}
                      onCheckedChange={(checked) => {
                        setHiddenColumns((prev) => ({
                          ...prev,
                          [col.id]: !checked,
                        }));
                      }}
                    >
                      {typeof col.header === 'string' ? col.header : col.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>

          {secondaryActions}
          {primaryAction}
        </div>
      </div>

      {/* Bulk Action Bar Banner */}
      {enableSelection && selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-primary/10 border border-primary/20 px-4 py-2.5 rounded-lg text-sm text-primary animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="font-semibold rounded-full px-2.5">
              {selectedIds.size} selected
            </Badge>
            <span className="text-xs text-muted-foreground">
              Items checked across active dataset
            </span>
          </div>

          <div className="flex items-center gap-2">
            {bulkActions.map((action) => (
              <Button
                key={action.id}
                size="sm"
                variant={action.variant || 'secondary'}
                onClick={() => action.onClick(selectedItems)}
                className="h-8 text-xs gap-1.5"
              >
                {action.icon}
                {action.label}
              </Button>
            ))}

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-left border-collapse exec-table">
            {/* Sticky Header */}
            <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur-xs border-b border-border">
              <tr>
                {enableSelection && (
                  <th className="w-10 px-4 py-3 text-center">
                    <Checkbox
                      checked={isAllPageSelected ? true : isSomePageSelected ? 'indeterminate' : false}
                      onCheckedChange={toggleSelectAllPage}
                      aria-label="Select all"
                    />
                  </th>
                )}
                {visibleColumns.map((col) => {
                  const isSorted = sortColumn === col.id;
                  const alignClass =
                    col.align === 'center'
                      ? 'text-center'
                      : col.align === 'right'
                      ? 'text-right'
                      : 'text-left';

                  return (
                    <th
                      key={col.id}
                      className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none ${alignClass} ${
                        col.sortable !== false ? 'cursor-pointer hover:bg-muted' : ''
                      } ${col.headerClassName || ''}`}
                      onClick={() => col.sortable !== false && handleSort(col.id)}
                    >
                      <div className={`inline-flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                        <span>{col.header}</span>
                        {col.sortable !== false && (
                          <span className="text-muted-foreground">
                            {isSorted ? (
                              sortDirection === 'asc' ? (
                                <ChevronUp className="h-3.5 w-3.5 text-primary" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5 text-primary" />
                              )
                            ) : (
                              <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-border bg-card">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, rIdx) => (
                  <tr key={rIdx} className="animate-pulse">
                    {enableSelection && (
                      <td className="px-4 py-3">
                        <div className="h-4 w-4 bg-muted rounded" />
                      </td>
                    )}
                    {visibleColumns.map((c) => (
                      <td key={c.id} className="px-4 py-3">
                        <div className="h-4 bg-muted rounded w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleColumns.length + (enableSelection ? 1 : 0)}
                    className="py-6 text-center"
                  >
                    {emptyState || (
                      <EmptyState
                        icon={Search}
                        title="No matching records found"
                        description="Try adjusting your filters or search query."
                        className="border-0 bg-transparent min-h-[160px]"
                      />
                    )}
                  </td>
                </tr>
              ) : (
                paginatedData.map((item, idx) => {
                  const rowId = getRowId(item);
                  const isSelected = selectedIds.has(rowId);

                  return (
                    <tr
                      key={rowId}
                      className={`transition-colors hover:bg-muted/50 ${
                        isSelected ? 'bg-primary/5' : ''
                      }`}
                    >
                      {enableSelection && (
                        <td className="w-10 px-4 py-3 text-center">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelectRow(rowId)}
                            aria-label={`Select row ${rowId}`}
                          />
                        </td>
                      )}
                      {visibleColumns.map((col) => {
                        const alignClass =
                          col.align === 'center'
                            ? 'text-center'
                            : col.align === 'right'
                            ? 'text-right'
                            : 'text-left';

                        return (
                          <td
                            key={col.id}
                            className={`px-4 ${pyClass} ${alignClass} text-foreground font-normal ${
                              col.className || ''
                            }`}
                          >
                            {col.cell(item, idx)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer & Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>
              Showing{' '}
              <strong className="font-semibold text-foreground">
                {sortedData.length === 0 ? 0 : (validCurrentPage - 1) * pageSize + 1}
              </strong>{' '}
              to{' '}
              <strong className="font-semibold text-foreground">
                {Math.min(validCurrentPage * pageSize, sortedData.length)}
              </strong>{' '}
              of <strong className="font-semibold text-foreground">{sortedData.length}</strong> entries
              {filteredData.length < data.length && ` (filtered from ${data.length} total)`}
            </span>

            <div className="flex items-center gap-1.5">
              <span>Rows:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(val) => {
                  setPageSize(Number(val));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[70px] text-xs border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageSizeOptions.map((opt) => (
                    <SelectItem key={opt} value={String(opt)}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={validCurrentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-10 w-10 p-0"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="text-xs text-muted-foreground px-2 font-medium">
              Page {validCurrentPage} of {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              disabled={validCurrentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-10 w-10 p-0"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
