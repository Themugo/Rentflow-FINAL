import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ManagerPortalShell, MANAGER_ACCENT } from "@/features/auth/components/ManagerPortalChrome";

function renderShell() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
      <ManagerPortalShell>
        <form onSubmit={(e) => e.preventDefault()}>
          <input type="email" aria-label="Email address" />
          <button type="submit">Sign in</button>
        </form>
      </ManagerPortalShell>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Manager portal entry chrome", () => {
  it("renders the two-line Manager / Portal headline", () => {
    renderShell();
    const headline = screen.getByRole("heading", { level: 1 });
    expect(headline).toHaveTextContent(/manager/i);
    expect(headline).toHaveTextContent(/portal/i);
    expect(headline.querySelectorAll("span.block").length).toBe(2);
  });

  it("uses the manager deep-navy accent and property-photo background", () => {
    const { container } = renderShell();
    const bgImage = container.querySelector('img[alt=""]');
    expect(bgImage).not.toBeNull();
    expect(bgImage?.getAttribute("src")).toMatch(/property-residential/);
    expect(MANAGER_ACCENT).toBe("#31577E");
  });

  it("carries the CALQULUS brand mark and portal description", () => {
    renderShell();
    expect(screen.getAllByText(/CALQULUS/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/run properties, tenants, leases, billing, payments and maintenance/i),
    ).toBeInTheDocument();
  });

  it("renders the child sign-in form passed to it", () => {
    renderShell();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });
});
