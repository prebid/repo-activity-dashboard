// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import {
  browserInventory,
  createBrowserPlan,
  verifyBrowserShards,
} from '../../scripts/browser-shards.mjs';

const sourceRevision = 'a'.repeat(40);
const projects = [
  { name: 'chromium', metadata: {} },
  { name: 'webkit', metadata: {} },
];
const cases = projects.flatMap((p) =>
  ['alpha', 'beta'].map((title) => ({ project: p.name, title })),
);
function report(items = cases, current: number | null = null, total = 2, completed = false) {
  return {
    config: { projects, shard: current === null ? null : { current, total } },
    errors: [],
    stats: { expected: items.length, unexpected: 0, skipped: 0, flaky: 0 },
    suites: [
      {
        title: 'browser.spec.ts',
        suites: [
          {
            title: 'workflow',
            specs: items.map((item) => ({
              title: item.title,
              file: 'browser.spec.ts',
              tests: [
                {
                  projectName: item.project,
                  expectedStatus: 'passed',
                  status: 'expected',
                  results: completed ? [{ status: 'passed' }] : [],
                },
              ],
            })),
          },
        ],
      },
    ],
  };
}
function fixture() {
  const collect = (project: string, index: number, total: number) =>
    report(
      cases.filter((c) => c.project === project && c.title === (index === 1 ? 'alpha' : 'beta')),
      index,
      total,
    );
  const plan = createBrowserPlan(report(), 2, sourceRevision, collect);
  const results = plan.shards.map((s) => ({
    id: s.id,
    sourceRevision,
    report: report(
      cases.filter(
        (c) => c.project === s.project && c.title === (s.index === 1 ? 'alpha' : 'beta'),
      ),
      s.index,
      s.total,
      true,
    ),
  }));
  return { plan, results, collect };
}
it('plans all configured projects and proves the complete native partition', () => {
  const { plan, results } = fixture();
  expect(
    plan.shards.map((s) => [s.id, s.project, s.browser, s.index, s.total, s.cases.length]),
  ).toEqual([
    ['1-1', 'chromium', 'chromium', 1, 2, 1],
    ['1-2', 'chromium', 'chromium', 2, 2, 1],
    ['2-1', 'webkit', 'webkit', 1, 2, 1],
    ['2-2', 'webkit', 'webkit', 2, 2, 1],
  ]);
  expect(plan.cases).toHaveLength(4);
  expect(verifyBrowserShards(plan, results, sourceRevision)).toBe(4);
});
it('supports explicit engine metadata for device projects rather than omitting them', () => {
  const data = report([{ project: 'mobile-safari', title: 'alpha' }]);
  const config = {
    projects: [{ name: 'mobile-safari', metadata: { ciBrowser: 'webkit' } }],
    shard: null,
  };
  const plan = createBrowserPlan({ ...data, config }, 1, sourceRevision, () => ({
    ...data,
    config: { ...config, shard: { current: 1, total: 1 } },
  }));
  expect(plan.shards[0].browser).toBe('webkit');
  expect(plan.shards[0].project).toBe('mobile-safari');
});
it('rejects zero, duplicate, unknown-project and unsupported-engine inventories', () => {
  expect(() => browserInventory(report([]))).toThrow();
  expect(() => browserInventory(report([cases[0], cases[0]]))).toThrow('Duplicate');
  expect(() => browserInventory(report([{ project: 'absent', title: 'alpha' }]))).toThrow(
    'Unknown',
  );
  expect(() =>
    browserInventory({
      ...report(),
      config: { projects: [{ name: 'device', metadata: {} }], shard: null },
    }),
  ).toThrow();
  expect(() =>
    browserInventory({
      ...report(),
      config: { projects: [projects[0], projects[0]], shard: null },
    }),
  ).toThrow('Duplicate');
});
it('refuses partial starting inventories and configured projects with no collected cases', () => {
  const { collect } = fixture();
  expect(() => createBrowserPlan(report(cases, 1), 2, sourceRevision, collect)).toThrow(
    'unsharded',
  );
  expect(() =>
    createBrowserPlan(
      report(cases.filter((c) => c.project === 'chromium')),
      2,
      sourceRevision,
      collect,
    ),
  ).toThrow('no browser cases');
  expect(() => createBrowserPlan(report(), 0, sourceRevision, collect)).toThrow();
  expect(() => createBrowserPlan(report(), 257, sourceRevision, collect)).toThrow();
});
it('rejects wrong shard metadata, empty shards, missing cases and duplicated partitions', () => {
  const { collect } = fixture();
  expect(() =>
    createBrowserPlan(report(), 2, sourceRevision, (project) => collect(project, 1, 2)),
  ).toThrow('Incorrect');
  expect(() => createBrowserPlan(report(), 2, sourceRevision, () => report([], 1))).toThrow(
    'No browser cases',
  );
  expect(() =>
    createBrowserPlan(report(), 2, sourceRevision, (project, index, total) =>
      report(
        cases.filter((c) => c.project === project && c.title === 'alpha'),
        index,
        total,
      ),
    ),
  ).toThrow('Duplicate');
  expect(() =>
    createBrowserPlan(report(), 2, sourceRevision, (project, index, total) =>
      report([{ project, title: index === 1 ? 'alpha' : 'unknown' }], index, total),
    ),
  ).toThrow('Incomplete');
});
it.each([
  'missing',
  'duplicate',
  'wrong-case',
  'wrong-shard',
  'wrong-source',
  'wrong-plan-source',
  'altered-plan',
] as const)('rejects %s evidence despite passing per-job status', (kind) => {
  const { plan, results } = fixture();
  if (kind === 'missing') results.pop();
  if (kind === 'duplicate') results[1] = results[0];
  if (kind === 'wrong-case') results[0].report.suites[0].suites[0].specs[0].title = 'different';
  if (kind === 'wrong-shard') results[0].report.config.shard = { current: 2, total: 2 };
  if (kind === 'wrong-source') results[0].sourceRevision = 'b'.repeat(40);
  if (kind === 'wrong-plan-source') plan.sourceRevision = 'b'.repeat(40);
  if (kind === 'altered-plan') plan.cases.pop();
  expect(() => verifyBrowserShards(plan, results, sourceRevision)).toThrow();
});
it.each([
  'skipped',
  'flaky',
  'failed',
  'expected-failure',
  'empty-results',
  'false-count',
] as const)('rejects %s cases through the shared result validator', (kind) => {
  const { plan, results } = fixture();
  const data = results[0].report,
    item = data.suites[0].suites[0].specs[0].tests[0];
  if (kind === 'skipped') data.stats.skipped = 1;
  if (kind === 'flaky') data.stats.flaky = 1;
  if (kind === 'failed') item.results[0].status = 'failed';
  if (kind === 'expected-failure') item.expectedStatus = 'failed';
  if (kind === 'empty-results') item.results = [];
  if (kind === 'false-count') data.stats.expected = 2;
  expect(() => verifyBrowserShards(plan, results, sourceRevision)).toThrow();
});
it.each(['direct', 'symlinked'] as const)('runs the command through a %s script path', (kind) => {
  const link = mkdtempSync(join(tmpdir(), 'browser-shards-link-'));
  try {
    symlinkSync(resolve('scripts'), join(link, 'scripts'), 'dir');
    const script =
      kind === 'direct'
        ? resolve('scripts/browser-shards.mjs')
        : join(link, 'scripts/browser-shards.mjs');
    // An unsupported mode exits before any plan or report is read or written.
    const run = spawnSync(process.execPath, [script, 'unsupported'], { encoding: 'utf8' });
    expect(run.stderr).toContain('Expected plan <shards-per-project> or verify');
    expect(run.status).toBe(1);
  } finally {
    rmSync(link, { recursive: true, force: true });
  }
});
