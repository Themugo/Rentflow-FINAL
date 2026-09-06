import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Phases 162–163 accessibility and keyboard interaction structure", () => {
  it("keeps dialog and sheet surfaces visibly focusable", () => {
    const dialog = read("src/shared/components/ui/dialog.tsx");
    const sheet = read("src/shared/components/ui/sheet.tsx");
    expect(dialog).toContain("focus-visible:ring-2");
    expect(sheet).toContain("focus-visible:ring-2");
  });

  it("requires an accessible name for the tenant transfer icon action", () => {
    const source = read("src/features/tenants/components/TenantTransferDialog.tsx");
    expect(source).toContain('aria-label="Transfer tenant"');
  });

  it("gives the password visibility control an accessible name and touch target", () => {
    const source = read("src/features/landlord/pages/LandlordInvitationAccept.tsx");
    const css = read("src/index.css");
    expect(source).toContain('aria-label={showPassword ? "Hide password" : "Show password"}');
    expect(source).toContain("touch-target");
    expect(css).toContain(".touch-target");
  });
});
