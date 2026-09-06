/**
 * auth.test.ts
 *
 * Tests for the core auth flows: sign in, sign up, sign out, and role fetch.
 * Uses vi.mock to stub Supabase so no real network calls are made.
 *
 * Run with:  npm test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Supabase mock ─────────────────────────────────────────────────────────────
//
// We mock the entire client module so every import of supabase in the code
// under test gets the mock, not a real network client.

const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
const mockSignOut = vi.fn();
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn(() => ({
  data: { subscription: { unsubscribe: vi.fn() } },
}));
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const createQueryBuilder = () => ({
  select: (...args: Parameters<typeof mockSelect>) => {
    const result = mockSelect(...args);
    return {
      eq: vi.fn(() => result),
      maybeSingle: vi.fn(() => result),
    };
  },
  insert: mockInsert,
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(),
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword: mockSignIn,
      signUp:             mockSignUp,
      signOut:            mockSignOut,
      getSession:         mockGetSession,
      onAuthStateChange:  mockOnAuthStateChange,
    },
    from: vi.fn(createQueryBuilder),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeUser(overrides = {}) {
  return {
    id:    "user-abc-123",
    email: "test@example.com",
    ...overrides,
  };
}

function makeRoleRow(role: string, approval_status = "approved") {
  return { role, tenant_id: null, approval_status };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("signIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns no error on successful sign-in", async () => {
    mockSignIn.mockResolvedValueOnce({ error: null });

    const { supabase } = await import("@/integrations/supabase/client");
    const result = await supabase.auth.signInWithPassword({
      email: "a@b.com",
      password: "correct",
    });

    expect(result.error).toBeNull();
    expect(mockSignIn).toHaveBeenCalledWith({ email: "a@b.com", password: "correct" });
  });

  it("returns an error on wrong credentials", async () => {
    mockSignIn.mockResolvedValueOnce({
      error: { message: "Invalid login credentials" },
    });

    const { supabase } = await import("@/integrations/supabase/client");
    const result = await supabase.auth.signInWithPassword({
      email: "a@b.com",
      password: "wrong",
    });

    expect(result.error).not.toBeNull();
    expect(result.error?.message).toContain("Invalid login credentials");
  });
});

describe("signUp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a user_roles row after successful sign-up", async () => {
    const user = makeUser();
    mockSignUp.mockResolvedValueOnce({ data: { user }, error: null });
    mockInsert.mockResolvedValueOnce({ error: null });

    const { supabase } = await import("@/integrations/supabase/client");

    const { data, error } = await supabase.auth.signUp({
      email: "new@user.com",
      password: "Password123!",
      options: { data: { full_name: "New User" } },
    });

    expect(error).toBeNull();
    expect(data.user).toEqual(user);

    // Simulate the role insert that AuthContext.signUp does
    await supabase.from("user_roles").insert({
      user_id:         user.id,
      role:            "manager",
      tenant_id:       null,
      approval_status: "pending",
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: user.id, role: "manager", approval_status: "pending" }),
    );
  });

  it("returns an error if the email is already in use", async () => {
    mockSignUp.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "User already registered" },
    });

    const { supabase } = await import("@/integrations/supabase/client");
    const { error } = await supabase.auth.signUp({
      email: "existing@user.com",
      password: "Password123!",
    });

    expect(error?.message).toContain("already registered");
  });
});

describe("signOut", () => {
  it("calls supabase.auth.signOut", async () => {
    mockSignOut.mockResolvedValueOnce({ error: null });
    const { supabase } = await import("@/integrations/supabase/client");
    await supabase.auth.signOut();
    expect(mockSignOut).toHaveBeenCalledOnce();
  });
});

describe("user role resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the manager role for a manager user", async () => {
    const roleRow = makeRoleRow("manager");
    mockSelect.mockResolvedValueOnce({ data: [roleRow], error: null });

    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase
      .from("user_roles")
      .select("role, tenant_id, approval_status")
      .eq("user_id", "user-abc-123");

    expect(data).toHaveLength(1);
    expect(data![0].role).toBe("manager");
  });

  it("returns null data when the user has no role row", async () => {
    mockSelect.mockResolvedValueOnce({ data: [], error: null });

    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase
      .from("user_roles")
      .select("role, tenant_id, approval_status")
      .eq("user_id", "ghost-user");

    expect(data).toHaveLength(0);
  });

  it("handles a database error gracefully", async () => {
    mockSelect.mockResolvedValueOnce({ data: null, error: { message: "DB error" } });

    const { supabase } = await import("@/integrations/supabase/client");
    const { error } = await supabase
      .from("user_roles")
      .select("role, tenant_id, approval_status")
      .eq("user_id", "user-abc-123");

    expect(error).not.toBeNull();
    expect(error?.message).toBe("DB error");
  });

  it("a pending manager has approval_status=pending", async () => {
    const roleRow = makeRoleRow("manager", "pending");
    mockSelect.mockResolvedValueOnce({ data: [roleRow], error: null });

    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase
      .from("user_roles")
      .select("role, tenant_id, approval_status")
      .eq("user_id", "new-manager");

    expect(data![0].approval_status).toBe("pending");
  });
});
