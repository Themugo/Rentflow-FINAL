import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { requireEnv } from "../_shared/env.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

// Canonical monthly invoice generation lives in generate-monthly-invoices.
// This function remains only as the backwards-compatible scheduled entrypoint.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader !== `Bearer ${SERVICE_KEY}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-monthly-invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ source: "scheduled" }),
    });

    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invoice generation service unreachable";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 502,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
