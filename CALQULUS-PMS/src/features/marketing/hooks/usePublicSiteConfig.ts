import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_PUBLIC_SITE_CONFIG, mergePublicSiteConfig, type PublicSiteConfig } from "@/features/marketing/publicSiteConfig";

export const PUBLIC_SITE_CONFIG_QUERY_KEY = ["public-site-config"] as const;

export function usePublicSiteConfig() {
  return useQuery<PublicSiteConfig>({
    queryKey: PUBLIC_SITE_CONFIG_QUERY_KEY,
    queryFn: async () => {
      try {
        const { data, error } = await (supabase.rpc as any)("get_public_site_config");
        if (error) return DEFAULT_PUBLIC_SITE_CONFIG;
        return mergePublicSiteConfig(data);
      } catch {
        // Public marketing pages must remain renderable if the optional
        // configuration RPC is unavailable during a staged deployment.
        return DEFAULT_PUBLIC_SITE_CONFIG;
      }
    },
    staleTime: 60_000,
    placeholderData: DEFAULT_PUBLIC_SITE_CONFIG,
  });
}
