import { repositoryTimelineMetricScope } from '@/models/repository-timeline';
import { beforeEach, expect, it, vi } from 'vitest';
const viewer = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/viewer', () => ({ requireViewer: viewer }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw Error('not-found');
  },
}));
import {
  contributionTimelinePreview,
  repositoryTimelinePreview,
  repositoryTimelineMatrixPreview,
} from '@/server/timeline-preview';
beforeEach(() => {
  viewer.mockReset().mockResolvedValue({ id: 'sample-viewer' });
});
it('guards both sample compositions and returns only their active model', async () => {
  const query = new URLSearchParams('timeline=1&sample=large');
  const result = await contributionTimelinePreview('companies', query);
  expect(viewer).toHaveBeenCalledOnce();
  expect(result.status).toBe('ready');
  expect(JSON.stringify(result)).not.toContain('Sample contributor 250');
  expect(result).not.toHaveProperty('directory');
  const repo = await repositoryTimelinePreview('prebidjs', new URLSearchParams('timeline=1'));
  expect(repo.status).toBe('ready');
  expect(JSON.stringify(repo)).not.toContain('Sample PR');
  viewer.mockRejectedValue(Error('denied'));
  await expect(contributionTimelinePreview('contributors', query)).rejects.toThrow('denied');
  await expect(repositoryTimelinePreview('prebidjs', query)).rejects.toThrow('denied');
  await expect(
    repositoryTimelineMatrixPreview(new URLSearchParams('timeline=bad')),
  ).rejects.toThrow('denied');
});
it('keeps contribution population, exact range and the return report explicit', async () => {
  const query = new URLSearchParams(
    'timeline=1&timeline.group=week&period=this-month&repo=repo-prebidjs&type=human&company=company-acme&exclude=account-alice&report.q=Bob',
  );
  const result = await contributionTimelinePreview('companies', query, {
    kind: 'company',
    companyId: 'company-acme',
  });
  if (result.status !== 'ready') throw Error('Expected timeline');
  expect(result.report.scope.includedAccountCount).toBe(2);
  expect(result.report.request.grouping).toBe('week');
  expect(result.report.summary.prsAuthored.value).toBe(2);
  const back = new URL(result.reportHref, 'https://example.test');
  expect(back.pathname).toBe('/companies/id/company-acme');
  expect(back.searchParams.get('report.q')).toBe('Bob');
  expect(back.searchParams.get('scope')).toBe('1');
  expect(back.searchParams.has('timeline')).toBe(false);
  expect(back.searchParams.getAll('exclude')).toEqual(['account-alice']);
  const empty = await contributionTimelinePreview(
    'contributors',
    new URLSearchParams('timeline=1&repo='),
  );
  expect(empty.status === 'ready' && empty.report.rows.length).toBe(0);
});
it.each([
  'timeline=0',
  'timeline=1&timeline=1',
  'timeline=1&timeline.group=bad',
  'timeline=1&timeline.foo=1',
  'timeline=1&timeline.group=day&timeline.group=week',
  'timeline=1&metric=prsAuthored',
  'timeline=1&sample=bad',
  'timeline=1&sample=mixed',
  'timeline=1&period=bad',
  'timeline=1&repo=missing',
  'timeline=1&timeline.family=snapshot',
  'timeline=1&view=other',
])('rejects invalid contribution preview %s', async (query) =>
  expect(
    (await contributionTimelinePreview('contributors', new URLSearchParams(query))).status,
  ).toBe('invalid'),
);
it('rejects excessive intervals/URL size and unknown entities', async () => {
  const oversized = new URLSearchParams(
    'timeline=1&timeline.group=day&period=custom&from=2020-01-01&through=2026-10-24',
  );
  expect(await contributionTimelinePreview('contributors', oversized)).toMatchObject({
    status: 'invalid',
    message: 'Timeline exceeds 500 intervals; narrow the range or choose a coarser grouping',
  });
  expect((await repositoryTimelinePreview('prebidjs', oversized)).status).toBe('invalid');
  expect(
    (
      await contributionTimelinePreview(
        'contributors',
        new URLSearchParams('timeline=1&report.q=' + 'x'.repeat(8000)),
      )
    ).status,
  ).toBe('invalid');
  await expect(
    contributionTimelinePreview('contributors', new URLSearchParams('timeline=1'), {
      kind: 'contributor',
      accountId: 'absent',
    }),
  ).rejects.toThrow('not-found');
  await expect(
    contributionTimelinePreview('companies', new URLSearchParams('timeline=1'), {
      kind: 'company',
      companyId: 'absent',
    }),
  ).rejects.toThrow('not-found');
  await expect(
    repositoryTimelinePreview('absent', new URLSearchParams('timeline=1')),
  ).rejects.toThrow('not-found');
  expect(
    (
      await contributionTimelinePreview('companies', new URLSearchParams('timeline=1'), {
        kind: 'company',
        companyId: null,
      })
    ).status,
  ).toBe('ready');
});

it('composes all repositories or explicit subsets without hidden histories and preserves Summary', async () => {
  const all = await repositoryTimelineMatrixPreview(new URLSearchParams('timeline=1'));
  expect(viewer).toHaveBeenCalledOnce();
  expect(all.status === 'ready' && all.matrix.rows.length).toBe(18);
  expect(JSON.stringify(all)).not.toContain('Sample PR');
  expect(all).not.toHaveProperty('navigation');
  expect(all).not.toHaveProperty('directory');
  const summary =
    '/repos?period=this-week&period2=last-month&age=30&age=60&activity.sort=prsMerged';
  const query = new URLSearchParams({ timeline: '1', repo: 'repo-prebidjs', summary });
  query.append('repo', 'repo-prebidjs');
  const subset = await repositoryTimelineMatrixPreview(query);
  if (subset.status !== 'ready') throw Error('Expected matrix');
  expect(subset.matrix.scope.repositoryIds).toEqual(['repo-prebidjs']);
  expect(subset.matrix.rows[0].values.map((value) => value.value)).toEqual([
    0, 0, 0, 0, 0, 0, 0, 1, 1, 3,
  ]);
  expect(subset.summaryHref).toBe(summary);
  expect(subset.href).toBe('/repos?' + query.toString());
  const none = await repositoryTimelineMatrixPreview(new URLSearchParams('timeline=1&repo='));
  expect(none.status === 'ready' && none.matrix.rows).toEqual([]);
});
it.each([
  ['issuesClosed', 'issues', 'activity', 'count', 'event', 'closedAt'],
  ['medianMergeDays', 'prs', 'activity', 'days', 'duration', 'mergedAt'],
  ['humanApprovals1', 'prs', 'snapshot', 'count', 'snapshot', null],
  ['openIssues', 'issues', 'snapshot', 'count', 'snapshot', null],
] as const)(
  'derives compatible scope from the active %s metric',
  async (metric, recordKind, family, unit, basis, eventDate) => {
    const result = await repositoryTimelineMatrixPreview(
      new URLSearchParams('timeline=1&timeline.metric=' + metric + '&sample=mixed'),
    );
    expect(result.status === 'ready' && result.matrix.scope.metrics).toEqual([metric]);
    expect(repositoryTimelineMetricScope(metric)).toEqual({
      recordKind,
      family,
      unit,
      basis,
      eventDate,
    });
    expect(
      result.status === 'ready' &&
        result.matrix.rows
          .find((row) => row.id === 'repo-prebidserverjava')!
          .values.every((value) => value.status === 'missing'),
    ).toBe(true);
  },
);
it.each([
  'timeline=0',
  'timeline=1&repo=unknown',
  'timeline=1&timeline.metric=invalid',
  'timeline=1&sample=reference&sample=mixed',
  'timeline=1&timeline.kind=issues',
  'timeline=1&timeline.family=snapshot',
  'timeline=1&other=1',
  'timeline=1&summary=https://example.test',
  'timeline=1&summary=%2Frepos&summary=%2Frepos',
  'timeline=1&period=bad',
  'timeline=1&period=custom&from=2020-01-01&through=2026-10-24&timeline.group=day',
  'timeline=1&summary=%2Frepos%3Ftimeline%3D1',
  'timeline=1&summary=' + encodeURIComponent('/repos?q=' + 'a'.repeat(8000)),
])('rejects invalid matrix preview %s', async (query) =>
  expect((await repositoryTimelineMatrixPreview(new URLSearchParams(query))).status).toBe(
    'invalid',
  ),
);
it('composes issue/snapshot/partial previews and applies compatible record filters', async () => {
  const result = await repositoryTimelinePreview(
    'prebidjs',
    new URLSearchParams(
      'timeline=1&timeline.kind=issues&timeline.family=snapshot&timeline.group=day&period=custom&from=2026-10-11&through=2026-10-21',
    ),
  );
  expect(result.status === 'ready' && result.report.summary.openIssues?.value).toBe(2);
  const gap = await contributionTimelinePreview(
    'contributors',
    new URLSearchParams('timeline=1&timeline.gap=1'),
  );
  expect(gap.status === 'ready' && gap.report.summary.prsAuthored.status).toBe('partial');
  const all = await repositoryTimelinePreview('prebidjs', new URLSearchParams('timeline=1'));
  const alice = await repositoryTimelinePreview(
    'prebidjs',
    new URLSearchParams('timeline=1&prs.filter.authors=sample-alice'),
  );
  if (all.status !== 'ready' || alice.status !== 'ready') throw Error('Expected previews');
  expect(all.report.summary.prsOpened).toEqual({ status: 'complete', value: 5 });
  expect(alice.report.summary.prsOpened).toEqual({ status: 'complete', value: 1 });
  expect(
    (
      await repositoryTimelinePreview(
        'prebidjs',
        new URLSearchParams('timeline=1&timeline.kind=bad'),
      )
    ).status,
  ).toBe('invalid');
});
it('rejects ambiguous scalar scope fields rather than broadening a copied contribution report', async () => {
  for (const query of [
    'timeline=1&population=all&population=selected',
    'timeline=1&scope=1&scope=0',
    'timeline=1&view=members&view=repositories',
  ])
    expect(
      (await contributionTimelinePreview('contributors', new URLSearchParams(query))).status,
    ).toBe('invalid');
  expect(
    (
      await repositoryTimelinePreview(
        'prebidjs',
        new URLSearchParams('timeline=1&prs.q=one&prs.q=two'),
      )
    ).status,
  ).toBe('invalid');
});
