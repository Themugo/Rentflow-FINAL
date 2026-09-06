import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ManagerOperationsPreviewPage from "@/features/design-preview/pages/ManagerOperationsPreviewPage";
import { PUBLIC_ROUTES } from "@/features/marketing/publicConfig";

function renderPreview() {
  return render(
    <MemoryRouter>
      <ManagerOperationsPreviewPage />
    </MemoryRouter>,
  );
}

describe("Manager operations preview", () => {
  it("renders the command-centre hierarchy without invented metrics", () => {
    renderPreview();
    expect(screen.getByRole("link", { name: /skip to main content/i })).toHaveAttribute(
      "href",
      "#manager-operations-preview",
    );
    expect(screen.getByRole("heading", { level: 1, name: /good morning/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add property/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view reports/i })).toBeInTheDocument();
    // KPI labels
    for (const label of ["Properties", "Units", "Occupancy", "Collected"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    // Sections
    expect(screen.getByRole("heading", { name: "Portfolio performance" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Needs attention" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Properties" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recent collections" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Maintenance" })).toBeInTheDocument();
  });

  it("does not invent currency or client values", () => {
    renderPreview();
    expect(screen.queryByText(/KES/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/92%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/1.24M/i)).not.toBeInTheDocument();
  });

  it("links to the design bible from the header", () => {
    renderPreview();
    expect(screen.getByRole("link", { name: /design bible/i })).toHaveAttribute(
      "href",
      PUBLIC_ROUTES.designPreview,
    );
  });
});