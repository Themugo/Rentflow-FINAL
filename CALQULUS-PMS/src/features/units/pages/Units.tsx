import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, CircleDollarSign, Home, Search, Users, ArrowRight, UserRound, FileText } from "lucide-react";
import { Layout } from "@/shared/components/layout/Layout";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ErrorState } from "@/shared/components/ui/error-state";
import { LoadingState } from "@/shared/components/ui/loading-state";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { logError } from "@/shared/lib/errorLogger";
import { cn } from "@/shared/lib/utils";
import { leaseStatusTone, statusBadgeClass } from "@/shared/lib/statusBadge";
import { fetchPortfolioUnits, type PortfolioUnitRow } from "@/features/units/lib/portfolioUnits";
import { paginate } from "@/shared/lib/clientTable";
import { TablePager } from "@/shared/components/ui/table-pager";
import { DataTableFrame } from "@/shared/components/ui/data-table-frame";
import { SearchFilterBar } from "@/shared/components/ui/search-filter-bar";
import { DashboardSectionHeader } from "@/features/dashboard/components/DashboardSectionHeader";
import { MetricCard } from "@/shared/components/ui/metric-card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/shared/components/ui/sheet";
import { Badge } from "@/shared/components/ui/badge";

const unitStatusClass: Record<string, string> = {
  vacant: statusBadgeClass("success"),
  occupied: statusBadgeClass("info"),
  maintenance: statusBadgeClass("warning"),
  reserved: statusBadgeClass("neutral"),
};

const Units = () => {
  const navigate = useNavigate();
  const { formatCurrency } = useCurrency();
  const { managerId, restrictToAssignedProperties, assignedPropertyIds } = useManagerScope();
  const assignedKey = assignedPropertyIds.join(",");

  const [rows, setRows] = useState<PortfolioUnitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedUnit, setSelectedUnit] = useState<PortfolioUnitRow | null>(null);

  const fetchRows = useCallback(async () => {
    if (!managerId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchPortfolioUnits(managerId, {
        restrictToAssignedProperties,
        assignedPropertyIds,
      });
      setRows(data);
    } catch (error) {
      logError("Units.fetchRows", error);
      setLoadError("Couldn't load units from live records.");
    } finally {
      setLoading(false);
    }
  }, [assignedPropertyIds, managerId, restrictToAssignedProperties]);

  useEffect(() => {
    void fetchRows();
  }, [assignedKey, fetchRows]);

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!query) return true;
      return (
        row.unitNumber.toLowerCase().includes(query)
        || row.propertyName.toLowerCase().includes(query)
        || (row.tenantName || "").toLowerCase().includes(query)
      );
    });
  }, [rows, searchQuery, statusFilter]);

  const slice = useMemo(() => paginate(filtered, page, 20), [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter]);

  return (
    <Layout
      title="Units"
      subtitle="Unit, property, tenant, status, rent, lease, and balance from live records."
      headerActions={
        <Button variant="outline" size="sm" className="min-h-11" asChild>
          <Link to="/properties">View properties</Link>
        </Button>
      }
    >
      <div className="mb-6">
        <DashboardSectionHeader
          eyebrow="Portfolio / Units"
          title="Units at a glance"
          description="Find a unit, confirm its occupancy and financial position, then move into the right record."
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {[
            { label: "Units", value: rows.length, icon: Building2 },
            { label: "Occupied", value: rows.filter((row) => row.status === "occupied").length, icon: Users },
            { label: "With balance", value: rows.filter((row) => row.balance > 0).length, icon: CircleDollarSign },
          ].map((item) => {
            const Icon = item.icon;
            return <MetricCard key={item.label} label={item.label} value={item.value} icon={Icon} />;
          })}
        </div>
      </div>
      <SearchFilterBar
        value={searchQuery}
        onValueChange={setSearchQuery}
        placeholder="Search unit, property, or tenant"
        ariaLabel="Search units"
        activeFilterCount={statusFilter !== "all" ? 1 : 0}
        onClearFilters={() => setStatusFilter("all")}
      >
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44 min-h-11" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="vacant">Vacant</SelectItem>
            <SelectItem value="occupied">Occupied</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="reserved">Reserved</SelectItem>
          </SelectContent>
        </Select>
      </SearchFilterBar>

      {loadError && !loading && (
        <div className="mb-4">
          <ErrorState title="Couldn't load units" message={loadError} onRetry={() => { void fetchRows(); }} />
        </div>
      )}

      {loading ? (
        <LoadingState label="Loading units…" variant="skeleton" rows={8} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Home}
          title={searchQuery || statusFilter !== "all" ? "No matching units" : "No units yet"}
          description={
            searchQuery || statusFilter !== "all"
              ? "Try a different search or status filter."
              : "Add a property, then add units on the property record."
          }
          actionLabel="Open properties"
          onAction={() => navigate("/properties")}
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border bg-card card-shadow">
            <DataTableFrame minWidth="min-w-[760px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rent</TableHead>
                  <TableHead>Lease</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slice.items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        to={`/properties/${row.propertyId}?tab=units`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {row.unitNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[14rem] truncate text-muted-foreground">
                      <Link to={`/properties/${row.propertyId}`} className="hover:underline">
                        {row.propertyName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {row.tenantName ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <span className={cn("capitalize", unitStatusClass[row.status] || statusBadgeClass("neutral"))}>
                        {row.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {row.rent != null ? formatCurrency(row.rent) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {row.leaseStatus ? (
                        <span className={cn("capitalize", statusBadgeClass(leaseStatusTone(row.leaseStatus)))}>
                          {row.leaseStatus}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="mr-1 min-h-10" onClick={() => setSelectedUnit(row)}>
                        View
                      </Button>
                      {row.balance > 0 ? (
                        <span className="font-medium text-destructive">{formatCurrency(row.balance)}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </DataTableFrame>
          </div>
          <div className="mt-3">
            <TablePager page={slice} onPageChange={setPage} noun="units" />
          </div>
        </>
      )}

      <Sheet open={!!selectedUnit} onOpenChange={(open) => !open && setSelectedUnit(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedUnit && (
            <>
              <SheetHeader className="text-left">
                <div className="flex items-center gap-2">
                  <Badge className={cn(unitStatusClass[selectedUnit.status] || statusBadgeClass("neutral"))}>{selectedUnit.status}</Badge>
                </div>
                <SheetTitle className="text-xl">Unit {selectedUnit.unitNumber}</SheetTitle>
                <SheetDescription>{selectedUnit.propertyName}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current position</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><p className="text-muted-foreground">Tenant</p><p className="font-medium">{selectedUnit.tenantName || "Vacant"}</p></div>
                    <div><p className="text-muted-foreground">Rent</p><p className="font-medium">{selectedUnit.rent != null ? formatCurrency(selectedUnit.rent) : "—"}</p></div>
                    <div><p className="text-muted-foreground">Lease</p><p className="font-medium capitalize">{selectedUnit.leaseStatus || "No lease"}</p></div>
                    <div><p className="text-muted-foreground">Balance</p><p className={cn("font-medium", selectedUnit.balance > 0 && "text-destructive")}>{selectedUnit.balance > 0 ? formatCurrency(selectedUnit.balance) : "Clear"}</p></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Continue workflow</p>
                  <Button asChild variant="outline" className="w-full justify-between min-h-11">
                    <Link to={`/properties/${selectedUnit.propertyId}?tab=units`}>
                      <span className="flex items-center gap-2"><Home className="h-4 w-4" /> Property & unit record</span><ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  {selectedUnit.tenantName && (
                    <Button asChild variant="outline" className="w-full justify-between min-h-11">
                      <Link to="/tenants"><span className="flex items-center gap-2"><UserRound className="h-4 w-4" /> Tenant management</span><ArrowRight className="h-4 w-4" /></Link>
                    </Button>
                  )}
                  {selectedUnit.leaseStatus && (
                    <Button asChild variant="outline" className="w-full justify-between min-h-11">
                      <Link to="/leases"><span className="flex items-center gap-2"><FileText className="h-4 w-4" /> Lease management</span><ArrowRight className="h-4 w-4" /></Link>
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </Layout>
  );
};

export default Units;
