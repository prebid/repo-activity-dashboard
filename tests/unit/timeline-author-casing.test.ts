import { beforeEach, expect, it, vi } from 'vitest';
const viewer = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
// The reference cast, with Bob's PR 105 authored under a differently cased spelling of his login.
vi.mock('@/mocks/repository-timeline', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/mocks/repository-timeline')>();
  const { onlyCast } = await import('../support/cast-source');
  return {
    ...actual,
    repositoryTimelineSample: (...args: Parameters<typeof actual.repositoryTimelineSample>) => {
      const [kind, repositoryId, scenario = 'reference', gap = false] = args;
      const source = onlyCast(
        actual.repositoryTimelineSample(kind, repositoryId, scenario, gap),
        scenario,
        gap,
      );
      for (const row of source.rows) if (row.number === 105) row.author = 'Sample-Bob';
      return source;
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
import { timelineSupportHref } from '@/lib/presentation/timeline-support-query';
beforeEach(() => {
  viewer.mockReset().mockResolvedValue({ id: 'sample-viewer' });
});

it('opens one author drilldown for every casing of a login the interval observed', async () => {
  const parent = '/repos/prebidjs?timeline=1';
  const report = await loadTimelineReport(parent);
  if (report.status !== 'ready' || report.category === 'matrix') throw Error('Expected report');
  const url = new URL(
    timelineSupportHref(
      parent,
      report.report.source,
      'prAuthors',
      'month:2026-10-01T00:00:00.000Z',
    )!,
    'https://example.test',
  );
  const authors = await loadTimelineSupport(url.pathname, url.searchParams);
  if (authors.status !== 'ready' || authors.detail.kind !== 'authors')
    throw Error('Expected authors');
  // October's Prebid.js PRs are Bob's 105 and 108 and Drew's 107.
  expect(authors.detail.rows.map((row) => [row.account, row.recordCount])).toEqual([
    ['Sample-Bob', 2],
    ['sample-drew', 1],
  ]);
  for (const login of ['Sample-Bob', 'sample-bob', 'SAMPLE-BOB']) {
    url.searchParams.set('support.author', login);
    const records = await loadTimelineSupport(url.pathname, url.searchParams);
    if (records.status !== 'ready' || records.detail.kind !== 'repository')
      throw Error('Expected records for ' + login);
    expect(records.detail.author).toBe('Sample-Bob');
    expect(records.detail.rows.map((row) => row.number)).toEqual([105, 108]);
  }
});
