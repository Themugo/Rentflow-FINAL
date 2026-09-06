import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('production deployment migration gate', () => {
  const workflow = fs.readFileSync(
    path.resolve(process.cwd(), '.github/workflows/deploy-production.yml'),
    'utf8',
  );

  it('requires live Supabase migration reconciliation before build gates', () => {
    const reconciliation = workflow.indexOf('npm run gate:reconciliation');
    const typecheck = workflow.indexOf('npm run typecheck');
    const tests = workflow.indexOf('npm test');
    const build = workflow.indexOf('npm run build');

    expect(workflow).toContain('SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}');
    expect(reconciliation).toBeGreaterThan(-1);
    expect(typecheck).toBeGreaterThan(reconciliation);
    expect(tests).toBeGreaterThan(reconciliation);
    expect(build).toBeGreaterThan(reconciliation);
  });
});
