import { describe, expect, it } from 'vitest';
import {
  AGENCY_SERVICE_MODELS,
  AGENCY_SERVICE_MODEL_SHORT_LABELS,
  agencyServiceModelFromOperatingModel,
  getAgencyServiceModelMeta,
} from '@/shared/constants/authorityModels';

const EXPECTED = [
  {
    id: 'full_management',
    operatingModel: 'agency_collects_full_management',
    collects: 'Agency',
    operates: 'Agency',
    maintenance: 'Agency',
    destination: 'manager',
  },
  {
    id: 'managed_direct_landlord_collection',
    operatingModel: 'manager_operates_landlord_collects',
    collects: 'Landlord',
    operates: 'Agency',
    maintenance: 'Agency',
    destination: 'landlord',
  },
  {
    id: 'collections_enforcement_only',
    operatingModel: 'agency_collects_landlord_managed',
    collects: 'Agency',
    operates: 'Landlord',
    maintenance: 'Landlord',
    destination: 'manager',
  },
] as const;

describe('agency service model matrix', () => {
  it('contains the three commercial agency operating models', () => {
    expect(AGENCY_SERVICE_MODELS).toHaveLength(3);
    for (const expected of EXPECTED) {
      const meta = getAgencyServiceModelMeta(expected.id);
      expect(meta.operatingModel).toBe(expected.operatingModel);
      expect(meta.operates).toBe(expected.operates);
      expect(meta.collects).toBe(expected.collects);
      expect(meta.maintenance).toBe(expected.maintenance);
      expect(meta.paymentDestination).toBe(expected.destination);
      expect(meta.slogan.length).toBeGreaterThan(10);
    }
  });

  it('maps legacy operating models into the canonical agency vocabulary', () => {
    expect(agencyServiceModelFromOperatingModel('agency_collects_full_management')).toBe('full_management');
    expect(agencyServiceModelFromOperatingModel('agency_collects_pays_landlord')).toBe('full_management');
    expect(agencyServiceModelFromOperatingModel('manager_operates_landlord_collects')).toBe('managed_direct_landlord_collection');
    expect(agencyServiceModelFromOperatingModel('agency_manages_fee_from_landlord')).toBe('managed_direct_landlord_collection');
    expect(agencyServiceModelFromOperatingModel('agency_collects_landlord_managed')).toBe('collections_enforcement_only');
    expect(agencyServiceModelFromOperatingModel('landlord_self_managed')).toBeNull();
  });

  it('keeps service labels stable for dashboards and portfolio tables', () => {
    expect(AGENCY_SERVICE_MODEL_SHORT_LABELS).toMatchObject({
      full_management: 'Full management',
      managed_direct_landlord_collection: 'Manage · owner collects',
      collections_enforcement_only: 'Collections · enforcement',
    });
  });
});
