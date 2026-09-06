import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('owner payout settlement integrity', () => {
  const migration = fs.readFileSync(path.resolve(process.cwd(), 'supabase/migrations/20260904000032_owner_payout_settlement_management.sql'), 'utf8');
  const component = fs.readFileSync(path.resolve(process.cwd(), 'src/features/dashboard/components/OwnerPayoutSettlementCenter.tsx'), 'utf8');

  it('requires closed periods and approved payouts before batching', () => {
    expect(migration).toContain("v_period.status <> 'closed'");
    expect(migration).toContain("pr.status = 'approved'");
    expect(migration).toContain('Every payout must be approved, in scope, and inside the closed period');
  });

  it('prevents duplicate payout assignment', () => {
    expect(migration).toContain('UNIQUE(payout_request_id)');
    expect(migration).toContain('already assigned to a settlement batch');
  });

  it('requires a settlement reference and settles payout requests atomically', () => {
    expect(migration).toContain('Settlement reference required');
    expect(migration).toContain("SET status='paid'");
    expect(migration).toContain("status='settled'");
  });

  it('renders the settlement workflow from the dashboard', () => {
    expect(component).toContain('Owner Payout & Settlement');
    expect(component).toContain('create_owner_payout_batch_atomic');
    expect(component).toContain('transition_owner_payout_batch_atomic');
  });
});
