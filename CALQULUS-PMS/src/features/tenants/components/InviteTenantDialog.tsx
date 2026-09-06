import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { toast } from "@/shared/hooks/use-toast";
import { toUserFacingError } from "@/shared/lib/errorLogger";
import { loadFormDraft, saveFormDraft, clearFormDraft } from "@/shared/lib/formDraft";
import { trackTimeToFirst } from "@/features/dashboard/lib/activationMetrics";
import { invalidateManagerActivation } from "@/features/dashboard/hooks/useManagerActivation";
import { useAuth } from "@/features/auth/AuthContext";
import { Mail, Loader2, UserPlus, Copy, Check, MessageCircle, Phone, Send } from "lucide-react";

interface InviteTenantDialogProps {
  trigger?: React.ReactNode;
  /** Pre-selects a property — used when adding a tenant from a property detail page */
  preSelectedPropertyId?: string;
}

export function InviteTenantDialog({ trigger, preSelectedPropertyId }: InviteTenantDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const draft = loadFormDraft<{
    email: string; tenantName: string; phone: string; selectedPropertyId: string; unit: string;
    monthlyRent: string; houseDeposit: string; waterDeposit: string;
  }>("invite-tenant");
  const [email, setEmail] = useState(draft?.email ?? "");
  const [tenantName, setTenantName] = useState(draft?.tenantName ?? "");
  const [phone, setPhone] = useState(draft?.phone ?? "");
  const [selectedPropertyId, setSelectedPropertyId] = useState(preSelectedPropertyId || draft?.selectedPropertyId || "");
  const [unit, setUnit] = useState(draft?.unit ?? "");
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [monthlyRent, setMonthlyRent] = useState(draft?.monthlyRent ?? "");
  const [houseDeposit, setHouseDeposit] = useState(draft?.houseDeposit ?? "");
  const [waterDeposit, setWaterDeposit] = useState(draft?.waterDeposit ?? "");

  const { data: properties } = useQuery({
    queryKey: ["properties-for-invite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const selectedProperty = properties?.find(p => p.id === selectedPropertyId);

  useEffect(() => {
    if (invitationUrl) return;
    saveFormDraft("invite-tenant", {
      email, tenantName, phone, selectedPropertyId, unit, monthlyRent, houseDeposit, waterDeposit,
    });
  }, [email, tenantName, phone, selectedPropertyId, unit, monthlyRent, houseDeposit, waterDeposit, invitationUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Require tenant name, property, and at least one contact method (email OR phone)
    if (!tenantName || !selectedPropertyId) {
      toast({
        title: "Missing fields",
        description: "Please enter tenant name and select a property.",
        variant: "destructive",
      });
      return;
    }

    if (!email && !phone) {
      toast({
        title: "Contact method required",
        description: "Please provide either an email address or phone number.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-tenant-invitation", {
        body: {
          email,
          tenantName,
          phone: phone || undefined,
          propertyId: selectedPropertyId,
          propertyName: selectedProperty?.name || "",
          unit: unit || undefined,
          // Payment details — tenant portal shows these immediately
          monthlyRent:  monthlyRent ? parseFloat(monthlyRent) : undefined,
          houseDeposit: houseDeposit ? parseFloat(houseDeposit) : undefined,
          waterDeposit: waterDeposit ? parseFloat(waterDeposit) : undefined,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      // Store the invitation URL for copy functionality
      if (data?.invitationUrl) {
        setInvitationUrl(data.invitationUrl);
      }

      if (data?.emailError || data?.warning) {
        toast({
          title: "Invitation created",
          description: data?.warning || `Email could not be sent. You can copy the invitation link below.`,
          variant: "default",
        });
      } else {
        toast({
          title: "Invitation sent!",
          description: `An invitation email has been sent to ${email}.`,
        });
      }

      clearFormDraft("invite-tenant");
      trackTimeToFirst("tenant", { managerId: user?.id, signupAt: user?.created_at });
      invalidateManagerActivation(queryClient);

    } catch (err: unknown) {
      toast({
        title: "Failed to send invitation",
        description: toUserFacingError(err, "Could not send this invitation. Your details are still here — try again."),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (invitationUrl) {
      try {
        await navigator.clipboard.writeText(invitationUrl);
        setCopied(true);
        toast({
          title: "Link copied!",
          description: "Invitation link copied to clipboard.",
        });
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        toast({
          title: "Failed to copy",
          description: "Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const handleWhatsAppShare = () => {
    if (invitationUrl) {
      // Format phone number for WhatsApp (remove spaces, dashes, ensure + prefix)
      let formattedPhone = phone.replace(/[\s-]/g, "");
      if (!formattedPhone.startsWith("+")) {
        // Assume Kenya if no country code
        if (formattedPhone.startsWith("0")) {
          formattedPhone = "+254" + formattedPhone.substring(1);
        } else if (formattedPhone.startsWith("254")) {
          formattedPhone = "+" + formattedPhone;
        } else {
          formattedPhone = "+254" + formattedPhone;
        }
      }
      
      const message = encodeURIComponent(
        `Hi ${tenantName}! 👋\n\nYou've been invited to join ${selectedProperty?.name || "your property"}${unit ? ` (Unit ${unit})` : ""} on CALQULUS PMS.\n\nClick the link below to create your tenant account:\n${invitationUrl}\n\nWith CALQULUS PMS, you can:\n✅ View your lease details\n✅ Pay rent online via M-Pesa\n✅ Submit maintenance requests\n✅ Download statements and receipts`
      );
      
      // Remove the + for WhatsApp URL format
      const whatsappPhone = formattedPhone.replace("+", "");
      window.open(`https://wa.me/${whatsappPhone}?text=${message}`, "_blank");
    }
  };

  const handleSendSMS = async () => {
    if (!invitationUrl || !phone) return;
    
    setIsSendingSms(true);
    
    try {
      const smsMessage = `Hi ${tenantName}! You've been invited to join ${selectedProperty?.name || "your property"}${unit ? ` (Unit ${unit})` : ""} on CALQULUS PMS. Create your account here: ${invitationUrl}`;
      
      const { data, error } = await supabase.functions.invoke("send-sms-notification", {
        body: {
          phoneNumber: phone,
          message: smsMessage,
        },
      });

      if (error) throw error;

      if (data?.success) {
        setSmsSent(true);
        toast({
          title: "SMS sent!",
          description: `Invitation SMS sent to ${phone}.`,
        });
      } else {
        throw new Error(data?.error || "Failed to send SMS");
      }
    } catch (err: unknown) {
      toast({
        title: "Failed to send SMS",
        description: toUserFacingError(err, "Could not send the SMS. The invitation is still here — try again."),
        variant: "destructive",
      });
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    if (!invitationUrl) return;
    setTimeout(() => {
      setEmail("");
      setTenantName("");
      setPhone("");
      setSelectedPropertyId(preSelectedPropertyId || "");
      setUnit("");
      setInvitationUrl(null);
      setCopied(false);
      setSmsSent(false);
      setMonthlyRent("");
      setHouseDeposit("");
      setWaterDeposit("");
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Mail className="mr-2 h-4 w-4" />
            Invite Tenant
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite New Tenant
          </DialogTitle>
          <DialogDescription>
            Send an invitation via email or WhatsApp/SMS. At least one contact method is required.
          </DialogDescription>
        </DialogHeader>

        {invitationUrl ? (
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-amber-400/20 bg-amber-400/6 p-4">
              <div className="flex items-center gap-2 text-warning mb-2">
                <Check className="h-5 w-5" />
                <span className="font-medium">Invitation Created!</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                {email ? `An invitation has been created for ${email}.` : "The invitation link is ready."}
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 p-2 bg-background rounded border text-xs truncate">
                  {invitationUrl}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyLink}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            
            {/* Share options */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Share invitation with tenant:</p>
              <div className="flex flex-col gap-2">
                {/* WhatsApp sharing option */}
                {phone && (
                  <Button
                    variant="outline"
                    className="w-full bg-green-500/10 border-green-500/30 hover:bg-green-500/20 text-green-700"
                    onClick={handleWhatsAppShare}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Send via WhatsApp
                  </Button>
                )}
                
                {/* SMS sharing option */}
                {phone && (
                  <Button
                    variant="outline"
                    className="w-full bg-[hsl(214_73%_48%/0.1)] border-[hsl(214_73%_48%/0.3)] hover:bg-[hsl(214_73%_48%/0.2)] text-[hsl(214_73%_35%)]"
                    onClick={handleSendSMS}
                    disabled={isSendingSms || smsSent}
                  >
                    {isSendingSms ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending SMS...
                      </>
                    ) : smsSent ? (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        SMS Sent!
                      </>
                    ) : (
                      <>
                        <Phone className="mr-2 h-4 w-4" />
                        Send via SMS
                      </>
                    )}
                  </Button>
                )}

                {/* No contact method hint */}
                {!phone && !email && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Copy the link above to share manually
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button onClick={() => {
                setInvitationUrl(null);
                setEmail("");
                setTenantName("");
                setPhone("");
                setSelectedPropertyId("");
                setUnit("");
                setSmsSent(false);
              }}>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Another
              </Button>
            </div>
          </div>
        ) : (

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tenantName">Tenant Name *</Label>
            <Input
              id="tenantName"
              placeholder="John Doe"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address {!phone && <span className="text-destructive">*</span>}</Label>
            <Input
              id="email"
              type="email"
              placeholder="tenant@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Email is used for account creation and notifications
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number {!email && <span className="text-destructive">*</span>}</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+254712345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Phone is used for SMS/WhatsApp invitations
            </p>
          </div>

          {!email && !phone && (
            <div className="rounded-md bg-warning/10 border border-warning/30 p-3 text-sm text-warning">
              Please provide at least an email address or phone number to send the invitation.
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="property">Property *</Label>
            <Select
              value={selectedPropertyId}
              onValueChange={setSelectedPropertyId}
              disabled={isLoading || !!preSelectedPropertyId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a property" />
              </SelectTrigger>
              <SelectContent>
                {properties?.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unit">Unit (Optional)</Label>
            <Input
              id="unit"
              placeholder="e.g., A101"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {/* Payment details — pushed to tenant portal on accept */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Payment terms (optional — tenant sees these in their portal)
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Monthly rent (KES)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 15000"
                  value={monthlyRent}
                  onChange={e => setMonthlyRent(e.target.value)}
                  disabled={isLoading}
                  className="mt-1 h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">House deposit (KES)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 30000"
                  value={houseDeposit}
                  onChange={e => setHouseDeposit(e.target.value)}
                  disabled={isLoading}
                  className="mt-1 h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Water deposit (KES)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 2000"
                  value={waterDeposit}
                  onChange={e => setWaterDeposit(e.target.value)}
                  disabled={isLoading}
                  className="mt-1 h-8 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || (!email && !phone)}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Create Invitation
                </>
              )}
            </Button>
          </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}