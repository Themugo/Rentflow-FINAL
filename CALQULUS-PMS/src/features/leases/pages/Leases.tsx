// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/shared/components/layout/Layout";
import { openSafely } from "@/shared/lib/safeWindow";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
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
import { Label } from "@/shared/components/ui/label";
import { onActivateKey } from "@/shared/lib/a11y";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Plus,
  Search,
  FileText,
  Calendar,
  Wallet,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Upload,
  Download,
  ExternalLink,
  Loader2,
  Paperclip,
  Trash2,
  Receipt,
} from "lucide-react";
import { useToast } from "@/shared/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { leaseSchema } from "@/shared/lib/validations";
import { useActivityLog } from "@/shared/hooks/useActivityLog";
import { useViewOnly } from "@/shared/contexts/ViewOnlyContext";
import { formatDate } from "@/shared/lib/dateFormat";
import { logError, toUserFacingError } from "@/shared/lib/errorLogger";
import { BillingDueConfigPanel } from '@/features/billing/components/BillingDueConfigPanel';
import { PaymentCollectionRoutingPanel } from '@/features/billing/components/PaymentCollectionRoutingPanel';
import { LeaseStatements } from "@/features/leases/components/LeaseStatements";
import { LeaseRenewalPipeline } from "@/features/leases/components/LeaseRenewalPipeline";
import { DashboardSectionHeader } from "@/features/dashboard/components/DashboardSectionHeader";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateManagerActivation } from "@/features/dashboard/hooks/useManagerActivation";
import { invalidateDashboardQueries } from "@/shared/lib/invalidateDashboards";
import { LeaseCard } from "@/features/leases/components/LeaseCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ErrorState } from "@/shared/components/ui/error-state";
import { LoadingState } from "@/shared/components/ui/loading-state";
import { leaseStatusTone, statusBadgeClass } from "@/shared/lib/statusBadge";
import { paginate, sortBy, toggleSort, type SortDir } from "@/shared/lib/clientTable";
import { SortableHead, TablePager } from "@/shared/components/ui/table-pager";

type LeaseStatus = "active" | "expiring" | "expired" | "pending" | "terminated";

interface Tenant {
  id: string;
  name: string;
  email: string;
  photo_url: string | null;
}

interface Property {
  id: string;
  name: string;
  address: string;
}

interface Unit {
  id: string;
  property_id: string;
  unit_number: string;
  monthly_rent: number | null;
  status: string;
}

interface Lease {
  id: string;
  tenant_id: string | null;
  property_id: string | null;
  unit_id?: string | null;
  property: string;
  unit: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  deposit: number | null;
  status: LeaseStatus;
  terms: string | null;
  created_at: string;
  document_url: string | null;
  tenants?: Tenant | null;
}

/** Real end_date data only — the 30-day window matches the one already used by
 * dashboardStats.ts's expiringCutoff. Called from data-fetch code, never from
 * render, so it stays outside the render-purity rule entirely. */
function computeExpiringSoonIds(rows: Lease[]): Set<string> {
  const cutoff = Date.now() + 30 * 86400000;
  const ids = new Set<string>();
  for (const lease of rows) {
    if (lease.status === "active" && new Date(lease.end_date).getTime() <= cutoff) {
      ids.add(lease.id);
    }
  }
  return ids;
}

function leaseFieldErrors(error: { issues: { path: (string | number)[]; message: string }[] }): Record<string, string> {
  const next: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!next[key]) next[key] = issue.message;
  }
  return next;
}

function leaseStatusLabel(status: LeaseStatus, expiringSoon: boolean): string {
  if (status === "expired") return "Expired";
  if (expiringSoon || status === "expiring") return "Expiring soon";
  if (status === "active") return "Active";
  if (status === "pending") return "Pending";
  if (status === "terminated") return "Terminated";
  return status;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} role="alert" className="text-xs text-destructive">{message}</p>;
}

// Document Preview Component
const DocumentPreview = ({ documentUrl }: { documentUrl: string }) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSignedUrl = async () => {
      try {
        const { getSignedUrl } = await import('@/shared/lib/storageUtils');
        const url = await getSignedUrl(documentUrl);
        setSignedUrl(url);
      } catch {
      } finally {
        setIsLoading(false);
      }
    };
    loadSignedUrl();
  }, [documentUrl]);

  if (isLoading) {
    return (
      <div className="h-[200px] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isPdf = documentUrl.toLowerCase().includes('.pdf');

  if (isPdf) {
    return (
      <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p className="text-sm">PDF Document</p>
        {signedUrl && (
          <Button
            variant="link"
            size="sm"
            className="text-warning mt-1"
            onClick={() => openSafely(signedUrl)}
          >
            Click to view
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="h-[200px] flex items-center justify-center p-2">
      {signedUrl ? (
        <img
          src={signedUrl}
          alt="Lease document"
          className="max-h-full max-w-full object-contain rounded cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => openSafely(signedUrl)}
        />
      ) : (
        <div className="text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Could not load preview</p>
        </div>
      )}
    </div>
  );
};

const Leases = () => {
  const { toast } = useToast();
  const { managerId, restrictToAssignedProperties, assignedPropertyIds } = useManagerScope();
  const queryClient = useQueryClient();
  const { logActivity: _logActivity } = useActivityLog();
  const { isViewOnly } = useViewOnly();
  const [leases, setLeases] = useState<Lease[]>([]);
  const [expiringSoonLeaseIds, setExpiringSoonLeaseIds] = useState<Set<string>>(new Set());
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [filteredUnits, setFilteredUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeaseStatus | "all">("all");
  const [leasePage, setLeasePage] = useState(1);
  const [leaseSortKey, setLeaseSortKey] = useState("expiry");
  const [leaseSortDir, setLeaseSortDir] = useState<SortDir>("asc");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLease, setSelectedLease] = useState<Lease | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState<string | null>(null);
  const [selectedLeases, setSelectedLeases] = useState<Set<string>>(new Set());
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [newLease, setNewLease] = useState({
    tenant_id: "",
    property_id: "",
    unit_id: "",
    unit: "",
    start_date: "",
    end_date: "",
    monthly_rent: "",
    deposit: "",
    terms: "",
  });
  const [leaseErrors, setLeaseErrors] = useState<Record<string, string>>({});

  const fetchLeases = useCallback(async () => {
    if (!managerId) return;
    if (restrictToAssignedProperties && assignedPropertyIds.length === 0) {
      setLeases([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(null);

    let query = supabase.from("leases")
      .select(`
        *,
        tenants (
          id,
          name,
          email,
          photo_url
        )
      `)
      .eq("manager_id", managerId)
      .order("created_at", { ascending: false });
    if (restrictToAssignedProperties) {
      query = query.in("property_id", assignedPropertyIds);
    }
    const { data, error } = await query;

    // If the join fails (FK not applied), fetch leases without the join
    if (error) {
      logError('Leases.fetchLeases.joinFailed', error);
      let fallbackQuery = supabase
        .from("leases")
        .select("*")
        .eq("manager_id", managerId)
        .order("created_at", { ascending: false });
      if (restrictToAssignedProperties) {
        fallbackQuery = fallbackQuery.in("property_id", assignedPropertyIds);
      }
      const fallback = await fallbackQuery;

      if (fallback.error) {
        setLoadError("Couldn't load leases from live records.");
        toast({
          title: "Error",
          description: "Failed to fetch leases",
          variant: "destructive",
        });
      } else {
        setLeases(fallback.data || []);
        setExpiringSoonLeaseIds(computeExpiringSoonIds(fallback.data || []));
      }
    } else {
      setLeases(data || []);
      setExpiringSoonLeaseIds(computeExpiringSoonIds(data || []));
    }
    setIsLoading(false);
  }, [assignedPropertyIds, managerId, restrictToAssignedProperties, toast]);

  const fetchTenants = useCallback(async () => {
    if (!managerId) return;
    if (restrictToAssignedProperties && assignedPropertyIds.length === 0) {
      setTenants([]);
      return;
    }
    let query = supabase
      .from("tenants")
      .select("id, name, email, photo_url")
      .eq("manager_id", managerId)
      .eq("status", "active")
      .order("name");
    if (restrictToAssignedProperties) {
      query = query.in("property_id", assignedPropertyIds);
    }
    const { data, error } = await query;

    if (error) {
      logError('Leases.fetchTenants', error);
    } else {
      setTenants(data || []);
    }
  }, [assignedPropertyIds, managerId, restrictToAssignedProperties]);

  const fetchProperties = useCallback(async () => {
    if (!managerId) return;
    if (restrictToAssignedProperties && assignedPropertyIds.length === 0) {
      setProperties([]);
      return;
    }
    let query = supabase
      .from("properties")
      .select("id, name, address")
      .eq("manager_id", managerId)
      .order("name", { ascending: true });
    if (restrictToAssignedProperties) {
      query = query.in("id", assignedPropertyIds);
    }
    const { data, error } = await query;

    if (!error && data) {
      setProperties(data);
    }
  }, [assignedPropertyIds, managerId, restrictToAssignedProperties]);

  const fetchUnits = useCallback(async () => {
    if (properties.length === 0) {
      setUnits([]);
      return;
    }
    const propertyIds = properties.map((property) => property.id);
    const { data, error } = await supabase
      .from("units")
      .select("id, property_id, unit_number, monthly_rent, status")
      .in("property_id", propertyIds)
      .order("unit_number");

    if (!error && data) {
      setUnits(data as Unit[]);
    }
  }, [properties]);

  useEffect(() => {
    fetchLeases();
    fetchTenants();
    fetchProperties();
  }, [fetchLeases, fetchTenants, fetchProperties]);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  // Filter units when property changes
  useEffect(() => {
    if (newLease.property_id) {
      const propertyUnits = units.filter(u => u.property_id === newLease.property_id);
      setFilteredUnits(propertyUnits);
    } else {
      setFilteredUnits([]);
    }
  }, [newLease.property_id, units]);

  const handlePropertyChange = (propertyId: string) => {
    const _selectedProperty = properties.find(p => p.id === propertyId);
    setNewLease({ 
      ...newLease, 
      property_id: propertyId,
      unit_id: "",
      unit: "",
      monthly_rent: ""
    });
  };

  const handleUnitChange = (unitId: string) => {
    const selectedUnit = units.find(u => u.id === unitId);
    if (selectedUnit) {
      setNewLease({
        ...newLease,
        unit_id: unitId,
        unit: selectedUnit.unit_number,
        monthly_rent: selectedUnit.monthly_rent?.toString() || newLease.monthly_rent
      });
    }
  };

  const handleCreateLease = async () => {
    const validationResult = leaseSchema.safeParse(newLease);
    if (!validationResult.success) {
      setLeaseErrors(leaseFieldErrors(validationResult.error));
      return;
    }
    setLeaseErrors({});

    const monthlyRent = parseFloat(validationResult.data.monthly_rent);
    const deposit = validationResult.data.deposit
      ? parseFloat(validationResult.data.deposit)
      : monthlyRent * 2;

    const { data: createdLeaseId, error } = await supabase.rpc("create_lease_atomic", {
      p_tenant_id: validationResult.data.tenant_id,
      p_property_id: validationResult.data.property_id,
      p_unit_id: validationResult.data.unit_id || null,
      p_unit: validationResult.data.unit,
      p_start_date: validationResult.data.start_date,
      p_end_date: validationResult.data.end_date,
      p_monthly_rent: monthlyRent,
      p_deposit: deposit,
      p_terms: validationResult.data.terms || null,
      p_status: "pending",
      p_manager_id: managerId ?? null,
    });

    if (error) {
      toast({
        title: "Couldn't create lease",
        description: toUserFacingError(
          error,
          "Could not create this lease. No tenant, unit, or payment details were changed — try again."
        ),
        variant: "destructive",
      });
      return;
    }

    const selectedTenant = tenants.find((t) => t.id === validationResult.data.tenant_id);

    toast({
      title: "Lease Created",
      description: `Lease ${createdLeaseId ? "created" : "saved"} for ${selectedTenant?.name || "tenant"}.`,
    });
    invalidateManagerActivation(queryClient);
    invalidateDashboardQueries(queryClient);

    setNewLease({
      tenant_id: "",
      property_id: "",
      unit_id: "",
      unit: "",
      start_date: "",
      end_date: "",
      monthly_rent: "",
      deposit: "",
      terms: "",
    });
    setIsDialogOpen(false);
    fetchLeases();
  };

  const updateLeaseStatus = async (id: string, status: LeaseStatus) => {
    const { error } = await supabase.rpc("transition_lease_atomic", {
      p_lease_id: id,
      p_target_status: status,
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update lease status",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Lease status updated. History recorded for tenant.",
      });
      invalidateDashboardQueries(queryClient);
      fetchLeases();
      setIsViewDialogOpen(false);
    }
  };

  const handleUploadLeaseDocument = async (leaseId: string, file: File, tenantName?: string, tenantId?: string) => {
    setIsUploadingDoc(leaseId);
    
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const allowedTypes = ['pdf', 'jpg', 'jpeg', 'png'];
      
      if (!fileExt || !allowedTypes.includes(fileExt)) {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF or image file (JPG, PNG).",
          variant: "destructive",
        });
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Maximum file size is 10MB.",
          variant: "destructive",
        });
        return;
      }

      // Sanitize tenant name for file path (remove special characters)
      const sanitizedTenantName = tenantName
        ? tenantName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
        : 'unknown_tenant';
      
      // Organize files by tenant ID for better structure
      const tenantFolder = tenantId || 'unassigned';
      const fileName = `lease-${sanitizedTenantName}-${leaseId.slice(0, 8)}-${Date.now()}.${fileExt}`;
      const filePath = `leases/${tenantFolder}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('signed-contracts')
        .upload(filePath, file);

      if (uploadError) {
        logError('Leases.handleUpload', uploadError);
        toast({
          title: "Upload failed",
          description: uploadError.message,
          variant: "destructive",
        });
        return;
      }

      // Store the file path - signed URLs will be generated when viewing
      const storagePath = `signed-contracts/${filePath}`;

      const { error: updateError } = await supabase.rpc('attach_lease_document_atomic', {
        p_lease_id: leaseId,
        p_document_url: storagePath,
      });

      if (updateError) {
        toast({
          title: "Error",
          description: "Failed to save document URL.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Document uploaded",
        description: `Lease document for ${tenantName || 'tenant'} has been uploaded successfully.`,
      });
      fetchLeases();
    } catch (error) {
      logError('Leases.handleUpload', error);
      toast({
        title: "Upload failed",
        description: "An error occurred while uploading the document.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingDoc(null);
    }
  };

  const handleDownloadLeaseDocument = async (url: string, property: string, unit: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const extension = url.split('.').pop()?.split('?')[0] || 'pdf';
      link.download = `Lease_${property}_${unit}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      toast({
        title: "Download started",
        description: "The document is being downloaded.",
      });
    } catch (error) {
      logError('Leases.handleDownload', error);
      toast({
        title: "Download failed",
        description: "Unable to download the document.",
        variant: "destructive",
      });
    }
  };

  const _handleDeleteLease = async (leaseId: string) => {
    const { error } = await supabase.rpc("transition_lease_atomic", { p_lease_id: leaseId, p_target_status: "terminated" });
    if (error) {
      toast({ title: "Error", description: "Failed to deactivate lease", variant: "destructive" });
    } else {
      toast({ title: "Deactivated", description: "Lease has been deactivated and moved to history." });
      invalidateDashboardQueries(queryClient);
      fetchLeases();
    }
  };

  const handleBulkDeleteLeases = async () => {
    if (selectedLeases.size === 0) return;
    setIsDeleting(true);
    const leaseIds = Array.from(selectedLeases);
    const results = await Promise.all(leaseIds.map((leaseId) =>
      supabase.rpc("transition_lease_atomic", { p_lease_id: leaseId, p_target_status: "terminated" })
    ));
    const error = results.find((result) => result.error)?.error ?? null;
    if (error) {
      toast({ title: "Error", description: "Failed to deactivate leases", variant: "destructive" });
    } else {
      toast({ title: "Deactivated", description: `${leaseIds.length} lease(s) have been deactivated.` });
      invalidateDashboardQueries(queryClient);
      setSelectedLeases(new Set());
      fetchLeases();
    }
    setIsDeleting(false);
    setIsBulkDeleteDialogOpen(false);
  };

  const toggleLeaseSelection = (leaseId: string) => {
    setSelectedLeases(prev => {
      const next = new Set(prev);
      if (next.has(leaseId)) next.delete(leaseId);
      else next.add(leaseId);
      return next;
    });
  };

  const toggleSelectAllLeases = () => {
    if (selectedLeases.size === filteredLeases.length) {
      setSelectedLeases(new Set());
    } else {
      setSelectedLeases(new Set(filteredLeases.map(l => l.id)));
    }
  };

  const filteredLeases = leases.filter((lease) => {
    const tenantName = lease.tenants?.name || "";
    const matchesSearch = 
      tenantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lease.property.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lease.unit.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || lease.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  useEffect(() => {
    setLeasePage(1);
  }, [searchQuery, statusFilter]);

  const sortedLeases = useMemo(() => {
    const getter = (lease: Lease) => {
      switch (leaseSortKey) {
        case "status": return lease.status;
        case "tenant": return lease.tenants?.name ?? "";
        case "property": return `${lease.property} ${lease.unit}`;
        case "rent": return lease.monthly_rent;
        default: return lease.end_date;
      }
    };
    return sortBy(filteredLeases, getter, leaseSortDir);
  }, [filteredLeases, leaseSortKey, leaseSortDir]);

  const leaseSlice = useMemo(() => paginate(sortedLeases, leasePage, 25), [sortedLeases, leasePage]);

  const handleLeaseSort = (key: string) => {
    const next = toggleSort(leaseSortKey, key, leaseSortDir);
    setLeaseSortKey(next.key);
    setLeaseSortDir(next.dir);
    setLeasePage(1);
  };

  // Stats calculation
  const leaseStats = {
    total: leases.length,
    active: leases.filter(l => l.status === "active").length,
    expiring: leases.filter(l => l.status === "expiring").length,
    expired: leases.filter(l => l.status === "expired").length,
    pending: leases.filter(l => l.status === "pending").length,
    totalRent: leases.filter(l => l.status === "active").reduce((sum, l) => sum + l.monthly_rent, 0),
    withDocs: leases.filter(l => l.document_url).length,
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Layout
      title="Leases"
      subtitle="Status, dates, tenant, property, rent, and expiry — renew or end a lease here"
      headerActions={
        <Button size="sm" className="min-h-11 btn-brand" onClick={() => { setLeaseErrors({}); setIsDialogOpen(true); }}>
          <Plus className="h-4 w-4" />
          Create lease
        </Button>
      }
    >
      <div className="mb-6">
        <DashboardSectionHeader
          eyebrow="Operations / Lease management"
          title="Agreements at a glance"
          description="Keep occupancy, expiry and rent commitments visible without leaving the lease workspace."
        />
      </div>
      <Tabs defaultValue="agreements" className="w-full">
        <TabsList className="mb-4 sm:mb-6 w-full sm:w-auto grid grid-cols-3 sm:flex">
          <TabsTrigger value="agreements" className="gap-1.5 sm:gap-2 text-xs sm:text-sm">
            <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Agreements</span>
            <span className="xs:hidden">Leases</span>
          </TabsTrigger>
          <TabsTrigger value="renewals" className="gap-1.5 sm:gap-2 text-xs sm:text-sm">
            <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Renewals
          </TabsTrigger>
          <TabsTrigger value="statements" className="gap-1.5 sm:gap-2 text-xs sm:text-sm">
            <Receipt className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Statements
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agreements" className="space-y-4 sm:space-y-6">
          {/* Summary Stats - Scrollable on mobile */}
          <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-5 scrollbar-hide" role="group" aria-label="Filter leases by status">
            <Card 
              role="button"
              tabIndex={0}
              aria-pressed={statusFilter === "all"}
              aria-label={`Show all leases, ${leaseStats.total}`}
              className={`flex-shrink-0 w-[140px] sm:w-auto bg-card border-border cursor-pointer transition-all active:scale-95 sm:active:scale-100 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${statusFilter === "all" ? "ring-2 ring-primary" : ""}`}
              onClick={() => setStatusFilter("all")}
              onKeyDown={onActivateKey(() => setStatusFilter("all"))}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-2 sm:justify-between">
                    <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  </div>
                  <div className="text-right sm:text-left">
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Total</p>
                    <p className="text-lg sm:text-2xl font-bold text-foreground">{leaseStats.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card 
              role="button"
              tabIndex={0}
              aria-pressed={statusFilter === "active"}
              aria-label={`Show active leases, ${leaseStats.active}`}
              className={`flex-shrink-0 w-[140px] sm:w-auto bg-card border-border cursor-pointer transition-all active:scale-95 sm:active:scale-100 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${statusFilter === "active" ? "ring-2 ring-primary" : ""}`}
              onClick={() => setStatusFilter("active")}
              onKeyDown={onActivateKey(() => setStatusFilter("active"))}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-2 sm:justify-between">
                    <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
                  </div>
                  <div className="text-right sm:text-left">
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Active</p>
                    <p className="text-lg sm:text-2xl font-bold text-foreground">{leaseStats.active}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card 
              role="button"
              tabIndex={0}
              aria-pressed={statusFilter === "expiring"}
              aria-label={`Show expiring leases, ${leaseStats.expiring}`}
              className={`flex-shrink-0 w-[140px] sm:w-auto bg-card border-border cursor-pointer transition-all active:scale-95 sm:active:scale-100 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${statusFilter === "expiring" ? "ring-2 ring-primary" : ""}`}
              onClick={() => setStatusFilter("expiring")}
              onKeyDown={onActivateKey(() => setStatusFilter("expiring"))}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-2 sm:justify-between">
                    <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-warning/10 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
                  </div>
                  <div className="text-right sm:text-left">
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Expiring soon</p>
                    <p className="text-lg sm:text-2xl font-bold text-foreground">{leaseStats.expiring}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card 
              role="button"
              tabIndex={0}
              aria-pressed={statusFilter === "expired"}
              aria-label={`Show expired leases, ${leaseStats.expired}`}
              className={`flex-shrink-0 w-[140px] sm:w-auto bg-card border-border cursor-pointer transition-all active:scale-95 sm:active:scale-100 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${statusFilter === "expired" ? "ring-2 ring-primary" : ""}`}
              onClick={() => setStatusFilter("expired")}
              onKeyDown={onActivateKey(() => setStatusFilter("expired"))}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-2 sm:justify-between">
                    <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
                  </div>
                  <div className="text-right sm:text-left">
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Expired</p>
                    <p className="text-lg sm:text-2xl font-bold text-foreground">{leaseStats.expired}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card 
              role="button"
              tabIndex={0}
              aria-pressed={statusFilter === "pending"}
              aria-label={`Show pending leases, ${leaseStats.pending}`}
              className={`flex-shrink-0 w-[140px] sm:w-auto bg-card border-border cursor-pointer transition-all active:scale-95 sm:active:scale-100 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${statusFilter === "pending" ? "ring-2 ring-primary" : ""}`}
              onClick={() => setStatusFilter("pending")}
              onKeyDown={onActivateKey(() => setStatusFilter("pending"))}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-2 sm:justify-between">
                    <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  </div>
                  <div className="text-right sm:text-left">
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Pending</p>
                    <p className="text-lg sm:text-2xl font-bold text-foreground">{leaseStats.pending}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Active Filter Indicator */}
          {statusFilter !== "all" && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1.5">
                Showing: {statusFilter}
                <button 
                  type="button"
                  onClick={() => setStatusFilter("all")} 
                  className="ml-1 inline-flex min-h-11 min-w-11 items-center justify-center hover:text-destructive"
                  aria-label="Clear lease filter"
                >
                  ×
                </button>
              </Badge>
            </div>
          )}

          {/* Actions Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 justify-between">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by tenant, property or unit..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search leases"
                className="pl-9 min-h-11 w-full sm:w-80 bg-card border-border"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
          {selectedLeases.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBulkDeleteDialogOpen(true)}
              disabled={isViewOnly}
              className="sm:size-default border-warning text-warning hover:bg-amber-50 dark:hover:bg-amber-950"
            >
              <Trash2 className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Deactivate</span> {selectedLeases.size}
            </Button>
          )}
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setLeaseErrors({}); }}>
          <DialogContent className="max-w-[95vw] sm:max-w-[600px] bg-card border-border max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading text-foreground text-base sm:text-lg">
                Create New Lease Agreement
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Fill in the details to create a new rental agreement.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:gap-4 py-3 sm:py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="tenant">Tenant *</Label>
                  <Select
                    value={newLease.tenant_id}
                    onValueChange={(value) => {
                      setNewLease({ ...newLease, tenant_id: value });
                      setLeaseErrors((prev) => ({ ...prev, tenant_id: "" }));
                    }}
                  >
                    <SelectTrigger className="bg-background border-border" aria-invalid={!!leaseErrors.tenant_id} aria-describedby={leaseErrors.tenant_id ? "lease-tenant-error" : undefined}>
                      <SelectValue placeholder="Select tenant" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No tenants available
                        </SelectItem>
                      ) : (
                        tenants.map((tenant) => (
                          <SelectItem key={tenant.id} value={tenant.id}>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={tenant.photo_url || undefined} />
                                <AvatarFallback className="text-xs">
                                  {tenant.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")}
                                </AvatarFallback>
                              </Avatar>
                              {tenant.name}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FieldError id="lease-tenant-error" message={leaseErrors.tenant_id} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="property">Property *</Label>
                  <Select
                    value={newLease.property_id}
                    onValueChange={(value) => {
                      handlePropertyChange(value);
                      setLeaseErrors((prev) => ({ ...prev, property_id: "" }));
                    }}
                  >
                    <SelectTrigger className="bg-background border-border" aria-invalid={!!leaseErrors.property_id} aria-describedby={leaseErrors.property_id ? "lease-property-error" : undefined}>
                      <SelectValue placeholder="Select property" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border z-50">
                      {properties.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No properties available
                        </SelectItem>
                      ) : (
                        properties.map((property) => (
                          <SelectItem key={property.id} value={property.id}>
                            {property.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FieldError id="lease-property-error" message={leaseErrors.property_id} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="unit" className="text-sm">Unit *</Label>
                  {!newLease.property_id ? (
                    <div className="flex h-10 w-full items-center justify-between rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed">
                      <span>Select property first</span>
                    </div>
                  ) : filteredUnits.length === 0 ? (
                    // No units in database - allow manual entry
                    <Input
                      id="unit"
                      value={newLease.unit}
                      onChange={(e) => {
                        setNewLease({ ...newLease, unit: e.target.value });
                        setLeaseErrors((prev) => ({ ...prev, unit: "" }));
                      }}
                      placeholder="e.g., A101, Unit 1"
                      aria-invalid={!!leaseErrors.unit}
                      aria-describedby={leaseErrors.unit ? "lease-unit-error" : undefined}
                      className="bg-background border-border"
                    />
                  ) : (
                    <Select
                      value={newLease.unit_id}
                      onValueChange={(value) => {
                        handleUnitChange(value);
                        setLeaseErrors((prev) => ({ ...prev, unit: "" }));
                      }}
                    >
                      <SelectTrigger className="bg-background border-border" aria-invalid={!!leaseErrors.unit} aria-describedby={leaseErrors.unit ? "lease-unit-error" : undefined}>
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border z-50">
                        {filteredUnits.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            <div className="flex items-center justify-between gap-4">
                              <span>{unit.unit_number}</span>
                              {unit.status === "occupied" && (
                                <span className="text-xs text-warning">(Occupied)</span>
                              )}
                              {unit.monthly_rent && (
                                <span className="text-xs text-muted-foreground">
                                  KSh {unit.monthly_rent.toLocaleString()}/mo
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FieldError id="lease-unit-error" message={leaseErrors.unit} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rent">Monthly Rent (KSh) *</Label>
                  <Input
                    id="rent"
                    type="number"
                    value={newLease.monthly_rent}
                    onChange={(e) => {
                      setNewLease({ ...newLease, monthly_rent: e.target.value });
                      setLeaseErrors((prev) => ({ ...prev, monthly_rent: "" }));
                    }}
                    placeholder="1500"
                    aria-invalid={!!leaseErrors.monthly_rent}
                    aria-describedby={leaseErrors.monthly_rent ? "lease-rent-error" : undefined}
                    className="bg-background border-border"
                  />
                  <FieldError id="lease-rent-error" message={leaseErrors.monthly_rent} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="startDate" className="text-sm">Start Date *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={newLease.start_date}
                    onChange={(e) => {
                      setNewLease({ ...newLease, start_date: e.target.value });
                      setLeaseErrors((prev) => ({ ...prev, start_date: "" }));
                    }}
                    aria-invalid={!!leaseErrors.start_date}
                    aria-describedby={leaseErrors.start_date ? "lease-start-error" : undefined}
                    className="bg-background border-border"
                  />
                  <FieldError id="lease-start-error" message={leaseErrors.start_date} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="endDate">End Date *</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={newLease.end_date}
                    onChange={(e) => {
                      setNewLease({ ...newLease, end_date: e.target.value });
                      setLeaseErrors((prev) => ({ ...prev, end_date: "" }));
                    }}
                    aria-invalid={!!leaseErrors.end_date}
                    aria-describedby={leaseErrors.end_date ? "lease-end-error" : undefined}
                    className="bg-background border-border"
                  />
                  <FieldError id="lease-end-error" message={leaseErrors.end_date} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="deposit">Security Deposit (KSh)</Label>
                <Input
                  id="deposit"
                  type="number"
                  value={newLease.deposit}
                  onChange={(e) =>
                    setNewLease({ ...newLease, deposit: e.target.value })
                  }
                  placeholder="Defaults to 2x monthly rent"
                  className="bg-background border-border"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="terms">Additional Terms</Label>
                <Textarea
                  id="terms"
                  value={newLease.terms}
                  onChange={(e) =>
                    setNewLease({ ...newLease, terms: e.target.value })
                  }
                  placeholder="Enter any additional terms and conditions..."
                  rows={3}
                  className="bg-background border-border"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateLease}
                className="btn-brand"
              >
                Create Lease
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Select All Bar */}
      {filteredLeases.length > 0 && selectedLeases.size > 0 && (
        <div className="flex items-center justify-between gap-3 sm:gap-4 p-2.5 sm:p-3 rounded-lg bg-amber-400/6 border border-amber-400/20">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={filteredLeases.length > 0 && selectedLeases.size === filteredLeases.length}
              onCheckedChange={toggleSelectAllLeases}
              aria-label="Select all"
            />
            <span className="text-xs sm:text-sm text-foreground font-medium">
              {selectedLeases.size} of {filteredLeases.length} selected
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedLeases(new Set())}
            className="text-muted-foreground hover:text-foreground"
          >
            Clear
          </Button>
        </div>
      )}

      {loadError && !isLoading && (
        <div className="mb-4">
          <ErrorState title="Couldn't load leases" message={loadError} onRetry={() => { void fetchLeases(); }} />
        </div>
      )}

      {/* Leases Grid */}
      {isLoading ? (
        <LoadingState label="Loading leases…" variant="skeleton" rows={8} />
      ) : filteredLeases.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={searchQuery || statusFilter !== "all" ? "No matching leases" : "No leases yet"}
          description={
            searchQuery || statusFilter !== "all"
              ? "Try a different search or status filter."
              : "Create a lease agreement to connect a tenant to a unit."
          }
          actionLabel={statusFilter !== "all" ? "Clear filter" : "Create lease"}
          onAction={() => {
            if (statusFilter !== "all") setStatusFilter("all");
            else { setLeaseErrors({}); setIsDialogOpen(true); }
          }}
        />
      ) : (
        <>
        <div className="hidden md:block rounded-xl border border-border bg-card overflow-hidden card-shadow">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead className="w-10" />
                <SortableHead label="Tenant" sortKey="tenant" currentKey={leaseSortKey} dir={leaseSortDir} onSort={handleLeaseSort} />
                <SortableHead label="Property" sortKey="property" currentKey={leaseSortKey} dir={leaseSortDir} onSort={handleLeaseSort} />
                <TableHead>Unit</TableHead>
                <TableHead>Start date</TableHead>
                <SortableHead label="Expiry" sortKey="expiry" currentKey={leaseSortKey} dir={leaseSortDir} onSort={handleLeaseSort} />
                <SortableHead label="Rent" sortKey="rent" currentKey={leaseSortKey} dir={leaseSortDir} onSort={handleLeaseSort} />
                <SortableHead label="Status" sortKey="status" currentKey={leaseSortKey} dir={leaseSortDir} onSort={handleLeaseSort} />
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaseSlice.items.map((lease) => (
                <TableRow key={lease.id} className="hover:bg-muted/30 border-border">
                  <TableCell>
                    <Checkbox
                      checked={selectedLeases.has(lease.id)}
                      onCheckedChange={() => toggleLeaseSelection(lease.id)}
                      aria-label={`Select lease for ${lease.tenants?.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={lease.tenants?.photo_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {lease.tenants?.name?.split(" ").map((n) => n[0]).join("") || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium truncate">{lease.tenants?.name || "No Tenant"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm truncate">{lease.property}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-muted-foreground truncate">{lease.unit}</p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDate(lease.start_date)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDate(lease.end_date)}
                  </TableCell>
                  <TableCell className="font-medium">{formatCurrency(lease.monthly_rent)}</TableCell>
                  <TableCell>
                    {expiringSoonLeaseIds.has(lease.id) || lease.status === "expiring" ? (
                      <span className={statusBadgeClass("warning")}>Expiring soon</span>
                    ) : (
                      <span className={statusBadgeClass(leaseStatusTone(lease.status))}>
                        {leaseStatusLabel(lease.status, false)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" className="min-h-11" onClick={() => { setSelectedLease(lease); setIsViewDialogOpen(true); }}>
                        View
                      </Button>
                      {(lease.status === "active" || lease.status === "expiring") && (
                        <Button variant="ghost" size="sm" className="min-h-11 text-primary" asChild>
                          <Link to="/billing">Invoice</Link>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePager page={leaseSlice} onPageChange={setLeasePage} noun="leases" />
        </div>
        <div className="grid gap-3 grid-cols-1 md:hidden">
          {leaseSlice.items.map((lease) => (
            <LeaseCard
              key={lease.id}
              lease={lease}
              isSelected={selectedLeases.has(lease.id)}
              formatCurrency={formatCurrency}
              expiringSoon={expiringSoonLeaseIds.has(lease.id)}
              onSelect={() => toggleLeaseSelection(lease.id)}
              onView={() => { setSelectedLease(lease); setIsViewDialogOpen(true); }}
            />
          ))}
        </div>
        <div className="md:hidden">
          <TablePager page={leaseSlice} onPageChange={setLeasePage} noun="leases" />
        </div>
        </>
      )}

      {/* View Lease Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[500px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-heading text-foreground">
              Lease Details
            </DialogTitle>
            <DialogDescription>
              View and manage lease agreement
            </DialogDescription>
          </DialogHeader>
          {selectedLease && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={selectedLease.tenants?.photo_url || undefined} />
                  <AvatarFallback className="bg-amber-400 text-slate-900">
                    {selectedLease.tenants?.name
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("") || "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-foreground">
                    {selectedLease.tenants?.name || "No Tenant"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedLease.tenants?.email}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Property</p>
                  <p className="font-medium text-foreground">
                    {selectedLease.property}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Unit</p>
                  <p className="font-medium text-foreground">
                    {selectedLease.unit}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Rent</p>
                  <p className="font-medium text-foreground">
                    {formatCurrency(selectedLease.monthly_rent)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Deposit</p>
                  <p className="font-medium text-foreground">
                    {selectedLease.deposit
                      ? formatCurrency(selectedLease.deposit)
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Start Date</p>
                  <p className="font-medium text-foreground">
                    {formatDate(selectedLease.start_date)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">End Date</p>
                  <p className="font-medium text-foreground">
                    {formatDate(selectedLease.end_date)}
                  </p>
                </div>
              </div>

              {selectedLease.tenant_id && selectedLease.property_id && (
                <div className="space-y-3 mt-4">
                  <BillingDueConfigPanel scope="tenancy" scopeId={selectedLease.id} propertyId={selectedLease.property_id} title="Tenancy-specific due & overdue policy" compact />
                  <PaymentCollectionRoutingPanel propertyId={selectedLease.property_id} tenantId={selectedLease.tenant_id} leaseId={selectedLease.id} />
                </div>
              )}

              {selectedLease.terms && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Additional Terms
                  </p>
                  <p className="text-sm text-foreground bg-muted/30 p-3 rounded-lg">
                    {selectedLease.terms}
                  </p>
                </div>
              )}

              {/* Document Attachment Section */}
              <div className="pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground mb-3">
                  Lease Document
                </p>
                {selectedLease.document_url ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-success/10 border border-success/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Paperclip className="h-4 w-4 text-success" />
                        <span className="text-sm font-medium">Document attached</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            const { getSignedUrl } = await import('@/shared/lib/storageUtils');
                            const signedUrl = await getSignedUrl(selectedLease.document_url!);
                            if (signedUrl) {
                              handleDownloadLeaseDocument(signedUrl, selectedLease.property, selectedLease.unit);
                            } else {
                              toast({
                                title: "Error",
                                description: "Could not download document.",
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            const { getSignedUrl } = await import('@/shared/lib/storageUtils');
                            const signedUrl = await getSignedUrl(selectedLease.document_url!);
                            if (signedUrl) {
                              openSafely(signedUrl);
                            } else {
                              toast({
                                title: "Error",
                                description: "Could not open document.",
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        {/* Re-upload option */}
                        <div className="relative">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isUploadingDoc === selectedLease.id || isViewOnly}
                          >
                            {isUploadingDoc === selectedLease.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4" />
                            )}
                          </Button>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadLeaseDocument(selectedLease.id, file, selectedLease.tenants?.name, selectedLease.tenants?.id);
                              e.target.value = '';
                            }}
                            disabled={isUploadingDoc === selectedLease.id || isViewOnly}
                          />
                        </div>
                      </div>
                    </div>
                    {/* Inline Document Preview */}
                    <div className="border border-border rounded-lg overflow-hidden bg-muted/20">
                      <div className="p-2 bg-muted/30 border-b border-border flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Document Preview</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={async () => {
                            const { getSignedUrl } = await import('@/shared/lib/storageUtils');
                            const signedUrl = await getSignedUrl(selectedLease.document_url!);
                            if (signedUrl) {
                              openSafely(signedUrl);
                            }
                          }}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Open Full
                        </Button>
                      </div>
                      <DocumentPreview documentUrl={selectedLease.document_url} />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-muted/30 border rounded-lg">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Paperclip className="h-4 w-4" />
                      <span className="text-sm">No document attached</span>
                    </div>
                    <div className="relative">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isUploadingDoc === selectedLease.id || isViewOnly}
                      >
                        {isUploadingDoc === selectedLease.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Upload
                      </Button>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadLeaseDocument(selectedLease.id, file, selectedLease.tenants?.name, selectedLease.tenants?.id);
                          e.target.value = '';
                        }}
                        disabled={isUploadingDoc === selectedLease.id || isViewOnly}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground mb-3">
                  Next step
                </p>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/billing">Create invoice / collect rent</Link>
                </Button>
              </div>

              <div className="pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground mb-3">
                  Update Status
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedLease.status !== "active" && (
                    <Button
                      size="sm"
                      className="bg-success hover:bg-success"
                      onClick={() => updateLeaseStatus(selectedLease.id, "active")}
                    >
                      Activate
                    </Button>
                  )}
                  {selectedLease.status !== "expired" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-warning/50 text-warning hover:bg-warning/10"
                      onClick={() =>
                        updateLeaseStatus(selectedLease.id, "expiring")
                      }
                    >
                      Mark Expiring
                    </Button>
                  )}
                  {selectedLease.status !== "terminated" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                      onClick={() =>
                        updateLeaseStatus(selectedLease.id, "terminated")
                      }
                    >
                      Terminate
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Deactivate Confirmation Dialog */}
      <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Deactivate {selectedLeases.size} Lease{selectedLeases.size > 1 ? 's' : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate{" "}
              <span className="font-semibold text-foreground">
                {selectedLeases.size} lease{selectedLeases.size > 1 ? 's' : ''}
              </span>
              ? They will be moved to history and can be reactivated later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteLeases}
              disabled={isDeleting}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {isDeleting ? "Deactivating..." : `Deactivate ${selectedLeases.size}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        </TabsContent>

        <TabsContent value="renewals" className="space-y-4 sm:space-y-6">
          <LeaseRenewalPipeline />
        </TabsContent>

        <TabsContent value="statements">
          <LeaseStatements />
        </TabsContent>
      </Tabs>
    </Layout>
  );
};

export default Leases;
