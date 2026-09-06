import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthContext";

export type AgencyContractRule = {
  id: string;
  agency_id: string;
  property_landlord_id: string;
  contract_name: string;
  status: "draft" | "active" | "superseded" | "expired";
  effective_from: string;
  effective_to: string | null;
  collection_destination: "agency" | "landlord" | "tenant_direct" | "external" | "split";
  service_model: string | null;
  management_modules: Record<string, boolean>;
  financial_modules: Record<string, boolean | string | number>;
  payment_rules: Record<string, boolean | string | number>;
  enforcement_rules: Record<string, boolean | string | number>;
  settlement_rules: Record<string, boolean | string | number>;
  approval_rules: Record<string, boolean | string | number>;
  notes: string | null;
};

export type AgencyChargeCatalogItem = {
  id: string;
  agency_id: string;
  code: string;
  label: string;
  category: "income" | "expense" | "pass_through";
  charge_type: string;
  calculation_method: "fixed" | "per_unit" | "metered" | "percentage" | "manual";
  default_rate: number;
  unit_label: string | null;
  payer: "tenant" | "landlord" | "agency" | "third_party" | "shared";
  is_active: boolean;
  display_order: number;
  notes: string | null;
};

export type AgencyMemberPermission = {
  id: string;
  member_user_id: string;
  role_in_agency: string;
  permissions: Record<string, boolean>;
  is_active: boolean;
};

export type AgencyOperationsConfig = {
  agency_id: string;
  contract_rules: AgencyContractRule[];
  charge_catalog: AgencyChargeCatalogItem[];
  members: AgencyMemberPermission[];
  defaults: Record<string, unknown>;
  viewer: {
    user_id: string;
    is_admin: boolean;
    can_manage_settings: boolean;
    can_manage_contract_rules: boolean;
    can_manage_billing_rules: boolean;
    can_manage_team: boolean;
    can_view_financials: boolean;
    can_record_payments: boolean;
    can_verify_payment_evidence: boolean;
    can_close_books: boolean;
  };
};

export async function resolveAgencyId(userId?: string | null): Promise<string | null> {
  if (!userId) return null;
  const { data, error } = await (supabase as any).rpc("agency_id_for_user", { p_user_id: userId });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export function useAgencyOperationsConfig() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["agency-operations-config", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const agencyId = await resolveAgencyId(user?.id);
      if (!agencyId) throw new Error("Agency not found");
      const { data, error } = await (supabase as any).rpc("get_agency_operations_config", { p_agency_id: agencyId });
      if (error) throw error;
      return data as AgencyOperationsConfig;
    },
    staleTime: 30_000,
  });
}

export async function saveAgencyOperationsConfig(agencyId: string, action: string, payload: Record<string, unknown>) {
  const rpcMap: Record<string, { name: string; args: Record<string, unknown> }> = {
    defaults: { name: "save_agency_operating_defaults_atomic", args: { p_agency_id: agencyId, p_config: payload } },
    contract: { name: "save_agency_contract_rule_atomic", args: { p_rule_id: payload.ruleId ?? null, p_agency_id: agencyId, p_property_landlord_id: payload.propertyLandlordId, p_payload: payload } },
    charge: { name: "save_agency_charge_catalog_item_atomic", args: { p_item_id: payload.itemId ?? null, p_agency_id: agencyId, p_payload: payload } },
    member: { name: "save_agency_member_permissions_atomic", args: { p_agency_id: agencyId, p_member_id: payload.memberId, p_role_in_agency: payload.roleInAgency, p_permissions: payload.permissions } },
  };
  const entry = rpcMap[action];
  if (!entry) throw new Error(`Unknown Agency configuration action: ${action}`);
  const { data, error } = await (supabase as any).rpc(entry.name, entry.args);
  if (error) throw error;
  return data;
}
