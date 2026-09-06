/**
 * supabase-extensions.ts
 *
 * Type extensions for columns added via ALTER TABLE in migrations 001-014.
 * These are not in the auto-generated types.ts because supabase gen types
 * has not been re-run after migrations.
 *
 * Run `supabase gen types typescript --project-id aelzsqxllkypbzslxyju > src/integrations/supabase/types.ts`
 * after deploying all migrations to eliminate these and all 'as any' casts.
 */

// ── units table extensions (migration 010) ─────────────────────────────────
export interface UnitExtensions {
  label: string | null;
  unit_type: string | null;           // bedsitter | studio | one_bedroom | two_bedroom | etc.
  house_deposit: number | null;
  water_deposit: number | null;
  floor_number: number | null;
  facing: string | null;
  furnished: string | null;           // furnished | semi_furnished | unfurnished
  parking_included: boolean;
  parking_bays: number;
  notes: string | null;
  available_from: string | null;      // date ISO string
  market_rent: number | null;
}

// ── agencies table extensions (migration 014) ──────────────────────────────
export interface AgencyExtensions {
  registration_number: string | null;
  kra_pin: string | null;
  county: string | null;
  description: string | null;
  website: string | null;
  whatsapp: string | null;
  verified: boolean;
  verified_at: string | null;
  verified_by: string | null;
  status: 'active' | 'suspended' | 'pending_verification';
}

// ── submanager_permissions write flags (migration 013) ─────────────────────
export interface SubmanagerPermissionExtensions {
  can_record_payments: boolean;
  can_edit_tenants: boolean;
  can_manage_maintenance: boolean;
  can_create_invoices: boolean;
  can_approve_moveouts: boolean;
  can_send_notices: boolean;
  can_upload_documents: boolean;
}

// ── invoices table extensions (migration 003-004) ──────────────────────────
export interface InvoiceExtensions {
  original_amount: number | null;
  balance_due: number | null;
  paid_amount: number | null;
  unit_id: string | null;
  property_id: string | null;
  manager_id: string | null;
  invoice_type: string | null;
}

// ── unit_charge_configs extensions (migration 010) ─────────────────────────
export interface UnitChargeConfigExtensions {
  invoice_mode_override: string | null;
  charge_order: number;
  show_on_statement: boolean;
  tax_rate_pct: number;
  is_taxable: boolean;
}

// ── Usage: cast with type assertion ────────────────────────────────────────
// Instead of: const unit = data as any
// Use:        const unit = data as Tables<'units'> & UnitExtensions

export {};
