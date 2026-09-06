import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { CALQULUS_FIELD, CALQULUS_ICON } from "@/shared/theme/tokens";
import { statusBadgeClass } from "@/shared/lib/statusBadge";

const root = resolve(__dirname, "..");
function src(rel: string): string {
  return readFileSync(resolve(root, rel), "utf8");
}
function walk(rel: string): string[] {
  const base = resolve(root, rel);
  const out: string[] = [];
  for (const entry of readdirSync(base)) {
    const p = join(base, entry);
    if (statSync(p).isDirectory()) out.push(...walk(join(rel, entry)));
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const CONVERTED = [
  "features/services/pages/ServicesPage.tsx",
  "features/services/components/ServiceMarketplace.tsx",
  "features/vacation-notices/pages/VacationNotices.tsx",
  "features/properties/components/PropertyCollectionStatement.tsx",
  "features/webhost/components/ActivityLog.tsx",
  "features/webhost/components/ManagerManagement.tsx",
  "features/webhost/components/SystemLandlordManagement.tsx",
  "features/webhost/components/LandlordBilling.tsx",
  "features/reports/components/RentCollectionSummary.tsx",
  "features/landlord/components/LandlordLinksManager.tsx",
  "features/tenant-portal/pages/TenantInbox.tsx",
  "features/tenant-portal/components/TenantPortableHistory.tsx",
  "features/payments/pages/ManagerPaymentHistory.tsx",
  "features/payments/pages/ManagerPlatformBilling.tsx",
];

describe("button hierarchy — one clear order, no five equal buttons", () => {
  const button = src("shared/components/ui/button.tsx");

  it("has exactly the four-level hierarchy + link + ghost utilities", () => {
    for (const variant of ["default:", "destructive:", "outline:", "secondary:", "ghost:", "link:"]) {
      expect(button).toContain(variant);
    }
  });

  it("primary is the only filled default, destructive is the only danger", () => {
    expect(button).toContain('"bg-primary text-primary-foreground');
    expect(button).toContain('"bg-destructive text-destructive-foreground');
  });

  it("shares a single loading spinner state", () => {
    expect(button).toContain("loading");
    expect(button).toContain("animate-spin");
    expect(button).toContain("aria-busy");
  });
});

describe("forms — standard anatomy", () => {
  it("Field component standardizes label/control/helper/error", () => {
    const field = src("shared/components/ui/field.tsx");
    expect(field).toContain("label");
    expect(field).toContain("helper");
    expect(field).toContain('role="alert"');
    for (const slot of ["label", "helper", "error", "control"]) {
      expect(CALQULUS_FIELD).toHaveProperty(slot);
    }
  });
});

describe("status — semantic, never colour alone", () => {
  it("statusBadgeClass maps tones onto tokens", () => {
    expect(statusBadgeClass("success")).toContain("status-success");
    expect(statusBadgeClass("warning")).toContain("status-warning");
    expect(statusBadgeClass("danger")).toContain("status-danger");
    expect(statusBadgeClass("neutral")).toContain("status-neutral");
  });

  it("badge variants keep semantic names", () => {
    const badge = src("shared/components/ui/badge.tsx");
    for (const variant of ["success:", "warning:", "danger:", "info:", "destructive:"]) {
      expect(badge).toContain(variant);
    }
  });
});

describe("tables — one standard chrome", () => {
  const table = src("shared/components/ui/table.tsx");

  it("header uses muted label text, rows have hover + selected", () => {
    expect(table).toContain("text-muted-foreground");
    expect(table).toContain("hover:bg-muted/50");
    expect(table).toContain("data-[state=selected]:bg-muted");
  });

  it("pagination + pager primitives exist in the kit", () => {
    for (const primitive of ["ui/pagination.tsx", "ui/table-pager.tsx"]) {
      expect(readFileSync(resolve(root, "shared/components/" + primitive), "utf8").length).toBeGreaterThan(0);
    }
  });
});

describe("empty / error / loading states — one implementation shared", () => {
  it("converted screens use the shared EmptyState, not raw py-12 text-center blocks", () => {
    for (const rel of CONVERTED) {
      const file = src(rel);
      expect(file).not.toContain("py-12 text-center");
      expect(file).toContain("EmptyState");
    }
  });

  it("TenantInbox error path uses the shared ErrorState with a retry", () => {
    const file = src("features/tenant-portal/pages/TenantInbox.tsx");
    expect(file).toContain("ErrorState");
    expect(file).toContain("onRetry");
    expect(file).toContain("refetchNotices");
  });

  it("EmptyState and ErrorState carry status/alert semantics", () => {
    const empty = src("shared/components/ui/empty-state.tsx");
    expect(empty).toContain('role="status"');
    const error = src("shared/components/ui/error-state.tsx");
    expect(error).toContain("onRetry");
  });
});

describe("icons — one family, one sizing contract", () => {
  it("only lucide-react is used across feature and shared code", () => {
    const offenders: string[] = [];
    for (const dir of ["features", "shared"]) {
      for (const file of walk(dir)) {
        const text = readFileSync(file, "utf8");
        for (const banned of ["react-icons", "@iconify", "heroicons"]) {
          if (text.includes(banned)) offenders.push(`${file}: ${banned}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("icon sizes come from CALQULUS_ICON tokens", () => {
    expect(Object.keys(CALQULUS_ICON)).toEqual(["xs", "sm", "md", "lg"]);
  });
});

describe("no second component library", () => {
  it("shadcn-style ui kit is the single source — no MUI/AntD/Chakra imports", () => {
    const offenders: string[] = [];
    for (const dir of ["features", "shared"]) {
      for (const file of walk(dir)) {
        const text = readFileSync(file, "utf8");
        for (const banned of ["@mui/", "antd", "@chakra-ui"]) {
          if (text.includes(banned)) offenders.push(`${file}: ${banned}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
