import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FALLBACK_COMMERCIAL_TIERS, mergeLiveTiers, type CommercialTier } from "@/shared/lib/commercialCatalog";

export function usePublicTiers() {
  return useQuery({
    queryKey: ["public-subscription-tiers"],
    queryFn: async (): Promise<CommercialTier[]> => {
      try {
        const { data, error } = await supabase
          .from("subscription_tiers")
          .select("tier_key, name, description, price_per_property, max_properties, max_units, is_active, display_order")
          .eq("is_active", true)
          .order("display_order");
        if (error) return FALLBACK_COMMERCIAL_TIERS;
        return mergeLiveTiers(data ?? []);
      } catch {
        return FALLBACK_COMMERCIAL_TIERS;
      }
    },
    staleTime: 10 * 60 * 1000,
    placeholderData: mergeLiveTiers([]),
  });
}
