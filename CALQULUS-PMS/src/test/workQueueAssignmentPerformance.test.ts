import { describe,it,expect } from 'vitest';
import fs from 'fs';
const read=(p:string)=>fs.readFileSync(p,'utf8');
describe('work queue assignment performance',()=>{
 it('defines workload, auto-assignment and timestamps',()=>{const sql=read('supabase/migrations/20260904000018_work_queue_assignment_performance.sql'); expect(sql).toContain('get_operation_work_team'); expect(sql).toContain('auto_assign_operation_work_item_atomic'); expect(sql).toContain('assigned_at'); expect(sql).toContain('started_at');});
 it('keeps assignment scoped to the manager team',()=>{const sql=read('supabase/migrations/20260904000018_work_queue_assignment_performance.sql'); expect(sql).toContain('Assignee is outside manager team'); expect(sql).toContain('Work item scope unauthorized');});
});
