// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import { useState, useRef, useEffect } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Badge } from "@/shared/components/ui/badge";
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
import { Upload, Mail, Phone, MessageSquare, UserPlus } from "lucide-react";
import { useToast } from "@/shared/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { tenantSchema, formatValidationErrors } from "@/shared/lib/validations";
import { useActivityLog } from "@/shared/hooks/useActivityLog";
import { useAuth } from "@/features/auth/AuthContext";
import { OtherChargesTable, ChargeItem, serializeChargesForStorage } from "@/features/tenants/components/OtherChargesTable";

interface UnitOption {
  id: string;
  unit_number: string;
  status: string;
  monthly_rent: number | null;
}

interface AddTenantToPropertyDialogProps {
  propertyId: string;
  propertyName: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onTenantAdded: () => void;
}

export const AddTenantToPropertyDialog = ({
  propertyId,
  propertyName,
  isOpen,
  onOpenChange,
  onTenantAdded,
}: AddTenantToPropertyDialogProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { logActivity } = useActivityLog();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [sendSmsNotification, setSendSmsNotification] = useState(false);
  const [sendWhatsappNotification, setSendWhatsappNotification] = useState(false);
  const [chargeItems, setChargeItems] = useState<ChargeItem[]>([]);
  const [availableUnits, setAvailableUnits] = useState<UnitOption[]>([]);

  // Fetch available (vacant) units for this property
  useEffect(() => {
    if (isOpen && propertyId) {
      supabase
        .from("units")
        .select("id, unit_number, status, monthly_rent")
        .eq("property_id", propertyId)
        .in("status", ["vacant", "reserved", "maintenance"])
        .order("unit_number")
        .then(({ data }) => {
          setAvailableUnits((data as unknown as UnitOption[]) || []);
        });
    }
  }, [isOpen, propertyId]);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    whatsapp: "",
    unit: "",
    move_in_date: "",
    monthly_rent: "",
    deposit_amount: "",
    deposit_months: "",
    water_deposit: "",
  });

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      whatsapp: "",
      unit: "",
      move_in_date: "",
      monthly_rent: "",
      deposit_amount: "",
      deposit_months: "",
      water_deposit: "",
    });
    setChargeItems([]);
    setPhotoFile(null);
    setPhotoPreview(null);
    setSendSmsNotification(false);
    setSendWhatsappNotification(false);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const uploadPhoto = async (tenantId: string): Promise<string | null> => {
    if (!photoFile) return null;
    const fileExt = photoFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const fileName = `${tenantId}/photo.${fileExt}`;
    const { error } = await supabase.storage.from("tenant-photos").upload(fileName, photoFile, {
      cacheControl: "3600",
      contentType: photoFile.type,
      upsert: true,
    });
    if (error) return null;
    return fileName;
  };

  const handleAddTenant = async () => {
    const validationData = {
      ...formData,
      property_id: propertyId,
    };

    const validationResult = tenantSchema.safeParse(validationData);
    if (!validationResult.success) {
      toast({
        title: "Validation Error",
        description: formatValidationErrors(validationResult.error),
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const { data: accountData, error: accountError } = await supabase.functions.invoke(
        "create-tenant-account",
        {
          body: {
            name: validationResult.data.name,
            email: validationResult.data.email,
            phone: validationResult.data.phone || null,
            whatsapp: formData.whatsapp || null,
            property: propertyName,
            property_id: propertyId,
            unit: validationResult.data.unit || "",
            move_in_date: validationResult.data.move_in_date || null,
            manager_id: user?.id,
            sendSms: sendSmsNotification && !!validationResult.data.phone,
            sendWhatsapp: sendWhatsappNotification && !!formData.whatsapp,
            monthlyRent: formData.monthly_rent ? parseFloat(formData.monthly_rent) : null,
            depositAmount: formData.deposit_amount ? parseFloat(formData.deposit_amount) : null,
            companyName: "CALQULUS PMS Properties",
            portalUrl: `${window.location.origin}`,
          },
        }
      );

      if (accountError) {
        toast({ title: "Error", description: accountError.message || "Failed to create tenant account", variant: "destructive" });
        setIsUploading(false);
        return;
      }

      if (!accountData?.success) {
        toast({ title: "Error", description: accountData?.error || "Failed to create tenant account", variant: "destructive" });
        setIsUploading(false);
        return;
      }

      const insertedTenant = accountData.tenant;

      if (insertedTenant) {
        const chargesData = serializeChargesForStorage(chargeItems);
        let createdPhotoUrl: string | null = null;
        if (photoFile) createdPhotoUrl = await uploadPhoto(insertedTenant.id);
        const { error: finalizeError } = await supabase.rpc('finalize_tenant_creation_atomic' as any, {
          p_tenant_id: insertedTenant.id,
          p_payload: {
            deposit_months: formData.deposit_months ? parseInt(formData.deposit_months) : null,
            other_charges: chargesData.otherCharges || null,
            other_charges_description: chargesData.otherChargesDescription || null,
            deposit_balance: formData.deposit_amount ? parseFloat(formData.deposit_amount) : null,
            photo_url: createdPhotoUrl,
            history_description: `Tenant ${validationResult.data.name} was added to ${propertyName}`,
          },
        });
        if (finalizeError) throw finalizeError;

        // Sync payment details to tenant portal
        await supabase.rpc("save_tenant_payment_details_atomic" as never, {
          p_tenant_id:          insertedTenant.id,
          p_manager_id:         user?.id ?? null,
          p_property_id:        propertyId || null,
          p_unit_id:            insertedTenant.unit_id || null,
          p_monthly_rent:       formData.monthly_rent ? parseFloat(formData.monthly_rent) : null,
          p_house_deposit:      formData.deposit_amount ? parseFloat(formData.deposit_amount) : null,
          p_water_deposit:      formData.water_deposit ? parseFloat(formData.water_deposit) : null,
          p_other_charges:      null,
          p_other_charges_desc: null,
          p_payment_day:        1,
          p_paybill:            null,
          p_account_ref:        insertedTenant.unit || null,
          p_tenancy_type:       "standard",
        }).catch(() => {}); // non-critical

        logActivity({
          action: 'Created tenant',
          entityType: 'tenant',
          entityId: insertedTenant.id,
          details: { name: validationResult.data.name, email: validationResult.data.email, property: propertyName }
        });
      }

      const methods = [];
      if (accountData.emailSent) methods.push("email");
      if (accountData.smsSent) methods.push("SMS");
      if (accountData.whatsappSent) methods.push("WhatsApp");

      toast({
        title: accountData.isNewUser ? "Tenant Added & Account Created" : "Tenant Added",
        description: accountData.isNewUser && methods.length
          ? `${validationResult.data.name} added to ${propertyName}. Activation link sent via ${methods.join(", ")}.`
          : `${validationResult.data.name} has been added to ${propertyName}.`,
      });

      resetForm();
      onOpenChange(false);
      onTenantAdded();
    } catch (err) {
      toast({ title: "Error", description: "Failed to create tenant. Please try again.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) resetForm(); onOpenChange(open); }}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-heading text-foreground">Add Tenant to {propertyName}</DialogTitle>
          <DialogDescription>This tenant will be assigned to {propertyName}.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Photo Upload */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="relative cursor-pointer group"
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
            >
              <Avatar className="h-20 w-20 border-2 border-dashed border-border group-hover:border-amber-400/60 transition-colors">
                {photoPreview ? <AvatarImage src={photoPreview} /> : (
                  <AvatarFallback className="bg-muted"><Upload className="h-6 w-6 text-muted-foreground" /></AvatarFallback>
                )}
              </Avatar>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
            <p className="text-xs text-muted-foreground">Click to upload photo</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Full Name *</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="John Doe" className="bg-background border-border" />
            </div>
            <div className="grid gap-2">
              <Label>Email *</Label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="john@example.com" className="bg-background border-border" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Phone (SMS)</Label>
              <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="0712345678" className="bg-background border-border" />
            </div>
            <div className="grid gap-2">
              <Label>WhatsApp</Label>
              <Input value={formData.whatsapp} onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })} placeholder="0712345678" className="bg-background border-border" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Unit / House *</Label>
              {availableUnits.length > 0 ? (
                <Select
                  value={formData.unit}
                  onValueChange={(val) => {
                    const selectedUnit = availableUnits.find(u => u.unit_number === val);
                    setFormData({
                      ...formData,
                      unit: val,
                      monthly_rent: selectedUnit?.monthly_rent ? selectedUnit.monthly_rent.toString() : formData.monthly_rent,
                    });
                  }}
                >
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUnits.map((u) => (
                      <SelectItem key={u.id} value={u.unit_number}>
                        {u.unit_number} ({u.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} placeholder="e.g. A101" className="bg-background border-border" />
              )}
            </div>
            <div className="grid gap-2">
              <Label>Move-in Date</Label>
              <Input type="date" value={formData.move_in_date} onChange={(e) => setFormData({ ...formData, move_in_date: e.target.value })} className="bg-background border-border" />
            </div>
          </div>

          {/* Payment Details */}
          <div className="border-t border-border pt-4 mt-2">
            <h4 className="text-sm font-medium text-foreground mb-3">Payment Details</h4>
            <div className="grid gap-2">
              <Label>Monthly Rent (KES)</Label>
              <Input
                type="number" min="0" step="0.01"
                value={formData.monthly_rent}
                onChange={(e) => {
                  const rent = e.target.value;
                  const months = parseInt(formData.deposit_months) || 0;
                  const dep = rent && months ? (parseFloat(rent) * months).toString() : formData.deposit_amount;
                  setFormData({ ...formData, monthly_rent: rent, deposit_amount: dep });
                }}
                placeholder="e.g., 15000" className="bg-background border-border"
              />
            </div>

            <div className="grid gap-2 mt-4">
              <Label>Other Charges</Label>
              <OtherChargesTable items={chargeItems} onChange={setChargeItems} />
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="grid gap-2">
                <Label>Deposit Amount (KES)</Label>
                <Input type="number" min="0" value={formData.deposit_amount} onChange={(e) => setFormData({ ...formData, deposit_amount: e.target.value })} placeholder="e.g., 30000" className="bg-background border-border" />
              </div>
              <div className="grid gap-2">
                <Label>Deposit (Months)</Label>
                <Input
                  type="number" min="1" max="12"
                  value={formData.deposit_months}
                  onChange={(e) => {
                    const months = e.target.value;
                    const rent = parseFloat(formData.monthly_rent) || 0;
                    const dep = months && rent ? (parseInt(months) * rent).toString() : formData.deposit_amount;
                    setFormData({ ...formData, deposit_months: months, deposit_amount: dep });
                  }}
                  placeholder="e.g., 2" className="bg-background border-border"
                />
                <p className="text-xs text-muted-foreground">Auto-calculates deposit from rent × months</p>
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="border-t border-border pt-4 mt-2">
            <h4 className="text-sm font-medium text-foreground mb-3">Notifications</h4>
            <div className="space-y-3">
              <div className="flex items-center space-x-3 p-3 rounded-lg bg-amber-400/10 border border-amber-400/15">
                <Mail className="h-5 w-5 text-warning" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Email Activation</p>
                  <p className="text-xs text-muted-foreground">Secure link to set password</p>
                </div>
                <Badge variant="outline" className="text-warning border-accent">Always sent</Badge>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50 border border-border">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">SMS</p>
                </div>
                <Checkbox checked={sendSmsNotification} onCheckedChange={(c) => setSendSmsNotification(c === true)} disabled={!formData.phone} />
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50 border border-border">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">WhatsApp</p>
                </div>
                <Checkbox checked={sendWhatsappNotification} onCheckedChange={(c) => setSendWhatsappNotification(c === true)} disabled={!formData.whatsapp} />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>Cancel</Button>
          <Button onClick={handleAddTenant} disabled={isUploading}>
            {isUploading ? "Adding..." : "Add Tenant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
