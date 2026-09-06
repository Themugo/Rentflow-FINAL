import { useQuery } from "@tanstack/react-query";
import { checkHealth } from "@/shared/lib/observability";
import {
  assembleAdminHealthProbes,
  type ComponentProbe,
  type EdgeHealthPayload,
} from "@/features/webhost/lib/adminHealth";

export type { ComponentProbe, ProbeStatus } from "@/features/webhost/lib/adminHealth";

export const ADMIN_HEALTH_QUERY_KEY = ["platform-admin-health-probes"] as const;

export function useAdminHealthProbes() {
  return useQuery<ComponentProbe[]>({
    queryKey: ADMIN_HEALTH_QUERY_KEY,
    queryFn: async () => {
      const local = await checkHealth();

      let edge: EdgeHealthPayload | null = null;
      let edgeReachable = false;
      let edgeError = "";
      const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

      if (url && key && !url.includes("placeholder") && !key.includes("placeholder")) {
        try {
          const res = await fetch(`${url.replace(/\/$/, "")}/functions/v1/health-check`, {
            headers: { apikey: key, Authorization: `Bearer ${key}` },
          });
          if (res.status === 404) {
            edgeError = "Edge health-check is not deployed";
          } else if (!res.ok) {
            edgeError = `HTTP ${res.status}`;
          } else {
            edge = (await res.json()) as EdgeHealthPayload;
            edgeReachable = true;
          }
        } catch (error) {
          edgeError = error instanceof Error ? error.message : "Fetch failed";
        }
      } else {
        edgeError = "Supabase env is placeholder";
      }

      return assembleAdminHealthProbes({ local, edge, edgeReachable, edgeError });
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
