import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TenantPortalShell, TENANT_ACCENT } from "@/features/auth/components/TenantPortalChrome";

function renderShell() {
  return render(
    <MemoryRouter>
      <TenantPortalShell>
        <form onSubmit={(e) => e.preventDefault()}>
          <button type="submit">Sign in</button>
        </form>
      </TenantPortalShell>
    </MemoryRouter>,
  );
}

describe("Tenant portal entry chrome", () => {
  it("renders the two-line Tenant / Portal headline", () => {
    renderShell();
    const headline = screen.getByRole("heading", { level: 1 });
    expect(headline).toHaveTextContent(/tenant/i);
    expect(headline).toHaveTextContent(/portal/i);
    expect(headline.querySelectorAll("span.block").length).toBe(2);
  });

  it("uses the tenant violet accent and residential property-photo background", () => {
    const { container } = renderShell();
    const bgImage = container.querySelector('img[alt=""]');
    expect(bgImage).not.toBeNull();
    expect(bgImage?.getAttribute("src")).toMatch(/property-residential/);
    expect(TENANT_ACCENT).toBe("#7C5FD3");
  });

  it("carries the CALQULUS brand mark and portal description", () => {
    renderShell();
    expect(screen.getAllByText(/CALQULUS/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/your home, connected/i)).toBeInTheDocument();
  });

  it("renders the child sign-in form passed to it", () => {
    renderShell();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });
});
