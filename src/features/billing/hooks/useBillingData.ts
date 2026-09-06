/**
 * useBillingData.ts
 *
 * Replaces the manual useState/useEffect/fetchInvoices/fetchLeases/fetchTenants
 * pattern in Billing.tsx with proper React Query hooks.
 *
 * Benefits over the old approach:
 *   - Automatic background refetch when the window regains focus
 *   - Request deduplication: multiple components calling useBillingData()
 *     share a single in-flight request instead of firing N queries
 *   - Typed responses via Database["public"]["Tables"] — no more `as any`
 *   - invalidateQueries after mutations keeps data fresh without manual
 *     fetchInvoices() calls scattered through handlers
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthContext";
import { useManagerScope } from "@/shared/hooks/useManagerScope";
import { logError } from "@/shared/lib/errorLogger";
import { trackTimeToFirst } from "@/features/dashboard/lib/activationMetrics";
import { invalidateManagerActivation } from "@/features/dashboard/hooks/useManagerActivation";
import { invalidateDashboardQueries } from "@/shared/lib/invalidateDashboards";
import { roundMoney } from "@/shared/lib/money";
import type { Database } from "@/integrations/supabase/types";
import { agencyServiceModelFromOperatingModel, type AgencyServiceModel } from "@/shared/constants/authorityModels";

// ── Typed row aliases ────────────────────────────────────────────────────────

type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];
type LeaseRow   = Database["public"]["Tables"]["leases"]["Row"];
type TenantRow  = Database["public"]["Tables"]["tenants"]["Row"];
type ExpenditureRow = Database["public"]["Tables"]["expenditures"]["Row"];

// ── Shape returned to the page component ────────────────────────────────────

// The generated invoice_status enum ("paid" | "pending" | "overdue" | "cancelled")
// is stale relative to the live DB — InvoiceTable.tsx already defines its own
// wider local union for the same reason. Reuse the same seven real values here
// rather than letting each file invent a slightly different override.
export type BillingInvoiceStatus =
  | "paid" | "pending" | "overdue" | "cancelled"
  | "partially_paid" | "failed" | "refunded";

export interface BillingInvoice extends Omit<InvoiceRow, "status"> {
  status: BillingInvoiceStatus;
  leases: { property: string; unit: string } | null;
  tenants: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    photo_url: string | null;
  } | null;
  // The comprehensive-payment-schema migration (20260506000003) added these
  // columns to invoices for partial/instalment payments — original_amount,
  // paid_amount, balance_due. fetchInvoices() below selects "*", so they're
  // already present on every row at runtime; they're just missing from the
  // generated Database types until the next `supabase gen types` run, so we
  // declare them here rather than casting past them (same pattern as
  // shared/lib/money.ts's PayableInvoice).
  original_amount: number | null;
  paid_amount: number;
  balance_due: number | null;
  /** Agency-only: whether the agency is permitted to collect this invoice. */
  agencyCanCollect?: boolean;
  /** Agency-only: configured collection destination for this invoice. */
  agencyCollectionDestination?: "agency" | "landlord";
}

// fetchLeases() below only selects a handful of columns (not every LeaseRow
// column), so BillingLease reflects exactly that projection rather than
// falsely claiming to be a full lease row.
export interface BillingLease
  extends Pick<LeaseRow, "id" | "property" | "unit" | "monthly_rent" | "tenant_id" | "property_id" | "unit_id"> {
  tenants: {
    id: string;
    name: string;
    email: string;
    photo_url: string | null;
  } | null;
}

export type BillingTenant = Pick<
  TenantRow,
  "id" | "name" | "email" | "phone" | "photo_url" | "property" | "unit" | "monthly_rent"
>;

export type BillingExpenditure = ExpenditureRow;

// ── Query keys — centralised so invalidation is consistent ──────────────────

export const billingKeys = {
  invoices:     (managerId: string) => ["billing", "invoices", managerId] as const,
  leases:       (managerId: string) => ["billing", "leases", managerId] as const,
  tenants:      (managerId: string) => ["billing", "tenants", managerId] as const,
  expenditures: (managerId: string, month: string) =>
                  ["billing", "expenditures", managerId, month] as const,
};

// ── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchInvoices(managerId: string, assignedPropertyIds?: string[], isAgency = false): Promise<BillingInvoice[]> {
  if (assignedPropertyIds && assignedPropertyIds.length === 0) return [];

  let scopedTenantIds: string[] | null = null;
  if (assignedPropertyIds) {
    const { data: scopedTenants } = await supabase
      .from("tenants")
      .select("id")
      .eq("manager_id", managerId)
      .in("property_id", assignedPropertyIds);
    scopedTenantIds = (scopedTenants ?? []).map((t) => t.id);
    if (scopedTenantIds.length === 0) return [];
  }

  let query = supabase
    .from("invoices")
    .select(`
      *,
      leases ( property, unit ),
      tenants ( id, name, email, phone, photo_url )
    `)
    .eq("manager_id", managerId)
    .order("created_at", { ascending: false });
  if (scopedTenantIds) {
    query = query.in("tenant_id", scopedTenantIds);
  }

  const { data, error } = await query;

  if (error) {
    logError("billing.fetchInvoices", error);
    throw error;
  }

  const invoices = (data ?? []) as BillingInvoice[];
  if (!isAgency || invoices.length === 0) return invoices;

  const propertyIds = [...new Set(invoices.map((invoice) => invoice.property_id).filter((id): id is string => Boolean(id)))];
  const { data: serviceLinks, error: serviceError } = propertyIds.length
    ? await supabase
        .from("property_landlords")
        .select("property_id, agency_service_model, operating_model, payment_destination")
        .eq("manager_id", managerId)
        .in("property_id", propertyIds)
    : { data: [], error: null };
  if (serviceError) {
    logError("billing.fetchAgencyServiceModels", serviceError);
    throw serviceError;
  }

  const serviceByProperty = new Map<string, { model: AgencyServiceModel | null; destination: "agency" | "landlord" }>();
  for (const link of serviceLinks ?? []) {
    const model = (link.agency_service_model ?? agencyServiceModelFromOperatingModel(link.operating_model)) as AgencyServiceModel | null;
    const destination = link.payment_destination === "landlord" || model === "managed_direct_landlord_collection" ? "landlord" : "agency";
    serviceByProperty.set(link.property_id, { model, destination });
  }

  return invoices.map((invoice) => {
    const service = invoice.property_id ? serviceByProperty.get(invoice.property_id) : undefined;
    const legacyAllowed = !service || !service.model;
    return {
      ...invoice,
      agencyCanCollect: legacyAllowed || service.model === "full_management" || service.model === "collections_enforcement_only",
      agencyCollectionDestination: service?.destination ?? "agency",
    };
  });
}

async function fetchLeases(managerId: string, assignedPropertyIds?: string[]): Promise<BillingLease[]> {
  if (assignedPropertyIds && assignedPropertyIds.length === 0) return [];

  let query = supabase
    .from("leases")
    .select(`
      id, property, unit, monthly_rent, tenant_id, property_id, unit_id,
      tenants ( id, name, email, photo_url )
    `)
    .eq("manager_id", managerId)
    .eq("status", "active")
    .order("property");
  if (assignedPropertyIds) {
    query = query.in("property_id", assignedPropertyIds);
  }

  const { data, error } = await query;

  if (error) {
    logError("billing.fetchLeases", error);
    throw error;
  }
  // leases.tenant_id/unit_id/property_id are forward FKs from leases, so
  // PostgREST embeds each as a single object at runtime - but the generated
  // types conservatively infer the embed as an array. Normalize explicitly
  // instead of casting past the mismatch.
  return (data ?? []).map((row) => {
    const tenantRow = Array.isArray(row.tenants) ? row.tenants[0] ?? null : row.tenants;
    return {
      ...row,
      tenants: tenantRow
        ? {
            id: tenantRow.id,
            name: tenantRow.name,
            email: tenantRow.email,
            photo_url: tenantRow.photo_url,
          }
        : null,
    };
  }) as BillingLease[];
}

async function fetchTenants(managerId: string, assignedPropertyIds?: string[]): Promise<BillingTenant[]> {
  if (assignedPropertyIds && assignedPropertyIds.length === 0) return [];

  let query = supabase
    .from("tenants")
    .select("id, name, email, phone, photo_url, property, unit, monthly_rent")
    .eq("manager_id", managerId)
    .eq("status", "active")
    .order("name");
  if (assignedPropertyIds) {
    query = query.in("property_id", assignedPropertyIds);
  }

  const { data, error } = await query;

  if (error) {
    logError("billing.fetchTenants", error);
    throw error;
  }
  return (data ?? []) as BillingTenant[];
}

async function fetchExpenditures(
  managerId: string,
  month: string,  // YYYY-MM
): Promise<BillingExpenditure[]> {
  const monthDate = `${month}-01`;
  const { data, error } = await supabase
    .from("expenditures")
    .select("*")
    .eq("manager_id", managerId)
    .eq("month", monthDate)
    .order("category");

  if (error) {
    logError("billing.fetchExpenditures", error);
    throw error;
  }
  return (data ?? []) as BillingExpenditure[];
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useBillingData(selectedMonth: string) {
  const { userRole } = useAuth();
  const { managerId, restrictToAssignedProperties, assignedPropertyIds } = useManagerScope();
  const queryClient = useQueryClient();
  const scopeKey = restrictToAssignedProperties ? assignedPropertyIds.join(",") : "all";
  const scopedIds = restrictToAssignedProperties ? assignedPropertyIds : undefined;

  const invoicesQuery = useQuery({
    queryKey: [...billingKeys.invoices(managerId ?? ""), scopeKey, userRole?.role === "agency" ? "agency-service" : "standard"],
    queryFn: () => fetchInvoices(managerId!, scopedIds, userRole?.role === "agency"),
    enabled: !!managerId,
    staleTime: 15 * 1000,
  });

  const leasesQuery = useQuery({
    queryKey: [...billingKeys.leases(managerId ?? ""), scopeKey],
    queryFn: () => fetchLeases(managerId!, scopedIds),
    enabled: !!managerId,
    staleTime: 5 * 60 * 1000,
  });

  const tenantsQuery = useQuery({
    queryKey: [...billingKeys.tenants(managerId ?? ""), scopeKey],
    queryFn: () => fetchTenants(managerId!, scopedIds),
    enabled: !!managerId,
    staleTime: 5 * 60 * 1000,
  });

  const expendituresQuery = useQuery({
    queryKey: billingKeys.expenditures(managerId ?? "", selectedMonth),
    queryFn: () => fetchExpenditures(managerId!, selectedMonth),
    enabled: !!managerId,
  });

  /** Call after any mutation that changes invoices to get fresh data. */
  const invalidateInvoices = useCallback(() => {
    if (!managerId) return;
    queryClient.invalidateQueries({ queryKey: billingKeys.invoices(managerId) });
  }, [queryClient, managerId]);

  /** Call after saving an expenditure. */
  const invalidateExpenditures = useCallback(() => {
    if (!managerId) return;
    queryClient.invalidateQueries({
      queryKey: billingKeys.expenditures(managerId, selectedMonth),
    });
  }, [queryClient, managerId, selectedMonth]);

  return {
    // Data
    invoices:     invoicesQuery.data     ?? [],
    leases:       leasesQuery.data       ?? [],
    tenants:      tenantsQuery.data      ?? [],
    expenditures: expendituresQuery.data ?? [],

    // Loading / error states
    isLoading: invoicesQuery.isLoading || leasesQuery.isLoading,
    isError: invoicesQuery.isError,
    isExpendituresLoading: expendituresQuery.isLoading,
    refetchInvoices: invoicesQuery.refetch,

    // Invalidators (replaces bare fetchInvoices() calls in handlers)
    invalidateInvoices,
    invalidateExpenditures,
    managerId,
  };
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/** Record a payment that closes the invoice (never a status-only write). */
export function useMarkInvoicePaid() {
  const { user } = useAuth();
  const { managerId } = useManagerScope();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      invoiceId,
    }: {
      invoiceId: string;
    }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const { data: invoice, error: loadError } = await supabase
        .from("invoices")
        .select("id, tenant_id, amount, balance_due, invoice_number")
        .eq("id", invoiceId)
        .single();
      if (loadError) throw loadError;
      if (!invoice?.tenant_id) throw new Error("Invoice is missing a tenant");

      const amount = roundMoney(Number(invoice.balance_due ?? invoice.amount));
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Invoice has no remaining balance to record");
      }

      const paidDate = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase.functions.invoke("record-payment", {
        body: {
          tenantId: invoice.tenant_id,
          invoiceId,
          amount,
          paymentMethod: "receipt_upload",
          reference: `MANUAL-${invoice.invoice_number || invoiceId.slice(0, 8)}-${Date.now()}`,
          paymentDate: paidDate,
          notes: "Recorded via Mark paid",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      supabase.functions
        .invoke("auto-send-receipt", { body: { invoiceId, managerId: managerId ?? user.id } })
        .catch(() => {/* receipt email is best-effort after payment is recorded */});

      return { invoiceId, paidDate };
    },
    onSuccess: () => {
      if (!user?.id) return;
      trackTimeToFirst("payment", { managerId: managerId ?? user.id, signupAt: user.created_at });
      invalidateManagerActivation(queryClient);
      invalidateDashboardQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: billingKeys.invoices(managerId ?? user.id) });
    },
  });
}

/** Update invoice amount, due_date, description. */
export function useUpdateInvoice() {
  const { managerId } = useManagerScope();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      amount,
      due_date,
      description,
    }: {
      id: string;
      amount: number;
      due_date: string;
      description: string | null;
    }) => {
      const { error } = await supabase.rpc("update_invoice_atomic", {
        p_invoice_id: id,
        p_amount: amount,
        p_due_date: due_date,
        p_description: description,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      if (!managerId) return;
      queryClient.invalidateQueries({ queryKey: billingKeys.invoices(managerId) });
      invalidateDashboardQueries(queryClient);
    },
  });
}

/** Upsert a single expenditure category for the given month. */
export function useSaveExpenditure() {
  const { managerId } = useManagerScope();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      category,
      amount,
      month,           // YYYY-MM
      existingId,
      label,
    }: {
      category: string;
      amount: number;
      month: string;
      existingId: string | undefined;
      label: string;
    }) => {
      if (!managerId) throw new Error("Not authenticated");
      const monthDate = `${month}-01`;

      const { error } = await supabase.rpc("save_expenditure_atomic", {
        p_manager_id: managerId,
        p_category: category,
        p_amount: amount,
        p_month: month,
        p_description: label,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      if (!managerId) return;
      queryClient.invalidateQueries({
        queryKey: billingKeys.expenditures(managerId, variables.month),
      });
    },
  });
}
