import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const payoutMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260903000012_payout_lifecycle_atomic.sql"),
  "utf8",
);
const disputeMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260903000013_dispute_resolution_atomic.sql"),
  "utf8",
);

describe("Phase 27-28 payout/dispute lifecycle", () => {
  it("defines atomic payout creation and transitions", () => {
    expect(payoutMigration).toContain("create_payout_request_atomic");
    expect(payoutMigration).toContain("transition_payout_request_atomic");
    expect(payoutMigration).toContain("FOR UPDATE");
    expect(payoutMigration).toContain("Invalid payout transition");
  });
  it("defines canonical dispute creation/resolution", () => {
    expect(disputeMigration).toContain("create_dispute_atomic");
    expect(disputeMigration).toContain("resolve_dispute_atomic");
    expect(disputeMigration).toContain("resolution_note");
    expect(disputeMigration).toContain("FOR UPDATE");
  });
});
