import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd(), "src");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");

describe("CALQULUS mobile experience end-to-end contract", () => {
  it("uses one shared phone shell across every authenticated portal", () => {
    const shell = read("shared/components/layout/PortalDeskShell.tsx");
    for (const marker of ["MANAGER_MOBILE_NAV", "AGENCY_MOBILE_NAV", "LANDLORD_MOBILE_NAV", "TENANT_MOBILE_NAV", "WEBHOST_MOBILE_NAV"]) {
      expect(read("shared/navigation/portalNavigation.ts")).toContain(`export const ${marker}`);
    }
    expect(shell).toContain("mobile-app-surface");
    expect(shell).toContain("mobile-app-content");
    expect(shell).toContain("max-md:bottom-0");
    expect(shell).toContain("aria-label={`${navLabel} navigation`}");
  });

  it("turns the full navigation into a phone-friendly sheet instead of a desktop sidebar", () => {
    const shell = read("shared/components/layout/PortalDeskShell.tsx");
    expect(shell).toContain("max-md:h-[min(82dvh,720px)]");
    expect(shell).toContain("max-md:rounded-t-[1.5rem]");
    expect(shell).toContain("overscroll-contain");
    expect(shell).toContain("document.body.style.overflow = \"hidden\"");
    expect(shell).toContain('event.key === "Escape"');
  });

  it("keeps phone surfaces edge-to-edge and safe-area aware", () => {
    const css = read("index.css");
    expect(css).toContain("100dvh");
    expect(css).toContain("env(safe-area-inset-bottom");
    expect(css).toContain("env(safe-area-inset-top");
    expect(css).toContain("mobile-app-background");
    expect(css).toContain("scrollbar-width: none");
    expect(css).toContain("font-size: 16px");
  });

  it("ships an installable app identity", () => {
    const manifest = readFileSync(resolve(process.cwd(), "public/manifest.json"), "utf8");
    expect(manifest).toContain('"display": "standalone"');
    expect(manifest).toContain('"orientation": "portrait"');
    expect(manifest).toContain("calqulus-app-icon.svg");
    expect(manifest).toContain("pwa-512x512.png");
  });
});
