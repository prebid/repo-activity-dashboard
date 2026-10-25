// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectBoundaries } from '../../scripts/check-boundaries.mjs';
const directories: string[] = [];
function fixture(source: string) {
  const root = mkdtempSync(join(tmpdir(), 'dashboard-boundary-'));
  directories.push(root);
  mkdirSync(join(root, 'src/components/widgets'), { recursive: true });
  writeFileSync(join(root, 'src/components/widgets/example.tsx'), source);
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ scripts: { build: 'next build' }, dependencies: {} }),
  );
  return root;
}
afterEach(() => {
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});
describe('module boundary check', () => {
  it('selects real input and allows presentation dependencies', () => {
    expect(
      inspectBoundaries(fixture("import { formatCount } from '@/lib/presentation/format';")),
    ).toEqual({ sourceFiles: 1, failures: [] });
  });
  it.each([
    "import '@/lib/auth/auth';",
    "export { auth } from '../../lib/auth/auth';",
    "import('@/mocks/reporting');",
  ])('rejects server or mock imports in views: %s', (source) => {
    const result = inspectBoundaries(fixture(source));
    expect(result.sourceFiles).toBe(1);
    expect(result.failures).toHaveLength(1);
  });
  it('rejects computed imports rather than treating them as checked', () => {
    expect(inspectBoundaries(fixture('import(moduleName);')).failures[0]).toContain(
      'computed module import',
    );
  });
  it('does not confuse prose comments with imports', () => {
    expect(
      inspectBoundaries(fixture("// import '@/lib/auth/auth';\nexport const x = 1;")).failures,
    ).toEqual([]);
  });
});
