import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const root = process.cwd();
const read = (p:string) => readFileSync(join(root,p),"utf8");
describe("operation work queue",()=>{
  it("has scoped queue and atomic lifecycle RPCs",()=>{
    const sql=read("supabase/migrations/20260904000016_operation_work_queue.sql");
    expect(sql).toContain("sync_operation_work_queue_atomic");
    expect(sql).toContain("get_operation_work_queue");
    expect(sql).toContain("assign_operation_work_item_atomic");
    expect(sql).toContain("transition_operation_work_item_atomic");
    expect(sql).toContain("manager_submanagers");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
  });
  it("surfaces the queue on the manager dashboard",()=>{
    expect(read("src/features/dashboard/pages/Dashboard.tsx")).toContain("OperationWorkQueue");
    const component=read("src/features/dashboard/components/OperationWorkQueue.tsx");
    expect(component).toContain("sync_operation_work_queue_atomic");
    expect(component).toContain("transition_operation_work_item_atomic");
    const sql=read("supabase/migrations/20260904000016_operation_work_queue.sql");
    expect(sql).toContain("\'assignee_id\'");
    expect(sql).toContain("\'sla_due_at\'");
  });
});
