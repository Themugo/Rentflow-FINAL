import type { HealthStatus } from "@/shared/lib/observability";

export type ProbeStatus = "healthy" | "degraded" | "unhealthy" | "unavailable";

export type ComponentProbe = {
  id: "database" | "api" | "payments" | "notifications" | "storage";
  label: string;
  status: ProbeStatus;
  detail: string;
  latencyMs?: number;
};

export type EdgeHealthPayload = {
  checks?: {
    database?: { status?: string; latencyMs?: number; error?: string };
    auth?: { status?: string; latencyMs?: number; error?: string };
    storage?: { status?: string; latencyMs?: number; error?: string };
    edgeFunctions?: { status?: string; latencyMs?: number; error?: string };
  };
};

export const PAYMENTS_HEALTH_DETAIL =
  "No live probe — payment processors are not health-checked from this desk";

export const NOTIFICATIONS_HEALTH_DETAIL =
  "No live probe — notification dispatch is not health-checked from this desk";

export function mapEdgeStatus(value: string | undefined): ProbeStatus | null {
  if (value === "healthy" || value === "degraded" || value === "unhealthy") return value;
  return null;
}

export function fromLocal(
  checks: HealthStatus[],
  component: string,
): { status: ProbeStatus; detail: string; latencyMs?: number } {
  const row = checks.find((c) => c.component === component);
  if (!row) return { status: "unavailable", detail: "No live probe" };
  return {
    status:
      row.status === "healthy" || row.status === "degraded" || row.status === "unhealthy"
        ? row.status
        : "unavailable",
    detail: row.error || (row.status === "healthy" ? "Responding" : "Probe returned an issue"),
    latencyMs: row.latency,
  };
}

/** Assemble the five control-tower probes. Payments and notifications are never invented. */
export function assembleAdminHealthProbes(input: {
  local: HealthStatus[];
  edge: EdgeHealthPayload | null;
  edgeReachable: boolean;
  edgeError: string;
}): ComponentProbe[] {
  const { local, edge, edgeReachable, edgeError } = input;
  const dbLocal = fromLocal(local, "supabase");

  const database: ComponentProbe = {
    id: "database",
    label: "Database",
    status: mapEdgeStatus(edge?.checks?.database?.status) ?? dbLocal.status,
    detail: edge?.checks?.database?.error || dbLocal.detail,
    latencyMs: edge?.checks?.database?.latencyMs ?? dbLocal.latencyMs,
  };

  const api: ComponentProbe = {
    id: "api",
    label: "API",
    status: edgeReachable ? mapEdgeStatus(edge?.checks?.edgeFunctions?.status) ?? "healthy" : "unavailable",
    detail: edgeReachable ? "health-check reachable" : edgeError || "No live probe",
    latencyMs: edge?.checks?.edgeFunctions?.latencyMs,
  };

  const storageStatus = mapEdgeStatus(edge?.checks?.storage?.status);
  const storage: ComponentProbe = {
    id: "storage",
    label: "Storage",
    status: storageStatus ?? "unavailable",
    detail: storageStatus
      ? edge?.checks?.storage?.error || "Storage health reported by health-check"
      : "No live probe",
    latencyMs: edge?.checks?.storage?.latencyMs,
  };

  return [
    database,
    api,
    {
      id: "payments",
      label: "Payments",
      status: "unavailable",
      detail: PAYMENTS_HEALTH_DETAIL,
    },
    {
      id: "notifications",
      label: "Notifications",
      status: "unavailable",
      detail: NOTIFICATIONS_HEALTH_DETAIL,
    },
    storage,
  ];
}
