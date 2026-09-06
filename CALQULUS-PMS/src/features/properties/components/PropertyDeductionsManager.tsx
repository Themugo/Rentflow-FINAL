import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Badge } from "@/shared/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Switch } from "@/shared/components/ui/switch";
import { Plus, Trash2, Loader2, Settings2, DollarSign } from "lucide-react";
import { useToast } from "@/shared/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/shared/hooks/useCurrency";

interface Deduction {
  id: string;
  deduction_name: string;
  deduction_type: "fixed" | "percentage";
  amount: number;
  is_recurring: boolean;
  is_active: boolean;
}

interface AmenityCharge {
  id: string;
  unit_id: string | null;
  charge_type: string;
  charge_label: string;
  amount: number;
  is_active: boolean;
}

interface Props {
  propertyId: string;
  propertyName: string;
}

const COMMON_DEDUCTIONS = [
  "Commission on rent collected",
  "Salary-Soldier",
  "Salary-Caretaker",
  "Transport",
  "Tokens/Utilities",
  "Gate Keys",
  "Weeding & Fertilizer",
  "Mpesa Transaction Cost",
  "Water Bill",
  "Unblocking Septic",
  "Deposit Refund",
];

const AMENITY_TYPES = [
  { value: "garbage", label: "Garbage Collection" },
  { value: "security", label: "Security" },
  { value: "parking", label: "Parking" },
  { value: "internet", label: "Internet/WiFi" },
  { value: "cleaning", label: "Common Area Cleaning" },
  { value: "other", label: "Other" },
];

export function PropertyDeductionsManager({ propertyId, propertyName }: Props) {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [amenities, setAmenities] = useState<AmenityCharge[]>([]);
  const [units, setUnits] = useState<{ id: string; unit_number: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeductionDialogOpen, setIsDeductionDialogOpen] = useState(false);
  const [isAmenityDialogOpen, setIsAmenityDialogOpen] = useState(false);

  // Deduction form
  const [dedName, setDedName] = useState("");
  const [dedType, setDedType] = useState<"fixed" | "percentage">("fixed");
  const [dedAmount, setDedAmount] = useState("");

  // Amenity form
  const [amenityType, setAmenityType] = useState("garbage");
  const [amenityLabel, setAmenityLabel] = useState("Garbage Collection");
  const [amenityAmount, setAmenityAmount] = useState("");
  const [amenityUnitId, setAmenityUnitId] = useState<string>("all");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const [dedRes, amenRes, unitRes] = await Promise.all([
      supabase.from('property_deductions').select("*").eq("property_id", propertyId).order("created_at"),
      supabase.from('property_amenity_charges').select("*").eq("property_id", propertyId).order("created_at"),
      supabase.from("units").select("id, unit_number").eq("property_id", propertyId).order("unit_number"),
    ]);
    setDeductions((dedRes.data as unknown as Deduction[]) || []);
    setAmenities((amenRes.data as unknown as AmenityCharge[]) || []);
    setUnits(unitRes.data || []);
    setIsLoading(false);
  }, [propertyId]);

  useEffect(() => { fetchData(); }, [fetchData, propertyId]);

  const handleAddDeduction = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.rpc('save_property_deduction_atomic' as any, {
      p_deduction_id: null, p_property_id: propertyId,
      p_payload: { deduction_name: dedName, deduction_type: dedType, amount: parseFloat(dedAmount) || 0, is_recurring: true, is_active: true },
    });
    if (error) {
      toast({ title: "Error", description: "Failed to add deduction", variant: "destructive" });
    } else {
      toast({ title: "Added", description: "Deduction added successfully" });
      setIsDeductionDialogOpen(false);
      setDedName(""); setDedAmount("");
      fetchData();
    }
  };

  const handleAddAmenity = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (amenityUnitId === "all") {
      // Add to all units
      const inserts = units.map(u => ({
        property_id: propertyId,
        unit_id: u.id,
        manager_id: user.id,
        charge_type: amenityType,
        charge_label: amenityLabel,
        amount: parseFloat(amenityAmount) || 0,
        is_active: true,
      }));
      const results = await Promise.all(units.map(u => supabase.rpc('save_property_amenity_charge_atomic' as any, { p_charge_id: null, p_property_id: propertyId, p_unit_id: u.id, p_payload: { charge_type: amenityType, charge_label: amenityLabel, amount: parseFloat(amenityAmount) || 0, is_active: true } })));
      const error = results.find(r => r.error)?.error || null;
      if (error) {
        toast({ title: "Error", description: "Failed to add amenity charges", variant: "destructive" });
      } else {
        toast({ title: "Added", description: `${amenityLabel} added to all units` });
      }
    } else {
      const { error } = await supabase.rpc('save_property_amenity_charge_atomic' as any, { p_charge_id: null, p_property_id: propertyId, p_unit_id: amenityUnitId, p_payload: { charge_type: amenityType, charge_label: amenityLabel, amount: parseFloat(amenityAmount) || 0, is_active: true } });
      if (error) {
        toast({ title: "Error", description: "Failed to add amenity charge", variant: "destructive" });
      } else {
        toast({ title: "Added", description: "Amenity charge added" });
      }
    }
    setIsAmenityDialogOpen(false);
    setAmenityAmount("");
    fetchData();
  };

  const handleDeleteDeduction = async (id: string) => {
    await supabase.rpc('delete_property_deduction_atomic' as any, { p_id: id });
    fetchData();
  };

  const handleDeleteAmenity = async (id: string) => {
    await supabase.rpc('delete_property_amenity_charge_atomic' as any, { p_id: id });
    fetchData();
  };

  const handleToggleActive = async (table: string, id: string, isActive: boolean) => {
    await supabase.rpc((table === 'property_deductions' ? 'transition_property_deduction_atomic' : 'transition_property_amenity_charge_atomic') as any, { p_id: id, p_is_active: !isActive });
    fetchData();
  };

  const getUnitName = (unitId: string | null) => {
    if (!unitId) return "All Units";
    return units.find(u => u.id === unitId)?.unit_number || "Unknown";
  };

  if (isLoading) {
    return <Card><CardContent className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      {/* Deductions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-orange-500" />
            Property Deductions — {propertyName}
          </CardTitle>
          <Button size="sm" onClick={() => setIsDeductionDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Deduction
          </Button>
        </CardHeader>
        <CardContent>
          {deductions.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">No deductions configured. Add commission, salaries, etc.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deduction</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deductions.map(d => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.deduction_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{d.deduction_type === "percentage" ? "%" : "Fixed"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {d.deduction_type === "percentage" ? `${d.amount}%` : formatCurrency(d.amount)}
                    </TableCell>
                    <TableCell>
                      <Switch checked={d.is_active} onCheckedChange={() => handleToggleActive("property_deductions", d.id, d.is_active)} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteDeduction(d.id)} aria-label="Delete deduction">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Amenity Charges */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-500" />
            Amenity Charges (Garbage, Security, etc.)
          </CardTitle>
          <Button size="sm" onClick={() => setIsAmenityDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Charge
          </Button>
        </CardHeader>
        <CardContent>
          {amenities.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">No amenity charges configured.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead>Charge</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {amenities.map(a => (
                  <TableRow key={a.id}>
                    <TableCell>{getUnitName(a.unit_id)}</TableCell>
                    <TableCell className="font-medium">{a.charge_label}</TableCell>
                    <TableCell className="text-right">{formatCurrency(a.amount)}</TableCell>
                    <TableCell>
                      <Switch checked={a.is_active} onCheckedChange={() => handleToggleActive("property_amenity_charges", a.id, a.is_active)} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteAmenity(a.id)} aria-label="Delete amenity">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Deduction Dialog */}
      <Dialog open={isDeductionDialogOpen} onOpenChange={setIsDeductionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Property Deduction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Deduction Name</Label>
              <Select value={dedName} onValueChange={setDedName}>
                <SelectTrigger><SelectValue placeholder="Select or type" /></SelectTrigger>
                <SelectContent>
                  {COMMON_DEDUCTIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input value={dedName} onChange={e => setDedName(e.target.value)} placeholder="Or type custom name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={dedType} onValueChange={(v: "fixed" | "percentage") => setDedType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{dedType === "percentage" ? "Rate (%)" : "Amount (KES)"}</Label>
                <Input type="number" min="0" value={dedAmount} onChange={e => setDedAmount(e.target.value)} placeholder={dedType === "percentage" ? "e.g., 3" : "e.g., 13000"} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeductionDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddDeduction} disabled={!dedName || !dedAmount}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Amenity Dialog */}
      <Dialog open={isAmenityDialogOpen} onOpenChange={setIsAmenityDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Amenity Charge</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Charge Type</Label>
              <Select value={amenityType} onValueChange={(v) => {
                setAmenityType(v);
                setAmenityLabel(AMENITY_TYPES.find(t => t.value === v)?.label || v);
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AMENITY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Apply To</Label>
              <Select value={amenityUnitId} onValueChange={setAmenityUnitId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Units</SelectItem>
                  {units.map(u => <SelectItem key={u.id} value={u.id}>{u.unit_number}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount per Unit (KES/month)</Label>
              <Input type="number" min="0" value={amenityAmount} onChange={e => setAmenityAmount(e.target.value)} placeholder="e.g., 250" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAmenityDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddAmenity} disabled={!amenityAmount}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
