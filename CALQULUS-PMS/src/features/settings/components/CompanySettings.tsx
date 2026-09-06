import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Loader2, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/shared/hooks/use-toast";
import { toUserFacingError } from "@/shared/lib/errorLogger";
import { useAuth } from "@/features/auth/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateManagerActivation } from "@/features/dashboard/hooks/useManagerActivation";

export type CompanySettingsSection = "all" | "organization";

export const CompanySettings = ({ section: _section = "all" }: { section?: CompanySettingsSection }) => {
  const { toast } = useToast();
  const { isAgency, isManager, user } = useAuth();
  const canManageCompany = isManager || isAgency;
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyWhatsapp, setCompanyWhatsapp] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [kraPin, setKraPin] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");

  useEffect(() => {
    const fetchCompanySettings = async () => {
      if (!canManageCompany) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("company_settings")
          .select("*")
          .eq("manager_user_id", user!.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setCompanyId(data.id);
          setCompanyName(data.company_name || "");
          setAddress(data.address || "");
          setCity(data.city || "");
          setState(data.state || "");
          setZipCode(data.zip_code || "");
          setCompanyEmail(data.email || "");
          setCompanyPhone(data.phone || "");
          setCompanyWebsite(data.website || "");
        }

        if (user?.id) {
          const { data: agency } = await supabase.from("agencies")
            .select("phone, email, address, county, kra_pin, registration_number, whatsapp, website")
            .eq("manager_id", user.id)
            .maybeSingle();
          if (agency) {
            const a = agency as { whatsapp?: string; county?: string; kra_pin?: string; registration_number?: string; phone?: string; email?: string; address?: string };
            setCompanyWhatsapp(a.whatsapp || "");
            setCounty(a.county || "");
            setKraPin(a.kra_pin || "");
            setRegistrationNumber(a.registration_number || "");
            const d = data as { phone?: string; email?: string; address?: string } | null;
            if (!d?.phone) setCompanyPhone(a.phone || "");
            if (!d?.email) setCompanyEmail(a.email || "");
            if (!d?.address) setAddress(a.address || "");
          }
        }
      } catch (error) {
        toast({
          title: "Company Settings Load Failed",
          description: error instanceof Error ? error.message : "Could not load company settings.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    void fetchCompanySettings();
  }, [canManageCompany, toast, user?.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!user?.id) throw new Error("You must be signed in to save company details.");

      // Fields company_settings actually has
      const companyPayload = {
        company_name: companyName,
        address,
        city,
        state,
        zip_code: zipCode,
        email: companyEmail,
        phone: companyPhone,
        website: companyWebsite,
      };

      const { data, error } = await supabase.rpc('save_manager_company_settings_atomic', {
        p_payload: { ...companyPayload, county, kra_pin: kraPin, registration_number: registrationNumber, whatsapp: companyWhatsapp },
      });
      if (error) throw error;
      setCompanyId(data);

      toast({
        title: "Company Details Saved",
        description: "Your company information has been updated.",
      });
      invalidateManagerActivation(queryClient);
      queryClient.invalidateQueries({ queryKey: ["org-brand"] });
    } catch (error) {
      toast({
        title: "Couldn't save company details",
        description: toUserFacingError(error, "Your details are still here. Check the fields and try again."),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!canManageCompany) {
    return null;
  }

  const showOrganization = true;
  const heading = "Organization";
  const description = "Shown on contracts and invoices. Desk chrome is Brand Studio.";

  return (
    <Card className="card-shadow animate-fade-in" style={{ animationDelay: "100ms" }}>
      <CardHeader>
        <CardTitle className="font-heading flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          {heading}
        </CardTitle>
        <CardDescription>
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {showOrganization && (
            <>
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Enter company name"
              />
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              <p className="text-sm font-medium">Documents</p>
              <p className="text-xs text-muted-foreground">
                Invoice, receipt, statement, and report branding is edited in Brand Studio. This company remains the issuer.
              </p>
            </div>
            </>
            )}


            {showOrganization && (
            <>
            <div className="space-y-2">
              <Label htmlFor="address">Business Address</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter business address"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="State"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip">ZIP Code</Label>
                <Input
                  id="zip"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  placeholder="ZIP"
                />
              </div>
            </div>

            <div className="pt-2">
              <p className="text-sm font-medium mb-3">Contact Information</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyEmail">Email</Label>
                  <Input
                    id="companyEmail"
                    type="email"
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                    placeholder="company@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyPhone">Phone</Label>
                  <Input
                    id="companyPhone"
                    type="tel"
                    value={companyPhone}
                    onChange={(e) => setCompanyPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="companyWebsite">Website</Label>
                <Input
                  id="companyWebsite"
                  type="url"
                  value={companyWebsite}
                  onChange={(e) => setCompanyWebsite(e.target.value)}
                  placeholder="https://www.example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyWhatsapp">WhatsApp number</Label>
                <Input
                  id="companyWhatsapp"
                  value={companyWhatsapp}
                  onChange={(e) => setCompanyWhatsapp(e.target.value)}
                  placeholder="2547XXXXXXXX (international format)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="county">County</Label>
                <Input
                  id="county"
                  value={county}
                  onChange={(e) => setCounty(e.target.value)}
                  placeholder="e.g. Nairobi, Mombasa, Kisumu"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kraPin">KRA PIN</Label>
                <Input
                  id="kraPin"
                  value={kraPin}
                  onChange={(e) => setKraPin(e.target.value.toUpperCase())}
                  placeholder="A012345678Z"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="registrationNumber">Business registration no.</Label>
                <Input
                  id="registrationNumber"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                  placeholder="e.g. CPR/2024/1234567"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2 col-span-2">
                This contact information will appear on invoices and contracts
              </p>
            </div>
            </>
            )}
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving} size="sm">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Company Details
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
