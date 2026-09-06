import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260904000038_controlled_management_reporting_releases.sql'), 'utf8');
const component = fs.readFileSync(path.join(root, 'src/features/dashboard/components/ControlledManagementReportingCenter.tsx'), 'utf8');

describe('controlled management reporting', () => {
  it('requires closed period, finalized audit pack and approved assurance review', () => {
    expect(migration).toContain("v_close.status <> 'closed'");
    expect(migration).toContain("status='finalized'");
    expect(migration).toContain("status='approved'");
  });
  it('uses the finalized audit pack as the reporting source of truth', () => {
    expect(migration).toContain("COALESCE(v_pack.snapshot->'financials'");
    expect(migration).toContain("COALESCE(v_pack.snapshot->'reconciliation'");
    expect(migration).toContain("controlled_statement_generated");
  });
  it('fingerprints releases and prevents anonymous execution', () => {
    expect(migration).toContain("^[0-9a-fA-F]{64}$");
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.release_controlled_statement_atomic');
    expect(migration).toContain("status='released'");
  });
  it('does not create a second work queue', () => {
    expect(migration).not.toContain('CREATE TABLE public.operation_work_items');
    expect(component).toContain('Controlled Management Reporting');
    expect(component).toContain('Release & fingerprint');
  });
});
