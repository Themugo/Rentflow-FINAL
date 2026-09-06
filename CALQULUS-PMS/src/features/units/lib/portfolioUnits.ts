import { supabase } from "@/integrations/supabase/client";

export interface PortfolioUnitRow {
  id: string;
  unitNumber: string;
  propertyId: string;
  propertyName: string;
  tenantName: string | null;
  status: string;
  rent: number | null;
  leaseStatus: string | null;
  leaseEndDate: string | null;
  balance: number;
}

interface Scope {
  restrictToAssignedProperties?: boolean;
  assignedPropertyIds?: string[];
}

/**
 * Portfolio units from live tables only.
 * Joins properties, units, tenants, leases, and unpaid invoices in memory.
 * Do not invent occupancy, rent, or balances.
 */
export async function fetchPortfolioUnits(
  managerId: string,
  scope: Scope = {},
): Promise<PortfolioUnitRow[]> {
  const restrict = Boolean(scope.restrictToAssignedProperties);
  const assigned = scope.assignedPropertyIds ?? [];
  if (restrict && assigned.length === 0) return [];

  let propertyQuery = supabase
    .from("properties")
    .select("id, name")
    .eq("manager_id", managerId)
    .neq("status", "inactive");
  if (restrict) propertyQuery = propertyQuery.in("id", assigned);

  const { data: properties, error: propertyError } = await propertyQuery;
  if (propertyError) throw propertyError;
  if (!properties?.length) return [];

  const propertyIds = properties.map((property) => property.id);
  const nameById = new Map(properties.map((property) => [property.id, property.name]));

  const { data: units, error: unitError } = await supabase
    .from("units")
    .select("id, property_id, unit_number, status, monthly_rent")
    .in("property_id", propertyIds)
    .neq("status", "inactive")
    .order("unit_number");
  if (unitError) throw unitError;
  if (!units?.length) return [];

  const [{ data: tenants }, { data: leases }] = await Promise.all([
    supabase
      .from("tenants")
      .select("id, name, unit, unit_id, property_id")
      .eq("manager_id", managerId)
      .in("property_id", propertyIds),
    supabase
      .from("leases")
      .select("tenant_id, unit, monthly_rent, status, end_date, property_id")
      .in("property_id", propertyIds),
  ]);

  const tenantIds = (tenants ?? []).map((tenant) => tenant.id);
  const balances: Record<string, number> = {};
  if (tenantIds.length > 0) {
    const { data: invoices } = await supabase
      .from("invoices")
      .select("tenant_id, amount, balance_due, status")
      .in("tenant_id", tenantIds)
      // "partially_paid" carries a real remaining balance_due too — omitting
      // it understates a tenant's balance the moment any partial payment
      // lands (see dashboardStats.ts / useAgencyPortfolio.ts for the same fix).
      .in("status", ["pending", "overdue", "partially_paid"]);
    for (const row of invoices ?? []) {
      if (!row.tenant_id) continue;
      const due = Number(row.balance_due ?? row.amount ?? 0);
      balances[row.tenant_id] = (balances[row.tenant_id] ?? 0) + due;
    }
  }

  return units.map((unit) => {
    const tenant = (tenants ?? []).find((row) =>
      row.unit_id === unit.id
      || (row.property_id === unit.property_id
        && (row.unit || "").toLowerCase() === unit.unit_number.toLowerCase()),
    );
    const lease = tenant
      ? (leases ?? []).find((row) => row.tenant_id === tenant.id)
      : (leases ?? []).find((row) =>
        row.property_id === unit.property_id
        && (row.unit || "").toLowerCase() === unit.unit_number.toLowerCase(),
      );

    return {
      id: unit.id,
      unitNumber: unit.unit_number,
      propertyId: unit.property_id,
      propertyName: nameById.get(unit.property_id) ?? "—",
      tenantName: tenant?.name ?? null,
      status: unit.status,
      rent: unit.monthly_rent ?? lease?.monthly_rent ?? null,
      leaseStatus: lease?.status ?? null,
      leaseEndDate: lease?.end_date ?? null,
      balance: tenant ? (balances[tenant.id] ?? 0) : 0,
    };
  });
}
