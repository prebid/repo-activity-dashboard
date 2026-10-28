import { expect, it } from 'vitest';
import { repositoryInsightSample } from '@/mocks/repository-insights';
import { repositoryRecordSample } from '@/mocks/repository-records';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
import { insightMetrics, type InsightMetric } from '@/models/repository-insights';
import { isInsightSelection, mergeElapsedDays } from '@/lib/presentation/repository-insights';
import { isRecordSelection } from '@/lib/presentation/repository-records';
import { backlogMetricIds, activityMetricIds, agingThresholds } from '@/models/repository-overview';
import type { DrilldownSelection } from '@/models/repository-drilldown';
const samples = repositoryOverviewSamples();
const js = samples.repositories.find((row) => row.repository.slug === 'prebidjs')!.repository;
const month = samples.periods.find(
  ({ period }) => period.selection.kind === 'preset' && period.selection.preset === 'this-month',
)!;
it('routes every approved metric to exactly one supported detail type', () => {
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
      range: month.period.range,
      ...(metric === 'prsMerged' ? { branch: 'master' } : {}),
    })),
    { scope: 'period', metric: 'medianMergeDays', range: month.period.range, branch: 'master' },
  ];
  expect(selections).toHaveLength(37);
  for (const selection of selections)
    expect(Number(isRecordSelection(selection)) + Number(isInsightSelection(selection))).toBe(1);
});
function load(metric: InsightMetric) {
  return repositoryInsightSample(js, {
    selection: {
      scope: 'period',
      metric,
      range: month.period.range,
      ...(metric === 'medianMergeDays' ? { branch: js.primaryBranch } : {}),
    },
    returnTo: '/repos?period=this-month&age=60',
  });
}
it('reconciles every author, contribution and duration detail across all repositories and prepared ranges', () => {
  for (const { repository } of samples.repositories)
    for (const period of samples.periods)
      for (const metric of insightMetrics) {
        const source = period.rows[repository.id].activity;
        const detail = repositoryInsightSample(repository, {
          selection: {
            scope: 'period',
            metric,
            range: period.period.range,
            ...(metric === 'medianMergeDays' ? { branch: repository.primaryBranch } : {}),
          },
          returnTo: '/repos',
        });
        if (detail.kind === 'duration') {
          expect(detail.records.rows.length).toBe(source.mergeDuration.sampleSize.value);
          const times = detail.records.rows
            .map((row) => (Date.parse(row.mergedAt!) - Date.parse(row.createdAt)) / 86_400_000)
            .sort((a, b) => a - b);
          const middle = Math.floor(times.length / 2);
          const median = !times.length
            ? null
            : times.length % 2
              ? times[middle]
              : (times[middle - 1] + times[middle]) / 2;
          if (median === null) expect(detail.days.value).toBeNull();
          else expect(median).toBeCloseTo(detail.days.value!, 9);
          expect(detail.days).toEqual(source.mergeDuration.days);
          expect(
            detail.records.rows.every(
              (row) => row.baseBranch === repository.primaryBranch && row.state === 'Merged',
            ),
          ).toBe(true);
        } else {
          expect(detail.rows.length).toBe(detail.measurement.value);
          expect(new Set(detail.rows.map((row) => row.id)).size).toBe(detail.rows.length);
          if (detail.kind === 'authors') {
            expect(new Set(detail.rows.map((row) => row.account)).size).toBe(detail.rows.length);
            expect(detail.rows.reduce((sum, row) => sum + row.recordCount, 0)).toBe(
              source.counts[detail.recordKind === 'prs' ? 'prsOpened' : 'issuesOpened'].value,
            );
            for (const row of detail.rows) expect(row.recordCount).toBe(row.records.length);
          } else {
            for (const row of detail.rows) {
              expect(row.firstCreditAt >= period.period.range.start).toBe(true);
              expect(
                period.period.range.endInclusive
                  ? row.firstCreditAt <= period.period.range.end
                  : row.firstCreditAt < period.period.range.end,
              ).toBe(true);
              expect(row.accountType).toBe(metric.startsWith('agent') ? 'agent' : 'bot');
              expect(row.contribution).toBe(
                metric.endsWith('ApprovalCredits') ? 'approval' : 'reviewer',
              );
            }
          }
        }
      }
});
it('counts authors once per repository, includes all account types, and links the exact opened records', () => {
  const pr = load('prAuthors'),
    issues = load('issueAuthors');
  if (pr.kind !== 'authors' || issues.kind !== 'authors') throw new Error('Expected authors');
  expect(pr.rows).toHaveLength(24);
  expect(issues.rows).toHaveLength(39);
  expect(new Set(pr.rows.map((row) => row.accountType))).toEqual(
    new Set(['human', 'agent', 'bot']),
  );
  const opened = repositoryRecordSample(js, {
    selection: { scope: 'period', metric: 'prsOpened', range: month.period.range },
    returnTo: '/repos',
  });
  expect(new Set(pr.rows.flatMap((row) => row.records.map((record) => record.id)))).toEqual(
    new Set(opened.rows.map((row) => row.id)),
  );
  expect(pr.rows.reduce((sum, row) => sum + row.recordCount, 0)).toBe(47);
  expect(issues.rows.reduce((sum, row) => sum + row.recordCount, 0)).toBe(58);
  const other = samples.repositories.find(
    (row) => row.repository.slug === 'prebidserver',
  )!.repository;
  const otherAuthors = repositoryInsightSample(other, pr.drilldown);
  if (otherAuthors.kind !== 'authors') throw new Error('Expected authors');
  expect(otherAuthors.rows).toHaveLength(12);
  expect(
    pr.rows.some((row) => otherAuthors.rows.some((otherRow) => otherRow.account === row.account)),
  ).toBe(true);
  expect(new Set([...pr.rows, ...otherAuthors.rows].map((row) => row.id)).size).toBe(36);
});
it('keeps account/PR/metric credits distinct, with first-credit dates and older PRs', () => {
  const reviewers = load('agentFeedbackCredits'),
    approvals = load('agentApprovalCredits'),
    bots = load('botFeedbackCredits');
  if (
    reviewers.kind !== 'contributions' ||
    approvals.kind !== 'contributions' ||
    bots.kind !== 'contributions'
  )
    throw new Error('Expected credits');
  expect(reviewers.rows).toHaveLength(18);
  expect(approvals.rows).toHaveLength(9);
  expect(bots.rows).toHaveLength(11);
  expect(new Set(reviewers.rows.map((row) => row.pr.id)).size).toBe(9);
  expect(new Set(reviewers.rows.map((row) => row.account)).size).toBe(2);
  expect(new Set([...reviewers.rows, ...approvals.rows].map((row) => row.id)).size).toBe(27);
  const merged = repositoryRecordSample(js, {
    selection: {
      scope: 'period',
      metric: 'prsMerged',
      range: month.period.range,
      branch: 'master',
    },
    returnTo: '/repos',
  });
  expect(merged.kind).toBe('prs');
  const older = merged.rows.find((row) => row.createdAt < month.period.range.start)!;
  expect(reviewers.rows.some((row) => row.pr.id === older.id)).toBe(true);
  for (const row of [...reviewers.rows, ...approvals.rows]) {
    const source = merged.rows.find((record) => record.id === row.pr.id);
    if (source && 'mergedAt' in source) {
      expect(row.firstCreditAt >= source.createdAt).toBe(true);
      expect(row.firstCreditAt <= source.mergedAt!).toBe(true);
    }
    expect(new URL(row.pr.url).hostname).toBe('github.example');
  }
});
it('distinguishes known zero, absent samples and no-merge duration', () => {
  const empty = samples.repositories.find(
    (row) => row.repository.slug === 'prebid-mobile-ios-sdk',
  )!.repository;
  for (const metric of insightMetrics) {
    const selection = {
      scope: 'period' as const,
      metric,
      range: month.period.range,
      ...(metric === 'medianMergeDays' ? { branch: empty.primaryBranch } : {}),
    };
    const detail = repositoryInsightSample(empty, { selection, returnTo: '/repos' });
    expect(detail.measurement).toEqual({ status: 'complete', value: 0 });
    if (detail.kind === 'duration') {
      expect(detail.days.status).toBe('not-applicable');
      expect(detail.records.rows).toEqual([]);
    } else expect(detail.rows).toEqual([]);
    const absent = repositoryInsightSample(empty, {
      selection: {
        ...selection,
        range: {
          start: '2026-10-01T00:00:00.000Z',
          end: '2026-10-02T00:00:00.000Z',
          endInclusive: false,
        },
      },
      returnTo: '/repos',
    });
    expect(absent.measurement.status).toBe('missing');
    if (absent.kind === 'duration') expect(absent.days.status).toBe('missing');
  }
});
it('calculates sortable elapsed days without converting missing or invalid timestamps to zero', () => {
  const start = '2026-10-01T00:00:00.000Z';
  expect(mergeElapsedDays(start, '2026-10-06T12:00:00.000Z')).toBe(5.5);
  expect(mergeElapsedDays(start, start)).toBe(0);
  expect(mergeElapsedDays(start, null)).toBeNull();
  expect(mergeElapsedDays('invalid', start)).toBeNull();
  expect(mergeElapsedDays(start, '2026-09-30T00:00:00.000Z')).toBeNull();
  expect(isInsightSelection({ scope: 'current', metric: 'totalOpenPrs' })).toBe(false);
  expect(
    isInsightSelection({ scope: 'period', metric: 'prsOpened', range: month.period.range }),
  ).toBe(false);
  expect(
    isInsightSelection({ scope: 'period', metric: 'prAuthors', range: month.period.range }),
  ).toBe(true);
});
