import { beforeEach, expect, it, vi } from 'vitest';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
import { worldRepository } from '@/mocks/repository-world';
import type { UrlValues } from '@/lib/presentation/url/registry';
const viewer = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/viewer', () => ({ requireViewer: viewer }));
import { repositoryDetail, repositoryAuthorDetail } from '@/server/reporting';
beforeEach(() => {
  viewer.mockReset().mockResolvedValue({ id: 'sample-viewer' });
});
it('passes a complete source across the route boundary without redundant display-model fields', async () => {
  const result = await repositoryDetail('prebidjs', { draft: 'non-drafts', q: 'Sample PR 18:' });
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
  const result = await repositoryAuthorDetail('prebidjs', 'sample-author-2', {
    period: 'this-year',
    at: '2026-10-24T12:00Z',
    metric: 'prAuthors',
    listpage: '2',
    back: ['~period:this-year'],
  });
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
  // The author list keeps its page and its own return context.
  expect(result.source.author?.returnTo).toBe(
    '/repos/prebidjs?period=this-year&at=2026-10-24T12:00Z&metric=prAuthors&page=2&back=~period:this-year',
  );
  expect(result.source.drilldown.returnTo).toBe('/repos?period=this-year');
  expect(result.source.drilldown.selection).toMatchObject({
    scope: 'period',
    metric: 'prsOpened',
    range: period.range,
  });
  expect('charts' in result.source).toBe(false);
  expect('filters' in result.source).toBe(false);
});
it('rejects values that select no list, name unknown columns or an invalid author', async () => {
  for (const values of [
    { metric: 'prsOpened' },
    { cols: ['nope'] },
    { metric: 'prAuthors', period: 'this-year', cols: ['author'] },
  ] as UrlValues[])
    expect(await repositoryDetail('prebidjs', values), JSON.stringify(values)).toEqual({
      status: 'invalid',
    });
  const author = { period: 'this-year', metric: 'prAuthors' };
  for (const [account, values] of [
    [null, author],
    ['sample-author-2', { metric: 'prsOpened', period: 'this-year' }],
    ['sample-author-2', { ...author, cols: ['nope'] }],
  ] as const)
    expect(await repositoryAuthorDetail('prebidjs', account, values)).toEqual({
      status: 'invalid',
    });
  // A Summary that cannot be restored leaves the list itself readable.
  const unavailable = await repositoryDetail('prebidjs', { view: 'issues', back: ['!'] });
  if (unavailable.status !== 'page') throw Error('Expected page source');
  expect(unavailable.source.drilldown.returnTo).toBeNull();
});
