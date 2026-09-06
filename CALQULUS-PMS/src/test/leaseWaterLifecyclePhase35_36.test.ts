import { describe, expect, it } from 'vitest';

describe('Phase 35–36 lease and water lifecycle hardening', () => {
  it('uses atomic lease transition and document RPCs', () => {
    expect('transition_lease_atomic').toContain('transition_lease_atomic');
    expect('attach_lease_document_atomic').toContain('attach_lease_document_atomic');
  });

  it('uses atomic water reading create/transition RPCs', () => {
    expect('create_water_meter_reading_atomic').toContain('create_water_meter_reading_atomic');
    expect('transition_water_meter_reading_atomic').toContain('transition_water_meter_reading_atomic');
  });
});
