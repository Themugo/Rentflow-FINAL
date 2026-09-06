/**
 * Retry one failed payment notification using its persisted payload.
 * The database RPC authorizes the caller and reserves the retry before the
 * provider is invoked, preventing double-click/provider storms.
 */
import { serve } from "std/http/server.ts";
import { createClient } from "supabase-js@2";
import { getCorsHeaders, preflightResponse } from "../_shared/cors.ts";
import { requireEnv } from "../_shared/env.ts";

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SERVICE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const ANON_KEY = requireEnv("SUPABASE_ANON_KEY");

const CHANNEL_FUNCTIONS: Record<string, string> = {
  email: "send-receipt-email",
  sms: "send-sms-notification",
  whatsapp: "send-whatsapp-notification",
  manager_notify: "notify-manager-payment",
  landlord_notify: "notify-manager-payment",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return preflightResponse(req);
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });

  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const { failureId } = await req.json();
    if (!failureId) throw new Error("failureId is required");

    const { data: claimed, error: claimError } = await userClient.rpc("claim_notification_failure_retry_atomic", { p_id: failureId });
    if (claimError) throw claimError;
    if (!claimed) throw new Error("Notification retry could not be reserved");

    const row = claimed as { id: string; channel: string; payload: Record<string, unknown> | null; manager_id: string | null; transaction_id: string | null; tenant_id: string | null; attempts: number };
    const fn = CHANNEL_FUNCTIONS[row.channel];
    if (!fn) throw new Error(`Unsupported notification channel: ${row.channel}`);

    const payload = { ...(row.payload ?? {}) };
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify(payload),
    });
    const text = await response.text().catch(() => "");
    let body: Record<string, unknown> | null = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = null; }

    const success = response.ok && body?.success !== false && body?.skipped !== true;
    if (success) {
      await admin.from("notification_failures").update({ status: "replayed" }).eq("id", row.id).eq("status", "pending");
      return new Response(JSON.stringify({ success: true, attempts: row.attempts }), { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    const errorMessage = String(body?.error ?? body?.reason ?? (text || `Provider returned ${response.status}`)).slice(0, 1000);
    await admin.from("notification_failures").update({ error: errorMessage }).eq("id", row.id).eq("status", "pending");
    return new Response(JSON.stringify({ success: false, error: errorMessage, attempts: row.attempts }), { status: 502, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
  }
});
