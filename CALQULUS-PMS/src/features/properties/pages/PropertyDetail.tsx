import { format } from "date-fns";
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { useRBAC } from "@/shared/hooks/useRBAC";
import { Layout } from "@/shared/components/layout/Layout";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/shared/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/shared/components/ui/table";
import {
  ArrowLeft, Building2, Users, Home,
  Plus, UserPlus, DollarSign, X, Layers, History, Hash,
  Wrench, CreditCard, FileText, Droplets, FileSignature, CalendarX, Settings2,
  FileSpreadsheet, User, ShieldCheck, MoveVertical, Zap, Sofa, AlertTriangle,
} from "lucide-react";
import PropertyLandlordTab from "@/features/properties/components/PropertyLandlordTab";
import { useToast } from "@/shared/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/shared/lib/utils";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { statusBadgeClass } from "@/shared/lib/statusBadge";
import { StatCard } from "@/features/dashboard/components/StatCard";
import { DashboardSectionHeader } from "@/features/dashboard/components/DashboardSectionHeader";
import { UnitManagement } from "@/features/units/components/UnitManagement";
import UnitBillingConfig from "@/features/units/components/UnitBillingConfig";
import { PropertyHistory } from "@/features/properties/components/PropertyHistory";
import { PropertyMaintenanceTab } from "@/features/properties/components/PropertyMaintenanceTab";
import { PropertyInvoicesTab } from "@/features/properties/components/PropertyInvoicesTab";
import { PropertyLeasesTab } from "@/features/properties/components/PropertyLeasesTab";
import { PropertyBillingTab } from "@/features/properties/components/PropertyBillingTab";
import { PropertyAgreementsTab } from "@/features/properties/components/PropertyAgreementsTab";
import { PropertyVacationNoticesTab } from "@/features/properties/components/PropertyVacationNoticesTab";
import { PropertySettingsTab } from "@/features/properties/components/PropertySettingsTab";
import PropertyBillingConfig from "@/features/properties/components/PropertyBillingConfig";
import { AddTenantToPropertyDialog } from "@/features/properties/components/AddTenantToPropertyDialog";
import { useDeskEmbed } from "@/shared/components/layout/DeskEmbed";

import { WaterBillingManager } from "@/features/water/components/WaterBillingManager";
import { PropertyStatementTab } from "@/features/properties/components/PropertyStatementTab";
import PropertyCollectionStatement from "@/features/properties/components/PropertyCollectionStatement";

interface Property {
  id: string;
  name: string;
  address: string;
  house_number: string | null;
  units: number;
  occupied: number;
  revenue: number;
  image_url: string | null;
  created_at: string;
  status?: string | null;
}

interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  unit: string | null;
  status: string;
  photo_url: string | null;
  move_in_date: string | null;
}

interface Lease {
  id: string;
  tenant_id: string | null;
  unit: string;
  monthly_rent: number;
  start_date: string;
  end_date: string;
  status: string;
  deposit: number | null;
}

const statusStyles: Record<string, string> = {
  active: statusBadgeClass("success"),
  pending: statusBadgeClass("warning"),
  inactive: statusBadgeClass("neutral"),
  expiring: statusBadgeClass("warning"),
  expired: statusBadgeClass("danger"),
};

const PropertyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const { can, is } = useRBAC();
  const { recordsHome } = useDeskEmbed();
  const propertyListPath = recordsHome ?? "/properties";
  // Permission gates for submanagers
  const canWrite           = is('manager') || can('edit_tenants');
  const canRecordPayments  = is('manager') || can('record_payments');
  const canManageMaint     = is('manager') || can('manage_maintenance');
  const canSendNotices     = is('manager') || can('send_notices');
  const canCreateInvoices  = is('manager') || can('create_invoices');
  const canApproveMoveouts = is('manager') || can('approve_moveouts');
  const activeTab = searchParams.get("tab") || "overview";
  const setActiveTab = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  const [property, setProperty] = useState<Property | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [allTenants, setAllTenants] = useState<Tenant[]>([]);
  const [tenantBalances, setTenantBalances] = useState<Record<string, number>>({});
  const [maintenanceOpenCount, setMaintenanceOpenCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // Assign tenant dialog
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [assignUnit, setAssignUnit] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  
  // Add tenant dialog
  const [isAddTenantOpen, setIsAddTenantOpen] = useState(false);

  const generateSignedUrls = async (tenantsList: Tenant[]) => {
    const urlMap: Record<string, string> = {};

    for (const tenant of tenantsList) {
      if (tenant.photo_url) {
        let filePath = tenant.photo_url;
        if (filePath.includes("/tenant-photos/")) {
          filePath = filePath.split("/tenant-photos/").pop() || filePath;
        }

        const { data, error } = await supabase.storage
          .from("tenant-photos")
          .createSignedUrl(filePath, 3600);

        if (data && !error) {
          urlMap[tenant.id] = data.signedUrl;
        }
      }
    }

    setSignedUrls(urlMap);
  };

  const fetchPropertyData = useCallback(async () => {
    if (!id) return;

    setIsLoading(true);

    // Fetch property
    const { data: propertyData, error: propertyError } = await supabase
      .from("properties")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (propertyError || !propertyData) {
      toast({
        title: "Error",
        description: "Property not found",
        variant: "destructive",
      });
      navigate(propertyListPath);
      return;
    }

    setProperty(propertyData);

    // Fetch related data in parallel
    const [tenantsRes, leasesRes, allTenantsRes, maintenanceRes] = await Promise.all([
      supabase.from("tenants").select("*").eq("property_id", id).order("name"),
      supabase.from("leases").select("*").eq("property_id", id).order("unit"),
      supabase.from("tenants").select("*").is("property_id", null).eq("status", "active").order("name"),
      supabase
        .from("maintenance_requests")
        .select("id, status")
        .eq("property_name", propertyData.name)
        .in("status", ["open", "pending", "in_progress"]),
    ]);

    if (tenantsRes.data) {
      setTenants(tenantsRes.data);
      generateSignedUrls(tenantsRes.data);

      // Outstanding balance per tenant, from real unpaid invoices — same
      // pending/overdue definition used by the dashboard's arrears view.
      const tenantIds = tenantsRes.data.map((t) => t.id);
      if (tenantIds.length > 0) {
        const { data: invoiceRows } = await supabase
          .from("invoices")
          .select("tenant_id, amount, status")
          .in("tenant_id", tenantIds)
          .in("status", ["pending", "overdue"]);
        const balances: Record<string, number> = {};
        for (const row of invoiceRows ?? []) {
          if (!row.tenant_id) continue;
          balances[row.tenant_id] = (balances[row.tenant_id] ?? 0) + Number(row.amount ?? 0);
        }
        setTenantBalances(balances);
      } else {
        setTenantBalances({});
      }
    }

    if (leasesRes.data) {
      setLeases(leasesRes.data);
    }

    if (allTenantsRes.data) {
      setAllTenants(allTenantsRes.data);
    }

    setMaintenanceOpenCount((maintenanceRes.data ?? []).length);

    setIsLoading(false);
  }, [id, toast, navigate, propertyListPath]);

  useEffect(() => {
    fetchPropertyData();
  }, [fetchPropertyData, id]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getUnitsWithTenants = () => {
    const unitMap = new Map<string, { tenant: Tenant | null; lease: Lease | null }>();

    // Initialize units from leases
    leases.forEach((lease) => {
      const tenant = tenants.find((t) => t.id === lease.tenant_id);
      unitMap.set(lease.unit, { tenant: tenant || null, lease });
    });

    // Add tenants with units but no matching lease
    tenants.forEach((tenant) => {
      if (tenant.unit && !unitMap.has(tenant.unit)) {
        unitMap.set(tenant.unit, { tenant, lease: null });
      }
    });

    // Generate empty units for remaining capacity
    const totalUnits = property?.units || 0;
    const existingUnits = unitMap.size;
    
    if (existingUnits < totalUnits) {
      for (let i = 1; i <= totalUnits; i++) {
        const unitName = `Unit ${i}`;
        if (!unitMap.has(unitName) && ![...unitMap.keys()].some(k => k.includes(i.toString()))) {
          unitMap.set(unitName, { tenant: null, lease: null });
        }
      }
    }

    return Array.from(unitMap.entries()).sort((a, b) => {
      // Try to sort numerically if possible
      const numA = parseInt(a[0].replace(/\D/g, "")) || 0;
      const numB = parseInt(b[0].replace(/\D/g, "")) || 0;
      return numA - numB || a[0].localeCompare(b[0]);
    });
  };

  const handleAssignTenant = async () => {
    if (!selectedTenantId || !assignUnit.trim() || !property) {
      toast({
        title: "Error",
        description: "Please select a tenant and enter a unit number",
        variant: "destructive",
      });
      return;
    }

    setIsAssigning(true);

    try {
      const { error } = await supabase.rpc('assign_tenant_unit_atomic' as never, {
        p_tenant_id: selectedTenantId, p_property_id: property.id, p_unit_id: null, p_unit_number: assignUnit.trim()
      });
      if (error) throw error;

      toast({
        title: "Tenant Assigned",
        description: "Tenant has been assigned to this property successfully.",
      });
      setIsAssignDialogOpen(false);
      setSelectedTenantId("");
      setAssignUnit("");
      fetchPropertyData();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to assign tenant",
        variant: "destructive",
      });
    }

    setIsAssigning(false);
  };

  const handleRemoveTenant = async (tenantId: string) => {
    const { error } = await supabase.rpc('unassign_tenant_atomic' as never, { p_tenant_id: tenantId });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to remove tenant from property",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Tenant Removed",
        description: "Tenant has been removed from this property.",
      });
      fetchPropertyData();
    }
  };

  if (isLoading) {
    return (
      <Layout title="Property Details" subtitle="Loading...">
        <div className="space-y-6">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (!property) {
    return null;
  }

  const occupancyRate = property.units > 0 ? Math.round((property.occupied / property.units) * 100) : 0;
  const unitsData = getUnitsWithTenants();
  const outstandingTotal = Object.values(tenantBalances).reduce((sum, value) => sum + value, 0);
  const activeRent = leases
    .filter((lease) => lease.status === "active")
    .reduce((sum, lease) => sum + Number(lease.monthly_rent || 0), 0);
  const rentValue = activeRent > 0 ? activeRent : property.revenue;
  const occupants = tenants.map((t) => {
    const lease = leases.find((l) => l.tenant_id === t.id);
    return {
      unitNumber: (t.unit || lease?.unit || "").trim(),
      tenantName: t.name,
      leaseStatus: lease?.status ?? null,
      leaseEndDate: lease?.end_date ?? null,
      balance: tenantBalances[t.id] ?? 0,
    };
  }).filter((o) => o.unitNumber);

  const GOLDEN_PATH = [
    { id: "units", label: "Unit" },
    { id: "tenants", label: "Tenant" },
    { id: "leases", label: "Lease" },
    { id: "billing", label: "Invoice & payment" },
  ] as const;

  return (
    <Layout
      title={property.name}
      subtitle={property.address}
      status={
        <span className={cn("capitalize", statusBadgeClass(property.status === "inactive" ? "neutral" : "success"))}>
          {property.status || "active"}
        </span>
      }
      headerActions={
        <div className="flex flex-wrap gap-2">
          <Button className="min-h-11" onClick={() => setIsAddTenantOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Add tenant
          </Button>
          <Button variant="outline" className="min-h-11" onClick={() => navigate(propertyListPath)}>
            <ArrowLeft className="h-4 w-4" />
            {propertyListPath.endsWith("/portfolio") ? "Portfolio" : "Properties"}
          </Button>
        </div>
      }
    >
      <section className="mb-6 min-w-0" aria-labelledby="property-summary">
        <h2 id="property-summary" className="sr-only">Property summary</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard compact title="Units" value={String(property.units)} change={`${property.occupied} occupied`} changeType="neutral" icon={Home} iconColor="primary" />
          <StatCard compact title="Occupancy" value={`${occupancyRate}%`} icon={Building2} iconColor={occupancyRate >= 70 ? "success" : "destructive"} progressValue={occupancyRate} />
          <StatCard compact title="Rent" value={formatCurrency(rentValue)} change={activeRent > 0 ? "Active leases" : undefined} changeType="neutral" icon={DollarSign} iconColor="primary" />
          <StatCard compact title="Outstanding" value={formatCurrency(outstandingTotal)} changeType={outstandingTotal > 0 ? "negative" : "neutral"} icon={AlertTriangle} iconColor={outstandingTotal > 0 ? "destructive" : "neutral"} />
          <StatCard compact title="Maintenance" value={String(maintenanceOpenCount)} change={maintenanceOpenCount > 0 ? "Open work orders" : "No open work"} changeType={maintenanceOpenCount > 0 ? "negative" : "neutral"} icon={Wrench} iconColor={maintenanceOpenCount > 0 ? "warning" : "neutral"} />
        </div>
      </section>

      <DashboardSectionHeader eyebrow="Property workspace" title="Manage this property" description="Move from units to tenants, leases and billing without losing context." />

      {/* Tabs for Property Details */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground mr-1">Path</span>
        {GOLDEN_PATH.map((step, index) => (
          <span key={step.id} className="inline-flex items-center gap-1.5">
            {index > 0 && <span className="text-border">→</span>}
            <button
              type="button"
              onClick={() => setActiveTab(step.id)}
              className={cn(
                "rounded-full px-2.5 py-1 border transition-colors",
                activeTab === step.id
                  ? "bg-primary/10 text-primary border-primary/20 font-semibold"
                  : "bg-card border-border hover:border-primary/30"
              )}
            >
              {step.label}
            </button>
          </span>
        ))}
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-2 flex-wrap h-auto gap-1 bg-muted/40 p-1">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="units" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Units
          </TabsTrigger>
          <TabsTrigger value="tenants" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Tenants
          </TabsTrigger>
          <TabsTrigger value="leases" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Leases
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Maintenance
          </TabsTrigger>
          <TabsTrigger value="agreements" className="flex items-center gap-2">
            <FileSignature className="h-4 w-4" />
            Documents
          </TabsTrigger>
        </TabsList>
        <div className="mb-2 mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Operations & records</div>
        <TabsList className="mb-4 flex-wrap h-auto gap-1 bg-transparent p-0">
          <TabsTrigger value="vacation" className="flex items-center gap-2 h-8 text-xs">
            <CalendarX className="h-3.5 w-3.5" />
            Vacation
          </TabsTrigger>
          <TabsTrigger value="water" className="flex items-center gap-2 h-8 text-xs">
            <Droplets className="h-3.5 w-3.5" />
            Water
          </TabsTrigger>
          <TabsTrigger value="statement" className="flex items-center gap-2 h-8 text-xs">
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Statement
          </TabsTrigger>
          <TabsTrigger value="landlord" className="flex items-center gap-2 h-8 text-xs">
            <User className="h-3.5 w-3.5" />
            Landlord
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2 h-8 text-xs">
            <Settings2 className="h-3.5 w-3.5" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2 h-8 text-xs">
            <History className="h-3.5 w-3.5" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="rounded-xl border border-border bg-card p-4 card-shadow">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden border border-border">
                  {property.image_url ? (
                    <img src={property.image_url} alt="" className="h-16 w-16 object-cover" />
                  ) : (
                    <Building2 className="h-7 w-7 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 space-y-1">
                  {property.house_number && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Hash className="h-4 w-4" /> House No: {property.house_number}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {(property as {category_key?: string}).category_key && (
                      <Badge variant="outline" className="text-xs">
                        {((property as {category_key?: string}).category_key as string).replace(/_/g, " ")}
                      </Badge>
                    )}
                    {(property as {is_gated?: boolean}).is_gated && (
                      <Badge variant="outline" className="text-xs gap-1"><ShieldCheck className="h-3 w-3" /> Gated</Badge>
                    )}
                    {(property as {has_lift?: boolean}).has_lift && (
                      <Badge variant="outline" className="text-xs gap-1"><MoveVertical className="h-3 w-3" /> Lift</Badge>
                    )}
                    {(property as {has_backup_power?: boolean}).has_backup_power && (
                      <Badge variant="outline" className="text-xs gap-1"><Zap className="h-3 w-3" /> Generator</Badge>
                    )}
                    {(property as {has_borehole?: boolean}).has_borehole && (
                      <Badge variant="outline" className="text-xs gap-1"><Droplets className="h-3 w-3" /> Borehole</Badge>
                    )}
                    {(property as {is_furnished_units?: boolean}).is_furnished_units && (
                      <Badge variant="outline" className="text-xs gap-1"><Sofa className="h-3 w-3" /> Furnished</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 card-shadow space-y-3">
              <p className="text-sm font-semibold text-foreground">Occupancy snapshot</p>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Active tenants</span>
                <span className={statusBadgeClass("success")}>{tenants.filter((t) => t.status === "active").length}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Active leases</span>
                <span className={statusBadgeClass("info")}>{leases.filter((l) => l.status === "active").length}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Vacant units</span>
                <span className={statusBadgeClass("warning")}>{Math.max(0, property.units - property.occupied)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Expiring leases</span>
                <span className={statusBadgeClass("warning")}>{leases.filter((l) => l.status === "expiring").length}</span>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="units">
          <UnitManagement 
            propertyId={property.id} 
            propertyName={property.name}
            houseLabelPrefix={(property as {house_label_prefix?: string}).house_label_prefix || ""}
            onUnitsChange={fetchPropertyData}
            occupants={occupants}
            onOpenTab={setActiveTab}
          />
        </TabsContent>

        <TabsContent value="tenants">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Home className="h-5 w-5 text-muted-foreground" />
                Tenants & Leases
              </CardTitle>
            </CardHeader>
            <CardContent>
              {unitsData.length === 0 ? (
                <div className="text-center py-12">
                  <Home className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No tenants assigned to this property</p>
                  <div className="flex justify-center gap-2 mt-4">
                    <Button onClick={() => setIsAddTenantOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add New Tenant
                    </Button>
                    <Button variant="outline" onClick={() => setIsAssignDialogOpen(true)}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Assign Existing
                    </Button>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Unit</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Lease</TableHead>
                      <TableHead>Rent</TableHead>
                      <TableHead>Next</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unitsData.map(([unit, { tenant, lease }]) => (
                      <TableRow key={unit}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "h-8 w-8 rounded-lg flex items-center justify-center text-xs font-medium",
                              tenant ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                            )}>
                              <Home className="h-4 w-4" />
                            </div>
                            <span className="font-medium">{unit}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {tenant ? (
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={signedUrls[tenant.id]} alt={tenant.name} />
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                  {getInitials(tenant.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-sm">{tenant.name}</p>
                                {tenant.email && (
                                  <p className="text-xs text-muted-foreground truncate max-w-[180px]">{tenant.email}</p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm italic">Vacant</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {lease ? (
                            <span className={cn("capitalize", statusStyles[lease.status] || statusStyles.inactive)}>
                              {lease.status}
                            </span>
                          ) : tenant ? (
                            <span className={statusBadgeClass("warning")}>No lease</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {lease ? (
                            <span className="font-medium text-foreground">
                              {formatCurrency(lease.monthly_rent)}/mo
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {!tenant ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-primary"
                              onClick={() => {
                                setAssignUnit(unit);
                                setIsAssignDialogOpen(true);
                              }}
                            >
                              Assign tenant
                            </Button>
                          ) : !lease ? (
                            <Button variant="ghost" size="sm" className="h-8 px-2 text-primary" onClick={() => setActiveTab("leases")}>
                              Create lease
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" className="h-8 px-2 text-primary" onClick={() => setActiveTab("billing")}>
                              Invoice / collect
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {tenant ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleRemoveTenant(tenant.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setAssignUnit(unit);
                                setIsAssignDialogOpen(true);
                              }}
                            >
                              <UserPlus className="h-4 w-4 mr-1" />
                              Assign
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leases">
          <PropertyLeasesTab 
            leases={leases} 
            tenants={tenants.map(t => ({ id: t.id, name: t.name }))} 
          />
        </TabsContent>

        <TabsContent value="billing">
          <div className="space-y-6">
            <PropertyBillingConfig propertyId={property.id} propertyName={property.name} />
            <PropertyBillingTab propertyId={property.id} propertyName={property.name} />
          </div>
        </TabsContent>

        <TabsContent value="agreements">
          <PropertyAgreementsTab propertyId={property.id} propertyName={property.name} />
        </TabsContent>

        <TabsContent value="maintenance">
          <PropertyMaintenanceTab propertyName={property.name} />
        </TabsContent>

        <TabsContent value="vacation">
          <PropertyVacationNoticesTab propertyId={property.id} propertyName={property.name} />
        </TabsContent>

        <TabsContent value="water">
          <WaterBillingManager propertyId={property.id} propertyName={property.name} />
        </TabsContent>

        <TabsContent value="statement">
          <div className="space-y-6">
            <PropertyCollectionStatement propertyId={property.id} propertyName={property.name} />
            <PropertyStatementTab propertyId={property.id} propertyName={property.name} />
          </div>
        </TabsContent>

        <TabsContent value="landlord">
          <PropertyLandlordTab propertyId={property.id} />
        </TabsContent>

        <TabsContent value="settings">
          <PropertySettingsTab propertyId={property.id} propertyName={property.name} />
        </TabsContent>

        <TabsContent value="history">
          <PropertyHistory propertyId={property.id} />
        </TabsContent>
      </Tabs>

      {/* Add Tenant Dialog */}
      <AddTenantToPropertyDialog
        propertyId={property.id}
        propertyName={property.name}
        isOpen={isAddTenantOpen}
        onOpenChange={setIsAddTenantOpen}
        onTenantAdded={fetchPropertyData}
      />

      {/* Assign Existing Tenant Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Existing Tenant</DialogTitle>
            <DialogDescription>
              Select an unassigned tenant and assign them to a unit in {property.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tenant">Tenant</Label>
              <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a tenant" />
                </SelectTrigger>
                <SelectContent>
                  {allTenants.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No unassigned tenants available
                    </SelectItem>
                  ) : (
                    allTenants.map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        {tenant.name} ({tenant.email})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unit Number</Label>
              <Input
                id="unit"
                value={assignUnit}
                onChange={(e) => setAssignUnit(e.target.value)}
                placeholder="e.g., Unit 1, A101, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignTenant} disabled={isAssigning || !selectedTenantId}>
              {isAssigning ? "Assigning..." : "Assign Tenant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default PropertyDetail;
