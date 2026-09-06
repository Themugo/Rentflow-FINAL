import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthContext";
import { agencyServiceModelFromOperatingModel, type AgencyServiceModel } from "@/shared/constants/authorityModels";

export type AgencyPropertyRow = {
  id: string;
  name: string;
  address: string;
  units: number;
  occupied: number;
  occupancyRate: number;
  clientId: string | null;
  propertyLandlordId: string | null;
  clientName: string;
  collectedMtd: number;
  outstanding: number;
  serviceModel: AgencyServiceModel | null;
  tenantCount: number;
};

export type AgencyClientRow = {
  id: string;
  name: string;
  email: string | null;
  pending: boolean;
  propertyCount: number;
  units: number;
  occupied: number;
  occupancyRate: number;
  collectedMtd: number;
  outstanding: number;
  propertyLocations: string[];
};

export type AgencyMonthPoint = { month: string; paid: number; pending: number };

function occupancyRate(occupied: number, units: number): number {
  return units > 0 ? Math.round((occupied / units) * 100) : 0;
}

function inMonth(date: string | null, start: string, end?: string): boolean {
  return Boolean(date && date >= start && (!end || date <= end));
}

type DueAmountInvoice = { amount: number | string | null; balance_due: number | string | null };

/**
 * balance_due is nullable and can legitimately be 0 (fully paid down but not
 * yet marked "paid"), so `owed || amount` would wrongly fall back to the
 * full amount whenever balance_due is exactly 0. Only fall back to amount
 * when balance_due itself is null/undefined.
 */
function dueAmount(invoice: DueAmountInvoice): number {
  const amount = Number(invoice.amount ?? 0);
  return invoice.balance_due === null || invoice.balance_due === undefined
    ? amount
    : Number(invoice.balance_due);
}

export function useAgencyPortfolio() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["agency-portfolio", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user) throw new Error("Not signed in");

      const { data: snapshot, error } = await (supabase as any).rpc("get_agency_portfolio_snapshot");
      if (error) throw error;
      if (!snapshot) throw new Error("Agency portfolio snapshot unavailable");

      const now = new Date();
      const mtdStart = startOfMonth(now).toISOString().slice(0, 10);

      const properties = (snapshot.properties ?? []) as {
        id: string;
        name: string;
        address: string | null;
        units: number | null;
        occupied: number | null;
      }[];
      const links = (snapshot.links ?? []) as {
        id: string;
        property_id: string;
        landlord_user_id: string | null;
        revenue_share_pct: number | null;
        operating_model?: string | null;
        agency_service_model?: string | null;
      }[];
      const tenantRows = (snapshot.tenants ?? []) as { id: string; property_id: string | null }[];
      const invoices = (snapshot.invoices ?? []) as {
        property_id: string | null;
        amount: number | string | null;
        paid_amount: number | string | null;
        balance_due: number | string | null;
        status: string | null;
        paid_date: string | null;
        due_date: string | null;
      }[];
      const profiles = (snapshot.profiles ?? []) as { id: string; full_name: string | null; email: string | null }[];
      const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
      const tenantCountByProperty = new Map<string, number>();
      for (const tenant of tenantRows) {
        if (tenant.property_id) tenantCountByProperty.set(tenant.property_id, (tenantCountByProperty.get(tenant.property_id) ?? 0) + 1);
      }

      const linkByProperty = new Map(links.map((link) => [link.property_id, link]));
      const collectedByProperty = new Map<string, number>();
      const outstandingByProperty = new Map<string, number>();
      let collectedMtd = 0;
      let outstanding = 0;
      let overdueInvoices = 0;

      for (const invoice of invoices) {
        const amount = Number(invoice.amount ?? 0);
        const paid = Number(invoice.paid_amount ?? (invoice.status === "paid" ? amount : 0));
        if (invoice.status === "paid" && inMonth(invoice.paid_date, mtdStart)) {
          collectedMtd += paid;
          if (invoice.property_id) collectedByProperty.set(invoice.property_id, (collectedByProperty.get(invoice.property_id) ?? 0) + paid);
        }
        if (invoice.status === "overdue") overdueInvoices += 1;
        if (invoice.status === "overdue" || invoice.status === "partially_paid") {
          const due = dueAmount(invoice);
          outstanding += due;
          if (invoice.property_id) outstandingByProperty.set(invoice.property_id, (outstandingByProperty.get(invoice.property_id) ?? 0) + due);
        }
      }

      const propertyRows: AgencyPropertyRow[] = properties.map((property) => {
        const link = linkByProperty.get(property.id);
        const profile = link?.landlord_user_id ? profileMap.get(link.landlord_user_id) : undefined;
        const units = Number(property.units ?? 0);
        const occupied = Number(property.occupied ?? 0);
        return {
          id: property.id,
          name: property.name,
          address: property.address ?? "",
          units,
          occupied,
          occupancyRate: occupancyRate(occupied, units),
          clientId: link?.landlord_user_id ?? null,
          propertyLandlordId: link?.id ?? null,
          clientName: profile?.full_name || profile?.email || (link ? "Invitation pending" : "Unlinked"),
          collectedMtd: collectedByProperty.get(property.id) ?? 0,
          outstanding: outstandingByProperty.get(property.id) ?? 0,
          serviceModel: (link?.agency_service_model ?? agencyServiceModelFromOperatingModel(link?.operating_model)) as AgencyPropertyRow["serviceModel"],
          tenantCount: tenantCountByProperty.get(property.id) ?? 0,
        };
      });

      const clientMap = new Map<string, AgencyClientRow>();
      for (const property of propertyRows) {
        if (property.clientName === "Unlinked") continue;
        const key = property.clientId ?? `pending:${property.id}`;
        const existing = clientMap.get(key);
        if (existing) {
          existing.propertyCount += 1;
          existing.units += property.units;
          existing.occupied += property.occupied;
          existing.collectedMtd += property.collectedMtd;
          existing.outstanding += property.outstanding;
          if (property.address && !existing.propertyLocations.includes(property.address)) existing.propertyLocations.push(property.address);
          existing.occupancyRate = occupancyRate(existing.occupied, existing.units);
        } else {
          clientMap.set(key, {
            id: key,
            name: property.clientName,
            email: property.clientId ? (profileMap.get(property.clientId)?.email ?? null) : null,
            pending: !property.clientId,
            propertyCount: 1,
            units: property.units,
            occupied: property.occupied,
            occupancyRate: property.occupancyRate,
            collectedMtd: property.collectedMtd,
            outstanding: property.outstanding,
            propertyLocations: property.address ? [property.address] : [],
          });
        }
      }

      const clients = [...clientMap.values()].sort((a, b) => b.collectedMtd - a.collectedMtd);
      const linkedClientCount = new Set(propertyRows.filter((row) => row.clientId).map((row) => row.clientId)).size;
      const pendingClientCount = links.filter((link) => !link.landlord_user_id).length;
      const unlinkedCount = propertyRows.filter((row) => row.clientName === "Unlinked").length;

      const series: AgencyMonthPoint[] = [];
      for (let i = 5; i >= 0; i -= 1) {
        const monthDate = subMonths(now, i);
        const start = startOfMonth(monthDate).toISOString().slice(0, 10);
        const end = endOfMonth(monthDate).toISOString().slice(0, 10);
        const paid = invoices.filter((invoice) => invoice.status === "paid" && inMonth(invoice.paid_date, start, end)).reduce((sum, invoice) => sum + Number(invoice.paid_amount ?? invoice.amount ?? 0), 0);
        const pending = invoices.filter((invoice) => (invoice.status === "pending" || invoice.status === "overdue" || invoice.status === "partially_paid") && inMonth(invoice.due_date, start, end)).reduce((sum, invoice) => sum + dueAmount(invoice), 0);
        series.push({ month: format(monthDate, "MMM"), paid, pending });
      }

      const totalUnits = propertyRows.reduce((sum, row) => sum + row.units, 0);
      const totalOccupied = propertyRows.reduce((sum, row) => sum + row.occupied, 0);
      const serviceModelsByProperty = new Map<string, AgencyServiceModel>();
      for (const link of links) {
        const model = (link.agency_service_model ?? agencyServiceModelFromOperatingModel(link.operating_model)) as AgencyServiceModel | null;
        if (model) serviceModelsByProperty.set(link.property_id, model);
      }
      const serviceMix = {
        fullManagement: [...serviceModelsByProperty.values()].filter((model) => model === "full_management").length,
        managedDirectCollection: [...serviceModelsByProperty.values()].filter((model) => model === "managed_direct_landlord_collection").length,
        collectionsEnforcementOnly: [...serviceModelsByProperty.values()].filter((model) => model === "collections_enforcement_only").length,
        unconfigured: propertyRows.filter((row) => !serviceModelsByProperty.has(row.id)).length,
      };

      return {
        properties: propertyRows,
        clients,
        clientCount: linkedClientCount + pendingClientCount,
        unlinkedCount,
        totalProperties: propertyRows.length,
        totalUnits,
        totalOccupied,
        occupancyRate: occupancyRate(totalOccupied, totalUnits),
        collectedMtd,
        outstanding,
        overdueInvoices,
        expiringLeases: Number(snapshot.expiring_leases ?? 0),
        serviceMix,
        series,
      };
    },
  });

  return { ...query, data: query.data };
}
