import React, { createContext, useContext, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { BrandConfig, BrandTerm } from "@/core/brand/BrandConfig";
import { composeBrandConfig } from "@/core/brand/composeBrandConfig";
import type { OrgBrandRecord } from "@/core/brand/parseOrgRecord";
import { PLATFORM_BRAND_CONFIG } from "@/core/brand/platformBrand";
import { brandConfigToResolved, PLATFORM_BRAND, type ResolvedBrand } from "@/core/brand/resolve";
import { term } from "@/core/brand/terms";
import { portalFromAppRole, WHITE_LABEL_CONSUMERS } from "@/core/product/portals";
import { applyBrandConfig, clearBrandOverrides } from "./applyBrand";

interface WhiteLabelContextValue {
  config: BrandConfig;
  brand: ResolvedBrand;
  isLoading: boolean;
}

const WhiteLabelContext = createContext<WhiteLabelContextValue>({
  config: PLATFORM_BRAND_CONFIG,
  brand: PLATFORM_BRAND,
  isLoading: false,
});

function readOrgBrandRow(data: unknown): OrgBrandRecord | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  return {
    company_name: typeof row.company_name === "string" ? row.company_name : null,
    logo_url: typeof row.logo_url === "string" ? row.logo_url : null,
    email: typeof row.email === "string" ? row.email : null,
    phone: typeof row.phone === "string" ? row.phone : null,
    website: typeof row.website === "string" ? row.website : null,
    address: typeof row.address === "string" ? row.address : null,
    city: typeof row.city === "string" ? row.city : null,
    state: typeof row.state === "string" ? row.state : null,
    zip_code: typeof row.zip_code === "string" ? row.zip_code : null,
    brand_primary_hex: typeof row.brand_primary_hex === "string" ? row.brand_primary_hex : null,
    white_label_enabled: row.white_label_enabled === true,
    brand_config: row.brand_config ?? {},
  };
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWhiteLabel(): WhiteLabelContextValue {
  return useContext(WhiteLabelContext);
}

/** Read a terminology label from the active BrandConfig. */
// eslint-disable-next-line react-refresh/only-export-components
export function useBrandTerm(): (key: BrandTerm) => string {
  const { config } = useWhiteLabel();
  return (key) => term(config, key);
}

export function WhiteLabelProvider({ children }: { children: React.ReactNode }) {
  const { user, userRole } = useAuth();
  const portal = portalFromAppRole(userRole?.role);
  const canConsume = !!user && !!portal && (WHITE_LABEL_CONSUMERS as string[]).includes(portal);

  const { data: org, isLoading } = useQuery({
    queryKey: ["org-brand", user?.id, userRole?.role],
    queryFn: async (): Promise<OrgBrandRecord | null> => {
      const { data, error } = await supabase.rpc("get_org_brand");
      if (error) throw error;
      return readOrgBrandRow(data);
    },
    enabled: canConsume,
    staleTime: 5 * 60 * 1000,
  });

  const config = useMemo(
    () => (canConsume ? composeBrandConfig(org ?? null) : PLATFORM_BRAND_CONFIG),
    [canConsume, org],
  );

  const brand = useMemo(() => brandConfigToResolved(config), [config]);

  useEffect(() => {
    applyBrandConfig(config);
    return () => clearBrandOverrides();
  }, [config]);

  const value = useMemo(
    () => ({ config, brand, isLoading: canConsume && isLoading }),
    [config, brand, canConsume, isLoading],
  );

  return (
    <WhiteLabelContext.Provider value={value}>
      {children}
    </WhiteLabelContext.Provider>
  );
}
