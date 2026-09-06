import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AgencyDashboardPreviewPage from "@/features/design-preview/pages/AgencyDashboardPreviewPage";
import { PUBLIC_ROUTES } from "@/features/marketing/publicConfig";

function renderPreview() {
  return render(
    <MemoryRouter>
      <AgencyDashboardPreviewPage />
    </MemoryRouter>,
  );
}

describe("Agency dashboard layout preview", () => {
  it("renders the executive command-centre hierarchy without invented metrics", () => {
    renderPreview();
    expect(screen.getByRole("link", { name: /skip to main content/i })).toHaveAttribute(
      "href",
      "#agency-dashboard-preview",
    );
    expect(screen.getByRole("heading", { level: 1, name: "Your agency at a glance." })).toBeInTheDocument();

    // Executive summary KPI row
    expect(screen.getByRole("region", { name: /executive summary/i })).toBeInTheDocument();
    expect(screen.getAllByText("Clients").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Collections").length).toBeGreaterThan(0);

    // Portfolio performance hero card
    expect(screen.getByRole("heading", { name: "Portfolio performance" })).toBeInTheDocument();

    // Needs attention
    expect(screen.getByRole("heading", { name: "Needs attention" })).toBeInTheDocument();
    expect(screen.getByText("Overdue invoices")).toBeInTheDocument();
    expect(screen.getByText("Expiring leases")).toBeInTheDocument();

    // Client portfolio performance
    expect(screen.getByRole("heading", { name: "Client portfolio performance" })).toBeInTheDocument();

    // Quick actions
    expect(screen.getByRole("heading", { name: "Quick actions" })).toBeInTheDocument();
  });

  it("does not invent client rows or currency figures", () => {
    renderPreview();
    expect(screen.queryByText(/KES/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/1\.24M/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/92%/)).not.toBeInTheDocument();
  });

  it("links back to the design bible", () => {
    renderPreview();
    expect(screen.getByRole("link", { name: /design bible/i })).toHaveAttribute(
      "href",
      PUBLIC_ROUTES.designPreview,
    );
  });
});