// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Browser } from '@playwright/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  inventory,
  reportViews,
  signInPages,
  viewsFor,
  type InventoryView,
  type ViewUse,
} from '../support/views';
import {
  capture,
  captureMatrix,
  cellFailure,
  parseCaptureArguments,
} from '../../scripts/capture-views.mjs';

const root = '/inventory-repository';
const base = ['--base', 'http://127.0.0.1:3200'];
const now = new Date('2026-11-01T03:04:05.678Z');
const kebab = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const origin = 'http://inventory.test';
const parse = (argv: readonly string[]) => parseCaptureArguments(argv, { root, cwd: root, now });
const ids = (views: readonly InventoryView[]) => views.map((view) => view.id);
const paths = (views: readonly InventoryView[]) => views.map((view) => view.path).sort();
const octoberRange =
  'from=2026-10-01T00%3A00%3A00.000Z&to=2026-10-24T12%3A00%3A00.000Z&inclusive=1';
const yearRange = 'from=2026-01-01T00:00:00.000Z&to=2026-10-24T12:00:00.000Z&inclusive=1';

describe('view inventory', () => {
  it('lists four sign-in pages and thirty report views under unique, well-formed ids and paths', () => {
    expect(signInPages.map((view) => view.path)).toEqual([
      '/auth/login',
      '/auth/error',
      '/auth/setup',
      '/auth/change-password',
    ]);
    expect(reportViews).toHaveLength(30);
    expect(inventory).toHaveLength(34);
    expect(new Set(ids(inventory)).size).toBe(inventory.length);
    expect(new Set(paths(inventory)).size).toBe(inventory.length);
    for (const view of inventory) {
      expect(view.id).toMatch(kebab);
      expect(view.path, view.id).toMatch(/^\/(?!\/)/);
      const url = new URL(view.path, origin);
      expect(url.origin, view.id).toBe(origin);
      expect(url.hash, view.id).toBe('');
      expect(url.pathname + url.search, view.id).toBe(view.path);
    }
  });
  it('signs in for every report view and the password change, and for no public page', () => {
    expect(Object.fromEntries(signInPages.map((view) => [view.id, view.access]))).toEqual({
      'sign-in': 'signed-out',
      'sign-in-error': 'public',
      'account-setup': 'public',
      'change-password': 'signed-in',
    });
    expect(new Set(reportViews.map((view) => view.access))).toEqual(new Set(['signed-in']));
  });
  it('keeps each page group on one pathname and shares groups only between repeat views', () => {
    const groups = new Map<string, InventoryView[]>();
    for (const view of inventory) groups.set(view.page, [...(groups.get(view.page) ?? []), view]);
    expect(groups.size).toBe(26);
    for (const [page, views] of groups) {
      expect(page).toMatch(kebab);
      const pathnames = new Set(views.map((view) => new URL(view.path, origin).pathname));
      expect(pathnames.size, page).toBe(1);
    }
    expect(
      Object.fromEntries(
        [...groups]
          .filter(([, views]) => views.length > 1)
          .map(([page, views]) => [page, ids(views)]),
      ),
    ).toEqual({
      'repos-summary': ['repos-overview', 'repos-comparison'],
      'repos-timeline': [
        'repos-timeline',
        'repos-timeline-week-state',
        'repos-timeline-mixed-quarter',
      ],
      'repo-issues': ['repo-issues-tab', 'repo-open-issues-metric'],
      'repo-timeline': ['repo-timeline', 'repo-timeline-issues-week'],
      contributors: ['contributors', 'contributors-report'],
      'contributors-timeline': [
        'contributors-timeline',
        'contributors-timeline-empty',
        'contributors-timeline-missing',
      ],
    });
  });
  it('pins the prepared-sample state views that the real-data milestone removes', () => {
    expect(
      ids(inventory.filter((view) => new URL(view.path, origin).searchParams.has('sample'))),
    ).toEqual([
      'repos-timeline-mixed-quarter',
      'contributors-timeline-empty',
      'contributors-timeline-missing',
    ]);
  });
  it('selects exactly the views each browser spec covered before the inventory', () => {
    expect(ids(viewsFor('visual-review'))).toEqual([
      'repos-comparison',
      'repo-docs-open-issues',
      'repo-approvals-metric',
      'repo-authors-metric',
      'repo-credits-metric',
      'repo-duration-metric',
      'repo-author',
      'repo-author-issues',
    ]);
    expect(paths(viewsFor('visual-review'))).toEqual(
      [
        '/repos?repo=repo-prebidjs&repo=repo-prebidserver&period=this-month&period2=last-month&age=30&age=60&age=90',
        '/repos/prebidjs?scope=current&metric=humanApprovals0',
        '/repos/prebiddocs?scope=current&metric=openIssues',
        '/repos/prebidjs?scope=period&metric=prAuthors&' + octoberRange,
        '/repos/prebidjs/authors/sample-author-2?scope=period&metric=prAuthors&' + yearRange,
        '/repos/prebidjs/authors/sample-author-2?scope=period&metric=issueAuthors&' + yearRange,
        '/repos/prebidjs?scope=period&metric=agentFeedbackCredits&' + octoberRange,
        '/repos/prebidjs?scope=period&metric=medianMergeDays&branch=master&' + octoberRange,
      ].sort(),
    );
    expect(ids(viewsFor('reflow'))).toEqual([
      'repos-comparison',
      'repo-authors-metric',
      'repo-duration-metric',
    ]);
    expect(paths(viewsFor('layout-width'))).toEqual(
      [
        '/repos',
        '/repos?timeline=1',
        '/repos/prebidjs',
        '/repos/prebidjs?scope=current&metric=openIssues',
        '/repos/prebidjs?timeline=1',
        '/repos/prebidjs/authors/sample-author-2?scope=period&metric=prAuthors&' + yearRange,
        '/contributors',
        '/contributors?timeline=1',
        '/companies',
        '/companies?timeline=1',
        '/contributors/account-alice',
        '/contributors/account-alice?timeline=1',
        '/companies/id/company-acme',
        '/companies/id/company-acme?view=repositories',
        '/companies/id/company-acme?timeline=1',
      ].sort(),
    );
    expect(ids(viewsFor('activity-region'))).toEqual(['repos-comparison']);
    expect(() => viewsFor('unused' as ViewUse)).toThrow('No inventory views are marked for unused');
  });
  it('counts rendered type over the sign-in page and the eleven views of the type review', () => {
    expect(ids(viewsFor('type-sample'))).toEqual([
      'sign-in',
      'repos-overview',
      'repos-timeline',
      'repo-detail',
      'repo-authors-metric',
      'repo-timeline',
      'repo-author',
      'contributors',
      'contributor-detail',
      'companies',
      'company-detail',
      'foundation',
    ]);
  });
});

describe('capture arguments and matrix', () => {
  it('captures every view at 1440, 1366 and 390 in Light and Dark into a timestamped default', () => {
    const options = parse(base);
    expect(options.base.href).toBe('http://127.0.0.1:3200/');
    expect(options.out).toBe(root + '/test-results/captures/2026-11-01T03-04-05Z');
    expect(options.measure).toBe(false);
    const cells = captureMatrix(options);
    expect(cells).toHaveLength(inventory.length * 3 * 2);
    expect(new Set(cells.flatMap((cell) => [cell.file, cell.fullPage])).size).toBe(
      cells.length * 2,
    );
    expect(new Set(cells.map((cell) => cell.theme + ' ' + cell.width + 'x' + cell.height))).toEqual(
      new Set([
        'light 1440x900',
        'light 1366x768',
        'light 390x844',
        'dark 1440x900',
        'dark 1366x768',
        'dark 390x844',
      ]),
    );
    expect(cells[0]).toMatchObject({
      view: inventory[0],
      theme: 'light',
      width: 1440,
      file: 'sign-in.light.1440.png',
      fullPage: 'sign-in.light.1440.full.png',
    });
  });
  it('narrows views, widths and themes, adds 2560 on request and turns on measurement', () => {
    const options = parse([
      ...base,
      '--views',
      'repos-overview,sign-in',
      '--widths',
      '2560',
      '--themes',
      'dark',
      '--measure',
      '--out',
      'test-results/captures/before',
    ]);
    expect(options.out).toBe(root + '/test-results/captures/before');
    expect(options.measure).toBe(true);
    expect(captureMatrix(options).map((cell) => [cell.file, cell.fullPage, cell.height])).toEqual([
      ['sign-in.dark.2560.png', 'sign-in.dark.2560.full.png', 1300],
      ['repos-overview.dark.2560.png', 'repos-overview.dark.2560.full.png', 1300],
    ]);
  });
  it.each(['http://localhost:3200', 'http://[::1]:3200/', 'https://127.0.0.1:3443'])(
    'accepts the loopback origin %s',
    (value) => {
      expect(parse(['--base', value]).base.origin).toBe(value.replace(/\/$/, ''));
    },
  );
  it.each(['/capture-output/before', '../captures/after'])(
    'accepts output %s outside the repository',
    (value) => {
      expect(parse([...base, '--out', value]).out).toBe(resolve(root, value));
    },
  );
  const rejections: [string[], string][] = [
    [[], '--base <origin> is required'],
    [['--base', 'https://example.com'], '--base must be a loopback origin'],
    [['--base', 'http://127.0.0.1:3200/repos'], '--base must be a loopback origin'],
    [['--base', 'http://127.0.0.1:3200/?view=issues'], '--base must be a loopback origin'],
    [['--base', 'http://user@127.0.0.1:3200'], '--base must be a loopback origin'],
    [['--base', 'ftp://127.0.0.1'], '--base must be a loopback origin'],
    [['--base', 'not a url'], '--base must be a loopback origin'],
    [[...base, '--out', '.'], '--out must be outside the repository'],
    [[...base, '--out', 'src/captures'], '--out must be outside the repository'],
    [[...base, '--out', 'test-results'], '--out must be outside the repository'],
    [
      [...base, '--out', 'test-results/browser-artifacts/c'],
      '--out must be outside the repository',
    ],
    [[...base, '--out', 'test-results/shards'], '--out must be outside the repository'],
    [[...base, '--views', 'repos-overview,nope'], 'Unknown view id: nope'],
    [[...base, '--views', 'repos-overview,'], 'without blank or repeated items'],
    [[...base, '--widths', '390,390'], 'without blank or repeated items'],
    [[...base, '--widths', '1280'], '--widths accepts 1440, 1366, 390, 2560'],
    [[...base, '--widths', '1440.0'], '--widths accepts 1440, 1366, 390, 2560'],
    [[...base, '--themes', 'system'], '--themes accepts light, dark'],
    [[...base, '--unknown'], "Unknown option '--unknown'"],
    [[...base, 'extra'], "Unexpected argument 'extra'"],
  ];
  it.each(rejections)('rejects %j', (argv, message) => {
    expect(() => parse(argv)).toThrow(message);
  });
  // A case-insensitive filesystem resolves each of these to the repository or a reserved directory.
  it.each([
    [root, root.toUpperCase(), 'src/captures'],
    [root.toUpperCase(), root, 'src/captures'],
    [root, '/Inventory-Repository', '.'],
    [root, root, root.toUpperCase() + '/src/captures'],
    [root, root, 'TEST-RESULTS'],
    [root, root, 'test-results/SHARDS/c'],
    [root, root, 'Test-Results/Browser-Artifacts/c'],
  ])(
    'rejects output under root %s from %s at %s, which differs only in case',
    (repository, cwd, out) => {
      expect(() =>
        parseCaptureArguments([...base, '--out', out], { root: repository, cwd, now }),
      ).toThrow('--out must be outside the repository');
    },
  );
  it('accepts a test-results/ subdirectory reached through another case of the repository path', () => {
    expect(
      parseCaptureArguments([...base, '--out', 'test-results/captures/before'], {
        root,
        cwd: root.toUpperCase(),
        now,
      }).out,
    ).toBe(root.toUpperCase() + '/test-results/captures/before');
  });
  it.each([
    [{ status: 200, redirected: false, expected: '/repos', actual: '/repos' }, null],
    [
      { status: null, redirected: false, expected: '/repos', actual: '/repos' },
      'no document response',
    ],
    [{ status: 404, redirected: false, expected: '/repos/x', actual: '/repos/x' }, 'status 404'],
    [
      { status: 200, redirected: true, expected: '/repos', actual: '/auth/login' },
      'redirected to /auth/login',
    ],
    [
      { status: 200, redirected: false, expected: '/repos/prebidjs', actual: '/repos' },
      'landed on /repos',
    ],
  ])('judges a loaded document %j', (result, failure) => {
    expect(cellFailure(result)).toBe(failure);
  });
});

describe('capture run record', () => {
  const refused = 'net::ERR_CONNECTION_REFUSED';
  // Every page load fails, as when the server stops answering partway through a run.
  const unreachable = () =>
    Promise.resolve({
      newContext: () =>
        Promise.resolve({
          newPage: () => Promise.resolve({ goto: () => Promise.reject(new Error(refused)) }),
          close: () => Promise.resolve(),
        }),
      close: () => Promise.resolve(),
    } as unknown as Browser);
  let out = '';
  beforeEach(() => {
    out = mkdtempSync(join(tmpdir(), 'capture-run-'));
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    rmSync(out, { recursive: true, force: true });
  });
  const options = (argv: readonly string[]) =>
    parseCaptureArguments([...base, '--out', out, ...argv], { root, cwd: root, now });
  const record = (directory: string) =>
    JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8')) as unknown;

  it('records the group whose sign-in failed', async () => {
    const run = options(['--views', 'sign-in', '--widths', '390', '--themes', 'dark']);
    expect(await capture(run, unreachable)).toBe(false);
    expect(record(run.out)).toEqual({
      version: 1,
      base: 'http://127.0.0.1:3200',
      widths: [390],
      themes: ['dark'],
      views: ['sign-in'],
      entries: [],
      failures: [{ stage: 'setup', theme: 'dark', access: 'signed-out', reason: refused }],
    });
    expect(existsSync(join(run.out, 'measurements.json'))).toBe(false);
  });
  it('records a failed measurement', async () => {
    const run = { ...options(['--measure']), views: [] };
    expect(await capture(run, unreachable)).toBe(false);
    expect(record(run.out)).toMatchObject({
      views: [],
      entries: [],
      failures: [{ stage: 'measure', reason: refused }],
    });
    expect(existsSync(join(run.out, 'measurements.json'))).toBe(false);
  });
  it('records a browser that did not start', async () => {
    const run = options(['--views', 'sign-in']);
    expect(await capture(run, () => Promise.reject(new Error('Executable does not exist')))).toBe(
      false,
    );
    expect(record(run.out)).toMatchObject({
      entries: [],
      failures: [{ stage: 'launch', reason: 'Executable does not exist' }],
    });
  });
});

it('keeps the capture script out of the quality gates', () => {
  const { scripts } = JSON.parse(readFileSync('package.json', 'utf8')) as {
    scripts: Record<string, string>;
  };
  expect(scripts['capture:views']).toBe('node scripts/capture-views.mjs');
  expect(scripts.check).not.toContain('capture');
  expect(scripts['check:all']).not.toContain('capture');
  expect(readFileSync('.github/workflows/quality.yml', 'utf8')).not.toContain('capture');
});
it('loads the inventory under Node type stripping and exits 1 on a usage error', () => {
  const run = spawnSync(
    process.execPath,
    [resolve('scripts/capture-views.mjs'), ...base, '--views', 'nope'],
    { encoding: 'utf8' },
  );
  expect(run.stderr).toContain('Unknown view id: nope');
  expect(run.stderr).toContain('Usage: npm run capture:views');
  expect(run.status).toBe(1);
});
