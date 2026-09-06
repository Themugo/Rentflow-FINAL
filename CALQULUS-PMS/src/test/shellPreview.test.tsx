import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ShellPreviewPage from "@/features/design-preview/pages/ShellPreviewPage";
import { SHELL_PREVIEW_PORTALS } from "@/features/design-preview/shellPreviewConfig";
import { PUBLIC_ROUTES } from "@/features/marketing/publicConfig";

function renderPreview() {
  return render(
    <MemoryRouter>
      <ShellPreviewPage />
    </MemoryRouter>,
  );
}

describe("Authenticated shell preview", () => {
  it("renders a preview-only manager shell with skip link and page header", () => {
    renderPreview();
    expect(screen.getByRole("link", { name: /skip to main content/i })).toHaveAttribute(
      "href",
      "#shell-preview-main",
    );
    expect(screen.getByText(/phase 0a — chrome preview/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getAllByText(/dashboards are not redesigned in this phase/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /design bible/i })).toHaveAttribute(
      "href",
      PUBLIC_ROUTES.designPreview,
    );
  });

  it("switches portal identities without leaving the preview", () => {
    renderPreview();
    fireEvent.click(screen.getByRole("tab", { name: "Tenant" }));
    expect(screen.getByRole("heading", { level: 1, name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay now" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "WebHost" }));
    expect(screen.getByText(/proposed webhost identity/i)).toBeInTheDocument();
  });

  it("exposes loading, empty, and error canvas states", () => {
    renderPreview();
    fireEvent.click(screen.getByRole("button", { name: "Loading" }));
    expect(screen.getByText(/loading desk canvas/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Empty" }));
    expect(screen.getByText(/nothing on this desk yet/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Error" }));
    expect(screen.getByText(/desk could not load/i)).toBeInTheDocument();
  });

  it("covers every preview portal without inventing live dashboard metrics", () => {
    expect(SHELL_PREVIEW_PORTALS.map((item) => item.id)).toEqual([
      "manager",
      "landlord",
      "agency",
      "tenant",
      "admin",
      "webhost",
    ]);
    renderPreview();
    expect(screen.queryByText(/KES 1.24M/i)).not.toBeInTheDocument();
  });
});
