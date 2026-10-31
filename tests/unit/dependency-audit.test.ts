// @vitest-environment node
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { inspectDependencyAudit } from '../../scripts/audit-dependencies.mjs';

it('retains the docgen consumer globSync API and absolute include/exclude file selection', () => {
  const consumer = createRequire(
    import.meta.resolve('@joshwooding/vite-plugin-react-docgen-typescript'),
  );
  const glob = consumer('glob') as {
    globSync: (
      pattern: string,
      options: { absolute: boolean; cwd: string; ignore: string[]; nodir: boolean },
    ) => string[];
  };
  const root = mkdtempSync(join(tmpdir(), 'docgen-glob-'));
  try {
    mkdirSync(join(root, 'src', 'excluded'), { recursive: true });
    mkdirSync(join(root, 'src', 'directory.tsx'));
    for (const file of ['one.tsx', 'two.tsx', 'skip.ts'])
      writeFileSync(join(root, 'src', file), '');
    writeFileSync(join(root, 'src', 'excluded', 'hidden.tsx'), '');
    expect(
      glob
        .globSync('src/**/*.tsx', {
          absolute: true,
          cwd: root,
          ignore: ['**/excluded/**'],
          nodir: true,
        })
        .sort(),
    ).toEqual([join(root, 'src', 'one.tsx'), join(root, 'src', 'two.tsx')]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

const url = 'https://github.com/advisories/GHSA-g3hv-75wg-m249';
const integrity =
  'sha512-VgjWUsnnT6n+NUk6eZq77zeFdpW2LWDzP6zFGrCbHXiYNul5Dzqk2HHQ5uFH2DNW5Xbp8+jVzaeNt94ssEEl4w==';
const installed = {
  name: 'minimatch',
  version: '3.1.5',
  main: 'minimatch.js',
  sourceHash: '746849f267c4868a53729225bd85c7dccd387712136fb305fcc0a3eadd4a3d9d',
};
function fixture() {
  const advisory = {
    name: 'minimatch',
    dependency: 'minimatch',
    severity: 'moderate',
    range: '<11.0.1',
    url,
  };
  const node = (name: string, via: (string | typeof advisory)[]) => ({
    name,
    severity: 'moderate',
    via,
    nodes: ['node_modules/' + name],
  });
  return {
    report: {
      auditReportVersion: 2,
      vulnerabilities: {
        minimatch: node('minimatch', [advisory]),
        eslint: node('eslint', ['minimatch', 'eslint-utils']),
        'eslint-utils': node('eslint-utils', ['eslint']),
      },
      metadata: { vulnerabilities: { total: 3 }, dependencies: { total: 10 } },
    },
    lock: {
      lockfileVersion: 3,
      packages: { 'node_modules/minimatch': { version: '3.1.5', integrity, dev: true } },
    },
  };
}
it('accepts a complete clean report without requiring the exception', () => {
  const { report, lock } = fixture();
  const result = inspectDependencyAudit(
    JSON.stringify({
      ...report,
      vulnerabilities: {},
      metadata: { ...report.metadata, vulnerabilities: { total: 0 } },
    }),
    0,
    lock,
    () => {
      throw Error('Should not read an exception package');
    },
  );
  expect(result).toEqual({
    reportedPackages: 0,
    auditedDependencies: 10,
    accepted: [],
    blocking: [],
  });
});
it('allows only the reviewed development package and resolves inherited advisories through npm cycles', () => {
  const { report, lock } = fixture();
  expect(inspectDependencyAudit(JSON.stringify(report), 1, lock, () => installed)).toEqual({
    reportedPackages: 3,
    auditedDependencies: 10,
    accepted: ['minimatch: ' + url],
    blocking: [],
  });
});
it('continues to block another advisory on the same package', () => {
  const { report, lock } = fixture();
  report.vulnerabilities.minimatch.via.push({
    name: 'minimatch',
    dependency: 'minimatch',
    severity: 'low',
    range: '*',
    url: 'https://github.com/advisories/GHSA-new-finding',
  });
  const result = inspectDependencyAudit(JSON.stringify(report), 1, lock, () => installed);
  expect(result.accepted).toEqual(['minimatch: ' + url]);
  expect(result.blocking).toEqual(['minimatch: https://github.com/advisories/GHSA-new-finding']);
});
it.each([{ version: '10.2.6' }, { version: '3.1.4' }, { integrity: 'changed' }, { dev: false }])(
  'rejects an unreviewed locked package: %j',
  (patch) => {
    const { report, lock } = fixture();
    Object.assign(lock.packages['node_modules/minimatch'], patch);
    const result = inspectDependencyAudit(JSON.stringify(report), 1, lock, () => installed);
    expect(result.accepted).toEqual([]);
    expect(result.blocking).toEqual(['minimatch: ' + url]);
  },
);
it.each([
  { name: 'another-package' },
  { version: '11.0.3' },
  { main: 'other.js' },
  { sourceHash: 'changed' },
])('rejects a changed installed package: %j', (patch) => {
  const { report, lock } = fixture();
  const result = inspectDependencyAudit(JSON.stringify(report), 1, lock, () => ({
    ...installed,
    ...patch,
  }));
  expect(result.accepted).toEqual([]);
  expect(result.blocking).toEqual(['minimatch: ' + url]);
});
it('rejects changed advisory severity/range and any mixed affected installation', () => {
  const { report, lock } = fixture();
  const first = report.vulnerabilities.minimatch.via[0];
  if (typeof first === 'string') throw Error('Expected a concrete advisory');
  first.severity = 'high';
  expect(
    inspectDependencyAudit(JSON.stringify(report), 1, lock, () => installed).blocking,
  ).toHaveLength(1);
  first.severity = 'moderate';
  first.range = '*';
  expect(
    inspectDependencyAudit(JSON.stringify(report), 1, lock, () => installed).blocking,
  ).toHaveLength(1);
  first.range = '<11.0.1';
  report.vulnerabilities.minimatch.nodes.push('node_modules/consumer/node_modules/minimatch');
  expect(
    inspectDependencyAudit(JSON.stringify(report), 1, lock, () => installed).blocking,
  ).toHaveLength(1);
});
it('fails closed on audit errors, malformed/empty evidence and inconsistent counts or exit status', () => {
  const { report, lock } = fixture();
  for (const [body, exit] of [
    ['', 1],
    ['null', 0],
    [JSON.stringify({ error: { code: 'ENOAUDIT' } }), 1],
    [JSON.stringify({}), 0],
    [JSON.stringify(report), 0],
    [JSON.stringify(report), 2],
    [JSON.stringify(report), null],
    [
      JSON.stringify({ ...report, metadata: { ...report.metadata, dependencies: { total: 0 } } }),
      1,
    ],
    [
      JSON.stringify({
        ...report,
        metadata: { ...report.metadata, vulnerabilities: { total: 0 } },
      }),
      1,
    ],
  ] as const)
    expect(() => inspectDependencyAudit(body, exit, lock, () => installed)).toThrow();
});
it('rejects missing graph evidence, rootless cycles and unsafe installation paths', () => {
  const { report, lock } = fixture();
  report.vulnerabilities.eslint.via = ['absent'];
  expect(() => inspectDependencyAudit(JSON.stringify(report), 1, lock, () => installed)).toThrow(
    'missing dependency',
  );
  report.vulnerabilities.eslint.via = ['eslint-utils'];
  expect(() => inspectDependencyAudit(JSON.stringify(report), 1, lock, () => installed)).toThrow(
    'without advisory evidence',
  );
  report.vulnerabilities.eslint.via = ['minimatch'];
  report.vulnerabilities.minimatch.nodes = ['node_modules/../minimatch'];
  expect(
    inspectDependencyAudit(JSON.stringify(report), 1, lock, () => {
      throw Error('Must not read outside the install');
    }).blocking,
  ).toHaveLength(1);
});
it('proves the legacy optimizer is absent and the patched modern optimizer bounds pattern amplification', () => {
  type Matcher = { set: unknown[]; firstPhasePreProcess?: unknown };
  type MatcherConstructor = new (pattern: string, options: Record<string, unknown>) => Matcher;
  const require = createRequire(import.meta.url);
  const legacy = require('minimatch') as { Minimatch: MatcherConstructor };
  const modern = createRequire(require.resolve('@typescript-eslint/typescript-estree'))(
    'minimatch',
  ) as {
    Minimatch: MatcherConstructor;
    minimatch: (file: string, pattern: string, options: Record<string, unknown>) => boolean;
  };
  const pattern = Array.from({ length: 6 }, (_, i) => `**/../segment${i}`).join('/') + '/file.ts';
  const before = new legacy.Minimatch(pattern, { optimizationLevel: 2, braceExpandMax: 8 });
  expect(typeof legacy).toBe('function');
  expect(before.firstPhasePreProcess).toBeUndefined();
  expect(before.set).toHaveLength(1);
  const after = new modern.Minimatch(pattern, { optimizationLevel: 2, braceExpandMax: 8 });
  expect(after.set.length).toBeGreaterThan(0);
  expect(after.set.length).toBeLessThanOrEqual(8);
  expect(modern.minimatch('src/example.ts', '**/*.ts', { dot: true })).toBe(true);
  expect(modern.minimatch('src/example.js', '**/*.ts', { dot: true })).toBe(false);
});
it('blocks unreviewed inherited severity and rejects inconsistent identities or unreadable installs', () => {
  const { report, lock } = fixture();
  report.vulnerabilities.eslint.severity = 'high';
  expect(
    inspectDependencyAudit(JSON.stringify(report), 1, lock, () => installed).blocking,
  ).toContain('eslint: unreviewed high severity');
  report.vulnerabilities.eslint.name = 'other';
  expect(() => inspectDependencyAudit(JSON.stringify(report), 1, lock, () => installed)).toThrow(
    'identity',
  );
  report.vulnerabilities.eslint.name = 'eslint';
  expect(() =>
    inspectDependencyAudit(JSON.stringify(report), 1, lock, () => {
      throw Error('unreadable install');
    }),
  ).toThrow('unreadable install');
});
