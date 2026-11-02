import { beforeEach, expect, it, vi } from 'vitest';
const { viewer, jar } = vi.hoisted(() => ({ viewer: vi.fn(), jar: new Map<string, string>() }));
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    }),
}));
// Server composition is checked against the reference cast, whose answers are hand-checkable.
vi.mock('@/mocks/repository-timeline', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/mocks/repository-timeline')>();
  const { onlyCast } = await import('../support/cast-source');
  return {
    ...actual,
    repositoryTimelineSample: (...args: Parameters<typeof actual.repositoryTimelineSample>) => {
      const [kind, repositoryId, scenario = 'reference', gap = false] = args;
      return onlyCast(
        actual.repositoryTimelineSample(
          kind,
          repositoryId,
          scenario === 'calendar' ? 'reference' : scenario,
          gap,
        ),
        scenario,
        gap,
      );
    },
    repositoryTimelineMatrixSample: (
      ...args: Parameters<typeof actual.repositoryTimelineMatrixSample>
    ) => {
      const [kind, scenario = 'reference', gap = false] = args;
      const matrix = actual.repositoryTimelineMatrixSample(
        kind,
        scenario === 'calendar' ? 'reference' : scenario,
        gap,
      );
      return {
        ...matrix,
        repositories: matrix.repositories.map((source) => onlyCast(source, scenario, gap)),
      };
    },
  };
});

vi.mock('@/lib/auth/viewer', () => ({ requireViewer: viewer }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw Error('not-found');
  },
}));
import { loadTimelineReport } from '@/server/timeline-report';
import { loadTimelineSupport } from '@/server/timeline-support';
import { timelineExportResponse } from '@/server/timeline-export';
import { readCsv } from '../support/csv';
import { timelineSupportHref } from '@/lib/presentation/timeline-support-query';
import { matrixRepositoryTimelineHref } from '@/lib/presentation/timeline-navigation';
import { viewHref, viewOf } from '@/lib/presentation/url/back';
import type { UrlValue } from '@/lib/presentation/url/registry';
import { canonicalHref } from '../support/timeline-urls';
import {
  contributionTimelinePreview,
  repositoryTimelineMatrixPreview,
  repositoryTimelinePreview,
} from '@/server/timeline-preview';
import { readPreferences } from '@/server/preferences';
import {
  encodePreferenceDocument,
  preferenceCookies,
  withPreferenceSection,
} from '@/lib/presentation/preference-cookie';
import type { PreferenceCookieName, PreferenceSectionKey } from '@/models/preferences';
const october = 'month:2026-10-01T00:00:00.000Z';
/** A canonical href with some values replaced (undefined removes one). */
function edited(href: string, patch: Record<string, UrlValue | undefined>) {
  const view = viewOf(href)!;
  const values: Record<string, UrlValue> = { ...view.values };
  for (const [name, value] of Object.entries(patch))
    if (value === undefined) delete values[name];
    else values[name] = value;
  return viewHref({ ...view, values }, 'level')!;
}
/** The supporting view at a canonical href, or a view the codec does not read. */
const load = (href: string) =>
  loadTimelineSupport(
    viewOf(href) ?? { route: '/repos/[slug]', segments: { slug: ['prebidjs'] }, values: {} },
  );
beforeEach(() => {
  jar.clear();
  viewer.mockReset().mockResolvedValue({ id: 'sample-viewer', authVersion: 0 });
});
async function support(parent: string, metric: string, interval = october) {
  const href = canonicalHref(parent);
  const report = await loadTimelineReport(href);
  if (report.status !== 'ready' || report.category === 'matrix') throw Error('Expected report');
  return timelineSupportHref(href, report.report.source, metric, interval)!;
}
const download = (body: unknown) =>
  new Request('http://localhost/api/reporting/timeline-export', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
it('guards malformed downloads and supporting requests before reporting work', async () => {
  viewer.mockRejectedValue(Error('denied'));
  await expect(timelineExportResponse(download({}))).rejects.toThrow('denied');
  await expect(load('/repos/prebidjs')).rejects.toThrow('denied');
});
it.each([
  '/bad',
  'https://example.test/repos',
  '/repos?x=' + 'a'.repeat(8000),
  '/companies/not-a-company',
  '/contributors/%',
])('rejects unsupported report routes %s', async (href) =>
  expect((await loadTimelineReport(href)).status).toBe('invalid'),
);
it.each([
  '/contributors?timeline=1',
  '/contributors/account-alice?timeline=1',
  '/companies?timeline=1',
  '/companies/id/company-acme?timeline=1',
  '/companies/unmapped?timeline=1',
  '/repos/prebidjs?timeline=1',
])('serves supported authorized Timeline route %s', async (href) =>
  expect((await loadTimelineReport(href)).status).toBe('ready'),
);
it('resolves exact PR, author and median populations without serializing unrelated histories', async () => {
  const href = await support('/repos/prebidjs?timeline=1', 'prAuthors');
  expect(href).toBe(
    '/repos/prebidjs?timeline&detail=prAuthors&interval=month:2026-10-01&snap=repositories-reference-v1@2026-10-24T12:00Z',
  );
  const result = await load(href);
  if (result.status !== 'ready' || result.detail.kind !== 'authors')
    throw Error('Expected authors');
  expect(result.detail.rows.map((row) => row.recordCount)).toEqual([2, 1]);
  expect(result.detail.context.parentHref).toBe('/repos/prebidjs?timeline');
  expect(JSON.stringify(result)).not.toContain('Sample PR');
  const nested = await load(edited(href, { author: 'sample-bob' }));
  expect(
    nested.status === 'ready' &&
      nested.detail.kind === 'repository' &&
      nested.detail.rows.map((row) => row.number),
  ).toEqual([105, 108]);
  expect((await load(edited(href, { author: 'unknown' }))).status).toBe('invalid');
  const median = await support('/repos/prebidjs?timeline=1', 'medianMergeDays');
  const duration = await load(median);
  expect(duration.status === 'ready' && duration.detail.context.measurement.value).toBe(31);
  expect((await load(edited(median, { author: 'sample-bob' }))).status).toBe('invalid');
});
it('keeps matrix returns pinned to the same repository, source and range', async () => {
  const href = '/repos?timeline&repo=prebidjs',
    loaded = await loadTimelineReport(href);
  if (loaded.status !== 'ready' || loaded.category !== 'matrix') throw Error('Expected matrix');
  const child = matrixRepositoryTimelineHref(loaded.controls, 'prebidjs', href)!;
  const detail = timelineSupportHref(child, loaded.matrix.source, 'prsOpened', october, 'matrix')!;
  const result = await load(detail);
  expect(result.status === 'ready' && result.detail.context.parentHref).toBe(href);
  /** The supporting view with another matrix as its Timeline's parent. */
  const fromMatrix = (matrix: string) => {
    const view = viewOf(detail)!;
    const [, ...farther] = view.values.back as string[];
    const frame = '/repos~timeline' + matrix;
    return viewHref({ ...view, values: { ...view.values, back: [frame, ...farther] } }, 'level')!;
  };
  expect((await load(fromMatrix('~repo:prebidserver'))).status).toBe('invalid');
  expect((await load(fromMatrix('~group:bad'))).status).toBe('invalid');
  expect((await load(edited(detail, { back: ['/contributors'] }))).status).toBe('invalid');
  // Each matrix consistency check: a valid parent that differs only in one pinned field.
  for (const [changed, query] of [
    ['~group:week', '&group=week'],
    ['~period:2026-02-01..2026-10-24', '&period=2026-02-01..2026-10-24'],
    ['~sample:mixed', '&sample=mixed'],
    ['~gap', '&gap'],
    ['~metric:prsMerged', '&metric=prsMerged'],
  ]) {
    expect((await loadTimelineReport(href + query)).status).toBe('ready');
    expect([changed, (await load(fromMatrix('~repo:prebidjs' + changed))).status]).toEqual([
      changed,
      'invalid',
    ]);
  }
  expect((await load(fromMatrix('~repo:prebidjs'))).status).toBe('ready');
});
it('rejects inherited property names as contribution support metrics', async () => {
  const href = await support('/contributors?timeline=1', 'prsAuthored');
  for (const name of ['constructor', '__proto__', 'hasOwnProperty'])
    expect((await load(edited(href, { detail: name }))).status).toBe('invalid');
});
it('keeps comments and merged-volume details inside exact period and population filters', async () => {
  const parent =
    '/contributors?timeline=1&account=account-bob&repo=repo-prebidjs&period=this-year&timeline.group=month';
  const href = await support(parent, 'reviewed.filesChanged'),
    result = await load(href);
  if (result.status !== 'ready' || result.detail.kind !== 'contribution')
    throw Error('Expected contributions');
  expect(result.detail.details.rows.map((row) => [row.record.number, row.value.value])).toEqual([
    [101, 10],
  ]);
  expect(result.detail.details.context.range.start).toBe('2026-10-01T00:00:00.000Z');
  expect((await load(edited(href, { author: 'sample-bob' }))).status).toBe('invalid');
  expect((await load(edited(href, { origin: 'matrix' }))).status).toBe('invalid');
});
it('rejects stale, missing and malformed detail scopes instead of substituting current data', async () => {
  const href = await support('/repos/prebidjs?timeline=1', 'prsOpened');
  for (const [name, value] of [
    ['snap', 'other@2026-10-24T12:00Z'],
    ['snap', 'repository-timeline-v1@2025-10-24T12:00Z'],
    ['interval', 'month:2026-09-15'],
    ['detail', 'notAMetric'],
    ['detail', 'constructor'],
    ['detail', '__proto__'],
    ['detail', 'toString'],
    ['group', 'week'],
  ])
    expect([name, value, (await load(edited(href, { [name]: value }))).status]).toEqual([
      name,
      value,
      'invalid',
    ]);
  const missing = await support('/repos/prebidjs?timeline=1&sample=missing', 'prsOpened');
  expect((await load(missing)).status).toBe('invalid');
  // A view the codec does not read, or a supporting view without its Timeline, is no detail.
  expect((await load(href.replace('detail=', 'timeline.detail='))).status).toBe('invalid');
  expect((await load(href.replace('/repos/prebidjs?timeline&', '/repos?'))).status).toBe('invalid');
});
it('exports all 500 intervals through an authenticated no-store CSV route and refuses stale/invalid options', async () => {
  const href =
    '/repos/prebidjs?timeline=1&timeline.group=day&period=custom&from=2025-06-12&through=2026-10-24&timeline.page=3';
  const loaded = await loadTimelineReport(href);
  if (loaded.status !== 'ready' || loaded.category === 'matrix') throw Error('Expected repository');
  const body = {
    href,
    revision: loaded.report.source.scenarioId,
    asOf: loaded.report.source.asOf,
    columns: ['period', 'prsOpened'],
  };
  const response = await timelineExportResponse(download(body));
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('content-type')).toContain('text/csv');
  expect((await response.text()).split('\r\n')).toHaveLength(501);
  expect((await timelineExportResponse(download({ ...body, revision: 'old' }))).status).toBe(409);
  expect((await timelineExportResponse(download({ ...body, columns: ['bad'] }))).status).toBe(400);
  expect((await timelineExportResponse(download({ ...body, href: '/admin/users' }))).status).toBe(
    400,
  );
  expect((await timelineExportResponse(download({}))).status).toBe(400);
  expect(
    (await timelineExportResponse(new Request('http://localhost', { method: 'POST', body: 'x' })))
      .status,
  ).toBe(415);
  expect(
    (
      await timelineExportResponse(
        new Request('http://localhost', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: 'x'.repeat(70000),
        }),
      )
    ).status,
  ).toBe(413);
});
it('exports the full matrix independently of its visible period window', async () => {
  const href = '/repos?timeline=1&timeline.group=day&period=this-year&timeline.window=2';
  const result = await loadTimelineReport(href);
  if (result.status !== 'ready' || result.category !== 'matrix') throw Error('Expected matrix');
  const response = await timelineExportResponse(
    download({
      href,
      revision: result.matrix.source.scenarioId,
      asOf: result.matrix.source.asOf,
      columns: ['repository', 'period', 'prsOpened'],
    }),
  );
  expect(response.status).toBe(200);
  expect((await response.text()).split('\r\n')).toHaveLength(18 * 297 + 1);
});
it('rejects matrix-origin detail links narrowed by extra record filters', async () => {
  const href = '/repos?timeline&repo=prebidjs',
    loaded = await loadTimelineReport(href);
  if (loaded.status !== 'ready' || loaded.category !== 'matrix') throw Error('Expected matrix');
  const child = matrixRepositoryTimelineHref(loaded.controls, 'prebidjs', href)!;
  const detail = timelineSupportHref(child, loaded.matrix.source, 'prsOpened', october, 'matrix')!;
  expect((await load(detail)).status).toBe('ready');
  expect((await load(edited(detail, { authors: ['sample-bob'] }))).status).toBe('invalid');
});
async function exportCsv(href: string, columns: string[]) {
  const loaded = await loadTimelineReport(href);
  if (loaded.status !== 'ready') throw Error('Expected report');
  const source = loaded.category === 'matrix' ? loaded.matrix.source : loaded.report.source;
  const response = await timelineExportResponse(
    download({ href, revision: source.scenarioId, asOf: source.asOf, columns }),
  );
  expect(response.status).toBe(200);
  return readCsv(await response.text());
}
it.each([
  [
    'repositories',
    'timeline.repository',
    '/repos/prebidjs?timeline=1&timeline.sort=prsOpened&timeline.dir=desc',
    ['period', 'prsOpened'],
  ],
  [
    'repositories',
    'timeline.matrix',
    '/repos?timeline=1&repo=repo-prebidjs',
    ['repository', 'period', 'prsOpened'],
  ],
  [
    'contributions',
    'timeline.contributors.overview',
    '/contributors?timeline=1',
    ['period', 'prsAuthored'],
  ],
] as const)(
  'exports the same %s Timeline whatever its saved %s presentation',
  async (cookie: PreferenceCookieName, section: PreferenceSectionKey, href, columns) => {
    const loaded = await loadTimelineReport(href);
    if (loaded.status !== 'ready') throw Error('Expected report');
    const source = loaded.category === 'matrix' ? loaded.matrix.source : loaded.report.source;
    const csv = async () => {
      const response = await timelineExportResponse(
        download({ href, revision: source.scenarioId, asOf: source.asOf, columns: [...columns] }),
      );
      expect(response.status).toBe(200);
      return response.text();
    };
    const withoutCookie = await csv();
    jar.set(
      preferenceCookies[cookie].name,
      encodePreferenceDocument(
        withPreferenceSection(null, { accountId: 'sample-viewer', authVersion: 0 }, section, {
          version: 1,
          query: 'timeline.group=week',
        }),
      ),
    );
    // A page reads this cookie: the same address is an entry it redirects to the saved grouping.
    const url = new URL(href, 'https://dashboard.invalid');
    const saved = await readPreferences(cookie);
    const page =
      section === 'timeline.matrix'
        ? await repositoryTimelineMatrixPreview(url.searchParams, saved)
        : section === 'timeline.repository'
          ? await repositoryTimelinePreview('prebidjs', url.searchParams, saved)
          : await contributionTimelinePreview('contributors', url.searchParams, undefined, saved);
    if (page.status !== 'redirect') throw Error('Expected the page to apply the saved view');
    expect(new URL(page.href, url).searchParams.get('timeline.group')).toBe('week');
    expect(await csv()).toBe(withoutCookie);
  },
);
it('exports matrix values, units and coverage by repository and period', async () => {
  const csv = await exportCsv(
    '/repos?timeline=1&repo=repo-prebidjs&timeline.metric=prsOpened&timeline.metric=prsMerged&timeline.metric=medianMergeDays',
    ['period', 'repository', 'prsOpened', 'prsMerged', 'medianMergeDays'],
  );
  const october = csv.records.find(
    (row) => row.Repository === 'Prebid.js' && row.Period === 'Oct 2026',
  )!;
  expect(october).toMatchObject({
    'Pull requests — Opened': '3',
    'Pull requests — Merged': '2',
    'Duration — Median merge time': '31',
    'Duration — Median merge time unit': 'days',
    'Pull requests — Opened unit': 'count',
    'Pull requests — Opened coverage': 'complete',
    'Calendar start (UTC)': '2026-10-01T00:00:00.000Z',
    'Covered end inclusive': 'true',
  });
  const mixed = await exportCsv(
    '/repos?timeline=1&sample=mixed&repo=repo-prebidserverjava&repo=repo-prebidserver&timeline.group=quarter',
    ['period', 'repository', 'prsOpened'],
  );
  const java = mixed.records.filter((row) => row['Repository ID'] === 'repo-prebidserverjava');
  expect(java.length).toBeGreaterThan(0);
  for (const row of java) {
    expect(row['Pull requests — Opened']).toBe('');
    expect(row['Pull requests — Opened coverage']).toBe('missing');
    expect(row['Pull requests — Opened coverage detail']).not.toBe('');
  }
  expect(
    mixed.records.find(
      (row) => row['Repository ID'] === 'repo-prebidserver' && row.Period === 'Q1 2026',
    )!['Pull requests — Opened coverage'],
  ).toBe('partial');
});
it('exports series rows in the table sort order and Over time without repository columns', async () => {
  const series = await exportCsv(
    '/repos/prebidjs?timeline=1&timeline.sort=prsOpened&timeline.dir=desc',
    ['period', 'prsOpened'],
  );
  expect(series.records.slice(0, 3).map((row) => row.Period)).toEqual([
    'Oct 2026',
    'Aug 2026',
    'Sep 2026',
  ]);
  const contributors = await exportCsv('/contributors?timeline=1', ['period', 'prsAuthored']);
  expect(contributors.headers).not.toContain('Repository ID');
  expect(contributors.records.find((row) => row.Period === 'Oct 2026')!['PRs authored']).toBe('6');
  expect(contributors.records.reduce((sum, row) => sum + Number(row['PRs authored']), 0)).toBe(8);
});
