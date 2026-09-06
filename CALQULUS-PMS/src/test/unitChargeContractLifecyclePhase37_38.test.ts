import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root,p), "utf8");

describe("Phase 37–38 lifecycle convergence", () => {
  it("removes direct unit charge writes", () => {
    for (const file of ["src/features/units/components/UnitBillingConfig.tsx", "src/features/units/components/UnitManagement.tsx"]) {
      const s=read(file); expect(s).not.toMatch(/from\(["']unit_charge_configs["']\)[\s\S]{0,180}\.(insert|update|delete)\(/);
    }
  });
  it("removes direct contract/template mutations from hardened surfaces", () => {
    for (const file of ["src/features/contracts/components/TemplateManager.tsx", "src/features/contracts/hooks/useContractsData.ts", "src/features/contracts/services/contracts.service.ts", "src/features/contracts/components/QuickCreateContract.tsx", "src/features/webhost/components/WebhostContracts.tsx", "src/features/webhost/components/ManagerManagement.tsx"]) {
      const s=read(file); expect(s).not.toMatch(/from\(["'](?:contracts|contract_templates|manager_contracts)["']\)[\s\S]{0,220}\.(insert|update|delete)\(/);
    }
  });
  it("defines phase 37–38 RPCs", () => {
    const sql=read("supabase/migrations/20260903000014_unit_charge_config_atomic.sql")+read("supabase/migrations/20260903000015_contract_lifecycle_atomic.sql");
    for (const n of ["save_unit_charge_config_atomic","transition_unit_charge_config_atomic","delete_unit_charge_config_atomic","create_contract_atomic","transition_contract_atomic","soft_delete_contract_atomic","save_contract_template_atomic","delete_contract_template_atomic","create_manager_contract_atomic","transition_manager_contract_atomic"]) expect(sql).toContain(`FUNCTION public.${n}`);
  });
});
