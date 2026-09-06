// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateDashboardQueries } from "@/shared/lib/invalidateDashboards";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { useRBAC } from "@/shared/hooks/useRBAC";
import { useActivityLog } from "@/shared/hooks/useActivityLog";
import { logError, toUserFacingError } from "@/shared/lib/errorLogger";
import { Layout } from "@/shared/components/layout/Layout";
import { DashboardSectionHeader } from "@/features/dashboard/components/DashboardSectionHeader";
import { SearchFilterBar } from "@/shared/components/ui/search-filter-bar";
import ServiceMarketplace from "@/features/services/components/ServiceMarketplace";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Card, CardContent } from "@/shared/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Label } from "@/shared/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  Plus,
  Wrench,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  Search,
  LayoutList,
  LayoutGrid,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/shared/hooks/use-toast";
import { maintenanceRequestSchema, formatValidationErrors } from "@/shared/lib/validations";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { formatDate } from "@/shared/lib/dateFormat";
import { MAINTENANCE_CATEGORIES, getCategoryLabel } from "@/features/maintenance/lib/maintenanceCategories";
import {
  countMaintenanceLanes,
  MAINTENANCE_LANES,
  matchesMaintenanceLane,
  type MaintenanceLane,
} from "@/features/maintenance/lib/maintenanceLane";
import { MaintenanceActiveReport } from "@/features/maintenance/components/MaintenanceActiveReport";
const MaintenanceBudgetDashboard = lazy(() =>
  import("@/features/maintenance/components/MaintenanceBudgetDashboard").then((m) => ({
    default: m.MaintenanceBudgetDashboard,
  })),
);
import { EmptyState } from "@/shared/components/ui/empty-state";
import { LoadingState } from "@/shared/components/ui/loading-state";
import {
  requestAgeLabel,
  statusBadgeClass,
} from "@/shared/lib/statusBadge";
import { paginate, sortBy, toggleSort, type SortDir } from "@/shared/lib/clientTable";
import { SortableHead, TablePager } from "@/shared/components/ui/table-pager";

type RequestStatus = "open" | "pending" | "in_progress" | "completed" | "cancelled";
type RequestPriority = "low" | "medium" | "high" | "urgent";

interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  property_name: string;
  unit_number: string | null;
  unit_id: string | null;
  tenant_name: string;
  tenant_email: string;
  status: RequestStatus;
  priority: RequestPriority;
  category: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  requested_date: string;
  expected_completion_date: string | null;
  completion_date: string | null;
  budget: number | null;
  created_by_role: string | null;
}

interface Property {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  unit_number: string;
  property_id: string;
}

const statusColors: Record<RequestStatus, string> = {
  open: statusBadgeClass("warning"),
  pending: statusBadgeClass("warning"),
  in_progress: statusBadgeClass("info"),
  completed: statusBadgeClass("success"),
  cancelled: statusBadgeClass("neutral"),
};

const priorityColors: Record<RequestPriority, string> = {
  low: statusBadgeClass("neutral"),
  medium: statusBadgeClass("warning"),
  high: statusBadgeClass("danger"),
  urgent: statusBadgeClass("danger"),
};

function nextMaintenanceAction(status: RequestStatus, assignedTo: string | null): string {
  if (status === "open") return assignedTo ? "Start work" : "Assign";
  if (status === "in_progress") return "Complete";
  return "—";
}

const PRIORITY_RANK: Record<RequestPriority, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

const statusIcons: Record<RequestStatus, React.ReactNode> = {
  open: <AlertTriangle className="h-4 w-4" />,
  pending: <Clock className="h-4 w-4" />,
  in_progress: <Clock className="h-4 w-4" />,
  completed: <CheckCircle2 className="h-4 w-4" />,
  cancelled: <Wrench className="h-4 w-4" />,
};

export default function Maintenance() {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<MaintenanceLane>("new");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const { toast } = useToast();
  const { managerId, restrictToAssignedProperties, assignedPropertyIds } = useManagerScope();
  const { can } = useRBAC();
  const { logActivity } = useActivityLog();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const { formatCurrency } = useCurrency();
  const [requestPage, setRequestPage] = useState(1);
  const [requestSortKey, setRequestSortKey] = useState("priority");
  const [requestSortDir, setRequestSortDir] = useState<SortDir>("desc");
  const [completeTarget, setCompleteTarget] = useState<{ id: string; oldStatus?: RequestStatus } | null>(null);

  // Properties and units for dropdowns
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [filteredUnits, setFilteredUnits] = useState<Unit[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    property_id: "",
    property_name: "",
    unit_id: "",
    unit_number: "",
    tenant_name: "",
    tenant_email: "",
    priority: "medium" as RequestPriority,
    expected_completion_date: "",
    budget: "",
  });

  const fetchRequests = useCallback(async () => {
    if (!managerId) {
      setRequests([]);
      setIsLoading(false);
      return;
    }
    if (restrictToAssignedProperties && assignedPropertyIds.length === 0) {
      setRequests([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let names: string[] | null = null;
    if (restrictToAssignedProperties) {
      const { data: scopedProperties } = await supabase
        .from("properties")
        .select("name")
        .eq("manager_id", managerId)
        .in("id", assignedPropertyIds);
      names = (scopedProperties ?? []).map((p) => p.name).filter(Boolean);
      if (!names.length) {
        setRequests([]);
        setIsLoading(false);
        return;
      }
    }

    let query = supabase
      .from("maintenance_requests")
      .select("*")
      .eq("manager_id", managerId)
      .order("created_at", { ascending: false });
    if (names) {
      query = query.in("property_name", names);
    }

    const { data, error } = await query;

    if (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch maintenance requests",
        variant: "destructive",
      });
    } else {
      setRequests(data || []);
    }
    setIsLoading(false);
  }, [assignedPropertyIds, managerId, restrictToAssignedProperties, toast]);

  const fetchPropertiesAndUnits = useCallback(async () => {
    if (!managerId) {
      setProperties([]);
      setUnits([]);
      return;
    }
    if (restrictToAssignedProperties && assignedPropertyIds.length === 0) {
      setProperties([]);
      setUnits([]);
      return;
    }

    let propertiesQuery = supabase.from("properties").select("id, name").eq("manager_id", managerId).order("name");
    if (restrictToAssignedProperties) {
      propertiesQuery = propertiesQuery.in("id", assignedPropertyIds);
    }
    const { data: propertyRows } = await propertiesQuery;
    const scopedProperties = propertyRows ?? [];
    setProperties(scopedProperties);

    const propertyIds = scopedProperties.map((p) => p.id);
    if (propertyIds.length === 0) {
      setUnits([]);
      return;
    }
    const { data: unitRows } = await supabase
      .from("units")
      .select("id, unit_number, property_id")
      .in("property_id", propertyIds)
      .order("unit_number");
    setUnits(unitRows ?? []);
  }, [assignedPropertyIds, managerId, restrictToAssignedProperties]);

  useEffect(() => {
    fetchRequests();
    fetchPropertiesAndUnits();
  }, [fetchRequests, fetchPropertiesAndUnits]);

  // Filter units when property changes
  useEffect(() => {
    if (formData.property_id) {
      setFilteredUnits(units.filter(u => u.property_id === formData.property_id));
    } else {
      setFilteredUnits([]);
    }
    // Reset unit when property changes
    if (formData.unit_id) {
      const unitBelongsToProperty = units.some(u => u.id === formData.unit_id && u.property_id === formData.property_id);
      if (!unitBelongsToProperty) {
        setFormData(prev => ({ ...prev, unit_id: "", unit_number: "" }));
      }
    }
  }, [formData.property_id, units, formData.unit_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managerId) {
      toast({ title: "Error", description: "You must be signed in to submit a maintenance request.", variant: "destructive" });
      return;
    }
    
    // Validate input
    const validationResult = maintenanceRequestSchema.safeParse({
      ...formData,
      property_name: formData.property_name,
      unit_number: formData.unit_number,
    });
    if (!validationResult.success) {
      toast({
        title: "Validation Error",
        description: formatValidationErrors(validationResult.error),
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.rpc("create_maintenance_request_atomic", {
      p_title: validationResult.data.title,
      p_description: validationResult.data.description,
      p_property_name: formData.property_name,
      p_unit_number: formData.unit_number || null,
      p_unit_id: formData.unit_id || null,
      p_tenant_name: validationResult.data.tenant_name,
      p_tenant_email: validationResult.data.tenant_email,
      p_priority: validationResult.data.priority,
      p_category: "other",
      p_expected_completion_date: formData.expected_completion_date || null,
      p_budget: formData.budget ? parseFloat(formData.budget) : null,
      p_manager_id: managerId,
      p_created_by_role: "manager",
    });

    if (error) {
      toast({
        title: "Error",
        description: toUserFacingError(error, "Failed to submit maintenance request"),
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Maintenance request submitted successfully",
      });
      invalidateDashboardQueries(queryClient);
      setFormData({
        title: "",
        description: "",
        property_id: "",
        property_name: "",
        unit_id: "",
        unit_number: "",
        tenant_name: "",
        tenant_email: "",
        priority: "medium",
        expected_completion_date: "",
        budget: "",
      });
      setIsDialogOpen(false);
      fetchRequests();
    }
  };

  const updateRequestStatus = async (id: string, status: RequestStatus, oldStatus?: RequestStatus) => {
    const { error } = await supabase.rpc("transition_maintenance_request_atomic", {
      p_request_id: id,
      p_target_status: status,
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
        variant: "destructive",
      });
    } else {
      // Send notification for status change
      supabase.functions.invoke('send-maintenance-notification', {
        body: { requestId: id, type: 'status_changed', oldStatus, newStatus: status },
      }).catch((err) => logError('Maintenance.sendNotification', err));

      logActivity({
        action: `maintenance_${status}`,
        entityType: 'maintenance',
        entityId: id,
        metadata: { old_status: oldStatus, new_status: status },
      });

      toast({ title: "Success", description: "Request status updated" });
      invalidateDashboardQueries(queryClient);
      fetchRequests();
    }
  };

  const assignRequest = async (id: string, assignedTo: string, providerId?: string) => {
    const { error } = await supabase.rpc("assign_maintenance_request_atomic", {
      p_request_id: id,
      p_assigned_to: assignedTo,
      p_provider_id: providerId || null,
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to assign request",
        variant: "destructive",
      });
    } else {
      // Send notification for assignment
      supabase.functions.invoke('send-maintenance-notification', {
        body: {
          requestId: id,
          type: 'assigned',
          assignedTo: assignedTo,
        },
      }).catch((err) => logError('Maintenance.sendNotification', err));

      toast({
        title: "Success",
        description: "Request assigned successfully",
      });
      fetchRequests();
    }
  };

  useEffect(() => {
    const priority = searchParams.get("priority");
    setPriorityFilter(["urgent", "high", "medium", "low"].includes(priority ?? "") ? priority! : "all");
  }, [searchParams]);

  const filteredRequests = requests.filter((request) => {
    const matchesSearch =
      request.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.tenant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.property_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === "all" || request.category === categoryFilter;
    const matchesPriority = priorityFilter === "all" || request.priority === priorityFilter;

    return matchesSearch && matchesCategory && matchesPriority && matchesMaintenanceLane(request.status, request.assigned_to, activeTab);
  });

  useEffect(() => {
    setRequestPage(1);
  }, [searchQuery, activeTab, categoryFilter, priorityFilter]);

  const sortedRequests = useMemo(() => {
    const getter = (request: MaintenanceRequest) => {
      switch (requestSortKey) {
        case "status": return request.status;
        case "property": return `${request.property_name} ${request.unit_number ?? ""}`;
        case "tenant": return request.tenant_name;
        case "age": return request.created_at;
        case "assigned": return request.assigned_to ?? "";
        default: return PRIORITY_RANK[request.priority] ?? 0;
      }
    };
    return sortBy(filteredRequests, getter, requestSortDir);
  }, [filteredRequests, requestSortKey, requestSortDir]);

  const requestSlice = useMemo(() => paginate(sortedRequests, requestPage, 25), [sortedRequests, requestPage]);

  const handleRequestSort = (key: string) => {
    const next = toggleSort(requestSortKey, key, requestSortDir);
    setRequestSortKey(next.key);
    setRequestSortDir(next.dir);
    setRequestPage(1);
  };

  const laneCounts = countMaintenanceLanes(requests);

  return (
    <Layout
      title="Maintenance"
      subtitle="New, assigned, in progress, awaiting, completed — assign, start, or complete work orders"
    >
      <div className="mb-5">
        <DashboardSectionHeader
          eyebrow="Operations / Maintenance"
          title="Work queue at a glance"
          description="See what needs attention, what is underway and what has been completed before opening individual work orders."
        />
      </div>

      {/* Lane counts — same five names as the tabs, not decorative KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-px border border-border rounded-xl overflow-hidden bg-border mb-4 sm:mb-6">
        {isLoading
          ? Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="bg-card p-3 sm:p-4">
                <LoadingState variant="skeleton" rows={2} className="p-0" label="Loading lane counts" />
              </div>
            ))
          : MAINTENANCE_LANES.map((lane) => (
              <div key={lane.id} className="bg-card p-3 sm:p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{lane.label}</p>
                <p className="font-heading text-lg sm:text-2xl font-bold text-foreground mt-1">{laneCounts[lane.id]}</p>
              </div>
            ))}
      </div>

      <details className="mb-4 rounded-xl border border-border bg-card">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground flex items-center justify-between">
          Reports and budget
          <span className="text-xs font-normal text-muted-foreground">Optional context</span>
        </summary>
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-3">
          <MaintenanceActiveReport
            requests={requests}
            onStartRequest={(id) => updateRequestStatus(id, "in_progress", "open")}
            onCompleteRequest={(id) => setCompleteTarget({ id, oldStatus: "in_progress" })}
          />
          <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-muted" aria-hidden />}>
            <MaintenanceBudgetDashboard requests={requests} />
          </Suspense>
        </div>
      </details>

      {/* Actions Bar */}
      <SearchFilterBar
        value={searchQuery}
        onValueChange={setSearchQuery}
        placeholder="Search requests..."
        ariaLabel="Search maintenance requests"
        activeFilterCount={categoryFilter !== "all" ? 1 : 0}
        onClearFilters={() => setCategoryFilter("all")}
      >
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-[180px] min-h-11 bg-card border-border" aria-label="Filter maintenance by category">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {MAINTENANCE_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex border border-border rounded-lg overflow-hidden self-start">
            <Button variant={viewMode === "table" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("table")} className="rounded-none h-9 px-3">
              <LayoutList className="h-4 w-4" />
              <span className="sr-only">Table view</span>
            </Button>
            <Button variant={viewMode === "cards" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("cards")} className="rounded-none h-9 px-3">
              <LayoutGrid className="h-4 w-4" />
              <span className="sr-only">Card view</span>
            </Button>
          </div>
        </div>
      </SearchFilterBar>

      {/* Tabs and Request List */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as MaintenanceLane)}>
        <TabsList className="bg-card border border-border mb-3 sm:mb-4 w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 h-auto">
          {MAINTENANCE_LANES.map((lane) => (
            <TabsTrigger key={lane.id} value={lane.id} className="text-[11px] sm:text-sm px-1 sm:px-3">
              {lane.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-0">
          {isLoading ? (
            <LoadingState variant="skeleton" rows={6} label="Loading requests" />
          ) : filteredRequests.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title="No maintenance requests found"
              description="Create a work order to track repairs by property, unit, and priority."
            />
          ) : viewMode === "table" ? (
            <Card className="bg-card border-border">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <SortableHead label="Priority" sortKey="priority" currentKey={requestSortKey} dir={requestSortDir} onSort={handleRequestSort} />
                      <SortableHead label="Status" sortKey="status" currentKey={requestSortKey} dir={requestSortDir} onSort={handleRequestSort} />
                      <TableHead>Issue</TableHead>
                      <SortableHead label="Property / Unit" sortKey="property" currentKey={requestSortKey} dir={requestSortDir} onSort={handleRequestSort} className="hidden sm:table-cell" />
                      <SortableHead label="Tenant" sortKey="tenant" currentKey={requestSortKey} dir={requestSortDir} onSort={handleRequestSort} className="hidden md:table-cell" />
                      <SortableHead label="Age" sortKey="age" currentKey={requestSortKey} dir={requestSortDir} onSort={handleRequestSort} />
                      <SortableHead label="Assigned" sortKey="assigned" currentKey={requestSortKey} dir={requestSortDir} onSort={handleRequestSort} className="hidden lg:table-cell" />
                      <TableHead className="hidden md:table-cell">Next</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requestSlice.items.map((request) => (
                      <TableRow key={request.id} className="border-border">
                        <TableCell>
                          <span className={priorityColors[request.priority]}>
                            {request.priority}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={statusColors[request.status]}>
                            {request.status.replace("_", " ")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground">{request.title}</p>
                            <p className="text-xs text-muted-foreground sm:hidden">
                              {request.property_name}
                              {request.unit_number && ` · ${request.unit_number}`}
                              {request.tenant_name && ` · ${request.tenant_name}`}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <p className="text-sm text-foreground">{request.property_name}</p>
                          <p className="text-xs text-muted-foreground">{request.unit_number || "—"}</p>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-sm text-foreground">{request.tenant_name}</span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {requestAgeLabel(request.created_at)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {request.assigned_to || "Unassigned"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {nextMaintenanceAction(request.status, request.assigned_to)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            {request.status === "open" && (
                              <>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button size="sm" variant="outline">
                                      Assign
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="bg-card border-border">
                                    <DialogHeader>
                                      <DialogTitle className="text-foreground">Assign Request</DialogTitle>
                                      <DialogDescription>
                                        Assign this maintenance request to a technician.
                                      </DialogDescription>
                                    </DialogHeader>
                                    <AssignForm
                                      onAssign={(name, pid) => assignRequest(request.id, name, pid)}
                                    />
                                  </DialogContent>
                                </Dialog>
                                {can('manage_maintenance') && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateRequestStatus(request.id, "in_progress")}
                                  >
                                    Start
                                  </Button>
                                )}
                              </>
                            )}
                            {request.status === "in_progress" && can('manage_maintenance') && (
                              <Button
                                size="sm"
                                className="bg-[hsl(214_73%_48%)] hover:bg-[hsl(214_73%_42%)] text-white"
                                onClick={() => setCompleteTarget({ id: request.id, oldStatus: request.status })}
                              >
                                Complete
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePager page={requestSlice} onPageChange={setRequestPage} noun="requests" />
              </CardContent>
            </Card>
          ) : (
            <>
            <div className="grid gap-4">
              {requestSlice.items.map((request) => (
                <Card key={request.id} className="bg-card border-border">
                  <CardContent className="p-5">
                    <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-start gap-3 mb-2">
                          <div className="p-2 rounded-lg bg-muted">
                            {statusIcons[request.status]}
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground">
                              {request.title}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {request.property_name}
                              {request.unit_number && ` - Unit ${request.unit_number}`}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {request.description}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <span className={statusColors[request.status]}>
                            {request.status.replace("_", " ")}
                          </span>
                          <span className={priorityColors[request.priority]}>
                            {request.priority} priority
                          </span>
                          <span className={statusBadgeClass("neutral")}>
                            {getCategoryLabel(request.category || 'other')}
                          </span>
                          <span className={statusBadgeClass("neutral")}>
                            <User className="h-3 w-3 mr-1" />
                            {request.tenant_name}
                          </span>
                          {request.budget && (
                            <span className={statusBadgeClass("success")}>
                              Budget: {formatCurrency(request.budget)}
                            </span>
                          )}
                        </div>
                        {request.assigned_to && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Assigned to: {request.assigned_to}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                          <span>Requested: {formatDate(request.requested_date)}</span>
                          {request.expected_completion_date && (
                            <span>Due: {formatDate(request.expected_completion_date)}</span>
                          )}
                          {request.completion_date && (
                            <span className="text-success">Completed: {formatDate(request.completion_date)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 lg:items-end">
                        <p className="text-xs text-muted-foreground">
                          {formatDate(request.created_at)}
                        </p>
                        <div className="flex gap-2">
                          {request.status === "open" && (
                            <>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button size="sm" variant="outline">
                                    Assign
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="bg-card border-border">
                                  <DialogHeader>
                                    <DialogTitle className="text-foreground">Assign Request</DialogTitle>
                                    <DialogDescription>
                                      Assign this maintenance request to a technician.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <AssignForm
                                    onAssign={(name, pid) => assignRequest(request.id, name, pid)}
                                  />
                                </DialogContent>
                              </Dialog>
                              {can('manage_maintenance') && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateRequestStatus(request.id, "in_progress")}
                                >
                                  Start
                                </Button>
                              )}
                            </>
                          )}
                          {request.status === "in_progress" && can('manage_maintenance') && (
                            <Button
                              size="sm"
                              className="bg-[hsl(214_73%_48%)] hover:bg-[hsl(214_73%_42%)] text-white"
                              onClick={() => setCompleteTarget({ id: request.id, oldStatus: request.status })}
                            >
                              Complete
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <TablePager page={requestSlice} onPageChange={setRequestPage} noun="requests" />
            </>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!completeTarget} onOpenChange={(open) => { if (!open) setCompleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark this work order complete?</AlertDialogTitle>
            <AlertDialogDescription>
              This records a completion date and notifies the requester. You can still view it under Completed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!completeTarget) return;
                void updateRequestStatus(completeTarget.id, "completed", completeTarget.oldStatus);
                setCompleteTarget(null);
              }}
            >
              Mark complete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

function AssignForm({ onAssign }: { onAssign: (name: string, providerId?: string) => void }) {
  const [tab, setTab] = useState<'marketplace' | 'manual'>('marketplace');
  const [manualName, setManualName] = useState('');

  return (
    <div className="space-y-3 py-2">
      {/* Tab toggle */}
      <div className="flex rounded-lg border border-border overflow-hidden text-sm">
        <button
          className={`flex-1 py-2 font-medium transition-colors ${tab === 'marketplace' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/40'}`}
          onClick={() => setTab('marketplace')}
        >
          From marketplace
        </button>
        <button
          className={`flex-1 py-2 font-medium transition-colors ${tab === 'manual' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/40'}`}
          onClick={() => setTab('manual')}
        >
          Enter manually
        </button>
      </div>

      {tab === 'marketplace' ? (
        <div className="max-h-96 overflow-y-auto">
          <ServiceMarketplace
            compact
            onSelectProvider={(providerId, name) => onAssign(name, providerId)}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <Label>Technician / contractor name</Label>
            <Input
              value={manualName}
              onChange={e => setManualName(e.target.value)}
              placeholder="Enter name or company"
              className="mt-1 bg-background border-border"
            />
          </div>
          <Button onClick={() => onAssign(manualName)} disabled={!manualName.trim()} className="w-full">
            Assign
          </Button>
        </div>
      )}
    </div>
  );
}
