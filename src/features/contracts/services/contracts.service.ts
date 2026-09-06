/**
 * contracts.service.ts
 *
 * Service layer for contract operations.
 * Contains all API calls and data transformations.
 */

import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { logError } from "@/shared/lib/errorLogger";
import type { Database } from "@/integrations/supabase/types";

type ContractRow = Database["public"]["Tables"]["contracts"]["Row"];

export interface LeaseForContract {
  id: string;
  property: string;
  unit: string;
  monthly_rent: number;
  start_date: string;
  end_date: string;
  tenant_id?: string;
  tenants?: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
}

/**
 * Fetch company settings for template population
 */
export async function fetchCompanySettings() {
  const { data, error } = await supabase
    .from("company_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) logError("fetchCompanySettings", error);
  return { data, error };
}

/**
 * Fetch property details
 */
export async function fetchPropertyDetails(propertyName: string) {
  const { data, error } = await supabase
    .from("properties")
    .select("address")
    .eq("name", propertyName)
    .maybeSingle();

  if (error) logError("fetchPropertyDetails", error);
  return { data, error };
}

/**
 * Create a new contract
 */
export async function createContract(payload: {
  lease_id: string;
  tenant_id?: string;
  property_id?: string;
  unit_id?: string;
  template_id?: string;
  title: string;
  content: string;
  valid_from?: string;
  valid_until?: string;
}) {
  const { data, error } = await supabase.rpc("create_contract_atomic", {
    p_lease_id: payload.lease_id, p_tenant_id: payload.tenant_id ?? null, p_property_id: payload.property_id ?? null,
    p_unit_id: payload.unit_id ?? null, p_template_id: payload.template_id ?? null, p_title: payload.title,
    p_content: payload.content, p_valid_from: payload.valid_from ?? null, p_valid_until: payload.valid_until ?? null, p_status: "draft",
  });

  if (error) {
    logError("createContract", error);
    throw error;
  }

  return data;
}

/**
 * Update contract status
 */
export async function updateContractStatus(
  contractId: string,
  updates: Partial<ContractRow>
) {
  const { error } = await supabase.rpc("transition_contract_atomic", {
    p_contract_id: contractId, p_status: updates.status ?? null, p_updates: updates as Record<string, unknown>,
  });

  if (error) {
    logError("updateContractStatus", error);
    throw error;
  }
}

/**
 * Add manager signature
 */
export async function addManagerSignature(contractId: string, signature: string) {
  const { error } = await supabase.rpc("transition_contract_atomic", {
    p_contract_id: contractId, p_status: "signed", p_updates: { manager_signature: signature, manager_signed_at: new Date().toISOString() },
  });

  if (error) {
    logError("addManagerSignature", error);
    throw error;
  }
}

/**
 * Soft delete a contract
 */
export async function softDeleteContract(
  contractId: string,
  userId: string,
  reason: string
) {
  const { error } = await supabase.rpc("soft_delete_contract_atomic", { p_contract_id: contractId, p_reason: reason, p_deleted_by: userId });

  if (error) {
    logError("softDeleteContract", error);
    throw error;
  }
}

/**
 * Bulk soft delete contracts
 */
export async function bulkDeleteContracts(
  contractIds: string[],
  userId: string,
  reason: string
) {
  for (const contractId of contractIds) {
    const { error } = await supabase.rpc("soft_delete_contract_atomic", { p_contract_id: contractId, p_reason: reason, p_deleted_by: userId });
    if (error) {
      logError("bulkDeleteContracts", error);
      throw error;
    }
  }
}

/**
 * Submit contract for approval
 */
export async function submitForApproval(contractId: string) {
  const { error } = await supabase.rpc("transition_contract_atomic", { p_contract_id: contractId, p_status: "pending_approval", p_updates: { pending_approval: true, rejection_reason: null } });

  if (error) {
    logError("submitForApproval", error);
    throw error;
  }
}

/**
 * Send contract for signature (notify tenant)
 */
export async function sendForSignature(
  contractId: string,
  tenantEmail: string,
  tenantName: string,
  contractTitle: string,
  propertyInfo: string,
  validFrom: string,
  validUntil: string,
  portalUrl: string,
  companyName: string
) {
  const { error } = await supabase.functions.invoke("send-contract-notification", {
    body: {
      tenantEmail,
      tenantName,
      companyName,
      contractTitle,
      propertyInfo,
      validFrom,
      validUntil,
      portalUrl,
    },
  });

  if (error) {
    logError("sendForSignature", error);
    throw error;
  }
}

/**
 * Populate template with lease data
 */
export function populateTemplateContent(
  templateContent: string,
  lease: LeaseForContract,
  company?: { company_name?: string; address?: string; city?: string; state?: string; zip_code?: string; email?: string; phone?: string } | null,
  property?: { address?: string } | null,
  formatCurrency: (amount: number) => string = (amount: number) => `KES ${amount.toLocaleString()}`
): string {
  const replacements: Record<string, string> = {
    "{{company_name}}": company?.company_name || "Property Management LLC",
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
    "{{deposit}}": formatCurrency(0),
  };

  let content = templateContent;
  for (const [placeholder, value] of Object.entries(replacements)) {
    content = content.replace(new RegExp(placeholder.replace(/[{}]/g, "\\$&"), "g"), value);
  }

  return content;
}
