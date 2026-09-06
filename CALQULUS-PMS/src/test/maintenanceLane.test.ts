import { describe, expect, it } from "vitest";
import {
  countMaintenanceLanes,
  MAINTENANCE_LANES,
  maintenanceLane,
  matchesMaintenanceLane,
} from "@/features/maintenance/lib/maintenanceLane";

describe("maintenance lanes", () => {
  it("names the five operations lanes", () => {
    expect(MAINTENANCE_LANES.map((lane) => lane.label)).toEqual([
      "New",
      "Assigned",
      "In Progress",
      "Awaiting",
      "Completed",
    ]);
  });

  it("splits open tickets by whether a technician is assigned", () => {
    expect(maintenanceLane("open", null)).toBe("new");
    expect(maintenanceLane("open", "  ")).toBe("new");
    expect(maintenanceLane("open", "James Mwangi")).toBe("assigned");
  });

  it("maps existing statuses without inventing columns", () => {
    expect(maintenanceLane("in_progress", "James")).toBe("in_progress");
    expect(maintenanceLane("pending", null)).toBe("awaiting");
    expect(maintenanceLane("completed", "James")).toBe("completed");
    expect(maintenanceLane("cancelled", null)).toBe("completed");
    expect(maintenanceLane("unknown", null)).toBeNull();
  });

  it("filters and counts by lane", () => {
    const rows = [
      { status: "open", assigned_to: null },
      { status: "open", assigned_to: "Aisha" },
      { status: "in_progress", assigned_to: "Aisha" },
      { status: "pending", assigned_to: null },
      { status: "completed", assigned_to: "Aisha" },
      { status: "cancelled", assigned_to: null },
    ];
    expect(matchesMaintenanceLane("open", null, "new")).toBe(true);
    expect(matchesMaintenanceLane("cancelled", null, "completed")).toBe(true);
    expect(countMaintenanceLanes(rows)).toEqual({
      new: 1,
      assigned: 1,
      in_progress: 1,
      awaiting: 1,
      completed: 2,
    });
  });
});
