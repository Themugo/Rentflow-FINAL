import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (p:string) => readFileSync(join(root,p),"utf8");

describe("post-intelligence integration hardening",()=>{
  it("hardens renewal SECURITY DEFINER functions",()=>{
    const sql=read("supabase/migrations/20260904000026_lease_renewal_retention_management.sql");
    expect(sql).toContain("SET search_path=''");
    expect(sql).toContain("REVOKE EXECUTE ON FUNCTION public.create_lease_renewal_case_atomic");
    expect(sql).toContain("REVOKE EXECUTE ON FUNCTION public.get_manager_lease_renewal_pipeline");
  });

  it("keeps work-queue assignment state aligned between RPC and UI",()=>{
    const sql=read("supabase/migrations/20260904000016_operation_work_queue.sql");
    const ui=read("src/features/dashboard/components/OperationWorkQueue.tsx");
    expect(sql).toContain("'assignee_id',w.assigned_to");
    expect(sql).toContain("'sla_due_at',w.sla_due_at");
    // The UI renders the resolved assignee display name (joined from
    // profiles), not the raw id, falling back to "Unassigned" when unset.
    expect(ui).toContain('item.assignee_name || "Unassigned"');
  });

  it("converges tenant experience into one canonical recovery/work loop",()=>{
    const sql=read("supabase/migrations/20260904000030_post_intelligence_integration_convergence.sql");
    expect(sql).toContain("work_item_id uuid REFERENCES public.operation_work_items(id)");
    expect(sql).toContain("tenant_service_recovery");
    expect(sql).toContain("canonical_source");
    expect(sql).toContain("status='cancelled'");
    expect(sql).toContain("completed_at=CASE WHEN v_work_status='completed'");
  });

  it("contains no fabricated renewal probability or market-rate snapshot in the AI summary cards",()=>{
    const ui=read("src/shared/components/ai/SmartSummaryCards.tsx");
    expect(ui).not.toContain("88% probability");
    expect(ui).not.toContain("94.2%");
    expect(ui).not.toContain("KES 1.2M");
    expect(ui).not.toContain("Market rental yield projection");
    expect(ui).toContain("live management analytics");
    expect(ui).toContain("does not claim a predictive renewal probability");
    expect(read("src/shared/components/bi/ReportCenterCatalog.tsx")).not.toContain("market rate adjustments");
    expect(read("src/features/communications/BroadcastCenter.tsx")).not.toContain("current market rates");
  });
});
