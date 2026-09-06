import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ManagerDashboardPreviewPage from "@/features/design-preview/pages/ManagerDashboardPreviewPage";
import { PUBLIC_ROUTES } from "@/features/marketing/publicConfig";

function renderPreview() {
  return render(
    <MemoryRouter>
      <ManagerDashboardPreviewPage />
    </MemoryRouter>,
  );
}

describe("Manager dashboard layout preview", () => {
  it("renders the executive operations hierarchy without invented metrics", () => {
    renderPreview();
    expect(screen.getByRole("link", { name: /skip to main content/i })).toHaveAttribute(
      "href",
      "#manager-dashboard-preview",
    );
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Portfolio overview and today's operational priorities.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add property" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View reports" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Attention" })).toBeInTheDocument();
    expect(screen.getByText("Overdue payments")).toBeInTheDocument();
    expect(screen.getByText("Open maintenance")).toBeInTheDocument();
    expect(screen.getByText("Expiring leases")).toBeInTheDocument();
    expect(screen.getByText("Pending actions")).toBeInTheDocument();
    expect(screen.getByText("Properties")).toBeInTheDocument();
    expect(screen.getByText("Units")).toBeInTheDocument();
    expect(screen.getAllByText("Occupancy").length).toBeGreaterThan(0);
    expect(screen.getByText("Collections")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Collections performance" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Occupancy" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Maintenance" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recent activity" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Upcoming actions" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Property performance" })).toBeInTheDocument();
    expect(screen.getAllByText("Live value").length).toBe(4);
    expect(screen.queryByText(/KES 1.24M/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/92%/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /design bible/i })).toHaveAttribute(
      "href",
      PUBLIC_ROUTES.designPreview,
    );
  });
});
