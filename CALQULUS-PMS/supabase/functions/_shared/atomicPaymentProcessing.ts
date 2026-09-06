/**
 * _shared/atomicPaymentProcessing.ts
 *
 * Atomic payment processing using database transactions.
 * Ensures all payment operations complete as a single atomic unit.
 *
 * Usage:
 *   import { processPaymentAtomic } from "../_shared/atomicPaymentProcessing.ts";
 *
 *   const result = await processPaymentAtomic(supabase, {
 *     tenantId, managerId, amount, paymentMethod, paymentDate, reference,
 *     invoiceId, invoiceIds, ...
 *   });
 */

import { createClient, SupabaseClient } from "supabase/supabase-js@2";

export interface AtomicPaymentInput {
  tenantId: string;
  managerId: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  reference: string;
  invoiceId?: string;
  invoiceIds?: string[];
  unitId?: string;
  propertyId?: string;
  unitNumber?: string;
  phone?: string;
  recordedBy?: string;
  notes?: string;
  transactionId?: string;
}

export interface AtomicPaymentResult {
  success: boolean;
  idempotent?: boolean;
  transactionId?: string;
  allocations?: Array<{ invoiceId: string; amount: number; closed: boolean }>;
  advanceCredit?: number;
  creditBalance?: number;
  totalAllocated?: number;
  error?: string;
}

/**
 * Process payment with full atomicity guarantees.
 * All database operations happen inside a single transaction.
 */
export async function processPaymentAtomic(
  supabase: SupabaseClient,
  input: AtomicPaymentInput
): Promise<AtomicPaymentResult> {
  // Use the RPC function that wraps everything in a transaction
  const { data, error } = await supabase.rpc("process_payment_atomic", {
    p_tenant_id: input.tenantId,
    p_manager_id: input.managerId,
    p_amount: input.amount,
    p_payment_method: input.paymentMethod,
    p_payment_date: input.paymentDate,
    p_reference: input.reference,
    p_invoice_id: input.invoiceId ?? null,
    p_invoice_ids: input.invoiceIds ?? null,
    p_unit_id: input.unitId ?? null,
    p_property_id: input.propertyId ?? null,
    p_unit_number: input.unitNumber ?? null,
    p_phone: input.phone ?? null,
    p_recorded_by: input.recordedBy ?? null,
    p_notes: input.notes ?? null,
    p_existing_transaction_id: input.transactionId ?? null,
  });

  if (error) {
    console.error("[atomic-payment] RPC failed:", error);
    return { success: false, error: error.message };
  }

  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  const allocs = Array.isArray(row?.allocations) ? row.allocations as Array<{ invoice_id: string; amount: number; closed: boolean }> : [];
  return {
    success: true,
    idempotent: Boolean(row?.idempotent),
    transactionId: String(row?.transaction_id ?? ""),
    allocations: allocs.map((a) => ({
      invoiceId: a.invoice_id,
      amount: Number(a.amount),
      closed: Boolean(a.closed),
    })),
    advanceCredit: Number(row?.advance_credit ?? 0),
    creditBalance: Number(row?.credit_balance ?? 0),
    totalAllocated: Number(row?.total_allocated ?? 0),
  };
}

/**
 * Lock invoice rows for update to prevent concurrent modifications.
 * Uses SELECT FOR UPDATE to acquire row-level locks.
 */
export async function lockInvoicesForUpdate(
  supabase: SupabaseClient,
  invoiceIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc("lock_invoices_for_update", {
    p_invoice_ids: invoiceIds,
  });

  if (error) {
    console.error("[atomic-payment] Failed to lock invoices:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Check if a transaction has already been processed (idempotency check).
 * Returns the existing transaction if found.
 */
export async function checkTransactionProcessed(
  supabase: SupabaseClient,
  tenantId: string,
  reference: string
): Promise<{ processed: boolean; transactionId?: string; status?: string }> {
  const { data, error } = await supabase
    .from("payment_transactions")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .eq("bank_reference", reference)
    .eq("status", "completed")
    .maybeSingle();

  if (error) {
    console.error("[atomic-payment] Idempotency check failed:", error);
    return { processed: false };
  }

  return {
    processed: !!data,
    transactionId: data?.id,
    status: data?.status,
  };
}
