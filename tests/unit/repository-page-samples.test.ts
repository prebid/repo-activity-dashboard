import { repositoryAuthorRecordSample } from '@/mocks/repository-insights';
import { expect, it } from 'vitest';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
import { repositoryRecordSample } from '@/mocks/repository-records';
import { repositoryPageSample, repositoryPageRecordsSample } from '@/mocks/repository-page';
import { selectRepositoryPage } from '@/lib/presentation/repository-page';
import { backlogMetricIds, agingThresholds } from '@/models/repository-overview';
import type { RecordSelection } from '@/models/repository-records';
const samples = repositoryOverviewSamples();
it.each(samples.repositories)(
  'reconciles page rows/charts with every prepared cohort: $repository.slug',
  ({ repository }) => {
    const selections: RecordSelection[] = [
      ...backlogMetricIds.map((metric) => ({ scope: 'current' as const, metric })),
      ...agingThresholds.map((ageDays) => ({
        scope: 'current' as const,
        metric: 'agedPrs' as const,
        ageDays,
      })),
    ];
    for (const { period } of samples.periods)
      for (const metric of ['prsOpened', 'prsMerged', 'issuesOpened', 'issuesClosed'] as const)
        selections.push({
          scope: 'period',
          metric,
          range: period.range,
          ...(metric === 'prsMerged' ? { branch: repository.primaryBranch } : {}),
        });
    for (const selection of selections) {
      const drilldown = {
        selection,
        returnTo: '/repos?period=this-month&period2=last-month&age=60',
      };
      const original = repositoryRecordSample(repository, drilldown);
      const source = repositoryPageSample(repository, drilldown),
        page = selectRepositoryPage(source);
      expect(page.measurement).toEqual(original.measurement);
      expect(page.rows.map((row) => row.id)).toEqual(original.rows.map((row) => row.id));
      expect(page.drilldown).toEqual(drilldown);
      expect(new Set(page.rows.map((row) => row.id)).size).toBe(page.rows.length);
      for (const [index, row] of page.rows.entries()) {
        expect(row).toMatchObject(original.rows[index]);
        if (row.latestActivity) {
          expect(row.latestActivity.at >= row.createdAt).toBe(true);
          expect(row.latestActivity.at <= page.asOf).toBe(true);
          if (row.latestActivity.account === row.author && row.authorType !== 'human')
            expect(row.latestActivity.category).toBe(row.authorType);
        }
      }
      for (const chart of page.charts) {
        if (chart.measurement.value === null) {
          expect(chart.points.every((point) => point.count.value === null)).toBe(true);
          continue;
        }
        expect(chart.points.reduce((sum, point) => sum + (point.count.value ?? 0), 0)).toBe(
          chart.measurement.value,
        );
        if (chart.kind !== 'activity')
          expect(chart.measurement.value + chart.excludedDrafts).toBe(page.rows.length);
      }
    }
  },
);
it('retains a complete large population and representative bot/agent metadata without fetching data', () => {
  const docs = samples.repositories.find((row) => row.repository.slug === 'prebiddocs')!.repository;
  const huge = selectRepositoryPage(
    repositoryPageSample(docs, {
      selection: { scope: 'current', metric: 'openIssues' },
      returnTo: '/repos',
    }),
  );
  expect(huge.rows).toHaveLength(12345);
  expect(huge.measurement.value).toBe(12345);
  expect(huge.charts[0].measurement.value).toBe(12345);
  const js = samples.repositories[0].repository;
  const period = samples.periods.find(
    ({ period }) => period.selection.kind === 'preset' && period.selection.preset === 'this-year',
  )!.period;
  const source = repositoryPageSample(js, {
    selection: { scope: 'period', metric: 'prsOpened', range: period.range },
    returnTo: '/repos',
  });
  const authored = (login: string) => source.rows.filter((row) => row.author === login).length;
  expect(authored('sample-author-2')).toBeGreaterThan(100);
  expect(
    selectRepositoryPage(source, { kind: 'prs', authors: ['sample-author-2'] }).rows,
  ).toHaveLength(authored('sample-author-2'));
  const bot = selectRepositoryPage(source, { kind: 'prs', authors: ['sample-author-3[bot]'] });
  expect(bot.rows.length).toBeGreaterThan(0);
  expect(bot.rows).toHaveLength(authored('sample-author-3[bot]'));
  expect(bot.rows.every((row) => row.authorType === 'bot')).toBe(true);
  // The record set starts in 2024, so an earlier range has no prepared coverage.
  const missing = repositoryPageSample(js, {
    selection: {
      scope: 'period',
      metric: 'issuesOpened',
      range: {
        start: '2023-10-01T00:00:00.000Z',
        end: '2023-10-02T00:00:00.000Z',
        endInclusive: false,
      },
    },
    returnTo: '/repos',
  });
  expect(selectRepositoryPage(missing).measurement.status).toBe('missing');
});

it('keeps metadata stable across narrower drilldowns and existing author-record sources', () => {
  const repo = samples.repositories[0].repository;
  const all = repositoryPageSample(repo, {
    selection: { scope: 'current', metric: 'totalOpenPrs' },
    returnTo: '/repos',
  });
  const aged = repositoryPageSample(repo, {
    selection: { scope: 'current', metric: 'agedPrs', ageDays: 60 },
    returnTo: '/repos',
  });
  expect(aged.rows.length).toBe(60);
  for (const row of aged.rows)
    expect(row).toEqual(all.rows.find((candidate) => candidate.id === row.id));
  const range = samples.periods.find(
    ({ period }) => period.selection.kind === 'preset' && period.selection.preset === 'this-year',
  )!.period.range;
  const opened = repositoryPageSample(repo, {
    selection: { scope: 'period', metric: 'issuesOpened', range },
    returnTo: '/repos',
  });
  const author = repositoryAuthorRecordSample(
    repo,
    {
      selection: { scope: 'period', metric: 'issueAuthors', range },
      returnTo: '/repos?period=this-year',
    },
    'sample-author-2',
    '/repos/prebidjs?authors.page=2',
  );
  const child = selectRepositoryPage(repositoryPageRecordsSample(author));
  expect(child.rows.length).toBeGreaterThan(100);
  expect(child.rows).toHaveLength(
    opened.rows.filter((row) => row.author === 'sample-author-2').length,
  );
  expect(child.author).toEqual({
    account: 'sample-author-2',
    returnTo: '/repos/prebidjs?authors.page=2',
  });
  for (const row of child.rows)
    expect(row).toEqual(opened.rows.find((candidate) => candidate.id === row.id));
});
