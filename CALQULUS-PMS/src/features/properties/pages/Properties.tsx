// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { logError, toUserFacingError } from "@/shared/lib/errorLogger";
import { Link } from "react-router-dom";
import { Layout } from "@/shared/components/layout/Layout";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Progress } from "@/shared/components/ui/progress";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { Plus, Building2, Search, ArrowUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { ImageUpload } from "@/shared/components/ui/image-upload";
import { FormSection } from "@/shared/components/ui/form-section";
import { useToast } from "@/shared/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { propertySchema, formatValidationErrors } from "@/shared/lib/validations";
import { useActivityLog } from "@/shared/hooks/useActivityLog";
import { useViewOnly } from "@/shared/contexts/ViewOnlyContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CATEGORY_BY_KEY, CATEGORIES_BY_GROUP, GROUP_LABELS, PROPERTY_CATEGORIES } from "@/shared/constants/propertyTypes";
import { PropertyTableRow, type Property, type Tenant } from "@/features/properties/components/PropertyTableRow";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { useAuth } from "@/features/auth/AuthContext";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { LoadingState } from "@/shared/components/ui/loading-state";
import { ErrorState } from "@/shared/components/ui/error-state";
import { paginate } from "@/shared/lib/clientTable";
import { TablePager } from "@/shared/components/ui/table-pager";
import { DataTableFrame } from "@/shared/components/ui/data-table-frame";
import { loadFormDraft, saveFormDraft, clearFormDraft } from "@/shared/lib/formDraft";
import { trackTimeToFirst } from "@/features/dashboard/lib/activationMetrics";
import { invalidateManagerActivation } from "@/features/dashboard/hooks/useManagerActivation";
import { invalidateDashboardQueries } from "@/shared/lib/invalidateDashboards";
import { DashboardSectionHeader } from "@/features/dashboard/components/DashboardSectionHeader";
import { MetricCard } from "@/shared/components/ui/metric-card";
import { SearchFilterBar } from "@/shared/components/ui/search-filter-bar";
import { Home, Users, WalletCards } from "lucide-react";

const EMPTY_PROPERTY_FORM = {
  name: "",
  address: "",
  house_number: "",
  house_label_prefix: "",
  units: "",
  image_url: "",
  property_type: "flat",
  number_of_floors: "",
  rent_per_house: "",
  payment_details: "",
};

const Properties = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();
  const { isViewOnly } = useViewOnly();
  const { managerId, restrictToAssignedProperties, assignedPropertyIds } = useManagerScope();
  const assignedPropertyIdsKey = assignedPropertyIds.join(',');

  // Check property limit from subscription tier
  const { data: subProfile } = useQuery({
    queryKey: ['manager-sub-profile', managerId],
    queryFn: async () => {
      const { data } = await (supabase.from('manager_profiles')
        .select('max_properties, property_count, subscription_tier')
        .eq('manager_user_id', managerId!).maybeSingle());
      return data as {max_properties?: number; property_count?: number; subscription_tier?: string} | null;
    },
    enabled: !!managerId,
  });
  const atPropertyLimit = subProfile
    ? (subProfile.property_count ?? 0) >= (subProfile.max_properties ?? 5)
    : false;
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [propertyPage, setPropertyPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newProperty, setNewProperty] = useState(() => loadFormDraft<typeof EMPTY_PROPERTY_FORM>("new-property") ?? EMPTY_PROPERTY_FORM);

  // Edit state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editProperty, setEditProperty] = useState<Property | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    address: "",
    house_number: "",
    house_label_prefix: "",
    units: "",
    occupied: "",
    revenue: "",
    image_url: "",
    property_type: "flat",
    number_of_floors: "",
    rent_per_house: "",
    payment_details: "",
  });

  // Delete state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteProperty, setDeleteProperty] = useState<Property | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Occupancy filter state
  const [filterOccupancy, setFilterOccupancy] = useState<string>("all");

  // Sort state
  const [sortBy, setSortBy] = useState<"name" | "units" | "occupancy" | "revenue">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const fetchData = useCallback(async () => {
    if (!managerId) {
      setProperties([]);
      setTenants([]);
      setIsLoading(false);
      return;
    }
    if (restrictToAssignedProperties && assignedPropertyIds.length === 0) {
      setProperties([]);
      setTenants([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      let propertiesQuery = supabase
        .from("properties")
        .select("*")
        .eq("manager_id", managerId)
        .neq("status", "inactive")
        .order("created_at", { ascending: false });
      let tenantsQuery = supabase
        .from("tenants")
        .select("id, name, email, unit, property_id, status")
        .eq("manager_id", managerId)
        .order("name", { ascending: true });

      if (restrictToAssignedProperties) {
        propertiesQuery = propertiesQuery.in("id", assignedPropertyIds);
        tenantsQuery = tenantsQuery.in("property_id", assignedPropertyIds);
      }

      const [propertiesRes, tenantsRes] = await Promise.all([
        propertiesQuery,
        tenantsQuery,
      ]);

      if (propertiesRes.error) {
        setLoadError(propertiesRes.error.message || "Failed to fetch properties");
        toast({ title: "Error", description: propertiesRes.error.message || "Failed to fetch properties", variant: "destructive" });
      } else {
        setProperties(propertiesRes.data || []);
      }

      if (!tenantsRes.error) {
        setTenants(tenantsRes.data || []);
      }
    } catch (err) {
      logError('Properties.fetchData', err);
      setLoadError("Failed to load data. Please try again.");
      toast({ title: "Error", description: "Failed to load data. Please try again.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [assignedPropertyIds, managerId, restrictToAssignedProperties, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    saveFormDraft("new-property", newProperty);
  }, [newProperty]);

  const handleAddProperty = async () => {
    if (!managerId) {
      toast({
        title: "Error",
        description: "You must be signed in to add a property.",
        variant: "destructive",
      });
      return;
    }

    const validationResult = propertySchema.safeParse(newProperty);
    if (!validationResult.success) {
      toast({ title: "Validation Error", description: formatValidationErrors(validationResult.error), variant: "destructive" });
      return;
    }

    // Enforce the tier/category limit that check_tier_allows_property was
    // built for — previously only a cosmetic "Enterprise"/"Pro+" badge was
    // shown next to restricted categories with nothing actually blocking
    // selection, so any tier could create any category of property.
    const { data: tierAllows, error: tierCheckError } = await supabase.rpc(
      'check_tier_allows_property' as unknown as string,
      { p_manager_id: managerId, p_category_key: newProperty.property_type || 'flat' }
    );
    if (tierCheckError) {
      toast({ title: "Couldn't verify plan limits", description: tierCheckError.message, variant: "destructive" });
      return;
    }
    if (tierAllows === false) {
      toast({
        title: "Not available on your plan",
        description: "This property type requires a higher subscription tier. Upgrade at Platform Billing to add it.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.rpc('create_property_atomic' as never, {
      p_name: validationResult.data.name, p_address: validationResult.data.address,
      p_house_number: newProperty.house_number.trim() || null,
      p_house_label_prefix: newProperty.house_label_prefix.trim() || null,
      p_units: validationResult.data.units ? parseInt(validationResult.data.units) : 0,
      p_image_url: validationResult.data.image_url || null, p_property_type: newProperty.property_type || 'flat',
      p_number_of_floors: newProperty.number_of_floors ? parseInt(newProperty.number_of_floors) : 1,
      p_rent_per_house: newProperty.rent_per_house ? parseFloat(newProperty.rent_per_house) : 0,
      p_payment_details: newProperty.payment_details.trim() || null, p_manager_id: managerId,
    });

    if (error) {
      logError("properties.create", error);
      toast({
        title: "Property creation failed",
        description: toUserFacingError(error, "Could not add this property. Check your plan limits and try again."),
        variant: "destructive",
      });
    } else {
      successToast({ title: "Property Added", description: `${validationResult.data.name} has been added successfully.` });
      logActivity({
        action: 'Created property',
        entityType: 'property',
        details: { name: validationResult.data.name, address: validationResult.data.address }
      });
      trackTimeToFirst("property", { managerId, signupAt: user?.created_at });
      invalidateManagerActivation(queryClient);
      invalidateDashboardQueries(queryClient);
      clearFormDraft("new-property");
      setNewProperty(EMPTY_PROPERTY_FORM);
      setIsDialogOpen(false);
      fetchData();
    }
    setIsSaving(false);
  };

  const openEditDialog = (property: Property) => {
    setEditProperty(property);
    setEditFormData({
      name: property.name,
      address: property.address,
      house_number: property.house_number || "",
      house_label_prefix: property.house_label_prefix || "",
      units: property.units.toString(),
      occupied: property.occupied.toString(),
      revenue: property.revenue.toString(),
      image_url: property.image_url || "",
      property_type: property.property_type || "flat",
      number_of_floors: property.number_of_floors?.toString() || "1",
      rent_per_house: property.rent_per_house?.toString() || "0",
      payment_details: property.payment_details || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateProperty = async () => {
    if (!editProperty) return;

    const validationResult = propertySchema.safeParse({
      name: editFormData.name,
      address: editFormData.address,
      units: editFormData.units,
      image_url: editFormData.image_url,
    });
    if (!validationResult.success) {
      toast({ title: "Validation Error", description: formatValidationErrors(validationResult.error), variant: "destructive" });
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.rpc('update_property_atomic' as never, {
      p_property_id: editProperty.id,
      p_payload: { name: validationResult.data.name, address: validationResult.data.address,
        house_number: editFormData.house_number, house_label_prefix: editFormData.house_label_prefix,
        units: validationResult.data.units ? parseInt(validationResult.data.units) : 0, image_url: validationResult.data.image_url || null,
        property_type: editFormData.property_type || 'flat', number_of_floors: editFormData.number_of_floors ? parseInt(editFormData.number_of_floors) : 1,
        rent_per_house: editFormData.rent_per_house ? parseFloat(editFormData.rent_per_house) : 0, payment_details: editFormData.payment_details }
    });

    if (error) {
      toast({ title: "Error", description: "Failed to update property", variant: "destructive" });
    } else {
      successToast({ title: "Property Updated", description: `${validationResult.data.name} has been updated successfully.` });
      logActivity({
        action: 'Updated property',
        entityType: 'property',
        entityId: editProperty.id,
        details: { name: validationResult.data.name }
      });
      invalidateDashboardQueries(queryClient);
      setIsEditDialogOpen(false);
      setEditProperty(null);
      fetchData();
    }
    setIsSaving(false);
  };

  const openDeleteDialog = (property: Property) => {
    setDeleteProperty(property);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteProperty = async () => {
    if (!deleteProperty) return;

    setIsDeleting(true);
    const { error } = await supabase.rpc('transition_property_atomic' as never, { p_property_id: deleteProperty.id, p_status: 'inactive' });

    if (error) {
      toast({ title: "Error", description: "Failed to deactivate property", variant: "destructive" });
    } else {
      successToast({ title: "Property Deactivated", description: `${deleteProperty.name} has been deactivated and moved to history.` });
      logActivity({
        action: 'Deactivated property',
        entityType: 'property',
        entityId: deleteProperty.id,
        details: { name: deleteProperty.name }
      });
      if (managerId) supabase.rpc('refresh_manager_stats', { p_manager_id: managerId }).catch(() => {});
      invalidateDashboardQueries(queryClient);
      fetchData();
    }
    setIsDeleting(false);
    setIsDeleteDialogOpen(false);
    setDeleteProperty(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const PROPERTY_PAGE_SIZE = 9;

  const filteredProperties = useMemo(() => {
    let filtered = properties;
    
    // Apply occupancy filter
    if (filterOccupancy !== "all") {
      filtered = filtered.filter(property => {
        const rate = property.units > 0 ? (property.occupied / property.units) * 100 : 0;
        switch (filterOccupancy) {
          case "empty": return rate === 0;
          case "low": return rate > 0 && rate < 50;
          case "medium": return rate >= 50 && rate < 80;
          case "high": return rate >= 80 && rate < 100;
          case "full": return rate === 100;
          default: return true;
        }
      });
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(property =>
        property.name.toLowerCase().includes(query) ||
        property.address.toLowerCase().includes(query)
      );
    }
    
    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "units":
          comparison = a.units - b.units;
          break;
        case "occupancy": {
          const occA = a.units > 0 ? a.occupied / a.units : 0;
          const occB = b.units > 0 ? b.occupied / b.units : 0;
          comparison = occA - occB;
          break;
        }
        case "revenue":
          comparison = a.revenue - b.revenue;
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
    
    return filtered;
  }, [filterOccupancy, properties, searchQuery, sortBy, sortOrder]);

  const propertySlice = useMemo(
    () => paginate(filteredProperties, propertyPage, PROPERTY_PAGE_SIZE),
    [filteredProperties, propertyPage],
  );

  useEffect(() => {
    setPropertyPage(1);
  }, [searchQuery, filterOccupancy, sortBy, sortOrder]);

  const handleQuickAssignTenant = async (tenantId: string, propertyId: string, propertyName: string) => {
    const tenant = tenants.find(t => t.id === tenantId);
    if (!tenant) return;

    const { error } = await supabase.rpc('assign_tenant_unit_atomic' as never, { p_tenant_id: tenantId, p_property_id: propertyId, p_unit_id: null, p_unit_number: null });

    if (error) {
      toast({ title: "Error", description: "Failed to assign tenant", variant: "destructive" });
    } else {
      toast({ title: "Tenant Assigned", description: `${tenant.name} assigned to ${propertyName}` });
      fetchData();
    }
  };

  const handleUnassignTenant = async (tenantId: string, tenantName: string, propertyName: string) => {
    const { error } = await supabase.rpc('unassign_tenant_atomic' as never, { p_tenant_id: tenantId });

    if (error) {
      toast({ title: "Error", description: "Failed to unassign tenant", variant: "destructive" });
    } else {
      toast({ title: "Tenant Unassigned", description: `${tenantName} removed from ${propertyName}` });
      fetchData();
    }
  };


  return (
    <Layout title="Properties" subtitle="Buildings, units, and occupancy — open a property to manage tenants and leases."
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            className="min-h-11"
            onClick={() => atPropertyLimit
              ? toast({ title: 'Property limit reached', description: `Your ${subProfile?.subscription_tier ?? 'Starter'} plan allows ${subProfile?.max_properties ?? 5} properties. Upgrade at Platform Billing to add more.`, variant: 'destructive' })
              : setIsDialogOpen(true)
            }
            title={atPropertyLimit ? `Limit reached — upgrade to add more properties` : 'Add a new property'}
            aria-label="Add property"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add property</span>
          </Button>
          <Button variant="outline" size="sm" className="min-h-11" asChild>
            <Link to="/units">View units</Link>
          </Button>
        </div>
      }
    >
      <div className="mb-6">
        <DashboardSectionHeader
          eyebrow="Portfolio"
          title="Your properties"
          description="A clear view of the buildings, units and income you manage."
          action={
            <span className="hidden rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground sm:inline-flex">
              {properties.length} total
            </span>
          }
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Properties", value: properties.length, icon: Building2 },
            { label: "Units", value: properties.reduce((sum, p) => sum + p.units, 0), icon: Home },
            { label: "Occupied", value: properties.reduce((sum, p) => sum + p.occupied, 0), icon: Users },
            { label: "Revenue", value: formatCurrency(properties.reduce((sum, p) => sum + p.revenue, 0)), icon: WalletCards },
          ].map((item) => {
            const Icon = item.icon;
            return <MetricCard key={item.label} label={item.label} value={item.value} icon={Icon} />;
          })}
        </div>
      </div>

      {/* Clean toolbar */}
      <SearchFilterBar
        value={searchQuery}
        onValueChange={setSearchQuery}
        placeholder="Search properties"
        ariaLabel="Search properties"
        activeFilterCount={filterOccupancy !== "all" ? 1 : 0}
        onClearFilters={() => setFilterOccupancy("all")}
        summary={`${filteredProperties.length} properties · ${filteredProperties.reduce((sum, p) => sum + p.units, 0)} total units · ${formatCurrency(filteredProperties.reduce((sum, p) => sum + p.revenue, 0))} revenue`}
      >

          {/* Filters dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="min-h-11 gap-1.5" aria-label="Filter properties">
                <ArrowUpDown className="h-3.5 w-3.5" />
                Filters
                {filterOccupancy !== "all" && (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px] ml-1">1</Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 p-3 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Sort By</Label>
                <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
                  const [field, order] = value.split("-") as [typeof sortBy, typeof sortOrder];
                  setSortBy(field);
                  setSortOrder(order);
                }}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                    <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                    <SelectItem value="units-desc">Units (High-Low)</SelectItem>
                    <SelectItem value="occupancy-desc">Occupancy (High-Low)</SelectItem>
                    <SelectItem value="revenue-desc">Revenue (High-Low)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Occupancy</Label>
                <Select value={filterOccupancy} onValueChange={setFilterOccupancy}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="empty">Empty (0%)</SelectItem>
                    <SelectItem value="low">Low (&lt;50%)</SelectItem>
                    <SelectItem value="medium">Medium (50-79%)</SelectItem>
                    <SelectItem value="high">High (80-99%)</SelectItem>
                    <SelectItem value="full">Full (100%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {filterOccupancy !== "all" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs"
                  onClick={() => setFilterOccupancy("all")}
                >
                  Clear Filters
                </Button>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

      </SearchFilterBar>
      {/* Add Property Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-foreground">Add New Property</DialogTitle>
            <DialogDescription>Enter the property details to add it to your portfolio.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <FormSection title="Property identity" description="The core details used across your portfolio and tenant records.">
            <div className="grid gap-2">
              <Label htmlFor="name">Property Name <span aria-hidden="true">*</span></Label>
              <Input required autoComplete="organization" id="name" value={newProperty.name} onChange={(e) => setNewProperty({ ...newProperty, name: e.target.value })} placeholder="Sunset Apartments" className="bg-background border-border" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Address *</Label>
              <Input required autoComplete="street-address" id="address" value={newProperty.address} onChange={(e) => setNewProperty({ ...newProperty, address: e.target.value })} placeholder="1234 Main St, City, State ZIP" className="bg-background border-border" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="property-type">Property Type</Label>
                <Select value={newProperty.property_type} onValueChange={(value) => setNewProperty({ ...newProperty, property_type: value })}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Select property type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIES_BY_GROUP).map(([group, cats]) => (
                      <Fragment key={group}>
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border/50 mt-1">
                          {GROUP_LABELS[group]}
                        </div>
                        {cats.map(cat => (
                          <SelectItem key={cat.key} value={cat.key}>
                            <div className="flex items-center justify-between w-full gap-3">
                              <span>{cat.name}</span>
                              {cat.requiresTier !== 'lite' && (
                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cat.requiresTier === 'enterprise' ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'}`}>
                                  {cat.requiresTier === 'enterprise' ? 'Enterprise' : 'Pro+'}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </Fragment>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="floors">Number of Floors</Label>
                <Input id="floors" type="number" min="1" value={newProperty.number_of_floors} onChange={(e) => setNewProperty({ ...newProperty, number_of_floors: e.target.value })} placeholder="e.g., 3" className="bg-background border-border" />
              </div>
            </div>
            </FormSection>
            <FormSection title="Property setup" description="Define the unit structure and default rental information.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="units">Number of Units</Label>
                <Input id="units" type="number" value={newProperty.units} onChange={(e) => setNewProperty({ ...newProperty, units: e.target.value })} placeholder="24" className="bg-background border-border" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rent-per-house">Rent Per House</Label>
                <Input id="rent-per-house" type="number" min="0" value={newProperty.rent_per_house} onChange={(e) => setNewProperty({ ...newProperty, rent_per_house: e.target.value })} placeholder="e.g., 15000" className="bg-background border-border" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="house-number">House Number</Label>
                <Input id="house-number" value={newProperty.house_number} onChange={(e) => setNewProperty({ ...newProperty, house_number: e.target.value })} placeholder="e.g., B12, Plot 45" className="bg-background border-border" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="house-label-prefix">House Label Prefix</Label>
                <Input id="house-label-prefix" value={newProperty.house_label_prefix} onChange={(e) => setNewProperty({ ...newProperty, house_label_prefix: e.target.value })} placeholder="e.g., HSE, APT" className="bg-background border-border" />
              </div>
            </div>
            </FormSection>
            <FormSection title="Tenant-facing details" description="Optional instructions and imagery shown alongside the property record.">
            <div className="grid gap-2">
              <Label htmlFor="payment-details">Payment Details</Label>
              <Input id="payment-details" value={newProperty.payment_details} onChange={(e) => setNewProperty({ ...newProperty, payment_details: e.target.value })} placeholder="e.g., Pay via M-Pesa to 123456" className="bg-background border-border" />
              <p className="text-xs text-muted-foreground">Payment instructions shown to tenants</p>
            </div>
            <ImageUpload
              value={newProperty.image_url}
              onChange={(url) => setNewProperty({ ...newProperty, image_url: url })}
              bucket="property-images"
              folder={`managers/${user?.id ?? "unknown"}`}
              label="Property Image"
              placeholder="Upload or paste image URL"
            />
            </FormSection>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleAddProperty} className="btn-brand" loading={isSaving}>Add Property</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loadError && !isLoading && (
        <div className="mb-4">
          <ErrorState
            title="Couldn't load properties"
            message={loadError}
            onRetry={() => { void fetchData(); }}
          />
        </div>
      )}

      {/* Properties grid */}
      {isLoading ? (
        <LoadingState label="Loading properties…" variant="skeleton" rows={6} />
      ) : filteredProperties.length === 0 ? (
        searchQuery || filterOccupancy !== "all" ? (
          <EmptyState
            icon={Search}
            title={searchQuery ? `No properties matching “${searchQuery}”` : "No matching properties"}
            description="Try a different search or occupancy filter."
          />
        ) : (
          <EmptyState
            icon={Building2}
            title="Add your first property"
            description="This is the fastest path to first value: a building, then units, then a tenant you can invoice."
            actionLabel="Add a property"
            onAction={() => setIsDialogOpen(true)}
          />
        )
      ) : (
        <>
        <div className="overflow-hidden rounded-xl border border-border bg-card card-shadow">
          <DataTableFrame minWidth="min-w-[760px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Units</TableHead>
                <TableHead>Occupancy</TableHead>
                <TableHead>Tenants</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {propertySlice.items.map((property) => (
                <PropertyTableRow
                  key={property.id}
                  property={property}
                  tenantCount={tenants.filter((t) => t.property_id === property.id).length}
                  formatCurrency={formatCurrency}
                  onEdit={openEditDialog}
                  onDelete={openDeleteDialog}
                />
              ))}
            </TableBody>
          </Table>
          </DataTableFrame>
        </div>
        <div className="mt-3 rounded-xl border border-border overflow-hidden">
          <TablePager page={propertySlice} onPageChange={setPropertyPage} noun="properties" />
        </div>
        </>
      )}

      {/* Edit Property Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-heading text-foreground">Edit Property</DialogTitle>
            <DialogDescription>Update the property information.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <FormSection title="Property identity" description="Keep the portfolio record accurate and easy to recognize.">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Property Name <span aria-hidden="true">*</span></Label>
              <Input required autoComplete="organization" id="edit-name" value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} placeholder="Sunset Apartments" className="bg-background border-border" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-address">Address *</Label>
              <Input required autoComplete="street-address" id="edit-address" value={editFormData.address} onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })} placeholder="1234 Main St, City, State ZIP" className="bg-background border-border" />
            </div>
            </FormSection>
            <FormSection title="Property setup" description="Update the unit structure, type and default rental settings.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-house-number">House Number</Label>
                <Input id="edit-house-number" value={editFormData.house_number} onChange={(e) => setEditFormData({ ...editFormData, house_number: e.target.value })} placeholder="e.g., B12, Plot 45" className="bg-background border-border" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-house-label-prefix">House Label Prefix</Label>
                <Input id="edit-house-label-prefix" value={editFormData.house_label_prefix} onChange={(e) => setEditFormData({ ...editFormData, house_label_prefix: e.target.value })} placeholder="e.g., HSE, APT, Villa" className="bg-background border-border" />
                <p className="text-xs text-muted-foreground">Units will be labeled as PREFIX-001, PREFIX-002, etc.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-units">Units</Label>
                <Input id="edit-units" type="number" value={editFormData.units} onChange={(e) => setEditFormData({ ...editFormData, units: e.target.value })} className="bg-background border-border" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-occupied">Occupied</Label>
                <Input id="edit-occupied" type="number" value={editFormData.occupied} onChange={(e) => setEditFormData({ ...editFormData, occupied: e.target.value })} className="bg-background border-border" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-revenue">Revenue</Label>
                <Input id="edit-revenue" type="number" value={editFormData.revenue} onChange={(e) => setEditFormData({ ...editFormData, revenue: e.target.value })} className="bg-background border-border" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-property-type">Property Type</Label>
                <Select value={editFormData.property_type} onValueChange={(value) => setEditFormData({ ...editFormData, property_type: value })}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">Flat</SelectItem>
                    <SelectItem value="villa">Villa</SelectItem>
                    <SelectItem value="bungalow">Bungalow</SelectItem>
                    <SelectItem value="mixed_use">Mixed Use</SelectItem>
                    <SelectItem value="apartment">Apartment</SelectItem>
                    <SelectItem value="townhouse">Townhouse</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-floors">Number of Floors</Label>
                <Input id="edit-floors" type="number" min="1" value={editFormData.number_of_floors} onChange={(e) => setEditFormData({ ...editFormData, number_of_floors: e.target.value })} placeholder="e.g., 3" className="bg-background border-border" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-rent-per-house">Rent Per House</Label>
              <Input id="edit-rent-per-house" type="number" min="0" value={editFormData.rent_per_house} onChange={(e) => setEditFormData({ ...editFormData, rent_per_house: e.target.value })} placeholder="e.g., 15000" className="bg-background border-border" />
              <p className="text-xs text-muted-foreground">Default rent amount per house/unit</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-payment-details">Payment Details</Label>
              <Input id="edit-payment-details" value={editFormData.payment_details} onChange={(e) => setEditFormData({ ...editFormData, payment_details: e.target.value })} placeholder="e.g., Pay via M-Pesa to 123456, Acc: Property Name" className="bg-background border-border" />
              <p className="text-xs text-muted-foreground">Payment instructions shown to tenants</p>
            </div>
            </FormSection>
            <FormSection title="Tenant-facing details" description="Optional payment instructions and property imagery.">
            <ImageUpload
              value={editFormData.image_url}
              onChange={(url) => setEditFormData({ ...editFormData, image_url: url })}
              bucket="property-images"
              folder={`managers/${user?.id ?? "unknown"}`}
              label="Property Image"
              placeholder="Upload or paste image URL"
            />
            </FormSection>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleUpdateProperty} className="btn-brand" loading={isSaving}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Deactivate Property</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate <span className="font-semibold text-foreground">{deleteProperty?.name}</span>? The property will be moved to history and can be reactivated later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProperty} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" aria-label={`Deactivate ${deleteProperty?.name ?? "property"}`}>
              {isDeleting ? "Deactivating…" : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </Layout>
  );
};

export default Properties;
