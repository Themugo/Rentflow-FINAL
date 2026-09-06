import type { ComponentProbe, ProbeStatus } from "@/features/webhost/lib/adminHealth";

/**
 * Infrastructure control-center model.
 * Every value is derived from real, observable sources:
 *   - service probes (useAdminHealthProbes → checkHealth + edge health-check)
 *   - build facts (import.meta.env)
 *   - runtime facts (window.location)
 * Deployments, servers, DNS, and certificate data have no runtime source in
 * this desk and are deliberately absent — never fabricate them here.
 */

export type InfraStatus = "operational" | "warning" | "degraded" | "down";

export type InfraStatusMeta = {
  label: string;
  dot: string;
  text: string;
};

export const INFRA_STATUS: Record<InfraStatus, InfraStatusMeta> = {
  operational: { label: "Operational", dot: "bg-success", text: "text-success" },
  warning: { label: "Warning", dot: "bg-warning", text: "text-warning" },
  degraded: { label: "Degraded", dot: "bg-warning", text: "text-warning" },
  down: { label: "Down", dot: "bg-destructive", text: "text-destructive" },
};

/** Probe vocabulary → control-center vocabulary. An unprobed service is a Warning, never Operational. */
export function probeToInfraStatus(status: ProbeStatus): InfraStatus {
  if (status === "healthy") return "operational";
  if (status === "degraded") return "degraded";
  if (status === "unhealthy") return "down";
  return "warning";
}

/** Roll all probes into one system status. Worst-of wins. */
export function deriveSystemStatus(probes: ComponentProbe[]): InfraStatus {
  if (probes.length === 0) return "warning";
  if (probes.some((probe) => probe.status === "unhealthy")) return "down";
  if (probes.some((probe) => probe.status === "degraded")) return "degraded";
  if (probes.some((probe) => probe.status === "unavailable")) return "warning";
  return "operational";
}

export function countProbed(probes: ComponentProbe[]): { probed: number; total: number } {
  return { probed: probes.filter((probe) => probe.status !== "unavailable").length, total: probes.length };
}

export type ApplicationFacts = {
  name: string;
  version: string;
  environment: string;
  domain: string;
  protocol: string;
  backendProject: string;
  backendConfigured: boolean;
};

type AppFactsEnv = { PROD: boolean; VITE_SUPABASE_URL?: string };

/** Real build + runtime facts about the one application this desk serves. */
export function getApplicationFacts(env: AppFactsEnv, location: Pick<Location, "hostname" | "protocol">): ApplicationFacts {
  const supabaseUrl = env.VITE_SUPABASE_URL ?? "";
  const backendConfigured = Boolean(supabaseUrl) && !supabaseUrl.includes("placeholder");
  let backendProject = "Not configured";
  if (backendConfigured) {
    try {
      backendProject = new URL(supabaseUrl).hostname;
    } catch {
      backendProject = supabaseUrl;
    }
  }
  return {
    name: "CALQULUS PMS",
    // Mirrors package.json "version" — JSON imports are not enabled in tsconfig.
    version: "1.0.0",
    environment: env.PROD ? "production" : "development",
    domain: location.hostname,
    protocol: location.protocol.replace(":", ""),
    backendProject,
    backendConfigured,
  };
}


export type ApplicationRuntime = ApplicationFacts & {
  id: 'calqulus-pms';
  health: InfraStatus;
  servicesReporting: number;
  servicesTotal: number;
};

/** The one application this desk serves, with live health rolled in. */
export function getApplicationRuntime(probes: ComponentProbe[], facts: ApplicationFacts): ApplicationRuntime {
  const counts = countProbed(probes);
  return {
    ...facts,
    id: 'calqulus-pms',
    health: deriveSystemStatus(probes),
    servicesReporting: counts.probed,
    servicesTotal: counts.total,
  };
}

export type NonSecretConfigEntry = {
  key: string;
  value: string;
};

/**
 * Build/runtime configuration entries that are safe to display. Secrets
 * (publishable keys, service keys, tokens) are never listed here.
 */
export function getNonSecretConfig(facts: ApplicationFacts): NonSecretConfigEntry[] {
  return [
    { key: 'Environment', value: facts.environment },
    { key: 'Version', value: facts.version },
    { key: 'Domain', value: facts.domain },
    { key: 'Protocol', value: facts.protocol },
    { key: 'Backend', value: facts.backendConfigured ? 'Supabase' : 'Not configured' },
    { key: 'Backend project', value: facts.backendProject },
  ];
}

/**
 * Deployment history is not instrumented: Vercel deploys this app via its
 * native GitHub integration and no deployment records are exposed to the
 * runtime. There is exactly one live deployment — the build serving the
 * page right now. Never fabricate history beyond this.
 */
export const DEPLOYMENTS_NOT_INSTRUMENTED =
  'Deployment history is not instrumented. Vercel deploys from the GitHub integration; no deployment records are exposed to the app runtime.' as const;
