// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
/**
 * useContractsData.ts
 *
 * React Query hooks for Contracts.tsx — replaces the manual
 * fetchData() pattern and its 6 parallel useState/setters.
 *
 * Typed via Database["public"]["Tables"] — no `as any` on query results.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logError } from "@/shared/lib/errorLogger";
import type { Database } from "@/integrations/supabase/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type ContractRow  = Database["public"]["Tables"]["contracts"]["Row"];
type TemplateRow  = Database["public"]["Tables"]["contract_templates"]["Row"];
type LeaseRow     = Database["public"]["Tables"]["leases"]["Row"];
type TenantRow    = Database["public"]["Tables"]["tenants"]["Row"];

export type ContractStatus = "draft" | "pending_approval" | "approved" | "sent" | "signed" | "expired" | "terminated";

export interface ContractWithRelations extends ContractRow {
  leases: (Pick<LeaseRow, "id" | "property" | "unit" | "monthly_rent"> & {
    tenants: Pick<TenantRow, "id" | "name" | "email" | "phone"> | null;
  }) | null;
}

export interface UploadedDocument {
  id: string;
  file_name: string;
  file_url: string;
  uploaded_at: string;
  lease_id: string | null;
  contract_id: string | null;
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const contractKeys = {
  all:       ["contracts"]            as const,
  templates: ["contracts", "templates"] as const,
  leases:    ["contracts", "leases"]  as const,
  uploads:   ["contracts", "uploads"] as const,
  tenants:   ["contracts", "tenants"] as const,
};

// ── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchContracts(): Promise<ContractWithRelations[]> {
  const { data, error } = await supabase
    .from("contracts")
    .select(`
      *,
      leases (
        id, property, unit, monthly_rent,
        tenants ( id, name, email, phone )
      )
    `)
    .order("created_at", { ascending: false });

  if (error) { logError("contracts.fetchContracts", error); throw error; }
  return (data ?? []) as ContractWithRelations[];
}

async function fetchTemplates(): Promise<TemplateRow[]> {
  const { data, error } = await supabase
    .from("contract_templates")
    .select("*")
    .order("name");

  if (error) { logError("contracts.fetchTemplates", error); throw error; }
  return (data ?? []) as TemplateRow[];
}

async function fetchLeases() {
  const { data, error } = await supabase
    .from("leases")
    .select(`
      id, property, unit, monthly_rent, start_date, end_date, status, tenant_id,
      tenants ( id, name, email, phone )
    `)
    .eq("status", "active")
    .order("property");

  if (error) { logError("contracts.fetchLeases", error); throw error; }
  return data ?? [];
}

async function fetchUploads(): Promise<UploadedDocument[]> {
  const { data, error } = await supabase
    .from("uploaded_documents")
    .select("id, file_name, file_url, uploaded_at, lease_id, contract_id")
    .order("uploaded_at", { ascending: false });

  if (error) { logError("contracts.fetchUploads", error); throw error; }
  return (data ?? []) as UploadedDocument[];
}

async function fetchTenants() {
  const { data, error } = await supabase
    .from("tenants")
    .select("id, name, email, phone, property, unit")
    .eq("status", "active")
    .order("name");

  if (error) { logError("contracts.fetchTenants", error); throw error; }
  return data ?? [];
}

// ── Main hook ─────────────────────────────────────────────────────────────────

export function useContractsData() {
  const queryClient = useQueryClient();

  const contractsQuery  = useQuery({ queryKey: contractKeys.all,       queryFn: fetchContracts,  staleTime: 2 * 60 * 1000 });
  const templatesQuery  = useQuery({ queryKey: contractKeys.templates,  queryFn: fetchTemplates,  staleTime: 10 * 60 * 1000 });
  const leasesQuery     = useQuery({ queryKey: contractKeys.leases,     queryFn: fetchLeases,     staleTime: 5 * 60 * 1000 });
  const uploadsQuery    = useQuery({ queryKey: contractKeys.uploads,    queryFn: fetchUploads,    staleTime: 2 * 60 * 1000 });
  const tenantsQuery    = useQuery({ queryKey: contractKeys.tenants,    queryFn: fetchTenants,    staleTime: 5 * 60 * 1000 });

  const isLoading = contractsQuery.isLoading;

  const invalidateContracts = () =>
    queryClient.invalidateQueries({ queryKey: contractKeys.all });

  return {
    contracts:         contractsQuery.data  ?? [],
    templates:         templatesQuery.data  ?? [],
    leases:            leasesQuery.data     ?? [],
    uploadedDocuments: uploadsQuery.data    ?? [],
    tenants:           tenantsQuery.data    ?? [],
    isLoading,
    invalidateContracts,
  };
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/** Update contract status (approve, send for signature, etc.) */
export function useUpdateContractStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contractId,
      status,
      extra = {},
    }: {
      contractId: string;
      status: ContractStatus;
      extra?: Partial<ContractRow>;
    }) => {
      const { error } = await supabase.rpc("transition_contract_atomic", { p_contract_id: contractId, p_status: status, p_updates: extra as Record<string, unknown> });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contractKeys.all });
    },
  });
}

/** Create a new contract. */
export function useCreateContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      payload: Pick<
        ContractRow,
        "title" | "content" | "lease_id" | "tenant_id" | "manager_id" | "status"
      >,
    ) => {
      const { data, error } = await supabase.rpc("create_contract_atomic", {
        p_lease_id: payload.lease_id, p_tenant_id: payload.tenant_id ?? null, p_property_id: null, p_unit_id: null, p_template_id: null,
        p_title: payload.title, p_content: payload.content, p_valid_from: null, p_valid_until: null, p_status: payload.status,
      });

      if (error) throw error;
      return data as ContractRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contractKeys.all });
    },
  });
}

/** Soft-delete a contract (marks as terminated). */
export function useDeleteContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contractId,
      reason,
    }: {
      contractId: string;
      reason: string;
    }) => {
      const { error } = await supabase.rpc("soft_delete_contract_atomic", { p_contract_id: contractId, p_reason: reason });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contractKeys.all });
    },
  });
}
