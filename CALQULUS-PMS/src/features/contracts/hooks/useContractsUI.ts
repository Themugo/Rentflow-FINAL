// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
/**
 * useContractsUI.ts
 *
 * Custom hook for managing contracts page UI state.
 * Separates UI state management from business logic.
 */

import { useState, useCallback, useMemo } from "react";
import type { ContractWithRelations } from "@/features/contracts/hooks/useContractsData";
import type { TemplateRow } from "@/features/contracts/hooks/useContractsData";
import type { LeaseRow } from "@/features/contracts/hooks/useContractsData";

export type ContractStatus = "draft" | "pending_signature" | "signed" | "expired" | "cancelled";

export interface ContractFilters {
  searchQuery: string;
  statusFilter: ContractStatus | "all";
  activeTab: "contracts" | "templates" | "uploaded";
}

export interface ContractSelection {
  selectedContracts: Set<string>;
  contractToDelete: ContractWithRelations | null;
  selectedContract: ContractWithRelations | null;
}

export interface ContractDialogs {
  createDialogOpen: boolean;
  previewDialogOpen: boolean;
  signDialogOpen: boolean;
  deleteDialogOpen: boolean;
  bulkDeleteDialogOpen: boolean;
}

export interface ContractLoading {
  isUploading: string | null;
  isBulkUploading: boolean;
  isDeleting: boolean;
  isSendingEmail: string | null;
  isSendingWhatsApp: string | null;
}

export interface NewContractForm {
  lease_id: string;
  template_id: string;
  title: string;
  content: string;
  valid_from: string;
  valid_until: string;
}

const initialFormState: NewContractForm = {
  lease_id: "",
  template_id: "",
  title: "",
  content: "",
  valid_from: "",
  valid_until: "",
};

export function useContractsUI(
  contracts: ContractWithRelations[],
  templates: TemplateRow[],
  leases: LeaseRow[]
) {
  // Filters
  const [filters, setFilters] = useState<ContractFilters>({
    searchQuery: "",
    statusFilter: "all",
    activeTab: "contracts",
  });

  // Selection state
  const [selection, setSelection] = useState<ContractSelection>({
    selectedContracts: new Set(),
    contractToDelete: null,
    selectedContract: null,
  });

  // Dialog state
  const [dialogs, setDialogs] = useState<ContractDialogs>({
    createDialogOpen: false,
    previewDialogOpen: false,
    signDialogOpen: false,
    deleteDialogOpen: false,
    bulkDeleteDialogOpen: false,
  });

  // Loading state
  const [loading, setLoading] = useState<ContractLoading>({
    isUploading: null,
    isBulkUploading: false,
    isDeleting: false,
    isSendingEmail: null,
    isSendingWhatsApp: null,
  });

  // Form state
  const [newContract, setNewContract] = useState<NewContractForm>(initialFormState);
  const [deleteReason, setDeleteReason] = useState("");

  // Filtered contracts
  const filteredContracts = useMemo(() => {
    let result = contracts;

    if (filters.statusFilter !== "all") {
      result = result.filter((c) => c.status === filters.statusFilter);
    }

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.title?.toLowerCase().includes(query) ||
          c.tenants?.name?.toLowerCase().includes(query) ||
          c.leases?.property?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [contracts, filters.statusFilter, filters.searchQuery]);

  // Actions
  const updateFilter = useCallback(<K extends keyof ContractFilters>(
    key: K,
    value: ContractFilters[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleContractSelection = useCallback((contractId: string) => {
    setSelection((prev) => {
      const newSet = new Set(prev.selectedContracts);
      if (newSet.has(contractId)) {
        newSet.delete(contractId);
      } else {
        newSet.add(contractId);
      }
      return { ...prev, selectedContracts: newSet };
    });
  }, []);

  const selectAllContracts = useCallback((select: boolean) => {
    setSelection((prev) => ({
      ...prev,
      selectedContracts: select ? new Set(filteredContracts.map((c) => c.id)) : new Set(),
    }));
  }, [filteredContracts]);

  const clearSelection = useCallback(() => {
    setSelection((prev) => ({ ...prev, selectedContracts: new Set() }));
  }, []);

  const openDialog = useCallback(<K extends keyof ContractDialogs>(
    dialog: K,
    contract?: ContractWithRelations
  ) => {
    setDialogs((prev) => ({ ...prev, [dialog]: true }));
    if (contract) {
      setSelection((prev) => ({ ...prev, selectedContract: contract }));
    }
  }, []);

  const closeDialog = useCallback(<K extends keyof ContractDialogs>(dialog: K) => {
    setDialogs((prev) => ({ ...prev, [dialog]: false }));
    if (dialog === "signDialogOpen" || dialog === "previewDialogOpen") {
      setSelection((prev) => ({ ...prev, selectedContract: null }));
    }
  }, []);

  const openDeleteDialog = useCallback((contract: ContractWithRelations) => {
    setSelection((prev) => ({ ...prev, contractToDelete: contract }));
    setDeleteReason("");
    setDialogs((prev) => ({ ...prev, deleteDialogOpen: true }));
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setDialogs((prev) => ({ ...prev, deleteDialogOpen: false }));
    setSelection((prev) => ({ ...prev, contractToDelete: null }));
    setDeleteReason("");
  }, []);

  const updateNewContract = useCallback(<K extends keyof NewContractForm>(
    key: K,
    value: NewContractForm[K]
  ) => {
    setNewContract((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetNewContract = useCallback(() => {
    setNewContract(initialFormState);
  }, []);

  const setLoadingState = useCallback(<K extends keyof ContractLoading>(
    key: K,
    value: ContractLoading[K]
  ) => {
    setLoading((prev) => ({ ...prev, [key]: value }));
  }, []);

  const getLeaseById = useCallback(
    (leaseId: string) => leases.find((l) => l.id === leaseId),
    [leases]
  );

  const getTemplateById = useCallback(
    (templateId: string) => templates.find((t) => t.id === templateId),
    [templates]
  );

  return {
    // State
    filters,
    selection,
    dialogs,
    loading,
    newContract,
    deleteReason,
    filteredContracts,

    // Filter actions
    updateFilter,

    // Selection actions
    toggleContractSelection,
    selectAllContracts,
    clearSelection,

    // Dialog actions
    openDialog,
    closeDialog,
    openDeleteDialog,
    closeDeleteDialog,

    // Form actions
    updateNewContract,
    resetNewContract,
    setDeleteReason,

    // Loading actions
    setLoadingState,

    // Utilities
    getLeaseById,
    getTemplateById,
  };
}
