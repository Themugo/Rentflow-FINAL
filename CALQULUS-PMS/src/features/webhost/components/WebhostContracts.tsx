// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import { useState, useEffect, useRef } from "react";
import { Button } from "@/shared/components/ui/button";
import { openSafely } from "@/shared/lib/safeWindow";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import {
  Search,
  FileText,
  CheckCircle,
  Clock,
  Eye,
  Download,
  XCircle,
  Upload,
  RefreshCw,
  Plus,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  Users,
  FileUp,
  RotateCcw,
  ExternalLink,
  Building,
  Sparkles,
  Loader2,
} from "lucide-react";
import { useToast } from "@/shared/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ScrollArea } from "@/shared/components/ui/scroll-area";

type ContractStatus = "pending" | "approved" | "rejected" | "signed" | "expired" | "cancelled";

interface ManagerContract {
  id: string;
  manager_user_id: string;
  manager_email: string;
  manager_name: string | null;
  title: string;
  description: string | null;
  contract_type: string | null;
  status: ContractStatus;
  uploaded_contract_url: string | null;
  parsed_content: Record<string, unknown> | null;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  signed_at: string | null;
  signature_url: string | null;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
}

interface Manager {
  id: string;
  email: string;
  full_name: string | null;
}

const statusConfig: Record<ContractStatus, { label: string; styles: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: "Pending Review", styles: "bg-warning text-white border-warning", icon: Clock },
  approved: { label: "Approved", styles: "bg-success text-white border-success", icon: CheckCircle },
  rejected: { label: "Rejected", styles: "bg-destructive text-white border-red-700", icon: XCircle },
  signed: { label: "Signed", styles: "bg-[hsl(214_73%_45%)] text-white border-[hsl(214_73%_38%)]", icon: ShieldCheck },
  expired: { label: "Expired", styles: "bg-secondary-foreground text-white border-gray-700", icon: XCircle },
  cancelled: { label: "Cancelled", styles: "bg-secondary-foreground text-white border-border", icon: XCircle },
};

const WebhostContracts = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [contracts, setContracts] = useState<ManagerContract[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [managerTiers, setManagerTiers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [managerFilter, setManagerFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [expiryFilter, setExpiryFilter] = useState("all");
  
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [retakeDialogOpen, setRetakeDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<ManagerContract | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parsedContent, setParsedContent] = useState<Record<string, unknown> | null>(null);
  
  // Upload form
  const [uploadForm, setUploadForm] = useState({
    manager_user_id: "",
    title: "",
    description: "",
    contract_type: "service_agreement",
    valid_from: "",
    valid_until: "",
  });
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setFetchError(null);

    try {
      const [contractsRes, managersRes] = await Promise.all([
        supabase
          .from("manager_contracts")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "manager")
          .eq("approval_status", "approved"),
      ]);

      if (contractsRes.error) throw contractsRes.error;
      if (contractsRes.data) {
        setContracts(contractsRes.data as ManagerContract[]);
      }

      // Fetch manager profiles
      let managerProfiles: Manager[] = [];
      if (managersRes.data && managersRes.data.length > 0) {
        const userIds = managersRes.data.map(m => m.user_id);
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .in("id", userIds);

        if (profilesError) throw profilesError;
        if (profiles) {
          managerProfiles = profiles as Manager[];
          setManagers(managerProfiles);
        }

        // Fetch subscription tier per manager (REAL, read-only — for tier relationship context)
        const { data: tiers } = await supabase
          .from("manager_profiles")
          .select("manager_user_id, subscription_tier")
          .in("manager_user_id", userIds);
        if (tiers) {
          const tierMap: Record<string, string> = {};
          for (const t of tiers as { manager_user_id: string; subscription_tier: string }[]) {
            tierMap[t.manager_user_id] = t.subscription_tier;
          }
          setManagerTiers(tierMap);
        }
      } else {
        setManagers([]);
        setManagerTiers({});
      }
    } catch (error: unknown) {
      setFetchError(error instanceof Error ? error.message : "Failed to load contracts.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Read-only derivation of expiry attention from valid_until. No auto-renewal logic.
  const getExpiryAttention = (contract: ManagerContract): "none" | "active" | "expiring" | "expired" => {
    if (!contract.valid_until) return "none";
    const expiry = new Date(contract.valid_until);
    const now = new Date();
    if (expiry < now) return "expired";
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    if (expiry.getTime() - now.getTime() <= thirtyDays) return "expiring";
    return "active";
  };

  const getFilteredContracts = () => {
    let filtered = contracts;
    
    if (statusFilter !== "all") {
      filtered = filtered.filter((c) => c.status === statusFilter);
    }
    
    if (managerFilter !== "all") {
      filtered = filtered.filter((c) => c.manager_user_id === managerFilter);
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter((c) => (c.contract_type || "service_agreement") === typeFilter);
    }

    if (expiryFilter !== "all") {
      filtered = filtered.filter((c) => getExpiryAttention(c) === expiryFilter);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.title.toLowerCase().includes(query) ||
          c.manager_email.toLowerCase().includes(query) ||
          c.manager_name?.toLowerCase().includes(query) ||
          c.description?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF or image file.",
          variant: "destructive",
        });
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please upload a file smaller than 10MB.",
          variant: "destructive",
        });
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const handleUploadContract = async () => {
    if (!uploadForm.manager_user_id || !uploadForm.title || !selectedFile) {
      toast({
        title: "Missing Information",
        description: "Please select a manager, enter a title, and upload a contract file.",
        variant: "destructive",
      });
      return;
    }

    setUploadingFile(true);

    try {
      // Get manager info
      const selectedManager = managers.find(m => m.id === uploadForm.manager_user_id);
      
      // Upload file to storage
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `manager-contracts/${uploadForm.manager_user_id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("contracts")
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Store the file path - signed URLs will be generated when viewing
      const storagePath = `contracts/${filePath}`;

      // Create contract record
      const { error: insertError } = await supabase.rpc("create_manager_contract_atomic", {
        p_manager_user_id: uploadForm.manager_user_id, p_manager_email: selectedManager?.email || "", p_manager_name: selectedManager?.full_name || null,
        p_title: uploadForm.title, p_description: uploadForm.description || null, p_contract_type: uploadForm.contract_type,
        p_uploaded_contract_url: storagePath, p_valid_from: uploadForm.valid_from || null, p_valid_until: uploadForm.valid_until || null,
      });

      if (insertError) throw insertError;

      // Send email notification to manager
      try {
        await supabase.functions.invoke("send-manager-contract-notification", {
          body: {
            managerEmail: selectedManager?.email,
            managerName: selectedManager?.full_name || selectedManager?.email,
            contractTitle: uploadForm.title,
            notificationType: "uploaded",
            portalUrl: `${window.location.origin}/platform-billing`,
          },
        });
      } catch {
        // Don't fail the whole operation if email fails
      }

      toast({ title: "Contract Uploaded", description: "The contract has been uploaded and the manager has been notified." });
      setUploadDialogOpen(false);
      setUploadForm({
        manager_user_id: "",
        title: "",
        description: "",
        contract_type: "service_agreement",
        valid_from: "",
        valid_until: "",
      });
      setSelectedFile(null);
      fetchData();
    } catch (error: unknown) {
      toast({ 
        title: "Upload Failed", 
        description: error instanceof Error ? error.message : "Failed to upload contract", 
        variant: "destructive" 
      });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleApproveContract = async () => {
    if (!selectedContract) return;

    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase.rpc("transition_manager_contract_atomic", { p_contract_id: selectedContract.id, p_status: "approved", p_review_notes: reviewNotes || null });

    if (error) {
      toast({ title: "Error", description: "Failed to approve contract", variant: "destructive" });
      return;
    }

    // Send approval email notification
    try {
      await supabase.functions.invoke("send-manager-contract-notification", {
        body: {
          managerEmail: selectedContract.manager_email,
          managerName: selectedContract.manager_name || selectedContract.manager_email,
          contractTitle: selectedContract.title,
          notificationType: "approved",
          reviewNotes: reviewNotes,
          portalUrl: `${window.location.origin}/platform-billing`,
        },
      });
    } catch (error) {
      logError('WebhostContracts', `Failed to send contract approval notification: ${error}`);
      toast({ 
        title: "Contract Approved", 
        description: "The contract has been approved, but the notification email may not have been sent. Please notify the manager manually.",
        variant: "warning" 
      });
      return;
    }

    toast({ title: "Contract Approved", description: "The contract has been approved and the manager has been notified." });
    setApproveDialogOpen(false);
    setReviewNotes("");
    setSelectedContract(null);
    fetchData();
  };

  const handleRejectContract = async () => {
    if (!selectedContract || !rejectionReason.trim()) {
      toast({ title: "Error", description: "Please provide a rejection reason.", variant: "destructive" });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase.rpc("transition_manager_contract_atomic", { p_contract_id: selectedContract.id, p_status: "rejected", p_review_notes: rejectionReason });

    if (error) {
      toast({ title: "Error", description: "Failed to reject contract", variant: "destructive" });
      return;
    }

    // Send rejection email notification
    try {
      await supabase.functions.invoke("send-manager-contract-notification", {
        body: {
          managerEmail: selectedContract.manager_email,
          managerName: selectedContract.manager_name || selectedContract.manager_email,
          contractTitle: selectedContract.title,
          notificationType: "rejected",
          reviewNotes: rejectionReason,
          portalUrl: `${window.location.origin}/platform-billing`,
        },
      });
    } catch (error) {
      logError('WebhostContracts', `Failed to send contract rejection notification: ${error}`);
      toast({ 
        title: "Contract Rejected", 
        description: "The contract has been rejected, but the notification email may not have been sent. Please notify the manager manually.",
        variant: "warning" 
      });
    }

    if (error) {
      toast({ title: "Error", description: "Failed to reject contract", variant: "destructive" });
      return;
    }

    toast({ title: "Contract Rejected", description: "The contract has been rejected." });
    setRejectDialogOpen(false);
    setRejectionReason("");
    setSelectedContract(null);
    fetchData();
  };

  const handleRetakeContract = async (contract: ManagerContract) => {
    // Reset the contract to pending with new upload
    const { error } = await supabase.rpc("transition_manager_contract_atomic", { p_contract_id: contract.id, p_status: "pending", p_review_notes: null });

    if (error) {
      toast({ title: "Error", description: "Failed to reset contract", variant: "destructive" });
      return;
    }

    toast({ title: "Contract Reset", description: "The contract has been reset for re-upload." });
    setRetakeDialogOpen(false);
    setSelectedContract(null);
    fetchData();
  };

  const handleDownloadContract = async (contract: ManagerContract) => {
    if (!contract.uploaded_contract_url) {
      toast({ title: "No file", description: "No contract file available.", variant: "destructive" });
      return;
    }

    openSafely(contract.uploaded_contract_url);
  };

  const handleParseContract = async () => {
    if (!selectedContract?.uploaded_contract_url) {
      toast({ title: "No file", description: "No contract file to parse.", variant: "destructive" });
      return;
    }

    setIsParsing(true);
    setParsedContent(null);

    try {
      const { data, error } = await supabase.functions.invoke("parse-contract-document", {
        body: {
          documentUrl: selectedContract.uploaded_contract_url,
          contractId: selectedContract.id,
        },
      });

      if (error) throw error;

      if (data?.parsedContent) {
        setParsedContent(data.parsedContent);
        
        // Update the contract in the database with parsed content
        // Parsed content persistence is intentionally deferred to a dedicated document-lifecycle RPC.
        // Do not bypass the manager-contract lifecycle with a direct financial/security-sensitive update.

        toast({ title: "Document Parsed", description: "Contract terms have been extracted successfully." });
        fetchData();
      } else {
        throw new Error("No parsed content returned");
      }
    } catch (error: unknown) {
      toast({
        title: "Parse Failed",
        description: error instanceof Error ? error.message : "Failed to parse document",
        variant: "destructive",
      });
    } finally {
      setIsParsing(false);
    }
  };

  const stats = {
    total: contracts.length,
    pending: contracts.filter((c) => c.status === "pending").length,
    approved: contracts.filter((c) => c.status === "approved").length,
    signed: contracts.filter((c) => c.status === "signed").length,
    rejected: contracts.filter((c) => c.status === "rejected").length,
  };

  const filteredContracts = getFilteredContracts();

  const getStatusBadge = (status: ContractStatus) => {
    const config = statusConfig[status];
    const Icon = config.icon;
    return (
      <Badge className={config.styles}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Commercial Contract Management Console</h2>
          <p className="text-warning/70">Manage service agreements with managers — contracts, documents, status, and commercial relationships.</p>
        </div>
        <Button
          onClick={() => setUploadDialogOpen(true)}
          className="bg-primary hover:bg-primary/90 text-white"
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Contract
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="bg-card border-warning/15">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-warning/70">Total</CardTitle>
            <FileText className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-warning/15">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-warning/70">Pending</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-warning/15">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-warning/70">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.approved}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-warning/15">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-warning/70">Signed</CardTitle>
            <ShieldCheck className="h-4 w-4 text-[hsl(214_73%_58%)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[hsl(214_73%_58%)]">{stats.signed}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-warning/15">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-warning/70">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="bg-card/80 border border-warning/12">
          <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            All Contracts
          </TabsTrigger>
          <TabsTrigger value="by-manager" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <Users className="h-4 w-4 mr-2" />
            By Manager
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {/* Filters */}
          <Card className="bg-card border-warning/15">
            <CardContent className="pt-4">
              <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-warning" />
                  <Input
                    placeholder="Search contracts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-secondary-background border-warning/20"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="bg-secondary-background border-warning/20">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="signed">Signed</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={managerFilter} onValueChange={setManagerFilter}>
                  <SelectTrigger className="bg-secondary-background border-warning/20">
                    <SelectValue placeholder="Manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Managers</SelectItem>
                    {managers.map((manager) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.full_name || manager.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="bg-secondary-background border-warning/20">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="service_agreement">Service Agreement</SelectItem>
                    <SelectItem value="management_contract">Management Contract</SelectItem>
                    <SelectItem value="partnership_agreement">Partnership Agreement</SelectItem>
                    <SelectItem value="nda">NDA</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={expiryFilter} onValueChange={setExpiryFilter}>
                  <SelectTrigger className="bg-secondary-background border-warning/20">
                    <SelectValue placeholder="Expiry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Expiry</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="expiring">Expiring ≤30d</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={fetchData} className="border-warning/20">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Contracts Table */}
          <Card className="bg-card border-warning/15">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-warning/12 hover:bg-transparent">
                    <TableHead className="text-warning/70">Title</TableHead>
                    <TableHead className="text-warning/70">Manager</TableHead>
                    <TableHead className="text-warning/70">Type</TableHead>
                    <TableHead className="text-warning/70">Status</TableHead>
                    <TableHead className="text-warning/70">Valid Period</TableHead>
                    <TableHead className="text-warning/70">Updated</TableHead>
                    <TableHead className="text-warning/70 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-warning" />
                      </TableCell>
                    </TableRow>
                  ) : fetchError ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8">
                        <div className="flex flex-col items-center text-center">
                          <AlertTriangle className="h-8 w-8 mb-2 text-destructive" />
                          <p className="text-sm font-semibold text-destructive">Unable to load contracts.</p>
                          <p className="text-xs text-muted-foreground mt-1 mb-3">{fetchError}</p>
                          <Button variant="outline" size="sm" onClick={fetchData} className="border-destructive/40 text-destructive hover:bg-destructive/10">
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredContracts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10">
                        <FileText className="h-10 w-10 mx-auto mb-2 text-warning/30" />
                        <p className="text-sm text-warning/70">No contracts configured.</p>
                        <p className="text-xs text-warning/50 mt-1">Upload a contract to get started.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredContracts.map((contract) => {
                      const expiryAttn = getExpiryAttention(contract);
                      return (
                      <TableRow key={contract.id} className="border-warning/12">
                        <TableCell className="font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-[180px]">{contract.title}</span>
                            {expiryAttn === "expired" && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                            {expiryAttn === "expiring" && <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />}
                          </div>
                        </TableCell>
                        <TableCell className="text-warning/70">
                          <div className="flex flex-col">
                            <span className="text-foreground">{contract.manager_name || "Unknown"}</span>
                            <span className="text-xs text-warning">{contract.manager_email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-warning/70 capitalize">
                          {contract.contract_type?.replace(/_/g, " ") || "Service Agreement"}
                        </TableCell>
                        <TableCell>{getStatusBadge(contract.status)}</TableCell>
                        <TableCell className="text-warning/70">
                          {contract.valid_from && contract.valid_until ? (
                            <span className={`text-xs ${expiryAttn === "expired" ? "text-destructive" : expiryAttn === "expiring" ? "text-warning" : "text-foreground"}`}>
                              {format(new Date(contract.valid_from), "dd/MM/yy")} -{" "}
                              {format(new Date(contract.valid_until), "dd/MM/yy")}
                            </span>
                          ) : (
                            <span className="text-[hsl(218_58%_50%)]">Not set</span>
                          )}
                        </TableCell>
                        <TableCell className="text-warning/70 text-xs">
                          {format(new Date(contract.updated_at), "dd/MM/yy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Preview contract"
                              onClick={() => {
                                setSelectedContract(contract);
                                setPreviewDialogOpen(true);
                              }}
                              className="h-8 w-8 text-warning hover:text-white hover:bg-[hsl(218_58%_40%/0.2)]"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {contract.uploaded_contract_url && (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Download contract"
                                onClick={() => handleDownloadContract(contract)}
                                className="h-8 w-8 text-warning hover:text-white hover:bg-[hsl(218_58%_40%/0.2)]"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                            {contract.status === "pending" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Approve contract"
                                  onClick={() => {
                                    setSelectedContract(contract);
                                    setApproveDialogOpen(true);
                                  }}
                                  className="h-8 w-8 text-success hover:text-foreground hover:bg-success/20"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Reject contract"
                                  onClick={() => {
                                    setSelectedContract(contract);
                                    setRejectDialogOpen(true);
                                  }}
                                  className="h-8 w-8 text-destructive hover:text-foreground hover:bg-destructive/20"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {(contract.status === "rejected" || contract.status === "expired") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Retake contract"
                                onClick={() => {
                                  setSelectedContract(contract);
                                  setRetakeDialogOpen(true);
                                }}
                                className="h-8 w-8 text-warning hover:text-foreground hover:bg-warning/20"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Manager Tab - Independent contracts per manager */}
        <TabsContent value="by-manager" className="space-y-4">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Users className="h-5 w-5 text-warning" />
                Manager Contract Sections
              </CardTitle>
              <CardDescription className="text-warning/70">
                View and upload contracts organized by each manager. Each manager has their own independent contract section.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {managers.length === 0 ? (
                <div className="text-center py-8 text-warning">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No managers found</p>
                </div>
              ) : (
                managers.map((manager) => {
                  const managerContracts = contracts.filter(c => c.manager_user_id === manager.id);
                  return (
                    <div key={manager.id} className="border border-warning/30/30 rounded-lg overflow-hidden">
                      <div className="bg-secondary-background px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-[hsl(218_58%_40%/0.2)] flex items-center justify-center">
                            <Building className="h-5 w-5 text-warning" />
                          </div>
                          <div>
                            <p className="text-foreground font-medium">{manager.full_name || "Unnamed Manager"}</p>
                            <p className="text-sm text-warning">{manager.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className="bg-[hsl(218_58%_40%/0.2)] text-warning/70 border-warning/20">
                            {managerContracts.length} contract(s)
                          </Badge>
                          <div className="relative">
                            <Button
                              size="sm"
                              className="bg-primary hover:bg-primary/90 text-white"
                              onClick={() => {
                                setUploadForm(prev => ({ ...prev, manager_user_id: manager.id }));
                                setUploadDialogOpen(true);
                              }}
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              Upload Contract
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="p-4">
                        {managerContracts.length === 0 ? (
                          <p className="text-center text-warning py-4">No contracts for this manager yet</p>
                        ) : (
                          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {managerContracts.map((contract) => (
                              <Card key={contract.id} className="bg-secondary-background border-warning/30/20">
                                <CardContent className="p-4">
                                  <div className="flex items-start justify-between mb-2">
                                    <h4 className="text-foreground font-medium text-sm truncate flex-1">{contract.title}</h4>
                                    {getStatusBadge(contract.status)}
                                  </div>
                                  <p className="text-xs text-warning mb-3 capitalize">
                                    {contract.contract_type?.replace(/_/g, " ") || "Service Agreement"}
                                  </p>
                                  <div className="flex gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedContract(contract);
                                        setPreviewDialogOpen(true);
                                      }}
                                      className="h-8 text-warning hover:text-white hover:bg-[hsl(218_58%_40%/0.2)]"
                                    >
                                      <Eye className="h-3 w-3 mr-1" />
                                      View
                                    </Button>
                                    {contract.uploaded_contract_url && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDownloadContract(contract)}
                                        className="h-8 text-warning hover:text-white hover:bg-[hsl(218_58%_40%/0.2)]"
                                      >
                                        <Download className="h-3 w-3 mr-1" />
                                        Download
                                      </Button>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={(open) => {
        setPreviewDialogOpen(open);
        if (!open) {
          setParsedContent(null);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden bg-card border-warning/15">
          <DialogHeader>
            <DialogTitle className="text-foreground">{selectedContract?.title}</DialogTitle>
            <DialogDescription className="text-warning/70">
              Contract for {selectedContract?.manager_name || selectedContract?.manager_email}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Status</p>
                  {selectedContract && getStatusBadge(selectedContract.status)}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Contract Type</p>
                  <p className="text-foreground capitalize font-normal">
                    {selectedContract?.contract_type?.replace(/_/g, " ") || "Service Agreement"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Valid From</p>
                  <p className="text-foreground font-normal">
                    {selectedContract?.valid_from 
                      ? format(new Date(selectedContract.valid_from), "dd/MM/yy")
                      : "Not set"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Valid Until</p>
                  <p className="text-foreground font-normal">
                    {selectedContract?.valid_until 
                      ? format(new Date(selectedContract.valid_until), "dd/MM/yy")
                      : "Not set"}
                  </p>
                </div>
              </div>

              {selectedContract?.description && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Description</p>
                  <p className="text-foreground font-normal">{selectedContract.description}</p>
                </div>
              )}

              {/* Commercial relationship context strip (read-only — context only, does not replace Tiers/Billing/Custom Pricing modules) */}
              {selectedContract && (
                <div className="p-3 rounded-lg border border-warning/20 bg-warning/5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-warning/80 mb-2">Commercial relationship</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2 py-1 rounded-md bg-warning/10 text-warning border border-warning/20">Contract</span>
                    <span className="text-warning/50">→</span>
                    <span className="px-2 py-1 rounded-md bg-secondary-background text-foreground border border-border">
                      {selectedContract.manager_name || selectedContract.manager_email}
                    </span>
                    <span className="text-warning/50">→</span>
                    <span className="px-2 py-1 rounded-md bg-secondary-background text-foreground border border-border capitalize">
                      {managerTiers[selectedContract.manager_user_id] ? `${managerTiers[selectedContract.manager_user_id]} tier` : "No tier"}
                    </span>
                    <span className="text-warning/50">→</span>
                    <span className="px-2 py-1 rounded-md bg-secondary-background text-muted-foreground border border-border">Custom pricing</span>
                    <span className="text-warning/50">→</span>
                    <span className="px-2 py-1 rounded-md bg-secondary-background text-muted-foreground border border-border">Billing</span>
                  </div>
                  <p className="text-[10px] text-warning/50 mt-2">Tier, custom pricing, and billing are managed in their respective admin modules.</p>
                </div>
              )}

              {/* Audit trail (existing fields — read-only) */}
              {selectedContract && (selectedContract.reviewed_at || selectedContract.updated_at || selectedContract.signed_at) && (
                <div className="grid gap-3 md:grid-cols-3 p-3 rounded-lg bg-card/80 border border-warning/15">
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wide text-warning/70">Created</p>
                    <p className="text-xs text-foreground">{format(new Date(selectedContract.created_at), "dd MMM yyyy")}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wide text-warning/70">Last updated</p>
                    <p className="text-xs text-foreground">{format(new Date(selectedContract.updated_at), "dd MMM yyyy")}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wide text-warning/70">Reviewed / Signed</p>
                    <p className="text-xs text-foreground">
                      {selectedContract.signed_at
                        ? `Signed ${format(new Date(selectedContract.signed_at), "dd MMM yyyy")}`
                        : selectedContract.reviewed_at
                        ? `Reviewed ${format(new Date(selectedContract.reviewed_at), "dd MMM yyyy")}`
                        : "—"}
                    </p>
                  </div>
                </div>
              )}

              {selectedContract?.review_notes && (
                <div className="space-y-1 p-3 rounded-lg bg-card/80 border border-warning/30/30">
                  <p className="text-sm font-medium text-foreground">Review Notes</p>
                  <p className="text-foreground font-normal">{selectedContract.review_notes}</p>
                  {selectedContract.reviewed_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Reviewed on {format(new Date(selectedContract.reviewed_at), "dd/MM/yy")}
                    </p>
                  )}
                </div>
              )}

              {/* AI Parsed Content Section */}
              {(parsedContent || selectedContract?.parsed_content) && (
                <div className="space-y-3 p-4 rounded-lg bg-gradient-to-br from-[hsl(218_58%_16%/0.3)] to-muted/80 border border-warning/20">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-foreground" />
                    <p className="text-sm font-medium text-foreground">AI Extracted Terms</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {Object.entries(parsedContent || selectedContract?.parsed_content || {}).map(([key, value]) => (
                      <div key={key} className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground capitalize">{key.replace(/_/g, " ")}</p>
                        <p className="text-sm text-foreground font-normal">
                          {typeof value === "object" && value !== null
                            ? JSON.stringify(value, null, 2)
                            : String(value) || "Not found"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedContract?.uploaded_contract_url && (
                <div className="border border-warning/30/30 rounded-lg overflow-hidden">
                  {selectedContract.uploaded_contract_url.endsWith(".pdf") ? (
                    <div className="p-6 text-center bg-card/80">
                      <FileText className="h-12 w-12 mx-auto mb-3 text-warning" />
                      <p className="text-foreground mb-3">PDF Document</p>
                      <Button
                        onClick={() => handleDownloadContract(selectedContract)}
                        className="bg-primary hover:bg-primary/90 text-white"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Open PDF
                      </Button>
                    </div>
                  ) : (
                    <img
                      src={selectedContract.uploaded_contract_url}
                      alt="Contract preview"
                      className="w-full max-h-[400px] object-contain"
                    />
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter className="flex gap-2">
            {selectedContract?.status === "pending" && (
              <>
                <Button
                  onClick={() => {
                    setPreviewDialogOpen(false);
                    setApproveDialogOpen(true);
                  }}
                  className="bg-success hover:bg-success/90"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                <Button
                  onClick={() => {
                    setPreviewDialogOpen(false);
                    setRejectDialogOpen(true);
                  }}
                  variant="destructive"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </>
            )}
            {selectedContract?.uploaded_contract_url && (
              <>
                <Button
                  variant="outline"
                  onClick={handleParseContract}
                  disabled={isParsing}
                  className="border-warning/25 text-warning hover:text-white hover:bg-[hsl(218_58%_40%/0.2)]"
                >
                  {isParsing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Parsing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      AI Parse
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleDownloadContract(selectedContract)}
                  className="border-warning/20"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent className="bg-card border-warning/15">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Approve Contract</AlertDialogTitle>
            <AlertDialogDescription className="text-warning/70">
              Are you sure you want to approve this contract? You can optionally add review notes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label className="text-warning/70">Review Notes (Optional)</Label>
            <Textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Add any notes about this approval..."
              className="mt-2 bg-secondary-background border-warning/20"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-warning/20">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApproveContract}
              className="bg-success hover:bg-success/90"
            >
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="bg-card border-warning/15">
          <DialogHeader>
            <DialogTitle className="text-foreground">Reject Contract</DialogTitle>
            <DialogDescription className="text-warning/70">
              Please provide a reason for rejecting this contract.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="text-warning/70">Rejection Reason *</Label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Explain why this contract is being rejected..."
              className="mt-2 bg-secondary-background border-warning/20 min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)} className="border-warning/20">
              Cancel
            </Button>
            <Button
              onClick={handleRejectContract}
              disabled={!rejectionReason.trim()}
              variant="destructive"
            >
              Reject Contract
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Retake Confirmation Dialog (commercially significant reset) */}
      <AlertDialog open={retakeDialogOpen} onOpenChange={setRetakeDialogOpen}>
        <AlertDialogContent className="bg-card border-warning/15">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-warning" />
              Reset Contract for Re-upload
            </AlertDialogTitle>
            <AlertDialogDescription className="text-warning/70">
              This will reset {selectedContract?.title ? `"${selectedContract.title}"` : "this contract"} back to pending review, clearing the reviewer, review date, and review notes. The contract document remains stored.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-warning/20">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedContract && handleRetakeContract(selectedContract)}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              Reset Contract
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upload Contract Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={(open) => {
        setUploadDialogOpen(open);
        if (!open) {
          setUploadForm({
            manager_user_id: "",
            title: "",
            description: "",
            contract_type: "service_agreement",
            valid_from: "",
            valid_until: "",
          });
          setSelectedFile(null);
        }
      }}>
        <DialogContent className="max-w-2xl bg-card border-warning/15">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <FileUp className="h-5 w-5 text-warning" />
              Upload Contract for Manager
            </DialogTitle>
            <DialogDescription className="text-warning/70">
              Upload a contract document for the selected manager. Supported formats: PDF, JPEG, PNG, WebP (max 10MB)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-warning/70">Select Manager *</Label>
                <Select 
                  value={uploadForm.manager_user_id} 
                  onValueChange={(value) => setUploadForm(prev => ({ ...prev, manager_user_id: value }))}
                >
                  <SelectTrigger className="bg-secondary-background border-warning/20">
                    <SelectValue placeholder="Choose a manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {managers.map((manager) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          {manager.full_name || manager.email}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-warning/70">Contract Type</Label>
                <Select 
                  value={uploadForm.contract_type} 
                  onValueChange={(value) => setUploadForm(prev => ({ ...prev, contract_type: value }))}
                >
                  <SelectTrigger className="bg-secondary-background border-warning/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="service_agreement">Service Agreement</SelectItem>
                    <SelectItem value="management_contract">Management Contract</SelectItem>
                    <SelectItem value="partnership_agreement">Partnership Agreement</SelectItem>
                    <SelectItem value="nda">Non-Disclosure Agreement</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-warning/70">Contract Title *</Label>
              <Input
                value={uploadForm.title}
                onChange={(e) => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Property Management Service Agreement 2024"
                className="bg-secondary-background border-warning/20"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-warning/70">Description</Label>
              <Textarea
                value={uploadForm.description}
                onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the contract terms..."
                className="bg-secondary-background border-warning/20 min-h-[60px]"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-warning/70">Valid From</Label>
                <Input
                  type="date"
                  value={uploadForm.valid_from}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, valid_from: e.target.value }))}
                  className="bg-secondary-background border-warning/20"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-warning/70">Valid Until</Label>
                <Input
                  type="date"
                  value={uploadForm.valid_until}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, valid_until: e.target.value }))}
                  className="bg-secondary-background border-warning/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-warning/70">Contract Document *</Label>
              <div 
                className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer
                  ${selectedFile 
                    ? "border-warning/50 bg-[hsl(218_58%_50%/0.1)]" 
                    : "border-warning/20 hover:border-warning/50/50 hover:bg-secondary-background/60"
                  }`}
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
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="h-6 w-6 text-warning" />
                    <div className="text-left">
                      <p className="text-foreground font-medium text-sm">{selectedFile.name}</p>
                      <p className="text-warning text-xs">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                      }}
                      className="text-destructive hover:text-destructive"
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="text-warning">
                    <Upload className="h-8 w-8 mx-auto mb-2" />
                    <p className="font-medium text-sm">Click to upload</p>
                    <p className="text-xs text-[hsl(218_58%_50%)]">PDF, JPEG, PNG, WebP (max 10MB)</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUploadDialogOpen(false)}
              className="border-warning/20"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUploadContract}
              disabled={uploadingFile || !uploadForm.manager_user_id || !uploadForm.title || !selectedFile}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {uploadingFile ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Contract
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WebhostContracts;
