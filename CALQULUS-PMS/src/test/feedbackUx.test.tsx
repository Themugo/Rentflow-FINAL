import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("feedback UX", () => {
  it("defines semantic feedback variants and shared helpers", () => {
    const toast = readFileSync("src/shared/components/ui/toast.tsx", "utf8");
    const helper = readFileSync("src/shared/lib/feedbackToast.ts", "utf8");
    expect(toast).toContain("success:");
    expect(toast).toContain("warning:");
    expect(toast).toContain("info:");
    expect(helper).toContain("successToast");
    expect(helper).toContain("warningToast");
    expect(helper).toContain("infoToast");
  });

  it("keeps property deactivation explicitly destructive and loading-aware", () => {
    const source = readFileSync("src/features/properties/pages/Properties.tsx", "utf8");
    expect(source).toContain('aria-label={`Deactivate ${deleteProperty?.name ?? "property"}`}');
    expect(source).toContain(`isDeleting ? "Deactivating…" : "Deactivate"`);
    expect(source).toContain(`successToast({ title: "Property Deactivated"`);
  });
});
