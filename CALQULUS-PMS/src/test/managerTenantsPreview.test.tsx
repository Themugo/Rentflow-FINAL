import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ManagerTenantsPreviewPage from "@/features/design-preview/pages/ManagerTenantsPreviewPage";
import { PUBLIC_ROUTES } from "@/features/marketing/publicConfig";

function renderPreview() {
  return render(
    <MemoryRouter>
      <ManagerTenantsPreviewPage />
    </MemoryRouter>,
  );
}

describe("Manager tenants layout preview", () => {
  it("renders tenants, detail, and leases chrome without invented metrics", () => {
    renderPreview();
    expect(screen.getByRole("link", { name: /skip to main content/i })).toHaveAttribute(
      "href",
      "#manager-tenants-preview",
    );
    expect(screen.getByRole("heading", { level: 1, name: "Tenants" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Invite tenant" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View leases" })).toBeInTheDocument();
    expect(screen.getByText("Property / Unit")).toBeInTheDocument();
    expect(screen.getByText("Rows populate from tenants, leases, and unpaid invoices.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Tenant detail" }));
    expect(screen.getByRole("heading", { level: 1, name: "Tenant" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View statement" })).toBeInTheDocument();
    for (const tab of ["Overview", "Lease", "Financial", "Payments", "Documents", "Activity"]) {
      expect(screen.getByText(tab)).toBeInTheDocument();
    }
    expect(screen.getAllByText("Maintenance").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("tab", { name: "Leases" }));
    expect(screen.getByRole("heading", { level: 1, name: "Leases" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create lease" })).toBeInTheDocument();
    expect(screen.getByText("Start date")).toBeInTheDocument();
    expect(screen.getByText("Expiry")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Expiring soon")).toBeInTheDocument();
    expect(screen.getByText("Expired")).toBeInTheDocument();
    expect(screen.getByText("Rows populate from leases and tenant records. Expiry uses the stored end date.")).toBeInTheDocument();

    expect(screen.queryByText(/KES 1.24M/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/92%/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /design bible/i })).toHaveAttribute(
      "href",
      PUBLIC_ROUTES.designPreview,
    );
  });
});
