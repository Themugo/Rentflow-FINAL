import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PublicLandingPage } from "@/features/marketing/PublicLandingPage";
import { PUBLIC_ROUTES } from "@/features/marketing/publicConfig";

function renderAt(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <PublicLandingPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PublicLandingPage", () => {
  it("renders the approved hero hierarchy with a single h1", () => {
    renderAt("/");
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("One Platform. Every Property. A Better Tomorrow.");
    expect(screen.getByText(/manage, automate and grow your real estate portfolio/i)).toBeInTheDocument();
  });

  it("keeps working portal routes on the hero and final CTA", () => {
    renderAt("/");
    expect(screen.getByRole("link", { name: /get started/i })).toHaveAttribute(
      "href",
      PUBLIC_ROUTES.managerSignUp,
    );
    expect(screen.getByRole("link", { name: /explore portals/i })).toHaveAttribute("href", "#portals");
  });

  it("uses only working primary navigation in a compact order", () => {
    renderAt("/");
    const primary = screen.getByRole("navigation", { name: "Primary" });
    const labels = within(primary)
      .getAllByRole("link")
      .map((link) => link.textContent);
    expect(labels).toEqual(["Home", "Properties", "Portals", "Insights", "Pricing"]);
    expect(primary).not.toHaveTextContent("Platform");
    expect(primary).not.toHaveTextContent("Solutions");
    expect(primary).not.toHaveTextContent("Resources");
    expect(primary).not.toHaveTextContent("Contact");
    const header = screen.getByRole("banner");
    expect(within(header).getByRole("link", { name: /login/i })).toHaveAttribute(
      "href",
      PUBLIC_ROUTES.managerSignIn,
    );
    expect(within(header).getByRole("link", { name: /get started/i })).toHaveAttribute(
      "href",
      PUBLIC_ROUTES.managerSignUp,
    );
  });


  it("keeps the pricing route reachable and free of fabricated prices on the homepage", () => {
    renderAt("/");
    const pricingLinks = screen.getAllByRole("link", { name: /pricing/i });
    expect(pricingLinks.some((link) => link.getAttribute("href") === PUBLIC_ROUTES.pricing)).toBe(true);
    expect(screen.queryByText(/\/ property \/ month/i)).not.toBeInTheDocument();
  });

  it("renders the pricing page without duplicating the homepage h1", () => {
    renderAt("/pricing");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Simple pricing for property operations.",
    );
    expect(screen.getAllByText(/\/ property \/ month/i).length).toBeGreaterThan(0);
  });

  it("defaults to a calm 30-second hero cadence with a configurable transition", () => {
    const source = require("node:fs").readFileSync("src/features/marketing/publicSiteConfig.ts", "utf8");
    expect(source).toContain("intervalMs: 30000");
    expect(source).toContain("transitionMs: 900");
  });

  it("uses the current blue public chrome without dead platform anchors", () => {
    const { container } = renderAt("/");
    expect(container.querySelector(".public-canvas")).toBeTruthy();
    const header = screen.getByRole("banner");
    expect(header.className).toMatch(/bg-\[\#123FB7\]/);
    expect(container.querySelector("footer")).toBeTruthy();
    expect(container.querySelector("#platform")).toBeNull();
    expect(container.querySelector("#solutions")).toBeNull();
  });

  it("keeps the approved public sections available", () => {
    renderAt("/");
    for (const heading of [
      /choose your portal to get started/i,
      /different properties\. smarter management/i,
      /discover premium properties/i,
      /built for serious property operations/i,
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
  });



  it("does not fabricate certifications or fake social links", () => {
    renderAt("/");
    expect(screen.queryByText(/SOC ?2/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ISO ?\d{4,5}/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/PCI/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /linkedin|facebook|instagram/i })).not.toBeInTheDocument();
  });

  it("renders a deep-navy final CTA with get-started and sign-in actions", () => {
    renderAt("/");
    const heading = screen.getByRole("heading", {
      name: /join thousands of property professionals already growing with calqulus\./i,
    });
    const ctaSection = heading.closest("section");
    expect(ctaSection).not.toBeNull();
    expect(ctaSection!.className).toMatch(/bg-\[linear-gradient/);
    expect(within(ctaSection as HTMLElement).getByRole("link", { name: /get started/i })).toHaveAttribute(
      "href",
      PUBLIC_ROUTES.managerSignUp,
    );
    expect(within(ctaSection as HTMLElement).getByRole("link", { name: /contact sales/i })).toHaveAttribute(
      "href",
      "mailto:enterprise@calqulusrms.com",
    );
  });
});
