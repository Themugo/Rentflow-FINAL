import { useQuery } from "@tanstack/react-query";
import { checkHealth } from "@/shared/lib/observability";

export type HealthState = "healthy" | "degraded" | "unhealthy" | "unknown";

export const PLATFORM_HEALTH_QUERY_KEY = ["webhost-overview-health"] as const;

export const HEALTH_COPY: Record<HealthState, { label: string; dot: string; text: string; sub: string }> = {
  healthy: {
    label: "System operational",
    dot: "bg-success",
    text: "text-success",
    sub: "Platform services responding normally",
  },
  degraded: {
    label: "System degraded",
    dot: "bg-warning",
    text: "text-warning",
    sub: "Some platform services are responding slowly",
  },
  unhealthy: {
    label: "System issue",
    dot: "bg-destructive",
    text: "text-destructive",
    sub: "A platform service is unreachable — investigate",
  },
  unknown: {
    label: "System status",
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
    sub: "Health probe unavailable",
  },
};

/**
 * Real, lightweight platform health probe. Reuses checkHealth() from the
 * observability stack — no invented metrics.
 */
export function usePlatformHealth() {
  return useQuery<HealthState>({
    queryKey: PLATFORM_HEALTH_QUERY_KEY,
    queryFn: async () => {
      try {
        const checks = await checkHealth();
        if (!checks.length) return "unknown";
        if (checks.some((c) => c.status === "unhealthy")) return "unhealthy";
        if (checks.some((c) => c.status === "degraded")) return "degraded";
        return "healthy";
      } catch {
        return "unknown";
      }
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
