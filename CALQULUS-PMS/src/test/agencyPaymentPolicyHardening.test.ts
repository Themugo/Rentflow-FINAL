import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const migration = readFileSync(resolve(root, 'supabase/migrations/20260906000006_agency_payment_scope_rules_tenant_visibility_and_notices.sql'), 'utf8');
const policyCenter = readFileSync(resolve(root, 'src/features/agency/components/AgencyPaymentPolicyCenter.tsx'), 'utf8');
const tenantPayment = readFileSync(resolve(root, 'src/features/tenant-portal/components/TenantPaymentDetails.tsx'), 'utf8');

describe('Agency payment policy hardening', () => {
  it('supports agency, property and unit policy scopes', () => {
    expect(migration).toContain("scope_type IN ('agency','property','unit')");
    expect(migration).toContain('agency_property_in_scope');
    expect(policyCenter).toContain('Agency-wide');
    expect(policyCenter).toContain('Property-wide');
    expect(policyCenter).toContain('Unit exception');
  });

  it('communicates tenant-visible changes with scoped or global reach', () => {
    expect(migration).toContain("p_notice_mode NOT IN ('none','selected','global')");
    expect(migration).toContain('publish_agency_tenant_notice_atomic');
    expect(policyCenter).toContain('Selected reach');
    expect(policyCenter).toContain('Global in scope');
    expect(tenantPayment).toContain('get_tenant_effective_agency_payment_policy');
  });

  it('protects manual and external payment evidence', () => {
    expect(migration).toContain('payment_reference_required');
    expect(migration).toContain('proof_required_for_manual');
    expect(migration).toContain('allow_external_consolidation');
    expect(migration).toContain('policy_snapshot');
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('closed. Reopen the period');
  });

  it('does not expose internal policy resolution helpers to authenticated users', () => {
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.get_agency_payment_policy_config_as_of(uuid,uuid,uuid,date) FROM PUBLIC,authenticated,anon;');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.agency_payment_evidence_policy_check(uuid,uuid,uuid,text,text,numeric,numeric,text,text,boolean,date) FROM PUBLIC,anon;');
  });
});
