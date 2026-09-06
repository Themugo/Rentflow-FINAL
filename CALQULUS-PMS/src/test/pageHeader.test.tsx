import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { PortalAccentBar } from "@/core/design/PortalAccentBar";

describe("PageHeader", () => {
  it("states where the user is, what matters, and the available action", () => {
    render(
      <PageHeader
        title="Billing"
        description="Collect overdue invoices"
        actions={<button type="button">Issue invoice</button>}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Billing" })).toBeInTheDocument();
    expect(screen.getByText("Collect overdue invoices")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Issue invoice" })).toBeInTheDocument();
  });
});

describe("PortalAccentBar", () => {
  it("uses the portal accent token, not a hardcoded palette class", () => {
    const { container } = render(<PortalAccentBar />);
    expect(container.firstElementChild?.className).toContain("bg-[var(--portal-accent)]");
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  });
});
