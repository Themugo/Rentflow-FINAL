import { describe, expect, it } from "vitest";
import { paginate, sortBy, toggleSort } from "@/shared/lib/clientTable";

describe("clientTable helpers", () => {
  it("paginates a list without dropping items", () => {
    const items = [1, 2, 3, 4, 5];
    const first = paginate(items, 1, 2);
    expect(first.items).toEqual([1, 2]);
    expect(first.start).toBe(1);
    expect(first.end).toBe(2);
    expect(first.total).toBe(5);
    expect(first.totalPages).toBe(3);
    expect(paginate(items, 3, 2).items).toEqual([5]);
  });

  it("clamps out-of-range pages", () => {
    const page = paginate(["a", "b"], 99, 10);
    expect(page.page).toBe(1);
    expect(page.items).toEqual(["a", "b"]);
  });

  it("sorts strings and numbers", () => {
    const rows = [{ name: "Unit 10", rent: 20 }, { name: "Unit 2", rent: 40 }];
    expect(sortBy(rows, (r) => r.name, "asc").map((r) => r.name)).toEqual(["Unit 2", "Unit 10"]);
    expect(sortBy(rows, (r) => r.rent, "desc").map((r) => r.rent)).toEqual([40, 20]);
  });

  it("toggles sort direction on the same column", () => {
    expect(toggleSort("rent", "rent", "asc")).toEqual({ key: "rent", dir: "desc" });
    expect(toggleSort("rent", "name", "desc")).toEqual({ key: "name", dir: "asc" });
  });
});
