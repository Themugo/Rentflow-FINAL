import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthContext";
import { useToast } from "@/shared/hooks/use-toast";
import { exportContractToPdf } from "@/features/contracts/lib/contractPdfExport";

export interface Contract {
  id: string;
  title: string;
  content: string;
  status: string;
  valid_from: string | null;
  valid_until: string | null;
  tenant_signature: string | null;
  tenant_signed_at: string | null;
  manager_signature: string | null;
  manager_signed_at: string | null;
  created_at: string;
  uploaded_contract_url: string | null;
}

export interface TenantInfo {
  name: string;
  property: string | null;
  unit: string | null;
}

/**
 * Shared data + actions for the tenant contracts experience.
 * Used by both the standalone TenantContracts page and the
 * embedded TenantContractsSection widget on the tenant portal
 * home, which render the same underlying data differently.
 */
export function useTenantContracts() {
  const { userRole } = useAuth();
  const { toast } = useToast();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const fetchContracts = useCallback(async () => {
    if (!userRole?.tenant_id) return;

    const { data, error } = await supabase
      .from("contracts")
      .select("*")
      .eq("tenant_id", userRole.tenant_id)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Unable to load contracts",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setContracts(data || []);
    }
    setLoading(false);
  }, [userRole?.tenant_id, toast]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const fetchTenantInfo = useCallback(async () => {
    if (!userRole?.tenant_id) return;
    const { data } = await supabase
      .from("tenants")
      .select("name, property, unit")
      .eq("id", userRole.tenant_id)
      .single();
    if (data) setTenantInfo(data);
  }, [userRole?.tenant_id]);

  useEffect(() => {
    fetchContracts();
    fetchTenantInfo();
  }, [userRole?.tenant_id, fetchContracts, fetchTenantInfo]);

  const handleViewContract = (contract: Contract) => {
    setSelectedContract(contract);
    setViewDialogOpen(true);
  };

  const handleSignContract = (contract: Contract) => {
    setSelectedContract(contract);
    setSignDialogOpen(true);
  };

  const handleSaveSignature = async (signature: string) => {
    if (!selectedContract) return;

    setIsSigning(true);
    try {
      const signedAt = new Date().toISOString();

      const { error } = await supabase.rpc('sign_tenant_contract_atomic', { p_contract_id: selectedContract.id, p_signature: signature });

      if (error) throw error;

      // Send email notification to manager
      try {
        // Fetch company settings for company name
        const { data: companyData } = await supabase
          .from("company_settings")
          .select("company_name, email")
          .limit(1)
          .single();

        const companyName = companyData?.company_name || "CALQULUS PMS Properties";
        const managerEmail = companyData?.email;

        if (managerEmail && tenantInfo) {
          await supabase.functions.invoke("send-signature-notification", {
            body: {
              managerEmail,
              tenantName: tenantInfo.name,
              contractTitle: selectedContract.title,
              propertyInfo: tenantInfo.property && tenantInfo.unit
                ? `${tenantInfo.property} - ${tenantInfo.unit}`
                : "N/A",
              signedAt: new Date(signedAt).toLocaleString(),
              companyName,
            },
          });
        }
      } catch (emailError) {
        // Don't fail the signing if email fails
      }

      toast({
        title: "Contract signed!",
        description: "Your signature has been saved successfully.",
      });

      setSignDialogOpen(false);
      fetchContracts();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save your signature. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSigning(false);
    }
  };

  const handleExportPdf = async (contract: Contract) => {
    setIsExporting(true);
    try {
      await exportContractToPdf({
        title: contract.title,
        content: contract.content,
        valid_from: contract.valid_from,
        valid_until: contract.valid_until,
        manager_signature: contract.manager_signature,
        manager_signed_at: contract.manager_signed_at,
        tenant_signature: contract.tenant_signature,
        tenant_signed_at: contract.tenant_signed_at,
        tenantName: tenantInfo?.name,
        propertyInfo: tenantInfo?.property && tenantInfo?.unit ? `${tenantInfo.property} - ${tenantInfo.unit}` : undefined,
      });
      toast({
        title: "PDF exported",
        description: "Your contract has been downloaded.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Unable to export the contract. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleUploadContract = async (e: React.ChangeEvent<HTMLInputElement>, contract: Contract) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Only allow one upload per contract
    if (contract.uploaded_contract_url) {
      toast({
        title: "Already uploaded",
        description: "You can only upload one signed contract document.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${contract.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('signed-contracts')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Store the file path - signed URLs will be generated when viewing
      const storagePath = `signed-contracts/${fileName}`;

      const { error: updateError } = await supabase.rpc('attach_tenant_contract_document_atomic', { p_contract_id: contract.id, p_document_url: storagePath });

      if (updateError) throw updateError;

      toast({
        title: "Contract uploaded",
        description: "Your signed contract has been uploaded successfully.",
      });

      fetchContracts();
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload contract. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadUploadedContract = async (url: string, title: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const extension = url.split('.').pop()?.split('?')[0] || 'pdf';
      link.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      toast({
        title: "Download started",
        description: "Your contract is being downloaded.",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Unable to download the contract.",
        variant: "destructive",
      });
    }
  };

  // Include uploaded contracts that need signature (uploaded_contract_url exists but no tenant signature)
  const pendingSignatureContracts = contracts.filter(c =>
    (c.status === "pending_signature" || (c.uploaded_contract_url && !c.tenant_signature)) && !c.tenant_signature
  );
  const activeContracts = contracts.filter(c => c.status === "active" || (c.tenant_signature && c.manager_signature));
  const otherContracts = contracts.filter(c => !pendingSignatureContracts.includes(c) && !activeContracts.includes(c));

  return {
    contracts,
    loading,
    selectedContract,
    setSelectedContract,
    viewDialogOpen,
    setViewDialogOpen,
    signDialogOpen,
    setSignDialogOpen,
    isSigning,
    isExporting,
    isUploading,
    tenantInfo,
    fetchContracts,
    handleViewContract,
    handleSignContract,
    handleSaveSignature,
    handleExportPdf,
    handleUploadContract,
    handleDownloadUploadedContract,
    pendingSignatureContracts,
    activeContracts,
    otherContracts,
  };
}
