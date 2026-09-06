import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260906000007_utilities_amenities_contract_document_control.sql'), 'utf8');

describe('utilities / amenities / contract document-control initiative', () => {
  it('extends existing canonical utility and water tables instead of creating duplicates', () => {
    expect(migration).toContain('ALTER TABLE public.unit_utility_meters');
    expect(migration).toContain('ALTER TABLE public.water_meter_readings');
    expect(migration).not.toMatch(/CREATE TABLE IF NOT EXISTS public\.water_meter_readings/i);
    expect(migration).toContain('utility_integrations');
    expect(migration).toContain('utility_sync_events');
  });

  it('preserves server-side write boundaries', () => {
    expect(migration).toContain('REVOKE INSERT, UPDATE, DELETE ON public.utility_integrations FROM authenticated');
    expect(migration).toContain('REVOKE INSERT, UPDATE, DELETE ON public.utility_sync_events FROM authenticated');
    expect(migration).toContain('REVOKE INSERT, UPDATE, DELETE ON public.amenity_charge_catalog FROM authenticated');
  });

  it('provides water verification and invoice-line provenance', () => {
    expect(migration).toContain('verify_water_meter_reading_atomic');
    expect(migration).toContain('build_water_invoice_line_item');
    expect(migration).toContain("reading_source text NOT NULL DEFAULT 'manager_manual'");
    expect(migration).toContain('ocr_confidence');
  });

  it('makes executed contracts immutable and routes changes through amendments', () => {
    expect(migration).toContain('contract_document_versions');
    expect(migration).toContain('contract_amendments');
    expect(migration).toContain('guard_executed_contract_update');
    expect(migration).toContain('lock_signed_contract_atomic');
    expect(migration).toContain('create_contract_amendment_atomic');
    expect(migration).toContain("digest(v_contract.content,'sha256')");
  });
});
