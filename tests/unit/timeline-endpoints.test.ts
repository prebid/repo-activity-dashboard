import { beforeEach, expect, it, vi } from 'vitest';
const viewer = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/viewer', () => ({ requireViewer: viewer }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw Error('not-found');
  },
}));
import { loadTimelineReport } from '@/server/timeline-report';
import { loadTimelineSupport } from '@/server/timeline-support';
import { timelineExportResponse } from '@/server/timeline-export';
import { timelineSupportHref } from '@/lib/presentation/timeline-support-query';
import { matrixRepositoryTimelineHref } from '@/lib/presentation/timeline-navigation';
const october = 'month:2026-10-01T00:00:00.000Z';
beforeEach(() => {
  viewer.mockReset().mockResolvedValue({ id: 'sample-viewer' });
});
async function support(parent: string, metric: string, interval = october) {
  const report = await loadTimelineReport(parent);
  if (report.status !== 'ready' || report.category === 'matrix') throw Error('Expected report');
  return timelineSupportHref(parent, report.report.source, metric, interval)!;
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
  await expect(loadTimelineSupport('/repos/prebidjs', new URLSearchParams())).rejects.toThrow(
    'denied',
  );
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
  const href = await support('/repos/prebidjs?timeline=1', 'prAuthors'),
    url = new URL(href, 'https://example.test');
  const result = await loadTimelineSupport(url.pathname, url.searchParams);
  if (result.status !== 'ready' || result.detail.kind !== 'authors')
    throw Error('Expected authors');
  expect(result.detail.rows.map((row) => row.recordCount)).toEqual([2, 1]);
  expect(result.detail.context.parentHref).toBe('/repos/prebidjs?timeline=1');
  expect(JSON.stringify(result)).not.toContain('Sample PR');
  url.searchParams.set('support.author', 'sample-bob');
  const nested = await loadTimelineSupport(url.pathname, url.searchParams);
  expect(
    nested.status === 'ready' &&
      nested.detail.kind === 'repository' &&
      nested.detail.rows.map((row) => row.number),
  ).toEqual([105, 108]);
  url.searchParams.set('support.author', 'unknown');
  expect((await loadTimelineSupport(url.pathname, url.searchParams)).status).toBe('invalid');
  const median = new URL(
    await support('/repos/prebidjs?timeline=1', 'medianMergeDays'),
    'https://example.test',
  );
  const duration = await loadTimelineSupport(median.pathname, median.searchParams);
  expect(duration.status === 'ready' && duration.detail.context.measurement.value).toBe(31);
  median.searchParams.set('support.author', 'sample-bob');
  expect((await loadTimelineSupport(median.pathname, median.searchParams)).status).toBe('invalid');
});
it('keeps matrix returns pinned to the same repository, source and range', async () => {
  const href = '/repos?timeline=1&repo=repo-prebidjs',
    loaded = await loadTimelineReport(href);
  if (loaded.status !== 'ready' || loaded.category !== 'matrix') throw Error('Expected matrix');
  const child = matrixRepositoryTimelineHref(loaded.controls, 'prebidjs', href)!;
  const url = new URL(
    timelineSupportHref(child, loaded.matrix.source, 'prsOpened', october, 'matrix')!,
    'https://example.test',
  );
  const result = await loadTimelineSupport(url.pathname, url.searchParams);
  expect(result.status === 'ready' && result.detail.context.parentHref).toBe(href);
  url.searchParams.set('timelineParent', '/repos?timeline=1&repo=repo-prebidserver');
  expect((await loadTimelineSupport(url.pathname, url.searchParams)).status).toBe('invalid');
  url.searchParams.set('timelineParent', '/repos?timeline=1&timeline.group=bad');
  expect((await loadTimelineSupport(url.pathname, url.searchParams)).status).toBe('invalid');
  url.searchParams.set('timelineParent', '/contributors');
  expect((await loadTimelineSupport(url.pathname, url.searchParams)).status).toBe('invalid');
});
it('keeps comments and merged-volume details inside exact period and population filters', async () => {
  const parent =
    '/contributors?timeline=1&account=account-bob&repo=repo-prebidjs&period=this-year&timeline.group=month';
  const url = new URL(await support(parent, 'reviewed.filesChanged'), 'https://example.test'),
    result = await loadTimelineSupport(url.pathname, url.searchParams);
  if (result.status !== 'ready' || result.detail.kind !== 'contribution')
    throw Error('Expected contributions');
  expect(result.detail.details.rows.map((row) => [row.record.number, row.value.value])).toEqual([
    [101, 10],
  ]);
  expect(result.detail.details.context.range.start).toBe('2026-10-01T00:00:00.000Z');
  url.searchParams.set('support.author', 'sample-bob');
  expect((await loadTimelineSupport(url.pathname, url.searchParams)).status).toBe('invalid');
  url.searchParams.delete('support.author');
  url.searchParams.set('support.origin', 'matrix');
  expect((await loadTimelineSupport(url.pathname, url.searchParams)).status).toBe('invalid');
});
it('rejects stale, missing and malformed detail scopes instead of substituting current data', async () => {
  const url = new URL(
    await support('/repos/prebidjs?timeline=1', 'prsOpened'),
    'https://example.test',
  );
  for (const [key, value] of [
    ['timeline.revision', 'other'],
    ['timeline.clock', '2025-10-24T12:00:00.000Z'],
    ['timeline.interval', 'absent'],
    ['timeline.detail', 'notAMetric'],
    ['support.records.q', 'a'.repeat(8000)],
  ]) {
    const params = new URLSearchParams(url.search);
    params.set(key, value);
    expect((await loadTimelineSupport(url.pathname, params)).status).toBe('invalid');
  }
  const missing = new URL(
    await support('/repos/prebidjs?timeline=1&sample=missing', 'prsOpened'),
    'https://example.test',
  );
  expect((await loadTimelineSupport(missing.pathname, missing.searchParams)).status).toBe(
    'invalid',
  );
  const bad = new URLSearchParams(url.search);
  bad.set('timeline.group', 'bad');
  expect((await loadTimelineSupport(url.pathname, bad)).status).toBe('invalid');
  expect((await loadTimelineSupport('/repos', new URLSearchParams(url.search))).status).toBe(
    'invalid',
  );
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
  const href = '/repos?timeline=1&repo=repo-prebidjs',
    loaded = await loadTimelineReport(href);
  if (loaded.status !== 'ready' || loaded.category !== 'matrix') throw Error('Expected matrix');
  const child = matrixRepositoryTimelineHref(loaded.controls, 'prebidjs', href)!;
  const url = new URL(
    timelineSupportHref(child, loaded.matrix.source, 'prsOpened', october, 'matrix')!,
    'https://example.test',
  );
  url.searchParams.set('prs.filter.authors', 'sample-bob');
  expect((await loadTimelineSupport(url.pathname, url.searchParams)).status).toBe('invalid');
});
