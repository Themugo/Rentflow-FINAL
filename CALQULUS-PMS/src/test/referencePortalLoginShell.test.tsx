import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ReferencePortalLoginShell, REFERENCE_PORTAL_LOGIN_CONFIG } from "@/features/auth/components/ReferencePortalLoginShell";

const portals = ["manager", "landlord", "tenant", "agency"] as const;

describe("reference portal login shell", () => {
  it.each(portals)("renders the supplied split-login composition for %s", (portal) => {
    render(
      <MemoryRouter>
        <ReferencePortalLoginShell portal={portal}>
          <form>
            <label htmlFor={`${portal}-email`}>Email address</label>
            <input id={`${portal}-email`} placeholder="Email address" />
            <label htmlFor={`${portal}-password`}>Password</label>
            <input id={`${portal}-password`} placeholder="Password" />
            <button type="submit">Login</button>
          </form>
        </ReferencePortalLoginShell>
      </MemoryRouter>,
    );

    const config = REFERENCE_PORTAL_LOGIN_CONFIG[portal];
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(config.title);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(config.subtitle);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Welcome Back!");
    expect(screen.getByText(new RegExp(`sign in to access your ${config.title.toLowerCase()} portal`, "i"))).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Email address")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in with Google" })).toBeInTheDocument();
    expect(screen.getByText("Secure")).toBeInTheDocument();
    expect(screen.getByText("Encrypted")).toBeInTheDocument();
    expect(screen.getByText("Protected")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Privacy/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Terms/i })).toBeInTheDocument();
  });

  it("keeps all four portal themes distinct and locally bundled", () => {
    const configs = portals.map((portal) => REFERENCE_PORTAL_LOGIN_CONFIG[portal]);
    expect(new Set(configs.map((config) => config.accent)).size).toBe(4);
    expect(new Set(configs.map((config) => config.background)).size).toBe(4);
    for (const config of configs) {
      expect(config.background).not.toMatch(/^https?:/);
    }
  });

  it("keeps the desktop composition at a 50/50 split", () => {
    const { container } = render(
      <MemoryRouter>
        <ReferencePortalLoginShell portal="manager">
          <form><button type="submit">Login</button></form>
        </ReferencePortalLoginShell>
      </MemoryRouter>,
    );
    expect(container.querySelector(".lg\\:grid-cols-2")).toBeTruthy();
  });
});
