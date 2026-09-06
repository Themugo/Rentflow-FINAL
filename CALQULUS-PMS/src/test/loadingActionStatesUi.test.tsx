import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Phases 160-161 loading, empty, error and action state UX", () => {
  const root = resolve(process.cwd(), "src");
  const read = (file: string) => readFileSync(resolve(root, file), "utf8");

  it("keeps shared loading state accessible and supports compact inline loading", () => {
    const source = read("shared/components/ui/loading-state.tsx");
    expect(source).toContain('variant?: "spinner" | "skeleton" | "inline"');
    expect(source).toContain('role="status"');
    expect(source).toContain('aria-busy="true"');
    expect(source).toContain('variant === "inline"');
  });

  it("uses shared loading states in property sub-record views", () => {
    for (const file of [
      "features/properties/components/PropertyAgreementsTab.tsx",
      "features/properties/components/PropertyInvoicesTab.tsx",
      "features/properties/components/PropertyVacationNoticesTab.tsx",
      "features/properties/components/PropertyMaintenanceTab.tsx",
    ]) {
      const source = read(file);
      expect(source).toContain("LoadingState");
      expect(source).toContain('variant="inline"');
      expect(source).not.toContain('>Loading...</div>');
    }
  });

  it("uses button loading semantics for primary property and invoice saves", () => {
    const properties = read("features/properties/pages/Properties.tsx");
    expect(properties).toContain('loading={isSaving}>Add Property</Button>');
    expect(properties).toContain('loading={isSaving}>Save Changes</Button>');

    const billing = read("features/billing/pages/Billing.tsx");
    expect(billing).toContain('loading={updateMutation.isPending}');
    expect(billing).not.toContain('disabled={updateMutation.isPending}');
  });

  it("keeps retryable errors and intentional empty states in the major portfolio flows", () => {
    const dashboard = read("features/dashboard/pages/Dashboard.tsx");
    const properties = read("features/properties/pages/Properties.tsx");
    expect(dashboard).toContain("<ErrorState");
    expect(dashboard).toContain("onRetry={refreshStats}");
    expect(properties).toContain("<EmptyState");
    expect(properties).toContain("onRetry={() => { void fetchData(); }}");
  });
});
