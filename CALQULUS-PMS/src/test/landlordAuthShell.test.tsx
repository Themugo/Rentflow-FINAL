import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LandlordPortalShell, LANDLORD_ACCENT } from "@/features/auth/components/LandlordPortalChrome";

function renderShell() {
  return render(
    <MemoryRouter>
      <LandlordPortalShell>
        <form onSubmit={(e) => e.preventDefault()}>
          <button type="submit">Sign in</button>
        </form>
      </LandlordPortalShell>
    </MemoryRouter>,
  );
}

describe("Landlord portal entry chrome", () => {
  it("renders the two-line Landlord / Portal headline", () => {
    renderShell();
    const headline = screen.getByRole("heading", { level: 1 });
    expect(headline).toHaveTextContent(/landlord/i);
    expect(headline).toHaveTextContent(/portal/i);
    expect(headline.querySelectorAll("span.block").length).toBe(2);
  });

  it("uses the landlord emerald accent and property-photo background", () => {
    const { container } = renderShell();
    const bgImage = container.querySelector('img[alt=""]');
    expect(bgImage).not.toBeNull();
    expect(bgImage?.getAttribute("src")).toMatch(/property-commercial/);
    expect(LANDLORD_ACCENT).toBe("#0F8A6A");
  });

  it("carries the CALQULUS brand mark and portal description", () => {
    renderShell();
    expect(screen.getAllByText(/CALQULUS/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/see how your properties are performing/i)).toBeInTheDocument();
  });

  it("renders the child sign-in form passed to it", () => {
    renderShell();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });
});
