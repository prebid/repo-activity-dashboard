import { expect, it } from 'vitest';
import {
  chartPointSelection,
  isChartSelection,
  toggleChartSelection,
} from '@/lib/presentation/repository-chart-selection';
import { selectRepositoryPage } from '@/lib/presentation/repository-page';
import { repositoryPageSample } from '@/mocks/repository-page';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
import { repositoryPageFiltersSchema, type RepositoryChart } from '@/models/repository-page';
const samples = repositoryOverviewSamples(),
  repo = samples.repositories[0].repository;
it('reconciles every chart selection with the full cohort, independently of fifty-row display pages', () => {
  const scopes = [
    { scope: 'current' as const, metric: 'totalOpenPrs' as const },
    { scope: 'current' as const, metric: 'openIssues' as const },
    { scope: 'current' as const, metric: 'agedPrs' as const, ageDays: 60 as const },
    ...samples.periods.flatMap(({ period }) =>
      (['prsOpened', 'prsMerged', 'issuesOpened', 'issuesClosed'] as const).map((metric) => ({
        scope: 'period' as const,
        metric,
        range: period.range,
        ...(metric === 'prsMerged' ? { branch: repo.primaryBranch } : {}),
      })),
    ),
  ];
  let pointsChecked = 0;
  for (const selection of scopes) {
    const source = repositoryPageSample(repo, { selection, returnTo: '/repos?period=this-week' });
    for (const authors of [[], ['sample-alice'], ['sample-author-2']]) {
      const page = selectRepositoryPage(source, { kind: source.kind, authors });
      for (const chart of page.charts)
        for (const [index, point] of chart.points.entries()) {
          if (point.count.value === null) continue;
          const selected = chartPointSelection(chart, index);
          const filters = toggleChartSelection(page.filters, selected);
          const detail = selectRepositoryPage(source, filters);
          expect(detail.rows.length).toBe(point.count.value);
          expect(detail.measurement.value).toBe(point.count.value);
          expect(detail.drilldown).toEqual(source.drilldown);
          expect(filters.authors).toEqual(authors);
          expect(isChartSelection(filters, selected)).toBe(true);
          expect(toggleChartSelection(filters, selected)).toEqual({
            ...page.filters,
            ...(selected.kind === 'activity'
              ? { eventRange: undefined }
              : selected.kind === 'age'
                ? { ageBand: undefined }
                : { [selected.kind]: undefined }),
          });
          pointsChecked++;
        }
    }
  }
  expect(pointsChecked).toBeGreaterThan(1000);
});
it('keeps human reviewers and approvals independent, and never includes drafts in a review bar', () => {
  const source = repositoryPageSample(repo, {
    selection: { scope: 'current', metric: 'totalOpenPrs' },
    returnTo: '/repos',
  });
  const page = selectRepositoryPage(source);
  expect(page.charts.map((chart) => chart.measurement.value)).toEqual([137, 120, 120]);
  const approvals = toggleChartSelection(page.filters, { kind: 'approvals', key: '0' });
  const narrowed = selectRepositoryPage(source, approvals);
  const reviewers = toggleChartSelection(narrowed.filters, { kind: 'reviewers', key: '1' });
  const result = selectRepositoryPage(source, reviewers);
  expect(result.rows).toHaveLength(21);
  expect(
    result.rows.every(
      (row) => 'draft' in row && !row.draft && row.humanReviewers === 1 && row.approvals === 0,
    ),
  ).toBe(true);
  expect(toggleChartSelection(reviewers, { kind: 'reviewers', key: '1' })).toMatchObject({
    approvals: '0',
    reviewers: undefined,
  });
  const issues = repositoryPageFiltersSchema.parse({ kind: 'issues' });
  expect(isChartSelection(issues, { kind: 'reviewers', key: '0' })).toBe(false);
  expect(() => toggleChartSelection(issues, { kind: 'approvals', key: '0' })).toThrow(
    'Review charts require PR filters',
  );
});
it('distinguishes inclusive endpoints and rejects mismatched chart point types', () => {
  const range = {
    start: '2026-10-01T00:00:00.000Z',
    end: '2026-10-02T00:00:00.000Z',
    endInclusive: false,
  };
  const filters = repositoryPageFiltersSchema.parse({ kind: 'issues', eventRange: range });
  expect(
    isChartSelection(filters, { kind: 'activity', range: { ...range, endInclusive: true } }),
  ).toBe(false);
  expect(
    isChartSelection(filters, { kind: 'activity', range: { ...range, start: range.end } }),
  ).toBe(false);
  expect(
    isChartSelection(filters, {
      kind: 'activity',
      range: { ...range, end: '2026-10-03T00:00:00.000Z' },
    }),
  ).toBe(false);
  const invalid: RepositoryChart = {
    kind: 'age',
    measurement: { status: 'complete', value: 1 },
    excludedDrafts: 0,
    points: [{ key: '0', label: 'bad', count: { status: 'complete', value: 1 } }],
  };
  expect(() => chartPointSelection(invalid, 0)).toThrow(
    'Chart point does not match its distribution',
  );
});
