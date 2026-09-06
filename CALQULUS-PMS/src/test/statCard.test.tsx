import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Home } from "lucide-react";
import { StatCard } from "@/features/dashboard/components/StatCard";

describe("StatCard", () => {
  it("states the metric without hover motion or gradient wells", () => {
    const { container } = render(
      <StatCard title="Occupancy" value="92%" change="12 occupied" icon={Home} />,
    );
    expect(screen.getByText("Occupancy")).toBeInTheDocument();
    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(container.firstElementChild?.className).not.toContain("hover:-translate-y");
    expect(container.innerHTML).not.toContain("bg-gradient-to-br");
  });

  it("uses restrained type when compact", () => {
    const { container } = render(
      <StatCard compact title="Properties" value="4" icon={Home} />,
    );
    const value = screen.getByText("4");
    expect(value.className).toContain("text-xl");
    expect(container.firstElementChild?.className).toContain("rounded-xl");
  });
});
