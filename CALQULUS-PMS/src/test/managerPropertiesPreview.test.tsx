import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ManagerPropertiesPreviewPage from "@/features/design-preview/pages/ManagerPropertiesPreviewPage";
import { PUBLIC_ROUTES } from "@/features/marketing/publicConfig";

function renderPreview() {
  return render(
    <MemoryRouter>
      <ManagerPropertiesPreviewPage />
    </MemoryRouter>,
  );
}

describe("Manager properties layout preview", () => {
  it("renders properties, detail, and units chrome without invented metrics", () => {
    renderPreview();
    expect(screen.getByRole("link", { name: /skip to main content/i })).toHaveAttribute(
      "href",
      "#manager-properties-preview",
    );
    expect(screen.getByRole("heading", { level: 1, name: "Properties" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add property" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View units" })).toBeInTheDocument();
    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.getByText("Filter")).toBeInTheDocument();
    expect(screen.getByText("View")).toBeInTheDocument();
    expect(screen.getByText("Property")).toBeInTheDocument();
    expect(screen.getByText("Category")).toBeInTheDocument();
    expect(screen.getByText("Rows populate from the manager's properties.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Property detail" }));
    expect(screen.getByRole("heading", { level: 1, name: "Property name" })).toBeInTheDocument();
    expect(screen.getByText("Location from the property record.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add tenant" })).toBeInTheDocument();
    for (const label of ["Occupancy", "Rent", "Outstanding", "Overview", "Tenants", "Leases", "Billing", "Documents"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText("Units").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Maintenance").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Live value").length).toBe(5);

    fireEvent.click(screen.getByRole("tab", { name: "Units" }));
    expect(screen.getByRole("heading", { level: 1, name: "Units" })).toBeInTheDocument();
    expect(screen.getByText("Unit")).toBeInTheDocument();
    expect(screen.getByText("Tenant")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Lease")).toBeInTheDocument();
    expect(screen.getByText("Balance")).toBeInTheDocument();
    expect(screen.getByText("Rows populate from units, tenants, leases, and unpaid invoices.")).toBeInTheDocument();

    expect(screen.queryByText(/KES 1.24M/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/92%/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /design bible/i })).toHaveAttribute(
      "href",
      PUBLIC_ROUTES.designPreview,
    );
  });
});
