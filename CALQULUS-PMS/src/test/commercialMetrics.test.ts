import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { track } = vi.hoisted(() => ({
  track: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/shared/lib/observability", () => ({
  kpi: { track },
}));

import { trackCommercialEvent } from "@/features/dashboard/lib/commercialMetrics";

describe("trackCommercialEvent", () => {
  beforeEach(() => {
    localStorage.clear();
    track.mockClear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("records signup once per manager", () => {
    trackCommercialEvent("signup", { managerId: "mgr-1" });
    trackCommercialEvent("signup", { managerId: "mgr-1" });
    expect(track).toHaveBeenCalledTimes(1);
    expect(track.mock.calls[0][0].name).toBe("commercial_signup");
  });

  it("records subscription conversion separately from signup", () => {
    trackCommercialEvent("signup", { managerId: "mgr-1" });
    trackCommercialEvent("subscription_paid", { managerId: "mgr-1" });
    expect(track).toHaveBeenCalledTimes(2);
  });
});
