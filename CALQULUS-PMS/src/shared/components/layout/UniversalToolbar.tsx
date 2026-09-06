import React, { useState } from "react";
import {
  Search,
  Filter,
  Download,
  Upload,
  RotateCw,
  Plus,
  X,
  SlidersHorizontal,
  Calendar,
  Grid,
  List,
  CheckSquare,
  Sparkles,
} from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { cn } from "@/shared/lib/utils";

export interface FilterOption {
  key: string;
  label: string;
  options: { label: string; value: string }[];
}

export interface UniversalToolbarProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  filterOptions?: FilterOption[];
  activeFilters?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
  onResetFilters?: () => void;
  selectedCount?: number;
  bulkActions?: { label: string; onClick: () => void; variant?: "default" | "destructive" | "outline" }[];
  primaryAction?: { label: string; onClick: () => void; icon?: React.ElementType };
  secondaryActions?: { label: string; onClick: () => void; icon?: React.ElementType }[];
  onExport?: () => void;
  onImport?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  viewMode?: "table" | "grid" | "compact";
  onViewModeChange?: (mode: "table" | "grid" | "compact") => void;
  customControls?: React.ReactNode;
}

export function UniversalToolbar({
  searchQuery = "",
  onSearchChange,
  searchPlaceholder = "Search records...",
  filterOptions = [],
  activeFilters = {},
  onFilterChange,
  onResetFilters,
  selectedCount = 0,
  bulkActions = [],
  primaryAction,
  secondaryActions = [],
  onExport,
  onImport,
  onRefresh,
  isRefreshing = false,
  viewMode = "table",
  onViewModeChange,
  customControls,
}: UniversalToolbarProps) {
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  const activeFilterCount = Object.values(activeFilters).filter(
    (val) => val && val !== "all"
  ).length;

  return (
    <div className="w-full space-y-2 mb-4">
      {/* Main Toolbar Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2 bg-card/60 backdrop-blur-xs border border-border/80 rounded-xl shadow-2xs">
        {/* Left Side: Search Bar & Active Filters */}
        <div className="flex flex-1 items-center gap-2 min-w-0">
          {onSearchChange && (
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-8 pr-8 h-8 text-xs bg-background border-border/80 focus-visible:ring-1 focus-visible:ring-primary"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {/* Filter Dropdown Trigger */}
          {filterOptions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs border-border/80 shrink-0">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="hidden md:inline">Filters</span>
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-bold bg-primary/15 text-primary border-0">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 p-2 space-y-1">
                <DropdownMenuLabel className="text-xs font-semibold">Filter Records</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {filterOptions.map((filter) => (
                  <div key={filter.key} className="space-y-1 py-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">
                      {filter.label}
                    </p>
                    <div className="space-y-0.5">
                      {filter.options.map((opt) => {
                        const isSelected = activeFilters[filter.key] === opt.value;
                        return (
                          <DropdownMenuItem
                            key={opt.value}
                            className={cn(
                              "text-xs px-2 py-1 cursor-pointer flex items-center justify-between rounded-md",
                              isSelected && "font-semibold bg-primary/10 text-primary"
                            )}
                            onClick={() => onFilterChange?.(filter.key, opt.value)}
                          >
                            <span>{opt.label}</span>
                            {isSelected && <Badge variant="outline" className="h-3.5 px-1 text-[9px] border-primary">Active</Badge>}
                          </DropdownMenuItem>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {activeFilterCount > 0 && onResetFilters && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-xs text-destructive focus:text-destructive cursor-pointer font-medium justify-center"
                      onClick={onResetFilters}
                    >
                      Clear All Filters
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Reset Filters Pill */}
          {activeFilterCount > 0 && onResetFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onResetFilters}
              className="h-8 text-xs text-muted-foreground hover:text-foreground px-2 hidden lg:flex"
            >
              Reset ({activeFilterCount})
            </Button>
          )}
        </div>

        {/* Right Side: Refresh, View Modes, Export, Actions */}
        <div className="flex items-center gap-2 shrink-0 justify-end">
          {customControls}

          {onRefresh && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              className="h-10 w-10 text-muted-foreground hover:text-foreground shrink-0"
              title="Refresh dataset"
              aria-label="Refresh dataset"
            >
              <RotateCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin text-primary")} />
            </Button>
          )}

          {onViewModeChange && (
            <div className="hidden sm:flex items-center rounded-lg border border-border/80 bg-muted/40 p-0.5 shrink-0">
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="icon"
                className="h-7 w-7 text-xs"
                onClick={() => onViewModeChange("table")}
                title="Table View"
              >
                <List className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                className="h-7 w-7 text-xs"
                onClick={() => onViewModeChange("grid")}
                title="Grid Cards View"
              >
                <Grid className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {onImport && (
            <Button
              variant="outline"
              size="sm"
              onClick={onImport}
              className="h-8 gap-1.5 text-xs border-border/80 hidden md:inline-flex"
            >
              <Upload className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Import</span>
            </Button>
          )}

          {onExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              className="h-8 gap-1.5 text-xs border-border/80"
            >
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          )}

          {secondaryActions.map((act, idx) => {
            const Icon = act.icon;
            return (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                onClick={act.onClick}
                className="h-8 gap-1.5 text-xs border-border/80 hidden lg:inline-flex"
              >
                {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
                <span>{act.label}</span>
              </Button>
            );
          })}

          {primaryAction && (
            <Button
              size="sm"
              onClick={primaryAction.onClick}
              className="h-8 gap-1.5 text-xs font-semibold shadow-xs"
            >
              {primaryAction.icon ? (
                <primaryAction.icon className="h-3.5 w-3.5" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              <span>{primaryAction.label}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Floating Bulk Action Bar (When records are checked) */}
      {selectedCount > 0 && (
        <div className="flex items-center justify-between p-2 px-4 bg-primary/10 border border-primary/20 rounded-lg text-xs animate-in fade-in-0 duration-200">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">
              {selectedCount} item{selectedCount > 1 ? "s" : ""} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            {bulkActions.map((action, idx) => (
              <Button
                key={idx}
                variant={action.variant || "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
