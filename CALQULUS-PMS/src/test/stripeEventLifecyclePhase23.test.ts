import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const handler = readFileSync('supabase/functions/stripe-webhook/index.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260903000008_stripe_webhook_event_lifecycle_atomic.sql', 'utf8');

describe('Phase 23 Stripe webhook event lifecycle', () => {
  it('claims before side effects and completes only after them', () => {
    expect(handler).toContain('claim_stripe_event_atomic');
    expect(handler).toContain('complete_stripe_event_atomic');
    expect(handler).toContain('fail_stripe_event_atomic');
    expect(handler).not.toContain('.from("stripe_processed_events")\n      .insert');
    expect(handler).not.toContain('.from("stripe_processed_events")\n            .update');
  });
  it('retries failed processing with HTTP 500', () => {
    expect(handler).toContain('status: claim.status === "completed" ? 200 : 500');
    expect(handler).toContain('return new Response("Webhook processing failed", { status: 500 });');
  });
  it('uses a stale-claim timeout and service-role-only RPCs', () => {
    expect(migration).toContain("interval '10 minutes'");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.claim_stripe_event_atomic(text,text) FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.complete_stripe_event_atomic(text,uuid,text) TO service_role");
  });
});
