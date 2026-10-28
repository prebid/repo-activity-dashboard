import { expect, it } from 'vitest';
import {
  repositoryDrilldownHref,
  readRepositoryDrilldown,
} from '@/lib/presentation/repository-drilldown';
import { overviewReturnPathSchema, type DrilldownSelection } from '@/models/repository-drilldown';
import { activityMetricIds, agingThresholds, backlogMetricIds } from '@/models/repository-overview';

const repo = {
  id: 'repo-prebidjs',
  slug: 'prebidjs',
  name: 'Prebid.js',
  primaryBranch: 'master' as const,
};
const range = {
  start: '2026-10-01T00:00:00.000Z',
  end: '2026-10-24T12:00:00.000Z',
  endInclusive: true,
};

it('creates a pinned, readable current-backlog destination and retains return context', () => {
  const href = repositoryDrilldownHref(repo, {
    selection: { scope: 'current', metric: 'agedPrs', ageDays: 30 },
    returnTo: '/repos?repo=a&repo=b&activity.sort=prsMerged',
  });
  expect(href).toBe(
    '/repos/prebidjs?scope=current&metric=agedPrs&age=30&returnTo=%2Frepos%3Frepo%3Da%26repo%3Db%26activity.sort%3DprsMerged',
  );
});
it('keeps all approved metric and threshold descriptors round-trippable', () => {
  const selections: DrilldownSelection[] = [
    ...backlogMetricIds.map((metric): DrilldownSelection => ({ scope: 'current', metric })),
    ...agingThresholds.map((ageDays): DrilldownSelection => ({
      scope: 'current',
      metric: 'agedPrs',
      ageDays,
    })),
    ...activityMetricIds.map((metric): DrilldownSelection => ({
      scope: 'period',
      metric,
      range,
      ...(metric === 'prsMerged' ? { branch: 'master' } : {}),
    })),
    {
      scope: 'period',
      metric: 'medianMergeDays',
      branch: 'master',
      range: { ...range, endInclusive: false },
    },
  ];
  expect(selections).toHaveLength(37);
  for (const selection of selections) {
    const href = repositoryDrilldownHref(repo, { selection, returnTo: '/repos' });
    expect(
      readRepositoryDrilldown(new URL(href, 'https://dashboard.invalid').searchParams, repo),
    ).toEqual({ status: 'valid', value: { selection, returnTo: '/repos' } });
  }
});
it('accepts main branch merges and ignores unrelated table parameters', () => {
  expect(readRepositoryDrilldown(new URLSearchParams('view=issues&issues.page=2'), repo)).toEqual({
    status: 'none',
  });
  const selection: DrilldownSelection = {
    scope: 'period',
    metric: 'prsMerged',
    branch: 'main',
    range,
  };
  const main = { ...repo, primaryBranch: 'main' as const };
  const url = new URL(
    repositoryDrilldownHref(main, { selection, returnTo: '/repos' }),
    'https://dashboard.invalid',
  );
  url.searchParams.set('prs.page', '2');
  expect(readRepositoryDrilldown(url.searchParams, main)).toEqual({
    status: 'valid',
    value: { selection, returnTo: '/repos' },
  });
});
it.each([
  'metric=openIssues',
  'scope=current',
  'scope=current&metric=missing',
  'scope=current&metric=agedPrs',
  'scope=current&metric=agedPrs&age=31',
  'scope=current&metric=openIssues&age=30',
  'scope=current&metric=openIssues&branch=main',
  'scope=period&metric=prsOpened',
  'scope=period&metric=prsOpened&inclusive=yes',
  'returnTo=https://evil.example',
])('rejects malformed scope instead of selecting a different list: %s', (query) => {
  expect(readRepositoryDrilldown(new URLSearchParams(query), repo)).toEqual({ status: 'invalid' });
});
it('requires the configured primary branch only for merge metrics', () => {
  const url = new URL(
    repositoryDrilldownHref(repo, {
      selection: { scope: 'period', metric: 'prsMerged', branch: 'master', range },
      returnTo: '/repos',
    }),
    'https://dashboard.invalid',
  );
  url.searchParams.set('branch', 'main');
  expect(readRepositoryDrilldown(url.searchParams, repo)).toEqual({ status: 'invalid' });
  expect(() =>
    repositoryDrilldownHref(repo, {
      selection: { scope: 'period', metric: 'prsMerged', branch: 'main', range },
      returnTo: '/repos',
    }),
  ).toThrow('Invalid repository drilldown');
  url.searchParams.delete('branch');
  expect(readRepositoryDrilldown(url.searchParams, repo)).toEqual({ status: 'invalid' });
  url.searchParams.set('branch', 'master');
  url.searchParams.set('metric', 'prsOpened');
  expect(readRepositoryDrilldown(url.searchParams, repo)).toEqual({ status: 'invalid' });
});
it.each([
  'https://evil.example',
  '//evil.example',
  '/repos/elsewhere',
  '/repos#x',
  '/repos\\evil',
  '/repos\n',
  '/admin/users',
])('rejects unsafe or unrelated return path %s', (value) =>
  expect(overviewReturnPathSchema.safeParse(value).success).toBe(false),
);
it('uses the first scalar value consistently with foundation query parsing', () => {
  expect(
    readRepositoryDrilldown(
      new URLSearchParams('scope=current&metric=openIssues&metric=draftPrs'),
      repo,
    ),
  ).toEqual({
    status: 'valid',
    value: { selection: { scope: 'current', metric: 'openIssues' }, returnTo: '/repos' },
  });
});
