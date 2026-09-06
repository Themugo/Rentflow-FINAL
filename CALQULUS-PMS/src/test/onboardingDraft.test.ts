import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useOnboardingDraft } from "@/features/onboarding/hooks/useOnboardingDraft";

describe("useOnboardingDraft", () => {
  it("starts empty and persists edits to sessionStorage", () => {
    const { result } = renderHook(() => useOnboardingDraft("organization", "user-1"));
    expect(result.current[0]).toBe("");

    act(() => result.current[1]("Acme Property Management"));
    expect(result.current[0]).toBe("Acme Property Management");

    const { result: remounted } = renderHook(() => useOnboardingDraft("organization", "user-1"));
    expect(remounted.current[0]).toBe("Acme Property Management");
  });

  it("clears the draft so saved state is not shadowed by stale input", () => {
    const { result } = renderHook(() => useOnboardingDraft("team-email", "user-1"));
    act(() => result.current[1]("teammate@example.com"));
    act(() => result.current[1](""));
    act(() => result.current[2]()); // clearDraft

    const { result: remounted } = renderHook(() => useOnboardingDraft("team-email", "user-1"));
    expect(remounted.current[0]).toBe("");
  });

  it("keys drafts per user so accounts on a shared browser never leak", () => {
    const { result: first } = renderHook(() => useOnboardingDraft("organization", "user-1"));
    act(() => first.current[1]("First Manager Ltd"));

    const { result: second } = renderHook(() => useOnboardingDraft("organization", "user-2"));
    expect(second.current[0]).toBe("");
  });

  it("keeps different fields on the same account independent", () => {
    const { result: org } = renderHook(() => useOnboardingDraft("organization", "user-1"));
    const { result: team } = renderHook(() => useOnboardingDraft("team-email", "user-1"));
    act(() => org.current[1]("Acme"));
    expect(team.current[0]).toBe("");
  });

  it("does nothing when there is no user id", () => {
    const { result } = renderHook(() => useOnboardingDraft("organization", null));
    act(() => result.current[1]("Acme"));
    expect(result.current[0]).toBe("Acme");
    const { result: remounted } = renderHook(() => useOnboardingDraft("organization", null));
    expect(remounted.current[0]).toBe("");
  });
});
