// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import { format } from "date-fns";
import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Badge } from "@/shared/components/ui/badge";
import { Switch } from "@/shared/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Textarea } from "@/shared/components/ui/textarea";
import { Droplets, Settings, Plus, GaugeCircle, Receipt, Save, Loader2 } from "lucide-react";
import { useToast } from "@/shared/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { trackTimeToFirst } from "@/features/dashboard/lib/activationMetrics";
import { invalidateManagerActivation } from "@/features/dashboard/hooks/useManagerActivation";
import { invalidateDashboardQueries } from "@/shared/lib/invalidateDashboards";
import { cn } from "@/shared/lib/utils";

interface WaterCompanyRow {
  short_code: string;
  company_name: string;
  county: string;
  domestic_rate: number;
}

// All 47 Kenyan county water companies (2024/25)
// Fallback providers used if DB is unavailable
const FALLBACK_PROVIDERS = [
  { value: "ncwsc", label: "Nairobi City Water & Sewerage Co. (NCWSC)", county: "Nairobi", rate: 82 },
  { value: "mowasco", label: "Mombasa Water Supply & Sanitation Co. (MOWASCO)", county: "Mombasa", rate: 75 },
  { value: "borehole", label: "Borehole / Private supply", county: "", rate: 30 },
  { value: "custom", label: "Other (enter manually)", county: "", rate: 0 },
];


interface WaterConfig {
  id?: string;
  property_id: string;
  manager_id: string;
  billing_method: "meter" | "flat_rate";
  flat_rate_amount: number;
  rate_per_unit: number;
  water_provider: string;
  meter_number: string;
  invoice_mode: "bundled" | "separate";
  billing_cycle_day: number;
  is_active: boolean;
}

interface Unit {
  id: string;
  unit_number: string;
  status: string;
}

interface MeterReading {
  id: string;
  unit_id: string;
  previous_reading: number;
  current_reading: number;
  consumption: number;
  rate_per_unit: number;
  total_amount: number;
  reading_date: string;
  billing_period_start: string | null;
  billing_period_end: string | null;
  status: string;
  notes: string | null;
}

interface WaterBillingManagerProps {
  propertyId: string;
  propertyName: string;
}

export function WaterBillingManager({ propertyId, propertyName }: WaterBillingManagerProps) {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const queryClient = useQueryClient();

  // Fetch water providers from DB — falls back to FALLBACK_PROVIDERS if unavailable
  const { data: KENYAN_WATER_PROVIDERS = FALLBACK_PROVIDERS } = useQuery({
    queryKey: ['kenya-water-companies'],
    queryFn: async () => {
      const { data } = await (supabase.from('kenya_water_companies')
        .select('short_code, company_name, county, domestic_rate')
        .eq('active', true)
        .order('county'));
      if (!data?.length) return FALLBACK_PROVIDERS;
      return [
        ...(data as WaterCompanyRow[]).map(c => ({
          value: c.short_code,
          label: `${c.company_name} (${c.county})`,
          county: c.county,
          rate: Number(c.domestic_rate ?? 0),
        })),
        { value: 'borehole', label: 'Borehole / Private supply', county: '', rate: 30 },
        { value: 'custom',   label: 'Other (enter manually)',    county: '', rate: 0  },
      ];
    },
    staleTime: 1000 * 60 * 60, // cache for 1 hour
  });

  const [config, setConfig] = useState<WaterConfig | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isReadingDialogOpen, setIsReadingDialogOpen] = useState(false);
  const [customProvider, setCustomProvider] = useState("");

  // New reading form
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [prevReading, setPrevReading] = useState("");
  const [currReading, setCurrReading] = useState("");
  const [readingDate, setReadingDate] = useState(new Date().toISOString().split("T")[0]);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [readingNotes, setReadingNotes] = useState("");
  const [flatRateForUnit, setFlatRateForUnit] = useState("");

  // Config form state
  const [billingMethod, setBillingMethod] = useState<"meter" | "flat_rate">("meter");
  const [flatRate, setFlatRate] = useState("");
  const [ratePerUnit, setRatePerUnit] = useState("");
  const [waterProvider, setWaterProvider] = useState("");
  const [meterNumber, setMeterNumber] = useState("");
  const [invoiceMode, setInvoiceMode] = useState<"bundled" | "separate">("bundled");
  const [billingCycleDay, setBillingCycleDay] = useState("1");
  const [isActive, setIsActive] = useState(true);

  const providersRef = useRef(KENYAN_WATER_PROVIDERS);
  useEffect(() => {
    providersRef.current = KENYAN_WATER_PROVIDERS;
  }, [KENYAN_WATER_PROVIDERS]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [configRes, unitsRes, readingsRes] = await Promise.all([
      supabase.from('water_billing_config').select("*").eq("property_id", propertyId).maybeSingle(),
      supabase.from('units').select("id, unit_number, status").eq("property_id", propertyId).order("unit_number"),
      supabase.from('water_meter_readings').select("*").eq("property_id", propertyId).order("reading_date", { ascending: false }).limit(50),
    ]);

    if (configRes.data) {
      const c = configRes.data as WaterConfig;
      setConfig(c);
      setBillingMethod(c.billing_method);
      setFlatRate(c.flat_rate_amount?.toString() || "0");
      setRatePerUnit(c.rate_per_unit?.toString() || "0");
      setWaterProvider(c.water_provider || "");
      setMeterNumber(c.meter_number || "");
      setInvoiceMode(c.invoice_mode);
      setBillingCycleDay(c.billing_cycle_day?.toString() || "1");
      setIsActive(c.is_active);
      if (c.water_provider && !providersRef.current.find(p => p.value === c.water_provider)) {
        setCustomProvider(c.water_provider);
        setWaterProvider("custom");
      }
    }

    setUnits((unitsRes.data as unknown as Unit[]) || []);
    setReadings((readingsRes.data as unknown as MeterReading[]) || []);
    setIsLoading(false);
  }, [propertyId]);

  useEffect(() => {
    fetchData();
  }, [propertyId, fetchData]);

  const handleSaveConfig = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setIsSaving(true);

    const providerValue = waterProvider === "custom" ? customProvider : waterProvider;

    const configData = {
      property_id: propertyId,
      manager_id: user.id,
      billing_method: billingMethod,
      flat_rate_amount: parseFloat(flatRate) || 0,
      rate_per_unit: parseFloat(ratePerUnit) || 0,
      water_provider: providerValue,
      meter_number: meterNumber,
      invoice_mode: invoiceMode,
      billing_cycle_day: parseInt(billingCycleDay) || 1,
      is_active: isActive,
    };

    const { error } = await supabase.rpc('save_water_billing_config_atomic' as never, {
      p_config_id: config?.id ?? null,
      p_property_id: propertyId,
      p_billing_method: billingMethod,
      p_flat_rate_amount: parseFloat(flatRate) || 0,
      p_rate_per_unit: parseFloat(ratePerUnit) || 0,
      p_water_provider: providerValue,
      p_meter_number: meterNumber,
      p_invoice_mode: invoiceMode,
      p_billing_cycle_day: parseInt(billingCycleDay) || 1,
      p_is_active: isActive,
    });

    if (error) {
      toast({ title: "Error", description: "Failed to save water billing settings", variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Water billing settings updated successfully" });
      fetchData();
    }
    setIsSaving(false);
  };

  const handleAddReading = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (!selectedUnitId) {
      toast({ title: "Error", description: "Please select a unit", variant: "destructive" });
      return;
    }

    if (billingMethod === "meter") {
      if (!prevReading || !currReading) {
        toast({ title: "Error", description: "Please enter both readings", variant: "destructive" });
        return;
      }
      if (parseFloat(currReading) < parseFloat(prevReading)) {
        toast({ title: "Error", description: "Current reading must be greater than previous reading", variant: "destructive" });
        return;
      }
    }

    setIsSaving(true);

    const readingData: { unit_id: string; property_id: string; manager_id: string; previous_reading: number; current_reading: number; rate_per_unit: number; reading_date: string; billing_period_start: string | null; billing_period_end: string | null; notes: string | null; [key: string]: unknown } = {
      unit_id: selectedUnitId,
      property_id: propertyId,
      manager_id: user.id,
      previous_reading: billingMethod === "meter" ? parseFloat(prevReading) : 0,
      current_reading: billingMethod === "meter" ? parseFloat(currReading) : 0,
      rate_per_unit: billingMethod === "meter" ? (parseFloat(ratePerUnit) || 0) : 0,
      reading_date: readingDate,
      billing_period_start: periodStart || null,
      billing_period_end: periodEnd || null,
      notes: readingNotes || null,
    };

    // For flat rate, we store the flat rate as total_amount via a trick: set readings to produce the flat amount
    if (billingMethod === "flat_rate") {
      const amount = parseFloat(flatRateForUnit) || parseFloat(flatRate) || 0;
      readingData.previous_reading = 0;
      readingData.current_reading = amount;
      readingData.rate_per_unit = 1;
    }

    const { data: readingId, error } = await supabase.rpc('create_water_meter_reading_atomic', {
      p_property_id: propertyId,
      p_unit_id: selectedUnitId,
      p_previous_reading: readingData.previous_reading,
      p_current_reading: readingData.current_reading,
      p_rate_per_unit: readingData.rate_per_unit,
      p_reading_date: readingData.reading_date,
      p_billing_period_start: readingData.billing_period_start,
      p_billing_period_end: readingData.billing_period_end,
      p_notes: readingData.notes,
      p_submitted_by_tenant: false,
      p_tenant_user_id: null,
      p_tenant_photo_url: null,
    });

    if (error) {
      toast({ title: "Error", description: "Failed to add reading", variant: "destructive" });
    } else {
      // Auto-generate water invoice for the tenant in this unit
      const reading = { id: readingId } as MeterReading;
      const consumption = billingMethod === "meter" 
        ? parseFloat(currReading) - parseFloat(prevReading) 
        : (parseFloat(flatRateForUnit) || parseFloat(flatRate) || 0);
      const waterAmount = billingMethod === "meter" 
        ? consumption * (parseFloat(ratePerUnit) || 0) 
        : consumption;

      if (waterAmount > 0) {
        // Find tenant for this unit
        const { data: tenant } = await supabase
          .from("tenants")
          .select("id, name")
          .eq("property_id", propertyId)
          .eq("unit_id", selectedUnitId)
          .eq("status", "active")
          .maybeSingle();

        if (tenant && invoiceMode === "separate") {
          // Generate separate water invoice
          const unitName = getUnitName(selectedUnitId);
          const monthLabel = format(new Date(readingDate), 'MMMM yyyy');
          const dueDate = new Date(readingDate);
          dueDate.setDate(dueDate.getDate() + 14);

          const description = billingMethod === "meter"
            ? `Water Bill - ${monthLabel} | ${unitName} | Prev: ${prevReading} → Curr: ${currReading} = ${consumption} m³ × KES ${ratePerUnit}/m³`
            : `Water Bill - ${monthLabel} | ${unitName} | Flat Rate`;

          const { data: lease } = await supabase.from("leases").select("id, property_id, unit_id").eq("tenant_id", tenant.id).eq("manager_id", user.id).in("status", ["active", "current"]).order("start_date", { ascending: false }).limit(1).maybeSingle();
          const { data: created, error: invError } = await supabase.functions.invoke("create-invoice", {
            body: { tenantId: tenant.id, leaseId: lease?.id ?? null, amount: waterAmount, description, dueDate: dueDate.toISOString().split("T")[0], managerId: user.id, propertyId, unitId: selectedUnitId, invoiceType: "water", generationKey: `water:${reading.id}` },
          });

          if (!invError && created?.success) {
            const invoice = { id: created.id };
            // Link reading to invoice
            const { error: linkError } = await supabase.rpc('transition_water_meter_reading_atomic', {
              p_reading_id: reading.id,
              p_action: 'invoiced',
              p_invoice_id: invoice.id,
              p_dispute_reason: null,
            });
            if (linkError) {
              toast({ title: "Warning", description: "Invoice was created but the water reading could not be linked.", variant: "destructive" });
              return;
            }

            toast({ 
              title: "Water Invoice Generated", 
              description: `${formatCurrency(waterAmount)} invoice created for ${tenant.name}` 
            });
            trackTimeToFirst("invoice", { managerId: user.id, signupAt: user.created_at });
            invalidateManagerActivation(queryClient);
            invalidateDashboardQueries(queryClient);
          }
        } else if (tenant && invoiceMode === "bundled") {
          toast({ 
            title: "Reading Added", 
            description: `Water charge of ${formatCurrency(waterAmount)} will be bundled with next rent invoice` 
          });
        } else {
          toast({ title: "Reading Added", description: "Water meter reading recorded (no active tenant in unit)" });
        }
      } else {
        toast({ title: "Reading Added", description: "Water meter reading has been recorded" });
      }

      setIsReadingDialogOpen(false);
      resetReadingForm();
      fetchData();
    }
    setIsSaving(false);
  };

  const resetReadingForm = () => {
    setSelectedUnitId("");
    setPrevReading("");
    setCurrReading("");
    setReadingDate(new Date().toISOString().split("T")[0]);
    setPeriodStart("");
    setPeriodEnd("");
    setReadingNotes("");
    setFlatRateForUnit("");
  };

  const handleUnitChange = (unitId: string) => {
    setSelectedUnitId(unitId);
    // Auto-fill previous reading from the last reading for this unit
    const lastReading = readings.find(r => r.unit_id === unitId);
    if (lastReading) {
      setPrevReading(lastReading.current_reading.toString());
    } else {
      setPrevReading("0");
    }
  };

  const getUnitName = (unitId: string) => {
    return units.find(u => u.id === unitId)?.unit_number || "Unknown";
  };

  const getProviderLabel = (value: string) => {
    const provider = KENYAN_WATER_PROVIDERS.find(p => p.value === value);
    return provider ? provider.label : value;
  };

  const lastReadingValue = selectedUnitId
    ? readings.find(r => r.unit_id === selectedUnitId)?.current_reading
    : undefined;

  // Auto-fill previous reading from last reading for selected unit
  useEffect(() => {
    if (selectedUnitId && billingMethod === "meter" && lastReadingValue !== undefined) {
      setPrevReading(lastReadingValue.toString());
    }
  }, [selectedUnitId, billingMethod, lastReadingValue]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          Loading water billing...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="settings">
        <TabsList className="mb-4">
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="readings" className="flex items-center gap-2">
            <GaugeCircle className="h-4 w-4" />
            Meter Readings
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Billing History
          </TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Droplets className="h-5 w-5 text-[hsl(195_60%_42%)]" />
                Water Billing Configuration — {propertyName}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <p className="font-medium">Enable Water Billing</p>
                  <p className="text-sm text-muted-foreground">Activate water billing for this property</p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Water Provider</Label>
                  <Select value={waterProvider} onValueChange={(val) => {
                    setWaterProvider(val);
                    // Auto-fill rate from provider default
                    const provider = KENYAN_WATER_PROVIDERS.find(p => p.value === val);
                    if (provider && provider.rate > 0 && val !== 'custom' && val !== 'borehole') {
                      setRatePerUnit(String(provider.rate));
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select water provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {KENYAN_WATER_PROVIDERS.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {waterProvider === "custom" && (
                    <Input
                      value={customProvider}
                      onChange={e => setCustomProvider(e.target.value)}
                      placeholder="Enter water provider name"
                      className="mt-2"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Master Meter Number</Label>
                  <Input
                    value={meterNumber}
                    onChange={e => setMeterNumber(e.target.value)}
                    placeholder="e.g., WM-12345"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Billing Method</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setBillingMethod("meter")}
                    className={cn(
                      "p-4 rounded-lg border-2 text-left transition-all",
                      billingMethod === "meter"
                        ? "border-amber-400/50 bg-amber-400/8"
                        : "border-border hover:border-amber-400/60/50"
                    )}
                  >
                    <GaugeCircle className={cn("h-6 w-6 mb-2", billingMethod === "meter" ? "text-warning" : "text-muted-foreground")} />
                    <p className="font-medium text-sm">Meter Readings</p>
                    <p className="text-xs text-muted-foreground mt-1">Enter previous & current readings per unit. System calculates consumption × rate.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingMethod("flat_rate")}
                    className={cn(
                      "p-4 rounded-lg border-2 text-left transition-all",
                      billingMethod === "flat_rate"
                        ? "border-amber-400/50 bg-amber-400/8"
                        : "border-border hover:border-amber-400/60/50"
                    )}
                  >
                    <Receipt className={cn("h-6 w-6 mb-2", billingMethod === "flat_rate" ? "text-warning" : "text-muted-foreground")} />
                    <p className="font-medium text-sm">Flat Rate</p>
                    <p className="text-xs text-muted-foreground mt-1">Fixed monthly water charge per unit. Can override per individual unit.</p>
                  </button>
                </div>
              </div>

              {billingMethod === "meter" ? (
                <div className="space-y-2">
                  <Label>Rate per Unit (KES per m³)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={ratePerUnit}
                    onChange={e => setRatePerUnit(e.target.value)}
                    placeholder="e.g., 85"
                  />
                  <p className="text-xs text-muted-foreground">
                    NCWSC domestic tariff: ~KES 53-85/m³ depending on consumption band
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Default Flat Rate per Unit (KES/month)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={flatRate}
                    onChange={e => setFlatRate(e.target.value)}
                    placeholder="e.g., 500"
                  />
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Invoice Mode</Label>
                  <Select value={invoiceMode} onValueChange={(v: "bundled" | "separate") => setInvoiceMode(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bundled">Add to Rent Invoice</SelectItem>
                      <SelectItem value="separate">Separate Water Invoice</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {invoiceMode === "bundled" 
                      ? "Water charges appear as a line item on monthly rent invoices" 
                      : "Standalone water bill generated per unit each cycle"}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Billing Cycle Day</Label>
                  <Input
                    type="number"
                    min="1"
                    max="28"
                    value={billingCycleDay}
                    onChange={e => setBillingCycleDay(e.target.value)}
                    placeholder="1"
                  />
                  <p className="text-xs text-muted-foreground">Day of month when water bills are generated</p>
                </div>
              </div>

              <Button onClick={handleSaveConfig} disabled={isSaving} className="w-full">
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {config?.id ? "Update Settings" : "Save Settings"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Meter Readings Tab */}
        <TabsContent value="readings">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <GaugeCircle className="h-5 w-5 text-[hsl(195_60%_42%)]" />
                {billingMethod === "meter" ? "Meter Readings" : "Water Charges"}
              </CardTitle>
              <Button onClick={() => { resetReadingForm(); setIsReadingDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                {billingMethod === "meter" ? "Record Reading" : "Add Charge"}
              </Button>
            </CardHeader>
            <CardContent>
              {readings.length === 0 ? (
                <div className="text-center py-12">
                  <GaugeCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No readings recorded yet</p>
                  <Button variant="outline" className="mt-4" onClick={() => { resetReadingForm(); setIsReadingDialogOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Record First {billingMethod === "meter" ? "Reading" : "Charge"}
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Unit</TableHead>
                      <TableHead>Date</TableHead>
                      {billingMethod === "meter" && (
                        <>
                          <TableHead>Previous</TableHead>
                          <TableHead>Current</TableHead>
                          <TableHead>Consumption (m³)</TableHead>
                        </>
                      )}
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {readings.map(reading => (
                      <TableRow key={reading.id}>
                        <TableCell className="font-medium">{getUnitName(reading.unit_id)}</TableCell>
                        <TableCell>{format(new Date(reading.reading_date), 'dd/MM/yy')}</TableCell>
                        {billingMethod === "meter" && (
                          <>
                            <TableCell>{reading.previous_reading}</TableCell>
                            <TableCell>{reading.current_reading}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-[hsl(195_60%_42%/0.1)] text-[hsl(195_60%_32%)] border-[hsl(195_60%_42%/0.2)]">
                                {reading.consumption} m³
                              </Badge>
                            </TableCell>
                          </>
                        )}
                        <TableCell className="font-medium text-success">
                          {formatCurrency(reading.total_amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(
                            "capitalize",
                            reading.status === "paid" && "bg-success/10 text-success border-success/20",
                            reading.status === "invoiced" && "bg-[hsl(195_60%_42%/0.1)] text-[hsl(195_60%_32%)] border-[hsl(195_60%_42%/0.2)]",
                            reading.status === "pending" && "bg-warning/10 text-warning border-warning/20"
                          )}>
                            {reading.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing History Tab */}
        <TabsContent value="billing">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Receipt className="h-5 w-5 text-[hsl(195_60%_42%)]" />
                Water Billing Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 rounded-lg bg-[hsl(195_60%_42%/0.1)]">
                  <p className="text-xs text-muted-foreground font-medium">Total Billed</p>
                  <p className="text-xl font-bold text-[hsl(195_60%_32%)]">
                    {formatCurrency(readings.reduce((sum, r) => sum + (r.total_amount || 0), 0))}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-success/10">
                  <p className="text-xs text-muted-foreground font-medium">Paid</p>
                  <p className="text-xl font-bold text-success">
                    {formatCurrency(readings.filter(r => r.status === "paid").reduce((sum, r) => sum + (r.total_amount || 0), 0))}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-warning/10">
                  <p className="text-xs text-muted-foreground font-medium">Pending</p>
                  <p className="text-xl font-bold text-warning">
                    {formatCurrency(readings.filter(r => r.status === "pending").reduce((sum, r) => sum + (r.total_amount || 0), 0))}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground font-medium">Total Readings</p>
                  <p className="text-xl font-bold">{readings.length}</p>
                </div>
              </div>
              
              {config && (
                <div className="p-4 rounded-lg border border-border space-y-2">
                  <p className="text-sm font-medium">Current Configuration</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Provider: </span>
                      <span className="font-medium">{getProviderLabel(config.water_provider) || "Not set"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Method: </span>
                      <Badge variant="outline" className="capitalize">{config.billing_method.replace("_", " ")}</Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Invoice: </span>
                      <Badge variant="outline" className="capitalize">{config.invoice_mode}</Badge>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Reading Dialog */}
      <Dialog open={isReadingDialogOpen} onOpenChange={setIsReadingDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Droplets className="h-5 w-5 text-[hsl(195_60%_42%)]" />
              {billingMethod === "meter" ? "Record Meter Reading" : "Add Water Charge"}
            </DialogTitle>
            <DialogDescription>
              {billingMethod === "meter" 
                ? "Enter previous and current meter readings for a unit" 
                : "Enter the flat rate water charge for a unit"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Unit / House *</Label>
              <Select value={selectedUnitId} onValueChange={handleUnitChange} disabled={units.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder={units.length === 0 ? "No units available" : "Select unit"} />
                </SelectTrigger>
                <SelectContent>
                  {units.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.unit_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {billingMethod === "meter" ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Previous Reading (m³)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={prevReading}
                    onChange={e => setPrevReading(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Current Reading (m³)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={currReading}
                    onChange={e => setCurrReading(e.target.value)}
                    placeholder="0"
                  />
                </div>
                {prevReading && currReading && parseFloat(currReading) >= parseFloat(prevReading) && (
                  <div className="col-span-2 p-3 rounded-lg bg-[hsl(195_60%_42%/0.1)]">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Consumption:</span>
                      <span className="font-medium">{(parseFloat(currReading) - parseFloat(prevReading)).toFixed(2)} m³</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-muted-foreground">Estimated Cost:</span>
                      <span className="font-bold text-success">
                        {formatCurrency((parseFloat(currReading) - parseFloat(prevReading)) * (parseFloat(ratePerUnit) || 0))}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Water Charge (KES)</Label>
                <Input
                  type="number"
                  min="0"
                  value={flatRateForUnit}
                  onChange={e => setFlatRateForUnit(e.target.value)}
                  placeholder={flatRate || "500"}
                />
                <p className="text-xs text-muted-foreground">
                  Default flat rate: {formatCurrency(parseFloat(flatRate) || 0)}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Reading Date</Label>
              <Input
                type="date"
                value={readingDate}
                onChange={e => setReadingDate(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Period Start</Label>
                <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Period End</Label>
                <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={readingNotes}
                onChange={e => setReadingNotes(e.target.value)}
                placeholder="e.g., Estimated reading, meter replaced"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReadingDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddReading} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              {billingMethod === "meter" ? "Save Reading" : "Add Charge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default WaterBillingManager;
