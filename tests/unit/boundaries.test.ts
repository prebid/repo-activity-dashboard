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
  it.each(['services', 'store', 'validation'])('allows legitimate nested %s modules', (name) => {
    const root = fixture(`import { value } from '@/lib/${name}/example';`);
    mkdirSync(join(root, 'src/lib', name), { recursive: true });
    writeFileSync(join(root, 'src/lib', name, 'example.ts'), 'export const value = 1;');
    expect(inspectBoundaries(root)).toEqual({ sourceFiles: 2, failures: [] });
  });
  it('rejects actual retired paths and packages', () => {
    const root = fixture('export const value = 1;');
    mkdirSync(join(root, 'store'));
    writeFileSync(join(root, 'store/data.json'), '{}');
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ dependencies: { '@aws-sdk/client-s3': '1.0.0' } }),
    );
    expect(inspectBoundaries(root).failures).toEqual([
      'Retired reporting path remains: store',
      'Retired dependency: @aws-sdk/client-s3',
    ]);
  });
  it('never accepts an empty source population', () => {
    const root = fixture('');
    rmSync(join(root, 'src/components/widgets/example.tsx'));
    expect(inspectBoundaries(root).failures).toContain('No source files selected');
  });
  it('rejects the known retired raw-data endpoint', () => {
    expect(inspectBoundaries(fixture("fetch('/store/repos.json')")).failures).toEqual([
      'src/components/widgets/example.tsx: raw store request',
    ]);
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
