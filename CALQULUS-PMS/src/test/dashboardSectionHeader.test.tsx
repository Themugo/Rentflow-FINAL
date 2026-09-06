import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardSectionHeader } from "@/features/dashboard/components/DashboardSectionHeader";

describe("DashboardSectionHeader", () => {
  it("renders hierarchy and optional description", () => {
    render(
      <DashboardSectionHeader
        eyebrow="Cash flow"
        title="Collections performance"
        description="Collected versus expected rent"
      />,
    );

    expect(screen.getByText("Cash flow")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Collections performance" })).toBeInTheDocument();
    expect(screen.getByText("Collected versus expected rent")).toBeInTheDocument();
  });
});
