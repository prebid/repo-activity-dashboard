// @vitest-environment node
import { it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { inspectArchitecture } from '../../scripts/check-architecture.mjs';
const directories: string[] = [];
function fixture(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'dashboard-graph-'));
  directories.push(root);
  mkdirSync(join(root, 'src'));
  for (const [name, source] of Object.entries(files)) {
    const path = join(root, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, source);
  }
  writeFileSync(
    join(root, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } } }),
  );
  return root;
}
afterEach(() => {
  for (const root of directories.splice(0)) rmSync(root, { recursive: true, force: true });
});
it('resolves alias, relative, and re-export chains without forbidding normal composition', () => {
  const result = inspectArchitecture(
    fixture({
      'src/app/page.ts': "export { view } from '@/features/repos/view';",
      'src/features/repos/view.ts': "export { view } from '../../components/view';",
      'src/components/view.ts': "export const view = 'ok';",
    }),
  );
  expect(result.sourceFiles).toBe(3);
  expect(result.failures).toEqual([]);
});
it('rejects transitive server imports, bare Node imports, reversed layers, cross-feature imports, unresolved imports, and cycles', () => {
  const result = inspectArchitecture(
    fixture({
      'src/components/view.ts':
        "export { secret } from '@/lib/presentation/helper'; import 'fs'; import '../features/other/view'; import './missing';",
      'src/lib/presentation/helper.ts': "export { secret } from '../auth/secret';",
      'src/lib/auth/secret.ts': 'export const secret = 1;',
      'src/features/repos/view.ts': "import '../other/view';",
      'src/features/other/view.ts': "import '../repos/view';",
    }),
  );
  for (const name of [
    'presentation-no-server-or-samples',
    'presentation-no-node',
    'shared-no-features',
    'pure-layer-direction',
    'feature-isolation-repos',
    'no-unresolved',
    'no-cycles',
  ]) {
    expect(
      result.failures.some((failure) => failure.startsWith(name + ':')),
      name,
    ).toBe(true);
  }
});
it('never treats an empty scan as a successful architectural check', () => {
  expect(
    inspectArchitecture(fixture({ 'outside.ts': 'export const ignored = true;' })).failures,
  ).toContain('No source files selected');
});
it('enforces transitive server isolation for client route entry points too', () => {
  const result = inspectArchitecture(
    fixture({
      'src/app/client/page.tsx':
        "'use client'; import { secret } from '@/helpers'; export default function Page(){ return secret; }",
      'src/helpers.ts': "export { secret } from './lib/auth/secret';",
      'src/lib/auth/secret.ts': "export const secret = 'server';",
    }),
  );
  expect(result.sourceFiles).toBe(3);
  expect(
    result.failures.some(
      (failure) =>
        failure.includes('src/app/client/page.tsx') && failure.includes('src/lib/auth/secret.ts'),
    ),
  ).toBe(true);
});
