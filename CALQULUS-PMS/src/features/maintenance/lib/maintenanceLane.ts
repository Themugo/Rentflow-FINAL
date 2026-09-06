/**
 * Map live maintenance_requests rows onto the five operations lanes.
 *
 * Status values already stored: open | pending | in_progress | completed | cancelled.
 * Assigned vs new is derived from assigned_to — there is no separate assigned status.
 */

export type MaintenanceLane = "new" | "assigned" | "in_progress" | "awaiting" | "completed";

export const MAINTENANCE_LANES: { id: MaintenanceLane; label: string }[] = [
  { id: "new", label: "New" },
  { id: "assigned", label: "Assigned" },
  { id: "in_progress", label: "In Progress" },
  { id: "awaiting", label: "Awaiting" },
  { id: "completed", label: "Completed" },
];

export function isAssignedTechnician(assignedTo: string | null | undefined): boolean {
  return Boolean(assignedTo && assignedTo.trim());
}

export function maintenanceLane(
  status: string | null | undefined,
  assignedTo: string | null | undefined,
): MaintenanceLane | null {
  const assigned = isAssignedTechnician(assignedTo);
  if (status === "pending") return "awaiting";
  if (status === "in_progress") return "in_progress";
  if (status === "completed" || status === "cancelled") return "completed";
  if (status === "open") return assigned ? "assigned" : "new";
  return null;
}

export function matchesMaintenanceLane(
  status: string | null | undefined,
  assignedTo: string | null | undefined,
  lane: MaintenanceLane | "all",
): boolean {
  if (lane === "all") return true;
  return maintenanceLane(status, assignedTo) === lane;
}

export function countMaintenanceLanes<T extends { status?: string | null; assigned_to?: string | null }>(
  requests: T[],
): Record<MaintenanceLane, number> {
  const counts: Record<MaintenanceLane, number> = {
    new: 0,
    assigned: 0,
    in_progress: 0,
    awaiting: 0,
    completed: 0,
  };
  for (const request of requests) {
    const lane = maintenanceLane(request.status, request.assigned_to);
    if (lane) counts[lane] += 1;
  }
  return counts;
}
