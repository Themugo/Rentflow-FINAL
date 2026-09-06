/**
 * stripeIdempotency.test.ts
 *
 * Tests the idempotency-via-insert pattern used by stripe-webhook.
 * Mirrors the dedup logic in `supabase/functions/stripe-webhook/index.ts`.
 *
 * The pattern: on every webhook, INSERT into stripe_processed_events
 * keyed by event.id. If the insert succeeds, we are the first to process
 * this event and proceed. If it raises a duplicate-key error (Postgres
 * code 23505) the event was already processed — short-circuit with 200 OK
 * so Stripe stops retrying.
 *
 * This is much safer than SELECT-then-INSERT because the unique-index
 * constraint makes the check atomic at the DB level.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Helper under test (mirrors stripe-webhook handler) ────────────────

interface StripeEvent {
  id: string;
  type: string;
}

interface DedupResult {
  /** True if we are the first to process; false if it was a duplicate. */
  shouldProcess: boolean;
  /** True if dedup itself errored — caller should proceed anyway, not retry. */
  dedupBroken: boolean;
}

async function dedupStripeEvent(
  supabase: { from: (t: string) => { insert: (row: unknown) => Promise<{ error: { code?: string; message: string } | null }> } },
  event: StripeEvent,
): Promise<DedupResult> {
  try {
    const { error } = await supabase
      .from("stripe_processed_events")
      .insert({ event_id: event.id, event_type: event.type });

    if (error) {
      if (error.code === "23505") return { shouldProcess: false, dedupBroken: false };
      // Other errors: log + continue. Better a rare double-process than a
      // permanent stuck payment.
      return { shouldProcess: true, dedupBroken: true };
    }
    return { shouldProcess: true, dedupBroken: false };
  } catch {
    return { shouldProcess: true, dedupBroken: true };
  }
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("dedupStripeEvent — first-time event", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns shouldProcess=true when the insert succeeds", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn(() => ({ insert })) };
    const r = await dedupStripeEvent(supabase, { id: "evt_001", type: "checkout.session.completed" });
    expect(r).toEqual({ shouldProcess: true, dedupBroken: false });
  });

  it("inserts the event_id and event_type", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn(() => ({ insert })) };
    await dedupStripeEvent(supabase, { id: "evt_xyz", type: "charge.refunded" });
    expect(insert).toHaveBeenCalledWith({ event_id: "evt_xyz", event_type: "charge.refunded" });
  });
});

describe("dedupStripeEvent — duplicate event", () => {
  it("returns shouldProcess=false when the insert raises a unique-violation (23505)", async () => {
    const insert = vi.fn().mockResolvedValue({
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
    });
    const supabase = { from: vi.fn(() => ({ insert })) };
    const r = await dedupStripeEvent(supabase, { id: "evt_001", type: "checkout.session.completed" });
    expect(r).toEqual({ shouldProcess: false, dedupBroken: false });
  });

  it("treats unique-violation as 'already processed' — caller must not run side effects", async () => {
    const insert = vi.fn().mockResolvedValue({
      error: { code: "23505", message: "x" },
    });
    const supabase = { from: vi.fn(() => ({ insert })) };
    const r = await dedupStripeEvent(supabase, { id: "evt_001", type: "x" });
    expect(r.shouldProcess).toBe(false);
  });
});

describe("dedupStripeEvent — infra failures (fail-soft)", () => {
  it("allows processing when the insert errors with a non-23505 code", async () => {
    // Network blip, table missing, whatever. We bias toward 'try anyway'
    // because Stripe retries and a single double-process is recoverable;
    // a stuck payment is not.
    const insert = vi.fn().mockResolvedValue({
      error: { code: "08006", message: "connection refused" },
    });
    const supabase = { from: vi.fn(() => ({ insert })) };
    const r = await dedupStripeEvent(supabase, { id: "evt_001", type: "x" });
    expect(r).toEqual({ shouldProcess: true, dedupBroken: true });
  });

  it("allows processing when the insert throws", async () => {
    const insert = vi.fn().mockRejectedValue(new Error("totally broken"));
    const supabase = { from: vi.fn(() => ({ insert })) };
    const r = await dedupStripeEvent(supabase, { id: "evt_001", type: "x" });
    expect(r).toEqual({ shouldProcess: true, dedupBroken: true });
  });

  it("dedupBroken=true signals operator attention even though we proceed", async () => {
    const insert = vi.fn().mockResolvedValue({
      error: { code: "42P01", message: "table does not exist" },
    });
    const supabase = { from: vi.fn(() => ({ insert })) };
    const r = await dedupStripeEvent(supabase, { id: "evt_001", type: "x" });
    expect(r.dedupBroken).toBe(true);
  });
});

describe("dedupStripeEvent — sequential calls (real-world retry scenario)", () => {
  it("first call processes; second call short-circuits", async () => {
    // Simulate a fresh table: first insert succeeds, second fails with 23505.
    const insert = vi.fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { code: "23505", message: "dup" } });

    const supabase = { from: vi.fn(() => ({ insert })) };

    const r1 = await dedupStripeEvent(supabase, { id: "evt_42", type: "checkout.session.completed" });
    expect(r1.shouldProcess).toBe(true);

    const r2 = await dedupStripeEvent(supabase, { id: "evt_42", type: "checkout.session.completed" });
    expect(r2.shouldProcess).toBe(false);
  });
});
