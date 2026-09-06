import { supabase } from '@/integrations/supabase/client';
import { logError } from '@/shared/lib/errorLogger';

export interface ManagerDashboardStats {
  totalTenants: number;
  activeTenants: number;
  inactiveTenants: number;
  newTenantsThisMonth: number;
  activeLeases: number;
  expiringLeases: number;
  revenueMTD: number;
  revenueChange: number;
  expectedRent: number;
  collectedRent: number;
  outstandingRent: number;
  collectionRate: number;
  totalProperties: number;
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  occupancyRate: number;
  pendingInvoices: number;
  overdueInvoices: number;
  arrearsTotal: number;
  openMaintenanceCount: number;
  urgentMaintenanceCount: number;
  pendingDepositRefundsCount: number;
}

export const EMPTY_DASHBOARD_STATS: ManagerDashboardStats = {
  totalTenants: 0,
  activeTenants: 0,
  inactiveTenants: 0,
  newTenantsThisMonth: 0,
  activeLeases: 0,
  expiringLeases: 0,
  revenueMTD: 0,
  revenueChange: 0,
  expectedRent: 0,
  collectedRent: 0,
  outstandingRent: 0,
  collectionRate: 0,
  totalProperties: 0,
  totalUnits: 0,
  occupiedUnits: 0,
  vacantUnits: 0,
  occupancyRate: 0,
  pendingInvoices: 0,
  overdueInvoices: 0,
  arrearsTotal: 0,
  openMaintenanceCount: 0,
  urgentMaintenanceCount: 0,
  pendingDepositRefundsCount: 0,
};

/** Parallel round-trips in the fallback path (matches the pre-Phase-11 dashboard). */
export const DASHBOARD_STATS_FALLBACK_QUERY_COUNT = 16;
/** Round-trips when the complete RPC is available. */
export const DASHBOARD_STATS_RPC_QUERY_COUNT = 1;

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function pick(raw: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (raw[key] != null) return raw[key];
  }
  return undefined;
}

/** True when the RPC payload includes the Phase 11 complete field set. */
export function isCompleteDashboardRpc(raw: unknown): boolean {
  const record = asRecord(raw);
  if (!record) return false;
  return (
    pick(record, 'expected_rent', 'expectedRent') != null &&
    pick(record, 'open_maintenance', 'openMaintenanceCount') != null &&
    pick(record, 'pending_deposit_refunds', 'pendingDepositRefundsCount') != null &&
    pick(record, 'new_tenants_this_month', 'newTenantsThisMonth') != null
  );
}

export function deriveOccupancy(totalUnits: number, occupiedUnits: number) {
  const vacantUnits = Math.max(0, totalUnits - occupiedUnits);
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
  return { vacantUnits, occupancyRate };
}

export function deriveRevenueChange(revenueMTD: number, revenuePrevMonth: number): number {
  return revenuePrevMonth > 0
    ? Math.round(((revenueMTD - revenuePrevMonth) / revenuePrevMonth) * 100)
    : 0;
}

export function deriveCollectionRate(collectedRent: number, expectedRent: number): number {
  return expectedRent > 0 ? Math.min(100, Math.round((collectedRent / expectedRent) * 100)) : 0;
}

/**
 * Map snake_case (or camelCase) RPC JSON onto the dashboard stats shape.
 * Missing optional fields default to 0 so a partial RPC can be supplemented.
 */
export function mapRpcDashboardStats(raw: unknown): ManagerDashboardStats | null {
  const record = asRecord(raw);
  if (!record) return null;

  const totalTenants = num(pick(record, 'total_tenants', 'totalTenants'));
  const activeTenants = num(pick(record, 'active_tenants', 'activeTenants'));
  const inactiveTenants = num(
    pick(record, 'inactive_tenants', 'inactiveTenants') ?? Math.max(0, totalTenants - activeTenants),
  );
  const revenueMTD = num(pick(record, 'revenue_mtd', 'revenueMTD'));
  const revenuePrev = num(pick(record, 'revenue_prev_month', 'revenuePrevMonth'));
  const expectedRent = num(pick(record, 'expected_rent', 'expectedRent'));
  const arrearsTotal = num(pick(record, 'arrears_total', 'arrearsTotal'));
  const totalUnits = num(pick(record, 'total_units', 'totalUnits'));
  const occupiedUnits = num(pick(record, 'occupied_units', 'occupiedUnits'));
  const occupancy = deriveOccupancy(totalUnits, occupiedUnits);
  const collectedRent = revenueMTD;

  return {
    totalTenants,
    activeTenants,
    inactiveTenants,
    newTenantsThisMonth: num(pick(record, 'new_tenants_this_month', 'newTenantsThisMonth')),
    activeLeases: num(pick(record, 'active_leases', 'activeLeases')),
    expiringLeases: num(pick(record, 'expiring_leases_30d', 'expiringLeases')),
    revenueMTD,
    revenueChange: deriveRevenueChange(revenueMTD, revenuePrev),
    expectedRent,
    collectedRent,
    outstandingRent: arrearsTotal,
    collectionRate: deriveCollectionRate(collectedRent, expectedRent),
    totalProperties: num(pick(record, 'total_properties', 'totalProperties')),
    totalUnits,
    occupiedUnits,
    vacantUnits: occupancy.vacantUnits,
    occupancyRate: occupancy.occupancyRate,
    pendingInvoices: num(pick(record, 'pending_invoices', 'pendingInvoices')),
    overdueInvoices: num(pick(record, 'overdue_invoices', 'overdueInvoices')),
    arrearsTotal,
    openMaintenanceCount: num(pick(record, 'open_maintenance', 'openMaintenanceCount')),
    urgentMaintenanceCount: num(pick(record, 'urgent_maintenance', 'urgentMaintenanceCount')),
    pendingDepositRefundsCount: num(
      pick(record, 'pending_deposit_refunds', 'pendingDepositRefundsCount'),
    ),
  };
}

function monthBounds(now = new Date()) {
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const endOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  const firstOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
  const expiringCutoff = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  return { firstOfThisMonth, endOfThisMonth, firstOfPrevMonth, endOfPrevMonth, expiringCutoff };
}

async function fetchExpectedRent(
  managerId: string,
  firstOfThisMonth: string,
  endOfThisMonth: string,
  tenantIds?: string[] | null,
  propertyIds?: string[] | null,
) {
  let invoiceQuery = supabase
    .from('invoices')
    .select('amount, status')
    .eq('manager_id', managerId)
    .gte('due_date', firstOfThisMonth)
    .lte('due_date', endOfThisMonth);
  if (tenantIds) {
    if (tenantIds.length === 0) {
      // fall through to leases
    } else {
      invoiceQuery = invoiceQuery.in('tenant_id', tenantIds);
    }
  }

  const { data } =
    tenantIds && tenantIds.length === 0
      ? { data: [] as { amount: number }[] }
      : await invoiceQuery;

  let expectedRent = ((data as { amount: number }[]) ?? []).reduce((s, i) => s + Number(i.amount || 0), 0);
  if (expectedRent === 0) {
    let leaseQuery = supabase
      .from('leases')
      .select('monthly_rent')
      .eq('manager_id', managerId)
      .eq('status', 'active');
    if (propertyIds && propertyIds.length > 0) {
      leaseQuery = leaseQuery.in('property_id', propertyIds);
    }
    const { data: activeLeaseRows } = await leaseQuery;
    expectedRent = (activeLeaseRows || []).reduce((s, l) => s + Number(l.monthly_rent || 0), 0);
  }
  return expectedRent;
}

async function supplementPartialStats(
  managerId: string,
  partial: ManagerDashboardStats,
): Promise<ManagerDashboardStats> {
  const { firstOfThisMonth, endOfThisMonth } = monthBounds();
  const [
    newTenantsResult,
    maintenanceResult,
    urgentMaintenanceResult,
    depositRefundsResult,
    expectedRent,
  ] = await Promise.all([
    supabase
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .eq('manager_id', managerId)
      .gte('created_at', firstOfThisMonth),
    supabase
      .from('maintenance_requests')
      .select('id', { count: 'exact', head: true })
      .eq('manager_id', managerId)
      .in('status', ['open', 'pending', 'in_progress']),
    supabase
      .from('maintenance_requests')
      .select('id', { count: 'exact', head: true })
      .eq('manager_id', managerId)
      .in('status', ['open', 'pending', 'in_progress'])
      .in('priority', ['high', 'urgent']),
    supabase
      .from('deposit_refunds')
      .select('id', { count: 'exact', head: true })
      .eq('manager_id', managerId)
      .eq('status', 'pending'),
    fetchExpectedRent(managerId, firstOfThisMonth, endOfThisMonth),
  ]);

  const collectedRent = partial.revenueMTD;
  return {
    ...partial,
    newTenantsThisMonth: newTenantsResult.count || 0,
    expectedRent,
    collectedRent,
    collectionRate: deriveCollectionRate(collectedRent, expectedRent),
    openMaintenanceCount: maintenanceResult.count || 0,
    urgentMaintenanceCount: urgentMaintenanceResult.count || 0,
    pendingDepositRefundsCount: depositRefundsResult.count || 0,
  };
}

export type ManagerDashboardScope = {
  restrictToAssignedProperties?: boolean;
  assignedPropertyIds?: string[];
};

/** Restricted submanagers must not consume the unscoped manager-wide RPC. */
export function shouldSkipUnscopedDashboardRpc(scope?: ManagerDashboardScope): boolean {
  return !!scope?.restrictToAssignedProperties;
}

async function resolveScopedTenantIds(managerId: string, propertyIds: string[]): Promise<string[]> {
  const { data } = await supabase
    .from('tenants')
    .select('id')
    .eq('manager_id', managerId)
    .in('property_id', propertyIds);
  return (data ?? []).map((row) => row.id);
}

async function countScopedMaintenance(
  managerId: string,
  propertyIds: string[],
  priorities?: string[],
): Promise<number> {
  const { data: properties } = await supabase
    .from('properties')
    .select('name')
    .eq('manager_id', managerId)
    .in('id', propertyIds);
  const names = (properties ?? []).map((p) => p.name).filter(Boolean);
  if (names.length === 0) return 0;

  let query = supabase
    .from('maintenance_requests')
    .select('id', { count: 'exact', head: true })
    .eq('manager_id', managerId)
    .in('status', ['open', 'pending', 'in_progress'])
    .in('property_name', names);
  if (priorities) {
    query = query.in('priority', priorities);
  }
  const { count } = await query;
  return count || 0;
}

type CountResult = { count: number | null };
type AmountRow = { amount: number };
type ArrearsRow = { amount: number; balance_due: number | null };

const EMPTY_COUNT: CountResult = { count: 0 };
const EMPTY_AMOUNT_ROWS: { data: AmountRow[] } = { data: [] };
const EMPTY_ARREARS_ROWS: { data: ArrearsRow[] } = { data: [] };

function sumAmounts(rows: AmountRow[] | null | undefined): number {
  return (rows ?? []).reduce((s, i) => s + Number(i.amount || 0), 0);
}

/**
 * Arrears total must include invoices a tenant has partially paid — a
 * partial payment moves status to 'partially_paid' while balance_due stays
 * > 0 (see the payment RPC), so summing 'overdue' alone silently drops real
 * outstanding money the moment any partial payment lands.
 */
function sumArrears(rows: ArrearsRow[] | null | undefined): number {
  return (rows ?? []).reduce((s, i) => s + Number(i.balance_due ?? i.amount ?? 0), 0);
}

/** Full 16-query path used when the RPC is missing, errors, or must be property-scoped. */
export async function fetchDashboardStatsFallback(
  managerId: string,
  propertyIds?: string[],
): Promise<ManagerDashboardStats> {
  const { firstOfThisMonth, endOfThisMonth, firstOfPrevMonth, endOfPrevMonth, expiringCutoff } =
    monthBounds();
  const scoped = !!(propertyIds && propertyIds.length > 0);
  const tenantIds = scoped ? await resolveScopedTenantIds(managerId, propertyIds) : null;
  const invoiceScopeEmpty = tenantIds !== null && tenantIds.length === 0;

  let tenantsAll = supabase.from('tenants').select('id', { count: 'exact', head: true }).eq('manager_id', managerId);
  let tenantsActive = supabase.from('tenants').select('id', { count: 'exact', head: true }).eq('manager_id', managerId).eq('status', 'active');
  let tenantsInactive = supabase.from('tenants').select('id', { count: 'exact', head: true }).eq('manager_id', managerId).eq('status', 'inactive');
  let tenantsNew = supabase.from('tenants').select('id', { count: 'exact', head: true }).eq('manager_id', managerId).gte('created_at', firstOfThisMonth);
  let leasesActive = supabase.from('leases').select('id', { count: 'exact', head: true }).eq('manager_id', managerId).eq('status', 'active');
  let leasesExpiring = supabase.from('leases').select('id', { count: 'exact', head: true }).eq('manager_id', managerId).eq('status', 'active').lte('end_date', expiringCutoff);
  let propertiesQuery = supabase.from('properties').select('id, units, occupied').eq('manager_id', managerId);

  if (scoped) {
    tenantsAll = tenantsAll.in('property_id', propertyIds!);
    tenantsActive = tenantsActive.in('property_id', propertyIds!);
    tenantsInactive = tenantsInactive.in('property_id', propertyIds!);
    tenantsNew = tenantsNew.in('property_id', propertyIds!);
    leasesActive = leasesActive.in('property_id', propertyIds!);
    leasesExpiring = leasesExpiring.in('property_id', propertyIds!);
    propertiesQuery = propertiesQuery.in('id', propertyIds!);
  }

  let paidQuery = supabase.from('invoices').select('amount').eq('manager_id', managerId).eq('status', 'paid').gte('paid_date', firstOfThisMonth);
  let prevPaidQuery = supabase.from('invoices').select('amount').eq('manager_id', managerId).eq('status', 'paid').gte('paid_date', firstOfPrevMonth).lte('paid_date', endOfPrevMonth);
  let pendingQuery = supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('manager_id', managerId).eq('status', 'pending');
  let overdueQuery = supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('manager_id', managerId).eq('status', 'overdue');
  let overdueAmountQuery = supabase.from('invoices').select('amount, balance_due').eq('manager_id', managerId).in('status', ['overdue', 'partially_paid']);

  if (tenantIds && tenantIds.length > 0) {
    paidQuery = paidQuery.in('tenant_id', tenantIds);
    prevPaidQuery = prevPaidQuery.in('tenant_id', tenantIds);
    pendingQuery = pendingQuery.in('tenant_id', tenantIds);
    overdueQuery = overdueQuery.in('tenant_id', tenantIds);
    overdueAmountQuery = overdueAmountQuery.in('tenant_id', tenantIds);
  }

  let depositQuery = supabase.from('deposit_refunds').select('id', { count: 'exact', head: true }).eq('manager_id', managerId).eq('status', 'pending');
  if (tenantIds && tenantIds.length > 0) {
    depositQuery = depositQuery.in('tenant_id', tenantIds);
  }

  const [
    tenantsResult,
    activeTenantsResult,
    inactiveTenantsResult,
    newTenantsResult,
    activeLeasesResult,
    expiringLeasesResult,
    paidInvoicesResult,
    prevMonthResult,
    pendingInvoicesResult,
    overdueInvoicesResult,
    overdueAmountResult,
    propertiesResult,
    openMaintenanceCount,
    urgentMaintenanceCount,
    depositRefundsResult,
  ] = await Promise.all([
    tenantsAll,
    tenantsActive,
    tenantsInactive,
    tenantsNew,
    leasesActive,
    leasesExpiring,
    invoiceScopeEmpty ? Promise.resolve(EMPTY_AMOUNT_ROWS) : paidQuery,
    invoiceScopeEmpty ? Promise.resolve(EMPTY_AMOUNT_ROWS) : prevPaidQuery,
    invoiceScopeEmpty ? Promise.resolve(EMPTY_COUNT) : pendingQuery,
    invoiceScopeEmpty ? Promise.resolve(EMPTY_COUNT) : overdueQuery,
    invoiceScopeEmpty ? Promise.resolve(EMPTY_ARREARS_ROWS) : overdueAmountQuery,
    propertiesQuery,
    scoped ? countScopedMaintenance(managerId, propertyIds!) : supabase.from('maintenance_requests').select('id', { count: 'exact', head: true }).eq('manager_id', managerId).in('status', ['open', 'pending', 'in_progress']).then((r) => r.count || 0),
    scoped ? countScopedMaintenance(managerId, propertyIds!, ['high', 'urgent']) : supabase.from('maintenance_requests').select('id', { count: 'exact', head: true }).eq('manager_id', managerId).in('status', ['open', 'pending', 'in_progress']).in('priority', ['high', 'urgent']).then((r) => r.count || 0),
    invoiceScopeEmpty ? Promise.resolve(EMPTY_COUNT) : depositQuery,
  ]);

  const revenueMTD = sumAmounts(paidInvoicesResult.data as AmountRow[] | null);
  const revenuePrev = sumAmounts(prevMonthResult.data as AmountRow[] | null);
  const expectedRent = await fetchExpectedRent(
    managerId,
    firstOfThisMonth,
    endOfThisMonth,
    tenantIds,
    propertyIds,
  );

  const allProps = (propertiesResult.data as { id: string; units: number; occupied: number }[]) ?? [];
  const totalUnits = allProps.reduce((s, p) => s + (Number(p.units) || 0), 0);
  const occupiedUnits = allProps.reduce((s, p) => s + (Number(p.occupied) || 0), 0);
  const occupancy = deriveOccupancy(totalUnits, occupiedUnits);
  const arrearsTotal = sumArrears(overdueAmountResult.data as ArrearsRow[] | null);

  return {
    totalTenants: tenantsResult.count || 0,
    activeTenants: activeTenantsResult.count || 0,
    inactiveTenants: inactiveTenantsResult.count || 0,
    newTenantsThisMonth: newTenantsResult.count || 0,
    activeLeases: activeLeasesResult.count || 0,
    expiringLeases: expiringLeasesResult.count || 0,
    revenueMTD,
    revenueChange: deriveRevenueChange(revenueMTD, revenuePrev),
    expectedRent,
    collectedRent: revenueMTD,
    outstandingRent: arrearsTotal,
    collectionRate: deriveCollectionRate(revenueMTD, expectedRent),
    totalProperties: allProps.length,
    totalUnits,
    occupiedUnits,
    vacantUnits: occupancy.vacantUnits,
    occupancyRate: occupancy.occupancyRate,
    pendingInvoices: pendingInvoicesResult.count || 0,
    overdueInvoices: overdueInvoicesResult.count || 0,
    arrearsTotal,
    openMaintenanceCount: typeof openMaintenanceCount === 'number' ? openMaintenanceCount : 0,
    urgentMaintenanceCount: typeof urgentMaintenanceCount === 'number' ? urgentMaintenanceCount : 0,
    pendingDepositRefundsCount: depositRefundsResult.count || 0,
  };
}

export async function fetchManagerDashboardStats(
  managerId: string,
  scope?: ManagerDashboardScope,
): Promise<ManagerDashboardStats> {
  if (shouldSkipUnscopedDashboardRpc(scope)) {
    const assigned = scope?.assignedPropertyIds ?? [];
    if (assigned.length === 0) return EMPTY_DASHBOARD_STATS;
    return fetchDashboardStatsFallback(managerId, assigned);
  }

  const { data, error } = await supabase.rpc('get_manager_dashboard_stats', {
    p_manager_id: managerId,
  });

  if (!error && data) {
    const mapped = mapRpcDashboardStats(data);
    if (mapped && isCompleteDashboardRpc(data)) {
      return mapped;
    }
    if (mapped) {
      return supplementPartialStats(managerId, mapped);
    }
  }

  if (error) {
    logError('fetchManagerDashboardStats.rpc', error);
  }

  return fetchDashboardStatsFallback(managerId);
}
