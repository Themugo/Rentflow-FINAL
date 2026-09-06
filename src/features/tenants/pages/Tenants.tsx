// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import { format } from "date-fns";
import { logError, toUserFacingError } from "@/shared/lib/errorLogger";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { useRBAC } from "@/shared/hooks/useRBAC";
import { Layout } from "@/shared/components/layout/Layout";
import { DashboardSectionHeader } from "@/features/dashboard/components/DashboardSectionHeader";
import { SearchFilterBar } from "@/shared/components/ui/search-filter-bar";
import { StatCard } from "@/features/dashboard/components/StatCard";
import { DollarSign, Home, AlertTriangle } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import {
  Search, History, FileText, Users, Eye,
  Clock, Archive, UserPlus, Building2, UserCheck, UserX,
} from "lucide-react";
import { TenantStatement } from "@/features/tenants/components/TenantStatement";
import { InvitationTracker } from "@/features/tenants/components/InvitationTracker";
import { InviteTenantDialog } from "@/features/tenants/components/InviteTenantDialog";
import MoveOutDialog from "@/features/tenants/components/MoveOutDialog";
import TenantProfilePanel from "@/features/tenants/components/TenantProfilePanel";
import DepositAccountabilityStatement from "@/features/tenants/components/DepositAccountabilityStatement";
import TenantNoticeComposer from "@/features/tenants/components/TenantNoticeComposer";
import { TenantLeaseTab } from "@/features/tenants/components/TenantLeaseTab";
import { TenantPaymentsTab } from "@/features/tenants/components/TenantPaymentsTab";
import { TenantMaintenanceTab } from "@/features/tenants/components/TenantMaintenanceTab";
import { TenantDocumentsTab } from "@/features/tenants/components/TenantDocumentsTab";
import PaymentPayersManager from "@/features/payments/components/PaymentPayersManager";
import { useToast } from "@/shared/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ErrorState } from "@/shared/components/ui/error-state";
import { LoadingState } from "@/shared/components/ui/loading-state";
import { statusBadgeClass, tenantStatusTone } from "@/shared/lib/statusBadge";
import { cn } from "@/shared/lib/utils";
import { paginate, sortBy, toggleSort, type SortDir } from "@/shared/lib/clientTable";
import { SortableHead, TablePager } from "@/shared/components/ui/table-pager";
import { DataTableFrame } from "@/shared/components/ui/data-table-frame";
import { TenantLifecycleCommandBar } from "@/features/tenants/components/TenantLifecycleCommandBar";

interface Property {
  id: string;
  name: string;
  address: string;
}

interface TenantData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  property: string | null;
  property_id: string | null;
  unit_id: string | null;
  unit: string | null;
  status: string;
  photo_url: string | null;
  move_in_date: string | null;
  monthly_rent: number | null;
  deposit_amount: number | null;
  deposit_months: number | null;
  deposit_balance: number | null;
  other_charges: number | null;
  other_charges_description: string | null;
  statement_history_months: number | null;
  created_at: string;
  updated_at: string;
}

interface TenantHistoryItem {
  id: string;
  tenant_id: string;
  action: string;
  description: string;
  created_at: string;
}

interface LeaseRecord {
  id: string;
  tenant_id: string | null;
  property: string;
  unit: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  deposit: number | null;
  status: string;
}

const statusStyles: Record<string, string> = {
  active: statusBadgeClass("success"),
  pending: statusBadgeClass("warning"),
  inactive: statusBadgeClass("neutral"),
};

const leaseStatusStyles: Record<string, string> = {
  active: statusBadgeClass("success"),
  pending: statusBadgeClass("warning"),
  expiring: statusBadgeClass("warning"),
  expired: statusBadgeClass("danger"),
  terminated: statusBadgeClass("neutral"),
};


interface TenantTableProps {
  tenantList: TenantData[];
  isLoading: boolean;
  searchQuery: string;
  signedUrls: Record<string, string>;
  canApproveMoveouts: boolean;
  leaseByTenantId: Map<string, LeaseRecord>;
  balanceByTenantId: Record<string, number>;
  expiringSoonLeaseIds: Set<string>;
  onOpenStatement: (tenant: TenantData) => void;
  onOpenHistory: (tenant: TenantData) => void;
  onOpenDetail: (tenant: TenantData) => void;
  onMoveOut: (tenant: TenantData) => void;
}

const TENANT_PAGE_SIZE = 25;

function TenantTable({ tenantList, isLoading, searchQuery, signedUrls, canApproveMoveouts, leaseByTenantId, balanceByTenantId, expiringSoonLeaseIds, onOpenStatement, onOpenHistory, onOpenDetail, onMoveOut }: TenantTableProps) {
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const listKey = `${tenantList.length}:${tenantList[0]?.id ?? ""}:${searchQuery}`;

  useEffect(() => {
    setPage(1);
  }, [listKey]);

  const sorted = useMemo(() => {
    const getter = (tenant: TenantData) => {
      switch (sortKey) {
        case "status": return tenant.status;
        case "property": return `${tenant.property ?? ""} ${tenant.unit ?? ""}`;
        case "rent": return tenant.monthly_rent ?? 0;
        case "move_in": return tenant.move_in_date ?? "";
        default: return tenant.name;
      }
    };
    return sortBy(tenantList, getter, sortDir);
  }, [tenantList, sortKey, sortDir]);

  const slice = useMemo(() => paginate(sorted, page, TENANT_PAGE_SIZE), [sorted, page]);

  const handleSort = (key: string) => {
    const next = toggleSort(sortKey, key, sortDir);
    setSortKey(next.key);
    setSortDir(next.dir);
    setPage(1);
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden card-shadow">
      {isLoading ? (
        <LoadingState label="Loading tenants…" variant="skeleton" rows={6} />
      ) : tenantList.length === 0 ? (
        <EmptyState
          icon={Users}
          title={searchQuery ? "No tenants match your search" : "No tenants in this category"}
          description={searchQuery ? "Try a different name, unit, or property." : "Invite a tenant to a property to start the lease and billing path."}
        />
      ) : (
        <>
        <DataTableFrame minWidth="min-w-[780px]">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border">
              <SortableHead label="Tenant" sortKey="name" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
              <SortableHead label="Property / Unit" sortKey="property" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
              <TableHead>Lease</TableHead>
              <SortableHead label="Rent" sortKey="rent" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
              <TableHead>Balance</TableHead>
              <SortableHead label="Status" sortKey="status" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slice.items.map((tenant) => (
              <TableRow
                key={tenant.id}
                className="hover:bg-muted/30 border-border cursor-pointer"
                onClick={() => onOpenDetail(tenant)}
              >
                <TableCell>
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={signedUrls[tenant.id] || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {tenant.name.split(" ").map((n) => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-foreground truncate">{tenant.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {tenant.property ? (
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{tenant.property}</p>
                      <p className="text-xs text-muted-foreground truncate">{tenant.unit || "No unit"}</p>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">Unassigned</span>
                  )}
                </TableCell>
                <TableCell>
                  {(() => {
                    const lease = leaseByTenantId.get(tenant.id);
                    if (!lease) return <span className="text-sm text-muted-foreground">—</span>;
                    const expiringSoon = expiringSoonLeaseIds.has(lease.id);
                    return (
                      <div className="flex flex-col gap-0.5">
                        {expiringSoon ? (
                          <span className={statusBadgeClass("warning") + " w-fit"}>Expiring soon</span>
                        ) : (
                          <span className={cn("capitalize w-fit", leaseStatusStyles[lease.status] || statusBadgeClass("neutral"))}>
                            {lease.status}
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground">
                          Ends {format(new Date(lease.end_date), "dd/MM/yy")}
                        </span>
                      </div>
                    );
                  })()}
                </TableCell>
                <TableCell>
                  {tenant.monthly_rent ? (
                    <div className="text-sm">
                      <p className="font-medium text-foreground">KES {tenant.monthly_rent.toLocaleString()}/mo</p>
                      {tenant.deposit_amount ? (
                        <p className="text-xs text-muted-foreground">
                          Deposit {((tenant.deposit_balance ?? tenant.deposit_amount)).toLocaleString()}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">No rent set</span>
                  )}
                </TableCell>
                <TableCell>
                  {balanceByTenantId[tenant.id] ? (
                    <span className="font-medium text-destructive text-sm">
                      KES {balanceByTenantId[tenant.id].toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className={statusStyles[tenant.status] || statusBadgeClass(tenantStatusTone(tenant.status))}>
                    {tenant.status.charAt(0).toUpperCase() + tenant.status.slice(1)}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end" onClick={(event) => event.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-11"
                      onClick={() => onOpenDetail(tenant)}
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 min-h-11 min-w-11"
                      onClick={() => onOpenStatement(tenant)}
                      title="View Statement"
                      aria-label="View statement"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 min-h-11 min-w-11"
                      onClick={() => onOpenHistory(tenant)}
                      title="View History"
                      aria-label="View history"
                    >
                      <History className="h-4 w-4" />
                    </Button>
                    {tenant.status === "active" && tenant.unit_id && canApproveMoveouts && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 min-h-11 min-w-11 text-warning hover:text-warning hover:bg-warning/10"
                        onClick={() => onMoveOut(tenant)}
                        title="Process Move-Out"
                        aria-label="Process move-out"
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </DataTableFrame>
        <TablePager page={slice} onPageChange={setPage} noun="tenants" />
        </>
      )}
    </div>
  );
}

const Tenants = () => {
  const { toast } = useToast();
  const { can } = useRBAC();
  const { managerId, restrictToAssignedProperties, assignedPropertyIds } = useManagerScope();
  const [tenants, setTenants] = useState<TenantData[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [leases, setLeases] = useState<LeaseRecord[]>([]);
  const [tenantBalances, setTenantBalances] = useState<Record<string, number>>({});
  const [expiringSoonLeaseIds, setExpiringSoonLeaseIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTenant, setSelectedTenant] = useState<TenantData | null>(null);
  const [tenantHistory, setTenantHistory] = useState<TenantHistoryItem[]>([]);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [statusTab, setStatusTab] = useState<"active" | "pending" | "inactive">("active");
  const [propertyFilter, setPropertyFilter] = useState<string>("");
  const [moveOutTenant, setMoveOutTenant] = useState<TenantData | null>(null);
  const [moveOutDialogOpen, setMoveOutDialogOpen] = useState(false);

  const generateSignedUrls = async (tenantsList: TenantData[]) => {
    const urlMap: Record<string, string> = {};
    for (const tenant of tenantsList) {
      if (tenant.photo_url) {
        let filePath = tenant.photo_url;
        if (filePath.includes('/tenant-photos/')) {
          filePath = filePath.split('/tenant-photos/').pop() || filePath;
        }
        const { data, error } = await supabase.storage
          .from('tenant-photos')
          .createSignedUrl(filePath, 3600);
        if (data && !error) {
          urlMap[tenant.id] = data.signedUrl;
        }
      }
    }
    setSignedUrls(urlMap);
  };

  const fetchTenants = useCallback(async () => {
    if (!managerId) {
      setTenants([]);
      setIsLoading(false);
      return;
    }
    if (restrictToAssignedProperties && assignedPropertyIds.length === 0) {
      setTenants([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      let query = supabase
        .from("tenants")
        .select("*")
        .eq("manager_id", managerId)
        .order("created_at", { ascending: false });

      if (restrictToAssignedProperties) {
        query = query.in("property_id", assignedPropertyIds);
      }

      const { data, error } = await query;

      if (error) {
        const msg = toUserFacingError(error, "Failed to fetch tenants");
        setLoadError(msg);
        toast({ title: "Error", description: msg, variant: "destructive" });
      } else {
        setTenants((data || []) as TenantData[]);
        if (data && data.length > 0) {
          generateSignedUrls((data || []) as TenantData[]);
        }
      }
    } catch (err) {
      logError('Tenants.fetchTenants', err);
      setLoadError("Failed to load tenants. Please try again.");
      toast({ title: "Error", description: "Failed to load tenants. Please try again.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [assignedPropertyIds, managerId, restrictToAssignedProperties, toast]);

  const fetchProperties = useCallback(async () => {
    if (!managerId) {
      setProperties([]);
      return;
    }
    if (restrictToAssignedProperties && assignedPropertyIds.length === 0) {
      setProperties([]);
      return;
    }
    try {
      let query = supabase
        .from("properties")
        .select("id, name, address")
        .eq("manager_id", managerId)
        .order("name", { ascending: true });

      if (restrictToAssignedProperties) {
        query = query.in("id", assignedPropertyIds);
      }

      const { data, error } = await query;
      if (!error && data) setProperties(data);
    } catch (err) {
      logError('Tenants.fetchProperties', err);
    }
  }, [assignedPropertyIds, managerId, restrictToAssignedProperties]);

  const fetchLeasesAndBalances = useCallback(async () => {
    if (!managerId) {
      setLeases([]);
      setTenantBalances({});
      return;
    }
    if (restrictToAssignedProperties && assignedPropertyIds.length === 0) {
      setLeases([]);
      setTenantBalances({});
      return;
    }
    try {
      let leaseQuery = supabase
        .from("leases")
        .select("id, tenant_id, property, unit, start_date, end_date, monthly_rent, deposit, status")
        .eq("manager_id", managerId);
      if (restrictToAssignedProperties) {
        leaseQuery = leaseQuery.in("property_id", assignedPropertyIds);
      }
      const { data: leaseRows, error: leaseError } = await leaseQuery;
      if (!leaseError) {
        setLeases(leaseRows ?? []);
        // Computed once here (a plain data-fetch function, not render) so the
        // render layer never calls Date.now() itself — real end_date data only,
        // a 30-day window is the only "invented" part, same window the rest of
        // this app already uses (see dashboardStats.ts's expiringCutoff).
        const cutoff = Date.now() + 30 * 86400000;
        const soon = new Set<string>();
        for (const lease of leaseRows ?? []) {
          if (lease.status === "active" && new Date(lease.end_date).getTime() <= cutoff) {
            soon.add(lease.id);
          }
        }
        setExpiringSoonLeaseIds(soon);
      }

      const { data: invoiceRows, error: invoiceError } = await supabase
        .from("invoices")
        .select("tenant_id, amount, status")
        .eq("manager_id", managerId)
        .in("status", ["pending", "overdue"]);
      if (!invoiceError) {
        const balances: Record<string, number> = {};
        for (const row of invoiceRows ?? []) {
          if (!row.tenant_id) continue;
          balances[row.tenant_id] = (balances[row.tenant_id] ?? 0) + Number(row.amount ?? 0);
        }
        setTenantBalances(balances);
      }
    } catch (err) {
      logError("Tenants.fetchLeasesAndBalances", err);
    }
  }, [assignedPropertyIds, managerId, restrictToAssignedProperties]);

  const fetchTenantHistory = async (tenantId: string) => {
    const { data, error } = await supabase
      .from("tenant_history")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Error", description: "Failed to fetch tenant history", variant: "destructive" });
    } else {
      setTenantHistory(data || []);
    }
  };

  useEffect(() => {
    fetchTenants();
    fetchProperties();
    fetchLeasesAndBalances();
  }, [fetchTenants, fetchProperties, fetchLeasesAndBalances]);

  const leaseByTenantId = useMemo(() => {
    const map = new Map<string, LeaseRecord>();
    for (const lease of leases) {
      if (!lease.tenant_id) continue;
      // Prefer the active lease if a tenant somehow has more than one record.
      const existing = map.get(lease.tenant_id);
      if (!existing || (lease.status === "active" && existing.status !== "active")) {
        map.set(lease.tenant_id, lease);
      }
    }
    return map;
  }, [leases]);

  const openDetail = async (tenant: TenantData) => {
    setSelectedTenant(tenant);
    setIsDetailOpen(true);
    await fetchTenantHistory(tenant.id);
  };

  const openHistory = async (tenant: TenantData) => {
    await openDetail(tenant);
  };

  const openStatement = (tenant: TenantData) => {
    setSelectedTenant(tenant);
    setIsStatementOpen(true);
  };

  // Filter tenants by status tab, property, and search
  const filteredTenants = tenants.filter((tenant) => {
    if (tenant.status !== statusTab) return false;
    if (propertyFilter && tenant.property_id !== propertyFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      tenant.name.toLowerCase().includes(q) ||
      tenant.email.toLowerCase().includes(q) ||
      (tenant.property && tenant.property.toLowerCase().includes(q)) ||
      (tenant.unit && tenant.unit.toLowerCase().includes(q))
    );
  });

  const activeTenants = tenants.filter(t => t.status === "active");
  const pendingTenants = tenants.filter(t => t.status === "pending");
  const inactiveTenants = tenants.filter(t => t.status === "inactive");
  const activeRentTotal = activeTenants.reduce((sum, t) => sum + Number(t.monthly_rent ?? leaseByTenantId.get(t.id)?.monthly_rent ?? 0), 0);
  const outstandingTotal = Object.values(tenantBalances).reduce((sum, value) => sum + Number(value || 0), 0);
  const occupiedUnits = activeTenants.filter(t => t.unit_id || t.unit).length;

  return (
    <Layout
      title="Tenants"
      subtitle="Who lives where, what they owe, and which lease needs action"
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          <InviteTenantDialog trigger={<Button size="sm" className="min-h-11 gap-1.5"><UserPlus className="h-3.5 w-3.5" />Invite tenant</Button>} />
          <Button variant="outline" size="sm" className="min-h-11" asChild>
            <Link to="/leases">View leases</Link>
          </Button>
        </div>
      }
    >
      <DashboardSectionHeader eyebrow="People / Occupancy" title="Tenant portfolio" description="See who is occupying each unit, what is due, and where action is needed." action={<InviteTenantDialog trigger={<Button size="sm" className="min-h-11 gap-1.5"><UserPlus className="h-3.5 w-3.5" />Add tenant</Button>} />} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-6">
        <StatCard compact title="Current tenants" value={String(activeTenants.length)} change={`${occupiedUnits} assigned units`} changeType="neutral" icon={Users} iconColor="primary" />
        <StatCard compact title="Monthly rent" value={activeRentTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })} change="Active leases" changeType="neutral" icon={DollarSign} iconColor="primary" />
        <StatCard compact title="Outstanding" value={outstandingTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })} changeType={outstandingTotal > 0 ? "negative" : "neutral"} icon={AlertTriangle} iconColor={outstandingTotal > 0 ? "destructive" : "neutral"} />
        <StatCard compact title="Onboarding" value={String(pendingTenants.length)} change="Pending tenants" changeType="neutral" icon={Clock} iconColor="warning" />
      </div>

      <SearchFilterBar
        value={searchQuery}
        onValueChange={setSearchQuery}
        placeholder="Search tenants..."
        ariaLabel="Search tenants"
        activeFilterCount={propertyFilter ? 1 : 0}
        onClearFilters={() => setPropertyFilter("")}
      >
        <Select value={propertyFilter} onValueChange={setPropertyFilter}>
          <SelectTrigger className="w-full sm:w-56 min-h-11 text-sm" aria-label="Filter by property">
            <SelectValue placeholder="All Properties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Properties</SelectItem>
            {properties.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SearchFilterBar>

      {loadError && !isLoading && (
        <div className="mb-4">
          <ErrorState
            title="Couldn't load tenants"
            message={loadError}
            onRetry={() => { void fetchTenants(); }}
          />
        </div>
      )}

      <div className="mb-3"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Filter & locate</p></div>

      {/* Per-property quick-add sections */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {(propertyFilter ? properties.filter(p => p.id === propertyFilter) : properties).map((p) => {
          const propertyTenants = tenants.filter(t => t.property_id === p.id);
          return (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{propertyTenants.length} tenant{propertyTenants.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <InviteTenantDialog
                preSelectedPropertyId={p.id}
                trigger={<Button variant="outline" size="sm" className="shrink-0 gap-1"><UserPlus className="h-3 w-3" />Add Tenant</Button>}
              />
            </div>
          );
        })}
      </div>

      <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as "active" | "pending" | "inactive")} className="w-full">
        <TabsList className="w-full sm:w-auto mb-4">
            <TabsTrigger value="active" className="flex items-center gap-1.5 flex-1 sm:flex-none text-xs sm:text-sm">
              <UserCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Current
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{activeTenants.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="pending" className="flex items-center gap-1.5 flex-1 sm:flex-none text-xs sm:text-sm">
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Onboarding
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{pendingTenants.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="inactive" className="flex items-center gap-1.5 flex-1 sm:flex-none text-xs sm:text-sm">
              <UserX className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Deactivated
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{inactiveTenants.length}</Badge>
            </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-0">
          <TenantTable
            tenantList={filteredTenants}
            isLoading={isLoading}
            searchQuery={searchQuery}
            signedUrls={signedUrls}
            canApproveMoveouts={can('approve_moveouts')}
            leaseByTenantId={leaseByTenantId}
            balanceByTenantId={tenantBalances}
            expiringSoonLeaseIds={expiringSoonLeaseIds}
            onOpenStatement={openStatement}
            onOpenHistory={openHistory}
            onOpenDetail={openDetail}
            onMoveOut={(tenant) => {
              setMoveOutTenant(tenant);
              setMoveOutDialogOpen(true);
            }}
          />
        </TabsContent>
        <TabsContent value="pending" className="mt-0">
          <TenantTable
            tenantList={filteredTenants}
            isLoading={isLoading}
            searchQuery={searchQuery}
            signedUrls={signedUrls}
            canApproveMoveouts={can('approve_moveouts')}
            leaseByTenantId={leaseByTenantId}
            balanceByTenantId={tenantBalances}
            expiringSoonLeaseIds={expiringSoonLeaseIds}
            onOpenStatement={openStatement}
            onOpenHistory={openHistory}
            onOpenDetail={openDetail}
            onMoveOut={(tenant) => {
              setMoveOutTenant(tenant);
              setMoveOutDialogOpen(true);
            }}
          />
        </TabsContent>
        <TabsContent value="inactive" className="mt-0">
          <TenantTable
            tenantList={filteredTenants}
            isLoading={isLoading}
            searchQuery={searchQuery}
            signedUrls={signedUrls}
            canApproveMoveouts={can('approve_moveouts')}
            leaseByTenantId={leaseByTenantId}
            balanceByTenantId={tenantBalances}
            expiringSoonLeaseIds={expiringSoonLeaseIds}
            onOpenStatement={openStatement}
            onOpenHistory={openHistory}
            onOpenDetail={openDetail}
            onMoveOut={(tenant) => {
              setMoveOutTenant(tenant);
              setMoveOutDialogOpen(true);
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Tenant Detail Sheet — full tabbed panel */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="bg-card border-border w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-foreground flex items-center gap-3">
              {selectedTenant && (
                <>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={signedUrls[selectedTenant.id] || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {selectedTenant.name.split(" ").map((n) => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate">{selectedTenant.name}</p>
                      <span className={statusStyles[selectedTenant.status] || statusBadgeClass(tenantStatusTone(selectedTenant.status))}>
                        {selectedTenant.status.charAt(0).toUpperCase() + selectedTenant.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-normal">
                      {selectedTenant.property || "Unassigned"}
                      {selectedTenant.unit ? ` · ${selectedTenant.unit}` : ""}
                    </p>
                  </div>
                </>
              )}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Tenant overview, lease, financials, payments, maintenance, documents, and activity.
            </SheetDescription>
          </SheetHeader>
          {selectedTenant && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" className="min-h-11" onClick={() => setIsStatementOpen(true)}>
                <FileText className="h-4 w-4" />
                View statement
              </Button>
              {selectedTenant.status === "active" && selectedTenant.unit_id && can("approve_moveouts") && (
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => {
                    setMoveOutTenant(selectedTenant);
                    setMoveOutDialogOpen(true);
                  }}
                >
                  <Archive className="h-4 w-4" />
                  Move out
                </Button>
              )}
            </div>
          )}
          {selectedTenant && (
            <div className="mt-4">
              <TenantLifecycleCommandBar
                tenant={selectedTenant}
                lease={leaseByTenantId.get(selectedTenant.id) ?? null}
                balance={tenantBalances[selectedTenant.id] ?? 0}
                expiringSoon={(() => {
                  const lease = leaseByTenantId.get(selectedTenant.id);
                  return lease ? expiringSoonLeaseIds.has(lease.id) : false;
                })()}
                canMoveOut={can("approve_moveouts")}
                onMoveOut={() => {
                  setMoveOutTenant(selectedTenant);
                  setMoveOutDialogOpen(true);
                }}
              />
            </div>
          )}
          {selectedTenant && (
            <div className="mt-6">
              <Tabs defaultValue="overview">
                <TabsList className="flex-wrap h-auto gap-1 p-1 mb-2 text-xs">
                  <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                  <TabsTrigger value="lease" className="text-xs">Lease</TabsTrigger>
                  <TabsTrigger value="financial" className="text-xs">Financial</TabsTrigger>
                  <TabsTrigger value="payments" className="text-xs">Payments</TabsTrigger>
                  <TabsTrigger value="maintenance" className="text-xs">Maintenance</TabsTrigger>
                  <TabsTrigger value="documents" className="text-xs">Documents</TabsTrigger>
                  <TabsTrigger value="activity" className="text-xs">Activity</TabsTrigger>
                </TabsList>
                <TabsList className="flex-wrap h-auto gap-1 p-0 mb-4 bg-transparent text-xs">
                  <TabsTrigger value="payers" className="text-xs h-8">Payers</TabsTrigger>
                  <TabsTrigger value="notices" className="text-xs h-8">Notices</TabsTrigger>
                  <TabsTrigger value="portal" className="text-xs h-8">Portal</TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                  <TenantProfilePanel tenant={selectedTenant} onUpdate={fetchTenants} />
                </TabsContent>

                <TabsContent value="lease">
                  <TenantLeaseTab
                    leases={leases
                      .filter((l) => l.tenant_id === selectedTenant.id)
                      .map((l) => ({
                        id: l.id,
                        property: l.property,
                        unit: l.unit,
                        start_date: l.start_date,
                        end_date: l.end_date,
                        monthly_rent: l.monthly_rent,
                        deposit: l.deposit,
                        status: l.status,
                        expiringSoon: expiringSoonLeaseIds.has(l.id),
                      }))}
                  />
                </TabsContent>

                <TabsContent value="financial">
                  <DepositAccountabilityStatement
                    tenant={selectedTenant}
                    unitId={selectedTenant.unit_id}
                  />
                </TabsContent>

                <TabsContent value="payments">
                  <TenantPaymentsTab tenantId={selectedTenant.id} />
                </TabsContent>

                <TabsContent value="maintenance">
                  <TenantMaintenanceTab tenantEmail={selectedTenant.email} />
                </TabsContent>

                <TabsContent value="documents">
                  <TenantDocumentsTab tenantId={selectedTenant.id} />
                </TabsContent>

                <TabsContent value="payers">
                  <PaymentPayersManager
                    tenantId={selectedTenant.id}
                    tenantName={selectedTenant.name}
                    unitId={selectedTenant.unit_id}
                    propertyId={selectedTenant.property_id}
                    monthlyRent={selectedTenant.monthly_rent}
                  />
                </TabsContent>

                <TabsContent value="notices">
                  <TenantNoticeComposer tenant={selectedTenant} />
                </TabsContent>

                <TabsContent value="activity">
                  <ScrollArea className="h-[calc(100vh-300px)]">
                    {tenantHistory.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No history records yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {tenantHistory.map((item) => (
                          <div key={item.id} className="relative pl-6 pb-4 border-l-2 border-border last:border-l-0">
                            <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-primary/40" />
                            <div className="bg-muted/30 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-1">
                                <Badge variant="outline">
                                  {item.action}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(item.created_at), 'dd/MM/yy')}
                                </span>
                              </div>
                              <p className="text-sm text-foreground">{item.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="portal">
                  <div className="space-y-4 p-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Tenant Portal Access</p>
                        <p className="text-xs text-muted-foreground">
                          Invite tenant to create their portal login and access invoices, maintenance, documents.
                        </p>
                      </div>
                      <InviteTenantDialog
                        trigger={
                          <Button size="sm" className="gap-1.5">
                            <UserPlus className="h-3.5 w-3.5" />
                            Send Invite
                          </Button>
                        }
                      />
                    </div>
                    <InvitationTracker tenantId={selectedTenant.id} />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Statement Sheet */}
      <TenantStatement
        tenant={selectedTenant}
        isOpen={isStatementOpen}
        onOpenChange={setIsStatementOpen}
      />

      {/* Move-Out Dialog */}
      {moveOutTenant && (
        <MoveOutDialog
          tenant={moveOutTenant}
          open={moveOutDialogOpen}
          onOpenChange={(open) => {
            setMoveOutDialogOpen(open);
            if (!open) setMoveOutTenant(null);
          }}
          onSuccess={() => {
            // Refresh tenant list after move-out
            setTenants(prev => prev.map(t =>
              t.id === moveOutTenant.id ? { ...t, status: 'inactive' } : t
            ));
          }}
        />
      )}
    </Layout>
  );
};

export default Tenants;
