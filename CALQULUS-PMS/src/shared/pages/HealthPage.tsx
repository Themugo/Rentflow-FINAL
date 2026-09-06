/**
 * In-app health endpoint used when the Supabase Edge Function `health-check`
 * is not deployed. Served from the SPA at /health (see routes.ts).
 *
 * This checks the public REST origin with the publishable key. It is not a
 * substitute for a privileged Edge Function that can inspect Auth/Storage.
 */
import { useEffect, useState } from "react";

type Check = { name: string; ok: boolean; status: number; detail: string };

const HealthPage = () => {
  const [checks, setChecks] = useState<Check[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const run = async () => {
      const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
      const next: Check[] = [];

      if (!url || !key || url.includes("placeholder") || key.includes("placeholder")) {
        next.push({ name: "frontend-env", ok: false, status: 0, detail: "Supabase env is placeholder" });
        setChecks(next);
        setDone(true);
        return;
      }

      next.push({ name: "frontend-env", ok: true, status: 200, detail: "VITE_SUPABASE_URL and publishable key present" });

      try {
        const rest = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
          headers: { apikey: key, Authorization: `Bearer ${key}` },
        });
        next.push({
          name: "supabase-rest",
          ok: rest.status < 500,
          status: rest.status,
          detail: rest.status < 500 ? "PostgREST reachable" : "PostgREST 5xx",
        });
      } catch (error) {
        next.push({
          name: "supabase-rest",
          ok: false,
          status: 0,
          detail: error instanceof Error ? error.message : "fetch failed",
        });
      }

      try {
        const fn = await fetch(`${url.replace(/\/$/, "")}/functions/v1/health-check`, {
          headers: { apikey: key, Authorization: `Bearer ${key}` },
        });
        next.push({
          name: "edge-health-check",
          ok: fn.status !== 404,
          status: fn.status,
          detail: fn.status === 404 ? "Edge Function not deployed" : "Edge Function reachable",
        });
      } catch (error) {
        next.push({
          name: "edge-health-check",
          ok: false,
          status: 0,
          detail: error instanceof Error ? error.message : "fetch failed",
        });
      }

      setChecks(next);
      setDone(true);
    };
    void run();
  }, []);

  const healthy = done && checks.length > 0 && checks.every((c) => c.ok || c.name === "edge-health-check");
  const payload = {
    status: !done ? "pending" : healthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    checks,
  };

  return (
    <pre style={{ padding: 24, fontFamily: "ui-monospace, monospace", whiteSpace: "pre-wrap" }}>
      {JSON.stringify(payload, null, 2)}
    </pre>
  );
};

export default HealthPage;
