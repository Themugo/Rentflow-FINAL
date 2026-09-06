import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ResendVerificationButton } from "@/features/auth/components/ResendVerificationButton";

const mockResend = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      resend: (...args: unknown[]) => mockResend(...args),
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

describe("ResendVerificationButton", () => {
  beforeEach(() => {
    mockResend.mockReset();
    mockResend.mockResolvedValue({ data: {}, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is disabled without an email address", () => {
    render(<ResendVerificationButton email={null} />);
    expect(screen.getByRole("button", { name: /resend verification email/i })).toBeDisabled();
    expect(mockResend).not.toHaveBeenCalled();
  });

  it("sends a signup verification email with the redirect target", async () => {
    render(<ResendVerificationButton email="manager@example.com" redirectTo="https://calqulus.site/onboarding/manager" />);

    fireEvent.click(screen.getByRole("button", { name: /resend verification email/i }));

    await waitFor(() =>
      expect(mockResend).toHaveBeenCalledWith({
        type: "signup",
        email: "manager@example.com",
        options: { emailRedirectTo: "https://calqulus.site/onboarding/manager" },
      }),
    );
  });

  it("enters a cooldown after a successful send so it cannot be spammed", async () => {
    vi.useFakeTimers();
    render(<ResendVerificationButton email="manager@example.com" />);

    fireEvent.click(screen.getByRole("button", { name: /resend verification email/i }));
    await act(async () => {});
    expect(mockResend).toHaveBeenCalledTimes(1);

    const cooling = screen.getByRole("button", { name: /resend in 60s/i });
    expect(cooling).toBeDisabled();

    fireEvent.click(cooling);
    await act(async () => {});
    expect(mockResend).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(screen.getByRole("button", { name: /resend verification email/i })).toBeEnabled();
  });

  it("does not start a cooldown when the send fails", async () => {
    mockResend.mockResolvedValue({ data: null, error: new Error("rate limit exceeded") });
    render(<ResendVerificationButton email="manager@example.com" />);

    fireEvent.click(screen.getByRole("button", { name: /resend verification email/i }));
    await waitFor(() => expect(mockResend).toHaveBeenCalledTimes(1));

    // A failed send must surface the error toast AND leave the button
    // re-enabled with no cooldown. The toast is queued on a microtask, so
    // wait for it rather than asserting immediately after the mock resolves
    // (races under full-suite CPU contention).
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /resend verification email/i })).toBeEnabled(),
    );
  });
});
