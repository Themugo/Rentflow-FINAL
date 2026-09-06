import { describe, expect, it } from 'vitest';
import {
  deriveCollectionRate,
  deriveOccupancy,
  deriveRevenueChange,
  isCompleteDashboardRpc,
  mapRpcDashboardStats,
  shouldSkipUnscopedDashboardRpc,
} from '@/features/dashboard/lib/dashboardStats';
import { canInitiateOnlinePayment } from '@/features/tenant-portal/lib/onlinePaymentGuard';

describe('mapRpcDashboardStats', () => {
  it('maps a complete snake_case RPC payload', () => {
    const stats = mapRpcDashboardStats({
      total_tenants: 12,
      active_tenants: 10,
      inactive_tenants: 2,
      new_tenants_this_month: 1,
      total_properties: 3,
      total_units: 20,
      occupied_units: 15,
      revenue_mtd: 400000,
      revenue_prev_month: 200000,
      expected_rent: 500000,
      pending_invoices: 4,
      overdue_invoices: 2,
      arrears_total: 80000,
      active_leases: 10,
      expiring_leases_30d: 1,
      open_maintenance: 3,
      urgent_maintenance: 1,
      pending_deposit_refunds: 2,
    });

    expect(stats).toMatchObject({
      totalTenants: 12,
      activeTenants: 10,
      inactiveTenants: 2,
      newTenantsThisMonth: 1,
      totalProperties: 3,
      totalUnits: 20,
      occupiedUnits: 15,
      vacantUnits: 5,
      occupancyRate: 75,
      revenueMTD: 400000,
      revenueChange: 100,
      expectedRent: 500000,
      collectedRent: 400000,
      collectionRate: 80,
      outstandingRent: 80000,
      arrearsTotal: 80000,
      pendingInvoices: 4,
      overdueInvoices: 2,
      activeLeases: 10,
      expiringLeases: 1,
      openMaintenanceCount: 3,
      urgentMaintenanceCount: 1,
      pendingDepositRefundsCount: 2,
    });
  });

  it('returns null for invalid payloads', () => {
    expect(mapRpcDashboardStats(null)).toBeNull();
    expect(mapRpcDashboardStats('nope')).toBeNull();
  });

  it('detects complete vs partial RPC payloads', () => {
    expect(isCompleteDashboardRpc({ total_tenants: 1 })).toBe(false);
    expect(
      isCompleteDashboardRpc({
        expected_rent: 0,
        open_maintenance: 0,
        pending_deposit_refunds: 0,
        new_tenants_this_month: 0,
      }),
    ).toBe(true);
  });
});

describe('dashboard derived metrics', () => {
  it('computes occupancy, collection rate, and revenue change', () => {
    expect(deriveOccupancy(10, 7)).toEqual({ vacantUnits: 3, occupancyRate: 70 });
    expect(deriveOccupancy(0, 0)).toEqual({ vacantUnits: 0, occupancyRate: 0 });
    expect(deriveCollectionRate(90, 100)).toBe(90);
    expect(deriveCollectionRate(120, 100)).toBe(100);
    expect(deriveCollectionRate(0, 0)).toBe(0);
    expect(deriveRevenueChange(150, 100)).toBe(50);
    expect(deriveRevenueChange(80, 0)).toBe(0);
  });
});

describe('shouldSkipUnscopedDashboardRpc', () => {
  it('skips the unscoped RPC when the submanager is property-restricted', () => {
    expect(shouldSkipUnscopedDashboardRpc({ restrictToAssignedProperties: true })).toBe(true);
    expect(shouldSkipUnscopedDashboardRpc()).toBe(false);
  });
});

describe('canInitiateOnlinePayment', () => {
  it('allows payment when online', () => {
    expect(canInitiateOnlinePayment(true)).toEqual({ allowed: true, message: null });
  });

  it('blocks payment when offline and never implies success', () => {
    const result = canInitiateOnlinePayment(false);
    expect(result.allowed).toBe(false);
    expect(result.message).toMatch(/not sent/i);
  });
});
