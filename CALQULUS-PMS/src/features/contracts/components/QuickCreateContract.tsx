import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Label } from "@/shared/components/ui/label";
import { Input } from "@/shared/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/shared/hooks/use-toast";
import { Loader2, Zap, Send, Copy, Check, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";

interface Lease {
  id: string;
  property: string;
  property_id: string | null;
  unit: string;
  unit_id: string | null;
  monthly_rent: number;
  deposit: number | null;
  start_date: string;
  end_date: string;
  tenant_id: string | null;
  tenants: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  } | null;
}

interface Template {
  id: string;
  name: string;
  content: string;
  is_default?: boolean | null;
}

interface Props {
  leases: Lease[];
  templates: Template[];
  onContractCreated: () => void;
}

export function QuickCreateContract({ leases, templates, onContractCreated }: Props) {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedLeaseId, setSelectedLeaseId] = useState("");
  const [createdContractId, setCreatedContractId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [credentialsEmailed, setCredentialsEmailed] = useState(false);
  
  // New tenant form fields
  const [newTenant, setNewTenant] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const defaultTemplate = templates.find(t => t.is_default) || templates[0];

  // Get leases without tenants for new tenant assignment
  const leasesWithoutTenants = leases.filter(l => !l.tenant_id);
  const leasesWithTenants = leases.filter(l => l.tenant_id && l.tenants);

  const populateTemplate = async (templateContent: string, lease: Lease): Promise<string> => {
    // Fetch company settings
    const { data: company } = await supabase
      .from("company_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    // Fetch property details
    const { data: property } = await supabase
      .from("properties")
      .select("address")
      .eq("name", lease.property)
      .maybeSingle();

    const replacements: Record<string, string> = {
      "{{company_name}}": company?.company_name || "CALQULUS PMS Properties",
      "{{company_address}}": [company?.address, company?.city, company?.state, company?.zip_code].filter(Boolean).join(", ") || "N/A",
      "{{company_email}}": company?.email || "N/A",
      "{{company_phone}}": company?.phone || "N/A",
      "{{tenant_name}}": lease.tenants?.name || "N/A",
      "{{tenant_email}}": lease.tenants?.email || "N/A",
      "{{tenant_phone}}": lease.tenants?.phone || "N/A",
      "{{property_name}}": lease.property,
      "{{unit_number}}": lease.unit,
      "{{property_address}}": property?.address || "N/A",
      "{{start_date}}": format(new Date(lease.start_date), "dd/MM/yy"),
      "{{end_date}}": format(new Date(lease.end_date), "dd/MM/yy"),
      "{{monthly_rent}}": formatCurrency(lease.monthly_rent),
      "{{deposit}}": formatCurrency(lease.deposit || 0),
    };

    let content = templateContent;
    for (const [placeholder, value] of Object.entries(replacements)) {
      content = content.replace(new RegExp(placeholder.replace(/[{}]/g, "\\$&"), "g"), value);
    }
    
    return content;
  };

  const handleQuickCreate = async () => {
    if (!selectedLeaseId) {
      toast({
        title: "Select a Lease",
        description: "Please select a lease to create a contract for.",
        variant: "destructive",
      });
      return;
    }

    if (!defaultTemplate) {
      toast({
        title: "No Template Found",
        description: "Please create a contract template first.",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);

    try {
      let lease = leases.find(l => l.id === selectedLeaseId);
      if (!lease) throw new Error("Lease not found");

      let tenantId = lease.tenant_id;
      let tenantName = lease.tenants?.name;
      let tenantEmail = lease.tenants?.email;

      // If new tenant mode, create tenant with login account
      if (mode === "new") {
        if (!newTenant.name.trim() || !newTenant.email.trim()) {
          toast({
            title: "Missing Information",
            description: "Please provide tenant name and email.",
            variant: "destructive",
          });
          setCreating(false);
          return;
        }

        // Fetch company name for email
        const { data: companyData } = await supabase
          .from("company_settings")
          .select("company_name")
          .limit(1)
          .single();

        // Create tenant account via edge function
        const { data: accountData, error: accountError } = await supabase.functions.invoke(
          "create-tenant-account",
          {
            body: {
              name: newTenant.name.trim(),
              email: newTenant.email.trim(),
              phone: newTenant.phone.trim() || null,
              property: lease.property,
              property_id: lease.property_id,
              unit: lease.unit,
              move_in_date: lease.start_date,
              companyName: companyData?.company_name || "CALQULUS PMS Properties",
              portalUrl: `${window.location.origin}/portal`,
            },
          }
        );

        if (accountError) throw accountError;
        if (!accountData?.success) throw new Error(accountData?.error || "Failed to create tenant account");

        const createdTenant = accountData.tenant;

        // Mark if credentials were emailed
        if (accountData.isNewUser && accountData.emailSent) {
          setCredentialsEmailed(true);
        }

        // Update the lease with the new tenant
        const { error: leaseError } = await supabase.rpc('assign_lease_tenant_atomic', { p_lease_id: lease.id, p_tenant_id: createdTenant.id });

        if (leaseError) throw leaseError;

        tenantId = createdTenant.id;
        tenantName = createdTenant.name;
        tenantEmail = createdTenant.email;

        // Update local lease reference for template population
        lease = {
          ...lease,
          tenant_id: createdTenant.id,
          tenants: createdTenant,
        };
      }

      const populatedContent = await populateTemplate(defaultTemplate.content, lease);

      const { data, error } = await supabase.rpc("create_contract_atomic", {
        p_lease_id: lease.id, p_tenant_id: tenantId, p_property_id: lease.property_id || null, p_unit_id: lease.unit_id || null,
        p_template_id: defaultTemplate.id, p_title: `Lease Agreement - ${lease.property} Unit ${lease.unit}`,
        p_content: populatedContent, p_valid_from: lease.start_date, p_valid_until: lease.end_date, p_status: "pending_approval",
      });

      if (error) throw error;

      setCreatedContractId(data.id);

      // Send notification to tenant
      if (tenantEmail) {
        const { data: company } = await supabase
          .from("company_settings")
          .select("company_name")
          .limit(1)
          .maybeSingle();

        await supabase.functions.invoke("send-contract-notification", {
          body: {
            tenantEmail: tenantEmail,
            tenantName: tenantName || "Tenant",
            companyName: company?.company_name || "CALQULUS PMS Properties",
            contractTitle: `Lease Agreement - ${lease.property} Unit ${lease.unit}`,
            propertyInfo: `${lease.property} - ${lease.unit}`,
            validFrom: format(new Date(lease.start_date), "dd/MM/yy"),
            validUntil: format(new Date(lease.end_date), "dd/MM/yy"),
            portalUrl: `${window.location.origin}/portal`,
          },
        });
      }

      toast({
        title: "Contract Created & Sent!",
        description: `Contract sent to ${tenantName || "tenant"} for signing.`,
      });

      onContractCreated();
    } catch {
      toast({
        title: "Error",
        description: "Failed to create contract. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const getShareableLink = () => {
    return `${window.location.origin}/portal`;
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getShareableLink());
      setCopied(true);
      toast({
        title: "Link Copied!",
        description: "Tenant portal link copied to clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Copy Failed",
        description: "Please copy the link manually.",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedLeaseId("");
    setCreatedContractId(null);
    setCopied(false);
    setMode("existing");
    setNewTenant({ name: "", email: "", phone: "" });
    setCredentialsEmailed(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleClose();
      else setOpen(true);
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Zap className="h-4 w-4" />
          Quick Create & Send
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-warning" />
            Quick Create Contract
          </DialogTitle>
          <DialogDescription>
            Instantly create a lease agreement using the default template and send it to the tenant for signing.
          </DialogDescription>
        </DialogHeader>

        {!createdContractId ? (
          <>
            <div className="space-y-4 py-4">
              <Tabs value={mode} onValueChange={(v) => { setMode(v as "existing" | "new"); setSelectedLeaseId(""); }}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="existing">Existing Tenant</TabsTrigger>
                  <TabsTrigger value="new">
                    <UserPlus className="h-4 w-4 mr-1" />
                    New Tenant
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="existing" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Select Active Lease</Label>
                    <Select value={selectedLeaseId} onValueChange={setSelectedLeaseId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a lease with tenant..." />
                      </SelectTrigger>
                      <SelectContent>
                        {leasesWithTenants.length === 0 ? (
                          <SelectItem value="none" disabled>
                            No leases with tenants found
                          </SelectItem>
                        ) : (
                          leasesWithTenants.map((lease) => (
                            <SelectItem key={lease.id} value={lease.id}>
                              {lease.property} - Unit {lease.unit} ({lease.tenants?.name})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                <TabsContent value="new" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Select Lease (without tenant)</Label>
                    <Select value={selectedLeaseId} onValueChange={setSelectedLeaseId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a vacant lease..." />
                      </SelectTrigger>
                      <SelectContent>
                        {leasesWithoutTenants.length === 0 ? (
                          <SelectItem value="none" disabled>
                            No vacant leases found
                          </SelectItem>
                        ) : (
                          leasesWithoutTenants.map((lease) => (
                            <SelectItem key={lease.id} value={lease.id}>
                              {lease.property} - Unit {lease.unit}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedLeaseId && mode === "new" && (
                    <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                      <h4 className="font-medium text-sm">New Tenant Details</h4>
                      <div className="space-y-2">
                        <Label>Full Name *</Label>
                        <Input
                          value={newTenant.name}
                          onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                          placeholder="John Doe"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email *</Label>
                        <Input
                          type="email"
                          value={newTenant.email}
                          onChange={(e) => setNewTenant({ ...newTenant, email: e.target.value })}
                          placeholder="john@example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone (optional)</Label>
                        <Input
                          value={newTenant.phone}
                          onChange={(e) => setNewTenant({ ...newTenant, phone: e.target.value })}
                          placeholder="+1 (555) 000-0000"
                        />
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              {selectedLeaseId && (
                <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                  <p className="font-medium">This will:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    {mode === "new" && <li>Create a new tenant record</li>}
                    <li>Create a contract using the default template</li>
                    <li>Auto-populate lease details (rent, dates, tenant info)</li>
                    <li>Send an email notification to the tenant</li>
                    <li>Mark the contract as "Pending Signature"</li>
                  </ul>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleQuickCreate} 
                disabled={creating || !selectedLeaseId || (mode === "new" && (!newTenant.name.trim() || !newTenant.email.trim()))}
              >
                {creating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {mode === "new" ? "Create Tenant & Send" : "Create & Send"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-center">
                <div className="h-12 w-12 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center text-success">
                  <Check className="h-6 w-6" />
                </div>
              </div>
              <div className="text-center">
                <p className="font-medium text-lg">Contract Sent Successfully!</p>
                <p className="text-muted-foreground text-sm mt-1">
                  The tenant will receive an email with instructions to sign.
                </p>
              </div>

              {credentialsEmailed && (
                <div className="space-y-2 p-4 border border-green-500/20 rounded-lg bg-green-500/5">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <Label className="text-green-600 font-medium">Login Credentials Sent</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    The tenant has received an email with their login credentials to access the portal.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Share Tenant Portal Link</Label>
                <div className="flex gap-2">
                  <code className="flex-1 bg-muted px-3 py-2 rounded text-sm truncate">
                    {getShareableLink()}
                  </code>
                  <Button variant="outline" size="icon" onClick={handleCopyLink} aria-label={copied ? "Link copied" : "Copy link"}>
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Tenants can log in to the portal to view and sign their contracts.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
