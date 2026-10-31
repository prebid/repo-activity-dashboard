import { beforeEach, expect, it, vi } from 'vitest';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
import { worldRepository } from '@/mocks/repository-world';
const viewer = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/viewer', () => ({ requireViewer: viewer }));
import { repositoryDetail, repositoryAuthorDetail } from '@/server/reporting';
beforeEach(() => {
  viewer.mockReset().mockResolvedValue({ id: 'sample-viewer' });
});
it('passes a complete source across the route boundary without redundant display-model fields', async () => {
  const result = await repositoryDetail(
    'prebidjs',
    new URLSearchParams('prs.filter.draft=non-drafts&prs.q=Sample+PR+18%3A'),
  );
  if (result.status !== 'page') throw Error('Expected page source');
  expect(viewer).toHaveBeenCalledTimes(1);
  expect(result.viewer.id).toBe('sample-viewer');
  expect(result.source.rows).toHaveLength(137);
  expect(result.source.measurement).toEqual({ status: 'complete', value: 137 });
  for (const field of ['charts', 'filters', 'cohortMeasurement', 'defaultSort'])
    expect(field in result.source).toBe(false);
});
it('retains the period, author and parent context on author-record sources', async () => {
  const period = repositoryOverviewSamples().periods.find(
    (item) =>
      item.period.selection.kind === 'preset' && item.period.selection.preset === 'this-year',
  )!.period;
  const params = new URLSearchParams({
    scope: 'period',
    metric: 'prAuthors',
    from: period.range.start,
    to: period.range.end,
    inclusive: period.range.endInclusive ? '1' : '0',
    'authors.page': '2',
    returnTo: '/repos?period=this-year',
  });
  const result = await repositoryAuthorDetail('prebidjs', 'sample-author-2', params);
  if (result.status !== 'list') throw Error('Expected author source');
  expect(viewer).toHaveBeenCalledTimes(1);
  const authored = worldRepository('repo-prebidjs').pullRequests.filter(
    (row) =>
      row.author === 'sample-author-2' &&
      row.createdAt >= period.range.start &&
      row.createdAt <= period.range.end,
  ).length;
  expect(authored).toBeGreaterThan(100);
  expect(result.source.rows).toHaveLength(authored);
  expect(result.source.measurement.value).toBe(authored);
  expect(result.source.author?.account).toBe('sample-author-2');
  expect(result.source.author?.returnTo).toContain('authors.page=2');
  expect(result.source.drilldown.returnTo).toBe('/repos?period=this-year');
  expect(result.source.drilldown.selection).toMatchObject({
    scope: 'period',
    metric: 'prsOpened',
    range: period.range,
  });
  expect('charts' in result.source).toBe(false);
  expect('filters' in result.source).toBe(false);
});
