import { describe, expect, it } from "vitest";
import { publicStoragePath } from "@/features/settings/lib/storagePaths";

describe("settings storage paths", () => {
  it("extracts an owner-scoped path from a Supabase public URL", () => {
    expect(
      publicStoragePath(
        "https://project.supabase.co/storage/v1/object/public/profile-photos/user-123/profile.png?t=123",
        "profile-photos",
      ),
    ).toBe("user-123/profile.png");
  });

  it("returns null for URLs outside the expected bucket", () => {
    expect(
      publicStoragePath(
        "https://project.supabase.co/storage/v1/object/public/company-logos/user-123/logo.png",
        "profile-photos",
      ),
    ).toBeNull();
  });

  it("extracts an owner-scoped path from a signed storage URL", () => {
    expect(
      publicStoragePath(
        "https://project.supabase.co/storage/v1/object/sign/profile-photos/user-123/profile.png?token=abc",
        "profile-photos",
      ),
    ).toBe("user-123/profile.png");
  });
});
