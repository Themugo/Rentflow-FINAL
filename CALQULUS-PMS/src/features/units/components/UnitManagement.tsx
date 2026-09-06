import { useState, useEffect, Fragment, useCallback } from "react";


import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Home,
  Plus,
  Pencil,
  Trash2,
  Layers,
  History,
  Settings2,
  Images,
  ListChecks,
  Gauge,
  MoreHorizontal,
} from "lucide-react";
import UnitHistoryPanel from "@/features/units/components/UnitHistoryPanel";
import UnitBillingConfig from "@/features/units/components/UnitBillingConfig";
import { PaymentCollectionRoutingPanel } from "@/features/billing/components/PaymentCollectionRoutingPanel";
import UnitPhotoGallery from "@/features/units/components/UnitPhotoGallery";
import UnitAmenitiesManager from "@/features/units/components/UnitAmenitiesManager";
import UnitUtilityMeters from "@/features/units/components/UnitUtilityMeters";
import { useToast } from "@/shared/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/shared/lib/utils";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { invalidateManagerActivation } from "@/features/dashboard/hooks/useManagerActivation";
import { invalidateDashboardQueries } from "@/shared/lib/invalidateDashboards";
import { toUserFacingError } from "@/shared/lib/errorLogger";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ErrorState } from "@/shared/components/ui/error-state";
import { LoadingState } from "@/shared/components/ui/loading-state";
import { statusBadgeClass } from "@/shared/lib/statusBadge";

interface Unit {
  id: string;
  property_id: string;
  unit_number: string;
  label: string | null;
  unit_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  description: string | null;
  monthly_rent: number | null;
  house_deposit: number | null;
  water_deposit: number | null;
  floor_number: number | null;
  furnished: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface OccupantHint {
  unitNumber: string;
  tenantName: string | null;
  leaseStatus: string | null;
  leaseEndDate?: string | null;
  balance?: number;
}

interface UnitManagementProps {
  propertyId: string;
  propertyName: string;
  houseLabelPrefix?: string;
  onUnitsChange?: () => void;
  occupants?: OccupantHint[];
  onOpenTab?: (tab: string) => void;
}

const unitStatuses = [
  { value: "vacant", label: "Vacant" },
  { value: "occupied", label: "Occupied" },
  { value: "maintenance", label: "Maintenance" },
  { value: "reserved", label: "Reserved" },
];

const statusStyles: Record<string, string> = {
  vacant: statusBadgeClass("success"),
  occupied: statusBadgeClass("info"),
  maintenance: statusBadgeClass("warning"),
  reserved: statusBadgeClass("neutral"),
};

const leaseStatusStyles: Record<string, string> = {
  active: statusBadgeClass("success"),
  pending: statusBadgeClass("warning"),
  expiring: statusBadgeClass("warning"),
  inactive: statusBadgeClass("neutral"),
};

export function UnitManagement({ propertyId, propertyName, houseLabelPrefix, onUnitsChange, occupants = [], onOpenTab }: UnitManagementProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const queryClient = useQueryClient();
  
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [expandedBillingUnitId, setExpandedBillingUnitId] = useState<string | null>(null);
  const [expandedHistoryUnitId, setExpandedHistoryUnitId] = useState<string | null>(null);
  const [expandedPhotosUnitId, setExpandedPhotosUnitId] = useState<string | null>(null);
  const [expandedAmenitiesUnitId, setExpandedAmenitiesUnitId] = useState<string | null>(null);
  const [expandedMetersUnitId, setExpandedMetersUnitId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [unitNumber, setUnitNumber] = useState("");
  const [unitLabel, setUnitLabel] = useState("");
  const [unitType, setUnitType] = useState("standard");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [squareFeet, setSquareFeet] = useState("");
  const [description, setDescription] = useState("");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [houseDeposit, setHouseDeposit] = useState("");
  const [waterDeposit, setWaterDeposit] = useState("");
  const [floorNumber, setFloorNumber] = useState("");
  const [furnished, setFurnished] = useState("unfurnished");
  const [status, setStatus] = useState("vacant");

  // Bulk create state
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPrefix, setBulkPrefix] = useState("R");
  const [bulkStart, setBulkStart] = useState("1");
  const [bulkCount, setBulkCount] = useState("10");
  const [bulkRent, setBulkRent] = useState("");
  const [bulkCreating, setBulkCreating] = useState(false);
  const [coverPhotos, setCoverPhotos] = useState<Record<string, string>>({});

  const fetchUnits = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from('units')
      .select("*")
      .eq("property_id", propertyId)
      .order("unit_number");

    if (error) {
      setLoadError("Failed to load units");
      toast({
        title: "Error",
        description: "Failed to load units",
        variant: "destructive",
      });
    } else {
      setUnits((data as unknown as Unit[]) || []);
    }
    setIsLoading(false);
  }, [propertyId, toast]);

  // One batched query for every unit's cover photo, rather than a query per
  // row — keeps this to a single round trip regardless of how many units
  // the property has.
  const fetchCoverPhotos = useCallback(async () => {
    const { data } = await (supabase.from('unit_photos') as any)
      .select('unit_id, photo_url')
      .eq('property_id', propertyId)
      .eq('is_cover', true);
    const map: Record<string, string> = {};
    (data || []).forEach((row: { unit_id: string; photo_url: string }) => {
      map[row.unit_id] = row.photo_url;
    });
    setCoverPhotos(map);
  }, [propertyId]);

  useEffect(() => {
    fetchCoverPhotos();
  }, [propertyId, fetchCoverPhotos]);

  useEffect(() => {
    fetchUnits();
  }, [propertyId, fetchUnits]);

  const resetForm = () => {
    setUnitNumber("");
    setUnitLabel("");
    setUnitType("standard");
    setBedrooms("");
    setBathrooms("");
    setSquareFeet("");
    setDescription("");
    setMonthlyRent("");
    setHouseDeposit("");
    setWaterDeposit("");
    setFloorNumber("");
    setFurnished("unfurnished");
    setStatus("vacant");
    setSelectedUnit(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (unit: Unit) => {
    setSelectedUnit(unit);
    setUnitNumber(unit.unit_number);
    setUnitLabel(unit.label || "");
    setUnitType(unit.unit_type || "standard");
    setBedrooms(unit.bedrooms?.toString() || "");
    setBathrooms(unit.bathrooms?.toString() || "");
    setSquareFeet(unit.square_feet?.toString() || "");
    setDescription(unit.description || "");
    setMonthlyRent(unit.monthly_rent?.toString() || "");
    setHouseDeposit(unit.house_deposit?.toString() || "");
    setWaterDeposit(unit.water_deposit?.toString() || "");
    setFloorNumber(unit.floor_number?.toString() || "");
    setFurnished(unit.furnished || "unfurnished");
    setStatus(unit.status);
    setIsDialogOpen(true);
  };

  const openDeleteDialog = (unit: Unit) => {
    setSelectedUnit(unit);
    setIsDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "You must be signed in to manage units.",
        variant: "destructive",
      });
      return;
    }

    if (!unitNumber.trim()) {
      toast({
        title: "Error",
        description: "House number is required",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    const unitData = {
      property_id:    propertyId,
      unit_number:    unitNumber.trim(),
      label:          unitLabel.trim() || unitNumber.trim(),
      unit_type:      unitType,
      bedrooms:       bedrooms ? parseInt(bedrooms) : null,
      bathrooms:      bathrooms ? parseFloat(bathrooms) : null,
      square_feet:    squareFeet ? parseInt(squareFeet) : null,
      description:    description.trim() || null,
      monthly_rent:   monthlyRent ? parseFloat(monthlyRent) : null,
      house_deposit:  houseDeposit ? parseFloat(houseDeposit) : null,
      water_deposit:  waterDeposit ? parseFloat(waterDeposit) : null,
      floor_number:   floorNumber ? parseInt(floorNumber) : null,
      furnished,
      status,
    };

    const syncRentCharge = async (unitId: string, rent: number | null) => {
      if (!rent || rent <= 0) return;

      const { data: existingCharge, error: chargeLookupError } = await supabase
        .from("unit_charge_configs")
        .select("id")
        .eq("unit_id", unitId)
        .eq("charge_type", "rent")
        .maybeSingle();
      if (chargeLookupError) throw chargeLookupError;

      const chargePayload = {
        unit_id: unitId,
        property_id: propertyId,
        manager_id: user.id,
        charge_type: "rent",
        charge_label: "Monthly Rent",
        amount: rent,
        is_active: true,
        is_metered: false,
        billing_cycle: "monthly",
        auto_generate: true,
      };

      const { error: chargeError } = await supabase.rpc("save_unit_charge_config_atomic", {
        p_unit_id: unitId, p_charge_type: chargePayload.charge_type, p_charge_label: chargePayload.charge_label,
        p_amount: chargePayload.amount, p_is_metered: chargePayload.is_metered, p_billing_cycle: chargePayload.billing_cycle,
        p_auto_generate: chargePayload.auto_generate, p_notes: null, p_charge_id: existingCharge?.id ?? null,
      });
      if (chargeError) throw chargeError;
    };

    if (selectedUnit) {
      // Update
      const { error } = await supabase.rpc('save_unit_atomic' as never, {
        p_unit_id: selectedUnit.id, p_property_id: propertyId, p_unit_number: unitData.unit_number, p_payload: unitData
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message || "Failed to update unit",
          variant: "destructive",
        });
      } else {
        try {
          await syncRentCharge(selectedUnit.id, unitData.monthly_rent);
        } catch (chargeError) {
          toast({
            title: "Unit Updated",
            description: chargeError instanceof Error ? `Saved unit, but rent charge sync failed: ${chargeError.message}` : "Saved unit, but rent charge sync failed.",
            variant: "destructive",
          });
        }
        toast({
          title: "Unit Updated",
          description: `Unit ${unitNumber} has been updated.`,
        });
        invalidateDashboardQueries(queryClient);
        setIsDialogOpen(false);
        resetForm();
        fetchUnits();
        onUnitsChange?.();
      }
    } else {
      // Create
      const { data: createdUnit, error } = await supabase.rpc('save_unit_atomic' as never, {
        p_unit_id: null, p_property_id: propertyId, p_unit_number: unitData.unit_number, p_payload: unitData
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message.includes("unique")
            ? "A unit with this number already exists"
            : toUserFacingError(error, "Could not create this unit. Your details are still here — try again."),
          variant: "destructive",
        });
      } else {
        try {
          if (createdUnit?.id) await syncRentCharge(createdUnit.id, unitData.monthly_rent);
        } catch (chargeError) {
          toast({
            title: "Unit Created",
            description: chargeError instanceof Error ? `Created unit, but rent charge sync failed: ${chargeError.message}` : "Created unit, but rent charge sync failed.",
            variant: "destructive",
          });
        }
        toast({
          title: "Unit Created",
          description: `Unit ${unitNumber} has been added to ${propertyName}.`,
        });
        invalidateManagerActivation(queryClient);
        invalidateDashboardQueries(queryClient);
        setIsDialogOpen(false);
        resetForm();
        fetchUnits();
        onUnitsChange?.();
      }
    }

    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!selectedUnit) return;

    const { error } = await supabase.rpc('transition_unit_atomic' as never, { p_unit_id: selectedUnit.id, p_status: 'inactive' });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to deactivate unit",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Unit Deactivated",
        description: `Unit ${selectedUnit.unit_number} has been deactivated and moved to history.`,
      });
      setIsDeleteDialogOpen(false);
      setSelectedUnit(null);
      invalidateDashboardQueries(queryClient);
      fetchUnits();
      onUnitsChange?.();
    }
  };

  const vacantCount = units.filter((u) => u.status === "vacant").length;
  const occupiedCount = units.filter((u) => u.status === "occupied").length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5 text-muted-foreground" />
            Units
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {units.length} houses • {vacantCount} vacant • {occupiedCount} occupied
            {houseLabelPrefix && <span className="ml-1">(Prefix: <strong>{houseLabelPrefix}</strong>)</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
            <Layers className="h-4 w-4 mr-2" />
            Bulk create
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add House
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingState label="Loading units…" variant="skeleton" rows={5} />
        ) : loadError ? (
          <ErrorState title="Couldn't load units" message={loadError} onRetry={() => { void fetchUnits(); }} />
        ) : units.length === 0 ? (
          <EmptyState
            icon={Home}
            title="No units yet"
            description="Add the first unit on this property."
            actionLabel="Add unit"
            onAction={openCreateDialog}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rent</TableHead>
                <TableHead>Lease</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((unit) => {
                const occupant = occupants.find(
                  (o) => o.unitNumber.toLowerCase() === unit.unit_number.toLowerCase()
                );
                const next = !occupant?.tenantName
                  ? { label: "Assign tenant", tab: "tenants" }
                  : !occupant.leaseStatus
                    ? { label: "Create lease", tab: "leases" }
                    : { label: "Invoice / collect", tab: "billing" };
                return (
                <Fragment key={unit.id}>
                  <TableRow>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {coverPhotos[unit.id] ? (
                          <img
                            src={coverPhotos[unit.id]}
                            alt=""
                            className="h-8 w-8 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-medium bg-muted text-muted-foreground">
                            <Home className="h-4 w-4" />
                          </div>
                        )}
                        <span className="font-medium">{unit.unit_number}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {occupant?.tenantName ? (
                        <span className="text-sm font-medium text-foreground">{occupant.tenantName}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">Vacant</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={cn("capitalize", statusStyles[unit.status] || statusStyles.vacant)}>
                        {unit.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {unit.monthly_rent ? (
                        <span className="font-medium text-foreground">
                          {formatCurrency(unit.monthly_rent)}/mo
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {occupant?.leaseStatus ? (
                        <div className="flex flex-col">
                          <span className={cn("capitalize text-xs w-fit", leaseStatusStyles[occupant.leaseStatus] || statusBadgeClass("neutral"))}>
                            {occupant.leaseStatus}
                          </span>
                          {occupant.leaseEndDate && (
                            <span className="text-[11px] text-muted-foreground mt-0.5">
                              Ends {new Date(occupant.leaseEndDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {occupant?.balance ? (
                        <span className="font-medium text-destructive">{formatCurrency(occupant.balance)}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Unit actions">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onOpenTab?.(next.tab)}>{next.label}</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setExpandedHistoryUnitId(expandedHistoryUnitId === unit.id ? null : unit.id);
                            setExpandedBillingUnitId(null);
                            setExpandedPhotosUnitId(null);
                            setExpandedAmenitiesUnitId(null);
                            setExpandedMetersUnitId(null);
                          }}>History</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setExpandedPhotosUnitId(expandedPhotosUnitId === unit.id ? null : unit.id);
                            setExpandedBillingUnitId(null);
                            setExpandedHistoryUnitId(null);
                            setExpandedAmenitiesUnitId(null);
                            setExpandedMetersUnitId(null);
                            fetchCoverPhotos();
                          }}>Photos</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setExpandedAmenitiesUnitId(expandedAmenitiesUnitId === unit.id ? null : unit.id);
                            setExpandedBillingUnitId(null);
                            setExpandedHistoryUnitId(null);
                            setExpandedPhotosUnitId(null);
                            setExpandedMetersUnitId(null);
                          }}>Amenities</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setExpandedMetersUnitId(expandedMetersUnitId === unit.id ? null : unit.id);
                            setExpandedBillingUnitId(null);
                            setExpandedHistoryUnitId(null);
                            setExpandedPhotosUnitId(null);
                            setExpandedAmenitiesUnitId(null);
                          }}>Utility meters</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setExpandedBillingUnitId(expandedBillingUnitId === unit.id ? null : unit.id);
                            setExpandedHistoryUnitId(null);
                            setExpandedPhotosUnitId(null);
                            setExpandedAmenitiesUnitId(null);
                            setExpandedMetersUnitId(null);
                          }}>Charges</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(unit)}>Edit</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => openDeleteDialog(unit)}>Deactivate</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  {expandedBillingUnitId === unit.id && (
                    <TableRow>
                      <TableCell colSpan={7} className="p-3 bg-muted/20">
                        <div className="space-y-3">
                          <PaymentCollectionRoutingPanel unitId={unit.id} propertyId={propertyId} title={`Payment destination — ${unit.unit_number}`} />
                          <UnitBillingConfig
                            unitId={unit.id}
                            unitLabel={unit.unit_number}
                            propertyId={propertyId}
                            monthlyRent={unit.monthly_rent ?? undefined}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {expandedHistoryUnitId === unit.id && (
                    <TableRow>
                      <TableCell colSpan={7} className="p-3 bg-muted/10">
                        <UnitHistoryPanel
                          unitId={unit.id}
                          unitLabel={unit.unit_number}
                          propertyId={propertyId}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                  {expandedPhotosUnitId === unit.id && (
                    <TableRow>
                      <TableCell colSpan={7} className="p-3 bg-muted/10">
                        <UnitPhotoGallery
                          unitId={unit.id}
                          unitLabel={unit.unit_number}
                          propertyId={propertyId}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                  {expandedAmenitiesUnitId === unit.id && (
                    <TableRow>
                      <TableCell colSpan={7} className="p-3 bg-muted/10">
                        <UnitAmenitiesManager
                          unitId={unit.id}
                          unitLabel={unit.unit_number}
                          propertyId={propertyId}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                  {expandedMetersUnitId === unit.id && (
                    <TableRow>
                      <TableCell colSpan={7} className="p-3 bg-muted/10">
                        <UnitUtilityMeters
                          unitId={unit.id}
                          unitLabel={unit.unit_number}
                          propertyId={propertyId}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {selectedUnit ? "Edit House" : "Add New House"}
            </DialogTitle>
            <DialogDescription>
              {selectedUnit 
                ? `Update the details for house ${selectedUnit.unit_number}`
                : `Add a new house to ${propertyName}`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unitNumber">House Number *</Label>
                <Input
                  id="unitNumber"
                  value={unitNumber}
                  onChange={(e) => setUnitNumber(e.target.value)}
                  placeholder={houseLabelPrefix ? `e.g., ${houseLabelPrefix}-001` : "e.g., HSE-001, A1"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unitLabel">Display Label (optional)</Label>
                <Input
                  id="unitLabel"
                  value={unitLabel}
                  onChange={(e) => setUnitLabel(e.target.value)}
                  placeholder="e.g., R1, Apt 2B"
                />
                <p className="text-xs text-muted-foreground">Shown on invoices & statements</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Unit type</Label>
                <Select value={unitType} onValueChange={setUnitType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[
                      { value: 'bedsitter', label: 'Bedsitter' },
                      { value: 'studio', label: 'Studio' },
                      { value: 'one_bedroom', label: '1 Bedroom' },
                      { value: 'two_bedroom', label: '2 Bedrooms' },
                      { value: 'three_bedroom', label: '3 Bedrooms' },
                      { value: 'shop', label: 'Shop / Retail' },
                      { value: 'office', label: 'Office' },
                      { value: 'penthouse', label: 'Penthouse' },
                      { value: 'standard', label: 'Standard' },
                    ].map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {unitStatuses.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="bedrooms">Bedrooms</Label>
                <Input id="bedrooms" type="number" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} placeholder="2" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bathrooms">Bathrooms</Label>
                <Input id="bathrooms" type="number" step="0.5" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} placeholder="1" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="floorNumber">Floor</Label>
                <Input id="floorNumber" type="number" value={floorNumber} onChange={(e) => setFloorNumber(e.target.value)} placeholder="1" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="squareFeet">Size (sqft)</Label>
                <Input id="squareFeet" type="number" value={squareFeet} onChange={(e) => setSquareFeet(e.target.value)} placeholder="850" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="monthlyRent">Monthly Rent (KES)</Label>
                <Input id="monthlyRent" type="number"
                value={monthlyRent}
                onChange={(e) => setMonthlyRent(e.target.value)}
                placeholder="e.g., 25000"
              />
              </div>
              <div className="space-y-2">
                <Label htmlFor="houseDeposit">House Deposit (KES)</Label>
                <Input id="houseDeposit" type="number" value={houseDeposit} onChange={(e) => setHouseDeposit(e.target.value)} placeholder="e.g., 25000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="waterDeposit">Water Deposit (KES)</Label>
                <Input id="waterDeposit" type="number" value={waterDeposit} onChange={(e) => setWaterDeposit(e.target.value)} placeholder="e.g., 1000" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Furnished status</Label>
              <Select value={furnished} onValueChange={setFurnished}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="furnished">Fully furnished</SelectItem>
                  <SelectItem value="semi_furnished">Semi-furnished</SelectItem>
                  <SelectItem value="unfurnished">Unfurnished</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Corner unit with balcony, freshly painted"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : selectedUnit ? "Update House" : "Add House"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate House</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate house {selectedUnit?.unit_number}? 
              The house will be moved to history and can be reactivated later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk create dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk create units</DialogTitle>
            <DialogDescription>
              Create multiple units at once with sequential numbering. e.g. Prefix "R", start 1, count 21 → R1 to R21
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="bulk-prefix" className="text-xs">Prefix</Label>
                <Input id="bulk-prefix" value={bulkPrefix} onChange={e => setBulkPrefix(e.target.value.toUpperCase())} placeholder="R" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="bulk-start" className="text-xs">Start number</Label>
                <Input id="bulk-start" type="number" min="1" value={bulkStart} onChange={e => setBulkStart(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="bulk-count" className="text-xs">How many</Label>
                <Input id="bulk-count" type="number" min="1" max="100" value={bulkCount} onChange={e => setBulkCount(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="bulk-rent" className="text-xs">Monthly rent (KES)</Label>
                <Input id="bulk-rent" type="number" value={bulkRent} onChange={e => setBulkRent(e.target.value)} placeholder="e.g. 12000" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="bulk-unit-type" className="text-xs">Unit type</Label>
                <Select value={unitType} onValueChange={setUnitType}>
                  <SelectTrigger id="bulk-unit-type" className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[{value:'bedsitter',label:'Bedsitter'},{value:'one_bedroom',label:'1 Bedroom'},{value:'two_bedroom',label:'2 Bedrooms'},{value:'studio',label:'Studio'},{value:'standard',label:'Standard'}].map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {bulkPrefix && bulkStart && bulkCount && (
              <div className="p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground">
                Preview: {bulkPrefix}{bulkStart} → {bulkPrefix}{parseInt(bulkStart) + parseInt(bulkCount) - 1} ({bulkCount} units)
                {bulkRent ? ` at KES ${Number(bulkRent).toLocaleString()}/month each` : ''}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button
              disabled={bulkCreating || !bulkPrefix || !bulkCount}
              onClick={async () => {
                setBulkCreating(true);
                try {
                  const { data, error } = await supabase.rpc('bulk_create_units', {
                    p_property_id:  propertyId,
                    p_manager_id:   user?.id,
                    p_prefix:       bulkPrefix,
                    p_start_number: parseInt(bulkStart),
                    p_count:        parseInt(bulkCount),
                    p_monthly_rent: bulkRent ? parseFloat(bulkRent) : 0,
                    p_unit_type:    unitType,
                    p_bedrooms:     1,
                  });
                  if (error) throw error;
                  toast({ title: `${data} units created`, description: `${bulkPrefix}${bulkStart} to ${bulkPrefix}${parseInt(bulkStart) + parseInt(bulkCount) - 1}` });
                  invalidateManagerActivation(queryClient);
                  invalidateDashboardQueries(queryClient);
                  setBulkOpen(false);
                  fetchUnits();
                  onUnitsChange?.();
                } catch (err: unknown) {
                  toast({ title: "Bulk create failed", description: toUserFacingError(err, "Could not create those units. Try again."), variant: "destructive" });
                }
                setBulkCreating(false);
              }}
            >
              {bulkCreating ? 'Creating…' : `Create ${bulkCount} units`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
