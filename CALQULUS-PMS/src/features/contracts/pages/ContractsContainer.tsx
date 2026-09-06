// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
/**
 * ContractsContainer.tsx
 *
 * Container component for the Contracts feature.
 * Orchestrates state management and renders presentation components.
 *
 * Architecture:
 * - Container: State management, data fetching, business logic
 * - Presentation: Pure UI components
 * - Dialogs: Reusable modal components
 * - Hooks: Reusable stateful logic
 * - Services: API calls and data transformations
 */

import { useCallback } from "react";
import { Layout } from "@/shared/components/layout/Layout";
import { FeatureGate } from "@/shared/components/FeatureGate";
import { useToast } from "@/shared/hooks/use-toast";
import { useContractsData, ContractWithRelations, ContractStatus } from "@/features/contracts/hooks/useContractsData";
import { useContractsUI } from "@/features/contracts/hooks/useContractsUI";
import {
  createContract,
  softDeleteContract,
  bulkDeleteContracts,
  submitForApproval,
  updateContractStatus,
  sendForSignature,
  fetchCompanySettings,
} from "@/features/contracts/services/contracts.service";

// Presentation Components
import { ContractsHeader } from "@/features/contracts/components/ContractsHeader";
import { ContractsTable } from "@/features/contracts/components/ContractsTable";

// Dialog Components
import { CreateContractDialog } from "@/features/contracts/dialogs/CreateContractDialog";
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
import { format } from "date-fns";
import { DashboardSectionHeader } from "@/features/dashboard/components/DashboardSectionHeader";

export function ContractsContainer() {
  const { toast } = useToast();

  // Data fetching via React Query
  const {
    contracts,
    templates,
    leases,
    uploadedDocuments,
    isLoading,
    invalidateContracts,
  } = useContractsData();

  // UI state management
  const {
    filters,
    selection,
    dialogs,
    loading,
    newContract,
    deleteReason,
    filteredContracts,
    updateFilter,
    toggleContractSelection,
    selectAllContracts,
    clearSelection,
    openDialog,
    closeDialog,
    openDeleteDialog,
    closeDeleteDialog,
    updateNewContract,
    resetNewContract,
    setDeleteReason,
    setLoadingState,
    getLeaseById,
  } = useContractsUI(contracts, templates, leases);

  // Handlers
  const handleCreateSuccess = useCallback(() => {
    invalidateContracts();
    resetNewContract();
  }, [invalidateContracts, resetNewContract]);

  const handleDeleteContract = useCallback(async () => {
    if (!selection.contractToDelete) return;

    setLoadingState("isDeleting", true);
    const { data: { user } } = await import("@/integrations/supabase/client").then(m => m.supabase.auth.getUser());

    if (!user) {
      toast({ title: "Error", description: "You must be logged in", variant: "destructive" });
      setLoadingState("isDeleting", false);
      return;
    }

    try {
      await softDeleteContract(selection.contractToDelete.id, user.id, deleteReason);
      toast({ title: "Contract Deleted", description: "The contract has been marked for deletion." });
      closeDeleteDialog();
      invalidateContracts();
    } catch {
      toast({ title: "Error", description: "Failed to delete contract", variant: "destructive" });
    } finally {
      setLoadingState("isDeleting", false);
    }
  }, [selection.contractToDelete, deleteReason, closeDeleteDialog, invalidateContracts, setLoadingState, toast]);

  const handleBulkDelete = useCallback(async () => {
    if (selection.selectedContracts.size === 0) return;

    setLoadingState("isDeleting", true);
    const { data: { user } } = await import("@/integrations/supabase/client").then(m => m.supabase.auth.getUser());

    if (!user) {
      setLoadingState("isDeleting", false);
      return;
    }

    try {
      await bulkDeleteContracts(
        Array.from(selection.selectedContracts),
        user.id,
        "Bulk deletion"
      );
      toast({ title: "Contracts Deleted", description: `${selection.selectedContracts.size} contracts deleted.` });
      clearSelection();
      invalidateContracts();
    } catch {
      toast({ title: "Error", description: "Failed to delete contracts", variant: "destructive" });
    } finally {
      setLoadingState("isDeleting", false);
    }
  }, [selection.selectedContracts, clearSelection, invalidateContracts, setLoadingState, toast]);

  const handleSubmitForApproval = useCallback(async (contractId: string) => {
    try {
      await submitForApproval(contractId);
      toast({ title: "Submitted for Approval", description: "The contract has been submitted for webhost approval." });
      invalidateContracts();
    } catch {
      toast({ title: "Error", description: "Failed to submit for approval", variant: "destructive" });
    }
  }, [invalidateContracts, toast]);

  const handleSendForSignature = useCallback(async (contract: ContractWithRelations) => {
    setLoadingState("isSendingEmail", contract.id);
    try {
      await updateContractStatus(contract.id, { status: "pending_signature" });

      const { data: company } = await fetchCompanySettings();
      const portalUrl = `${window.location.origin}/tenant-portal`;

      if (contract.tenants?.email) {
        try {
          await sendForSignature(
            contract.id,
            contract.tenants.email,
            contract.tenants.name,
            contract.title ?? "",
            contract.leases ? `${contract.leases.property} - ${contract.leases.unit}` : "N/A",
            contract.valid_from ? format(new Date(contract.valid_from), "dd/MM/yy") : "Not set",
            contract.valid_until ? format(new Date(contract.valid_until), "dd/MM/yy") : "Not set",
            portalUrl,
            company?.company_name || "CALQULUS PMS Properties"
          );
          toast({ title: "Contract Sent", description: `Contract sent to ${contract.tenants.name}.` });
        } catch {
          toast({ title: "Contract Sent", description: `Status updated, but email notification failed.` });
        }
      } else {
        toast({ title: "Contract Sent", description: "Status updated. No email sent (tenant email not available)." });
      }
      invalidateContracts();
    } catch {
      toast({ title: "Error", description: "Failed to send contract", variant: "destructive" });
    } finally {
      setLoadingState("isSendingEmail", null);
    }
  }, [invalidateContracts, setLoadingState, toast]);

  const handleStatusChange = useCallback(async (contractId: string, status: ContractStatus) => {
    try {
      await updateContractStatus(contractId, { status });
      toast({ title: "Status Updated", description: `Contract status changed to ${status}.` });
      invalidateContracts();
    } catch {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  }, [invalidateContracts, toast]);

  // Render based on active tab
  if (filters.activeTab === "templates") {
    // Templates tab - render template manager
    return (
      <div className="container mx-auto py-6">
        <ContractsHeader
          searchQuery={filters.searchQuery}
          onSearchChange={(v) => updateFilter("searchQuery", v)}
          statusFilter={filters.statusFilter}
          onStatusFilterChange={(v) => updateFilter("statusFilter", v)}
          activeTab={filters.activeTab}
          onTabChange={(v) => updateFilter("activeTab", v)}
          totalContracts={contracts.length}
          filteredCount={filteredContracts.length}
          selectedCount={selection.selectedContracts.size}
          onCreateClick={() => openDialog("createDialogOpen")}
        />
        {/* Template manager will be rendered here */}
      </div>
    );
  }

  if (filters.activeTab === "uploaded") {
    // Uploaded tab
    return (
      <div className="container mx-auto py-6">
        <ContractsHeader
          searchQuery={filters.searchQuery}
          onSearchChange={(v) => updateFilter("searchQuery", v)}
          statusFilter={filters.statusFilter}
          onStatusFilterChange={(v) => updateFilter("statusFilter", v)}
          activeTab={filters.activeTab}
          onTabChange={(v) => updateFilter("activeTab", v)}
          totalContracts={contracts.length}
          filteredCount={filteredContracts.length}
          selectedCount={selection.selectedContracts.size}
          onCreateClick={() => openDialog("createDialogOpen")}
        />
        {/* Uploaded documents will be rendered here */}
      </div>
    );
  }

  // Main contracts tab
  return (
    <Layout
      title="Contracts & Documents"
      subtitle="Manage lease contracts, templates, and digital signatures"
    >
      <FeatureGate feature="contracts" featureLabel="Contracts">
      <div className="space-y-6">
        <DashboardSectionHeader
          eyebrow="Records / Contracts & documents"
          title="Agreements at a glance"
          description="Keep contract status, signatures and uploaded records visible before opening an individual agreement."
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Contract workspace summary">
          {[
            ["Total", contracts.length],
            ["Active", contracts.filter((c: any) => c.status === "active").length],
            ["Awaiting signature", contracts.filter((c: any) => c.status === "pending_signature").length],
            ["Uploaded", uploadedDocuments.length],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-border bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">{value}</p>
            </div>
          ))}
        </div>
        <ContractsHeader
          searchQuery={filters.searchQuery}
          onSearchChange={(v) => updateFilter("searchQuery", v)}
          statusFilter={filters.statusFilter}
          onStatusFilterChange={(v) => updateFilter("statusFilter", v)}
          activeTab={filters.activeTab}
          onTabChange={(v) => updateFilter("activeTab", v)}
          totalContracts={contracts.length}
          filteredCount={filteredContracts.length}
          selectedCount={selection.selectedContracts.size}
          onCreateClick={() => openDialog("createDialogOpen")}
        />

        <ContractsTable
          contracts={filteredContracts}
          isLoading={isLoading}
          selectedContracts={selection.selectedContracts}
          onToggleSelect={toggleContractSelection}
          onSelectAll={(select) => selectAllContracts(select)}
          onPreview={(contract) => openDialog("previewDialogOpen", contract)}
          onSign={(contract) => openDialog("signDialogOpen", contract)}
          onDelete={(contract) => openDeleteDialog(contract)}
          onSubmitForApproval={handleSubmitForApproval}
          onSendForSignature={handleSendForSignature}
          onStatusChange={handleStatusChange}
          isSendingEmail={loading.isSendingEmail}
        />

        {/* Create Contract Dialog */}
        <CreateContractDialog
          open={dialogs.createDialogOpen}
          onOpenChange={(open) => {
            if (!open) resetNewContract();
            closeDialog("createDialogOpen");
          }}
          leases={leases}
          templates={templates}
          onSuccess={handleCreateSuccess}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={dialogs.deleteDialogOpen} onOpenChange={(open) => !open && closeDeleteDialog()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Contract</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{selection.contractToDelete?.title}"?
                This action will mark the contract for deletion and requires confirmation.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={closeDeleteDialog}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteContract}>
                {loading.isDeleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      </FeatureGate>
    </Layout>
  );
}
