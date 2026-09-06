import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { track, trackPropertyEvent, trackTenantEvent, trackPayment } = vi.hoisted(() => ({
  track: vi.fn().mockResolvedValue(undefined),
  trackPropertyEvent: vi.fn().mockResolvedValue(undefined),
  trackTenantEvent: vi.fn().mockResolvedValue(undefined),
  trackPayment: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/shared/lib/observability", () => ({
  kpi: {
    track,
    trackPropertyEvent,
    trackTenantEvent,
    trackPayment,
  },
}));

import { trackTimeToFirst } from "@/features/dashboard/lib/activationMetrics";

describe("trackTimeToFirst", () => {
  beforeEach(() => {
    localStorage.clear();
    track.mockClear();
    trackPropertyEvent.mockClear();
    trackTenantEvent.mockClear();
    trackPayment.mockClear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("does nothing without a manager id", () => {
    trackTimeToFirst("property", { managerId: null, signupAt: new Date().toISOString() });
    expect(track).not.toHaveBeenCalled();
  });

  it("records signup-to-first-property once and emits the existing property KPI", () => {
    const signupAt = new Date(Date.now() - 5_000).toISOString();
    trackTimeToFirst("property", { managerId: "mgr-1", signupAt });
    trackTimeToFirst("property", { managerId: "mgr-1", signupAt });

    expect(track).toHaveBeenCalledTimes(1);
    expect(track.mock.calls[0][0].name).toBe("activation_time_to_first_property");
    expect(track.mock.calls[0][0].unit).toBe("ms");
    expect(track.mock.calls[0][0].value).toBeGreaterThanOrEqual(0);
    expect(trackPropertyEvent).toHaveBeenCalledWith("created", undefined, "mgr-1");
  });

  it("records first tenant and first payment through the existing KPI helpers", () => {
    trackTimeToFirst("tenant", { managerId: "mgr-1", signupAt: new Date().toISOString() });
    trackTimeToFirst("invoice", { managerId: "mgr-1", signupAt: new Date().toISOString() });
    trackTimeToFirst("payment", { managerId: "mgr-1", signupAt: new Date().toISOString() });

    expect(trackTenantEvent).toHaveBeenCalledWith("signup", undefined, "mgr-1");
    expect(trackPayment).toHaveBeenCalledWith("first", 0, "success", "mgr-1");
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ name: "activation_time_to_first_invoice" }));
  });
});
