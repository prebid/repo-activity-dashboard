import { expect, it } from 'vitest';
import { readRepositoryPageEntry } from '@/lib/presentation/repository-page-entry';
import { repositoryDrilldownHref } from '@/lib/presentation/repository-drilldown';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
import { backlogMetricIds, activityMetricIds, agingThresholds } from '@/models/repository-overview';
import type { DrilldownSelection } from '@/models/repository-drilldown';
const samples = repositoryOverviewSamples();
const repo = samples.repositories[0].repository;
it('defaults direct visits to current open records without restoring a historical scope', () => {
  for (const [query, metric] of [
    ['', 'totalOpenPrs'],
    ['view=prs', 'totalOpenPrs'],
    ['view=issues', 'openIssues'],
    ['period=last-month&prs.sort=ageDays', 'totalOpenPrs'],
  ]) {
    expect(readRepositoryPageEntry(new URLSearchParams(query), repo)).toEqual({
      status: 'records',
      drilldown: { selection: { scope: 'current', metric }, returnTo: '/repos' },
    });
  }
  expect(
    readRepositoryPageEntry(new URLSearchParams('view=issues&returnTo=%2Frepos%3Fage%3D60'), repo),
  ).toMatchObject({ drilldown: { returnTo: '/repos?age=60' } });
});
it('preserves every existing metric entry and routes supporting lists separately', () => {
  const selections: DrilldownSelection[] = [
    ...backlogMetricIds.map((metric) => ({ scope: 'current' as const, metric })),
    ...agingThresholds.map((ageDays) => ({
      scope: 'current' as const,
      metric: 'agedPrs' as const,
      ageDays,
    })),
    ...[...activityMetricIds, 'medianMergeDays' as const].map((metric) => ({
      scope: 'period' as const,
      metric,
      range: samples.periods[0].period.range,
      ...(['prsMerged', 'medianMergeDays'].includes(metric) ? { branch: repo.primaryBranch } : {}),
    })),
  ];
  expect(selections).toHaveLength(37);
  for (const selection of selections) {
    const drilldown = { selection, returnTo: '/repos?period=this-week&period2=last-week&age=60' };
    const url = new URL(repositoryDrilldownHref(repo, drilldown), 'https://dashboard.invalid');
    url.searchParams.set('view', 'issues'); // explicit metric still owns the destination
    const result = readRepositoryPageEntry(url.searchParams, repo);
    const supporting = [
      'prAuthors',
      'issueAuthors',
      'agentFeedbackCredits',
      'agentApprovalCredits',
      'botFeedbackCredits',
      'botApprovalCredits',
      'medianMergeDays',
    ].includes(selection.metric);
    expect(result).toEqual({ status: supporting ? 'supporting' : 'records', drilldown });
  }
});
it.each([
  'view=other',
  'scope=current&metric=wrong',
  'age=45',
  'returnTo=%2F%2Fevil.example',
  'scope=period&metric=prsMerged&branch=main&from=2026-10-01T00:00:00.000Z&to=2026-10-24T12:00:00.000Z&inclusive=1',
])('rejects invalid entry instead of broadening its cohort: %s', (query) => {
  expect(
    readRepositoryPageEntry(new URLSearchParams(query), { ...repo, primaryBranch: 'master' }),
  ).toEqual({ status: 'invalid' });
});
