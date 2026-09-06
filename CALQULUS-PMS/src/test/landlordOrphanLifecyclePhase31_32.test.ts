import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(process.cwd());
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');
describe('Phase 31-32 landlord/orphan financial lifecycle', () => {
  it('centralizes landlord invoice writes', () => {
    const migration = read('supabase/migrations/20260903000014_landlord_invoice_lifecycle_atomic.sql');
    const ui = read('src/features/webhost/components/LandlordBilling.tsx');
    expect(migration).toContain('create_landlord_invoice_atomic');
    expect(migration).toContain('transition_landlord_invoice_atomic');
    expect(migration).toContain('REVOKE INSERT,UPDATE,DELETE ON public.landlord_invoices FROM authenticated');
    expect(ui).not.toMatch(/from\(['"]landlord_invoices['"]\)\.insert/);
    expect(ui).not.toMatch(/from\(['"]landlord_invoices['"]\)\.update/);
  });
  it('centralizes orphan payment and receipt writes', () => {
    const migration = read('supabase/migrations/20260903000015_orphan_payment_lifecycle_atomic.sql');
    const ui = read('src/features/tenant-portal/components/OrphanTenantHome.tsx');
    expect(migration).toContain('record_orphan_payment_atomic');
    expect(migration).toContain('attach_orphan_payment_receipt_atomic');
    expect(migration).toContain('REVOKE INSERT,UPDATE,DELETE ON public.orphan_payment_entries FROM authenticated');
    expect(ui).not.toMatch(/from\(['"]orphan_payment_entries['"]\)\.insert/);
    expect(ui).not.toMatch(/from\(['"]orphan_payment_entries['"]\)\.update/);
  });
});
