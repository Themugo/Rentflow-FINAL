/**
 * Static guard for the production deployment workflow.
 * The workflow must reconcile the linked Supabase project before typecheck,
 * tests, build, or any deploy job can be considered production-ready.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workflow = path.join(root, '.github', 'workflows', 'deploy-production.yml');
const source = fs.readFileSync(workflow, 'utf8');
const required = [
  'npm run gate:reconciliation',
  'SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}',
];
const missing = required.filter((needle) => !source.includes(needle));
const gateIndex = source.indexOf('npm run gate:reconciliation');
const typecheckIndex = source.indexOf('npm run typecheck');
const status = missing.length === 0 && gateIndex >= 0 && typecheckIndex >= 0 && gateIndex < typecheckIndex ? 'PASS' : 'FAIL';

console.log(`deployment-workflow-audit: ${status}`);
console.log(`- reconciliation gate: ${gateIndex >= 0 ? 'present' : 'missing'}`);
console.log(`- access token secret: ${source.includes(required[1]) ? 'present' : 'missing'}`);
console.log(`- gate before typecheck: ${gateIndex >= 0 && typecheckIndex >= 0 && gateIndex < typecheckIndex ? 'yes' : 'no'}`);
if (missing.length) {
  console.error(`- missing: ${missing.join(', ')}`);
  process.exit(1);
}
if (status !== 'PASS') process.exit(1);
