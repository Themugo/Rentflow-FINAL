import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

describe("Manager properties, property detail, and units layout contracts", () => {
  it("keeps Properties as a live data table with search, filter, view, and CRUD", () => {
    const properties = src("src/features/properties/pages/Properties.tsx");
    expect(properties).toContain('title="Properties"');
    expect(properties).toContain("Add property");
    // Search now goes through the shared SearchFilterBar, which takes the
    // accessible name as an `ariaLabel` prop rather than a raw attribute.
    expect(properties).toContain('ariaLabel="Search properties"');
    expect(properties).toContain('aria-label="Filter properties"');
    expect(properties).toContain('<Link to="/units">View units</Link>');
    expect(properties).toContain("<TableHead>Property</TableHead>");
    expect(properties).toContain("<TableHead>Category</TableHead>");
    expect(properties).toContain("<TableHead>Units</TableHead>");
    expect(properties).toContain("<TableHead>Occupancy</TableHead>");
    expect(properties).toContain("<TableHead>Tenants</TableHead>");
    expect(properties).toContain("<TableHead>Revenue</TableHead>");
    expect(properties).toContain("EmptyState");
    expect(properties).toContain("LoadingState");
    expect(properties).toContain("ErrorState");
    expect(properties).toContain("handleAddProperty");
    expect(properties).toContain("handleUpdateProperty");
    expect(properties).toContain("handleDeleteProperty");
    expect(properties).toContain('.from("properties")');
    expect(properties).not.toMatch(/KES 1\.24M/);

    const row = src("src/features/properties/components/PropertyTableRow.tsx");
    expect(row).toContain("aria-label={`View ${property.name}`}");
    expect(row).toContain("View Details");
    expect(row).toContain("Edit Property");
    expect(row).toContain("Deactivate");
  });

  it("gives property detail a live overview, summary metrics, and existing tabs", () => {
    const detail = src("src/features/properties/pages/PropertyDetail.tsx");
    expect(detail).toContain("searchParams.get(\"tab\") || \"overview\"");
    expect(detail).toContain("title={property.name}");
    expect(detail).toContain("subtitle={property.address}");
    expect(detail).toContain("Add tenant");
    expect(detail).toContain('title="Units"');
    expect(detail).toContain('title="Occupancy"');
    expect(detail).toContain('title="Rent"');
    expect(detail).toContain('title="Outstanding"');
    expect(detail).toContain('title="Maintenance"');
    expect(detail).toContain("Active leases");
    expect(detail).toContain(".from(\"invoices\")");
    expect(detail).toContain(".from(\"maintenance_requests\")");
    expect(detail).toContain('value="overview"');
    expect(detail).toContain('value="units"');
    expect(detail).toContain('value="tenants"');
    expect(detail).toContain('value="leases"');
    expect(detail).toContain('value="billing"');
    expect(detail).toContain('value="maintenance"');
    expect(detail).toContain('value="agreements"');
    expect(detail).toContain("Documents");
    expect(detail).toContain('value="vacation"');
    expect(detail).toContain('value="water"');
    expect(detail).toContain('value="statement"');
    expect(detail).toContain('value="landlord"');
    expect(detail).toContain('value="settings"');
    expect(detail).toContain('value="history"');
    expect(detail).toContain("UnitManagement");
    expect(detail).toContain("AddTenantToPropertyDialog");
    expect(detail).not.toMatch(/KES 1\.24M/);
  });

  it("lists portfolio units from live records with semantic status", () => {
    const units = src("src/features/units/pages/Units.tsx");
    expect(units).toContain('title="Units"');
    expect(units).toContain("<TableHead>Unit</TableHead>");
    expect(units).toContain("<TableHead>Property</TableHead>");
    expect(units).toContain("<TableHead>Tenant</TableHead>");
    expect(units).toContain("<TableHead>Status</TableHead>");
    expect(units).toContain("<TableHead>Rent</TableHead>");
    expect(units).toContain("<TableHead>Lease</TableHead>");
    expect(units).toContain("<TableHead className=\"text-right\">Balance</TableHead>");
    expect(units).toContain("fetchPortfolioUnits");
    expect(units).toContain("statusBadgeClass");
    expect(units).toContain("EmptyState");
    expect(units).toContain("LoadingState");
    expect(units).toContain("ErrorState");
    expect(units).not.toMatch(/KES 1\.24M/);

    const fetch = src("src/features/units/lib/portfolioUnits.ts");
    expect(fetch).toContain('.from("properties")');
    expect(fetch).toContain('.from("units")');
    expect(fetch).toContain('.from("tenants")');
    expect(fetch).toContain('.from("leases")');
    expect(fetch).toContain('.from("invoices")');
    expect(fetch).toContain("Do not invent");
  });

  it("preserves unit CRUD forms on the property record", () => {
    const management = src("src/features/units/components/UnitManagement.tsx");
    expect(management).toContain("Add House");
    expect(management).toContain("Update House");
    expect(management).toContain("Bulk create");
    expect(management).toContain("EmptyState");
    expect(management).toContain("LoadingState");
    expect(management).toContain("ErrorState");
    expect(management).toContain("<TableHead>Unit</TableHead>");
  });

  it("registers the units route and sidebar entry for managers", () => {
    const routes = src("src/app/routes.ts");
    expect(routes).toContain('{ path: "/units", element: Units, protected: true, permission: "view_properties" }');
    expect(routes).toContain("MANAGER_PROPERTIES_PREVIEW_PATH");

    // Sidebar now derives its items from the shared navigation module.
    const nav = src("src/shared/navigation/portalNavigation.ts");
    expect(nav).toContain('{ label: "Units", href: "/units", icon: Layers, permission: "view_properties" }');

    const roles = src("src/features/auth/lib/roleResolution.ts");
    expect(roles).toContain('"/units"');
  });
});
