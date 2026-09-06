import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const root = process.cwd();
const read = (p:string) => readFileSync(join(root,p),"utf8");
describe("work queue SLA control",()=>{
 it("defines SLA metrics and escalation",()=>{ const sql=read("supabase/migrations/20260904000017_work_queue_sla_control.sql"); expect(sql).toContain("get_operation_work_queue_metrics"); expect(sql).toContain("escalate_overdue_operation_work_atomic"); expect(sql).toContain("sla_due_at"); });
 it("surfaces operational SLA controls",()=>{ const ui=read("src/features/dashboard/components/OperationWorkQueue.tsx"); expect(ui).toContain("Escalate overdue"); expect(ui).toContain("SLA breached"); expect(ui).toContain("get_operation_work_queue_metrics"); });
});
