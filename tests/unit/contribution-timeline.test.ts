import { expect, it } from 'vitest';
import { contributionTimelineSample } from '@/mocks/contribution-timeline';
import {
  selectContributionTimeline,
  contributionTimelineDetail,
} from '@/lib/presentation/contribution-timeline';
import {
  defaultContributionSelection,
  selectContributions,
} from '@/lib/presentation/contributions';
import { contributionMetricIds } from '@/models/contributions';
import { reportMetricIds } from '@/models/contribution-metrics';
import { timelineGroupings } from '@/models/reporting-timeline';
import type { TimelineRequest } from '@/models/reporting-timeline';
import { inDateRange } from '@/lib/presentation/reporting-period';
import { contributionDetailRows } from '@/lib/presentation/contribution-detail-rows';
import { contributionScope } from '@/lib/presentation/contribution-scope';
const values = (report: ReturnType<typeof selectContributionTimeline>) =>
  contributionMetricIds.map((id) => report.summary[id].value);
const sample = contributionTimelineSample('calendar');
const request: TimelineRequest = { range: sample.contributions.range, grouping: 'month' };
it.each(timelineGroupings)(
  'reconciles all 39 prepared contribution metrics across %s and the existing report',
  (grouping) => {
    const report = selectContributionTimeline(sample, { ...request, grouping });
    expect(values(report)).toEqual([8, 5, 9, 7, 5, 6]);
    const original = selectContributions(sample.contributions);
    expect(report.summary).toEqual({ ...original.totals, ...original.additionalTotals });
    for (const metric of reportMetricIds)
      expect(
        report.rows.reduce((sum, row) => sum + row.values[metric].value!, 0),
        metric,
      ).toBe(report.summary[metric].value);
    expect(JSON.stringify(report)).not.toContain('mergedDiff');
    expect(JSON.stringify(report)).not.toContain('Sample PR');
  },
);
it('pins monthly credits and keeps later merged volume separate from first reviewer credit', () => {
  const report = selectContributionTimeline(sample, request);
  expect(
    report.rows.slice(7, 10).map((row) => contributionMetricIds.map((id) => row.values[id].value)),
  ).toEqual([
    [1, 0, 1, 1, 0, 1],
    [1, 1, 2, 2, 1, 1],
    [6, 4, 6, 4, 4, 4],
  ]);
  const bob = selectContributionTimeline(sample, request, undefined, {
    kind: 'contributor',
    accountId: 'account-bob',
  });
  expect(bob.scope.subject?.name).toBe('Bob');
  expect(
    bob.rows
      .slice(7, 10)
      .map((row) => [
        row.values.reviewerContributions.value,
        row.values['reviewed.filesChanged'].value,
      ]),
  ).toEqual([
    [1, 0],
    [1, 6],
    [0, 10],
  ]);
  expect(sample).toEqual(contributionTimelineSample('calendar'));
});
it('preserves company mapping, union/exclusion scope and actors without duplicate attribution', () => {
  const selection = defaultContributionSelection(sample.contributions);
  selection.population = {
    kind: 'selected',
    accountIds: ['account-bob'],
    companyIds: ['company-acme'],
  };
  selection.excludedAccountIds = ['account-alice'];
  selection.actorTypes = ['human'];
  const report = selectContributionTimeline(sample, request, selection, {
    kind: 'company',
    companyId: 'company-acme',
  });
  expect(values(report)).toEqual([2, 1, 2, 2, 1, 1]);
  expect(report.scope).toMatchObject({
    includedAccountCount: 2,
    companyAttribution: 'current-mapping',
    subject: { name: 'Example Acme' },
  });
  expect(
    selectContributionTimeline(sample, request, undefined, { kind: 'company', companyId: null })
      .scope.subject,
  ).toBeNull();
});
it('keeps exact timestamp bounds and supporting facts, rather than rounding to dates', () => {
  const exact = {
    start: '2024-09-01T00:00:00.000Z',
    end: '2024-09-04T12:00:00.000Z',
    endInclusive: true,
  };
  const report = selectContributionTimeline(sample, { grouping: 'day', range: exact });
  expect(report.summary.reviewerContributions.value).toBe(2);
  const descriptor = contributionTimelineDetail(report, 'reviewerContributions')!;
  expect(descriptor.range).toEqual(exact);
  const scope = contributionScope(sample.contributions);
  const context = {
    source: 'sample' as const,
    scenarioId: report.source.scenarioId,
    asOf: report.source.asOf,
    period: sample.contributions.period,
    range: exact,
    selection: scope.selection,
    focus: scope.focus,
    companyAttribution: 'current-mapping' as const,
    includedAccountCount: scope.accounts.length,
  };
  const details = contributionDetailRows(
    sample.contributions,
    context,
    'reviewerContributions',
    scope.accounts,
  ).filter((row) => inDateRange(row.creditedAt, exact));
  expect(details.map((row) => row.account.id)).toEqual(['account-alice', 'account-bob']);
  expect(details.reduce((sum, row) => sum + row.value.value!, 0)).toBe(
    report.summary.reviewerContributions.value,
  );
});
it('keeps unavailable time, temporal clipping and explicit empty selection distinct', () => {
  const gap = contributionTimelineSample('calendar', true),
    report = selectContributionTimeline(gap, request);
  expect(report.rows[0].values.prsAuthored).toEqual({ status: 'complete', value: 0 });
  expect(report.rows[1].values.prsAuthored).toMatchObject({ status: 'missing', value: null });
  expect(report.summary.prsAuthored).toMatchObject({ status: 'partial', value: 8 });
  expect(contributionTimelineDetail(report, 'prsAuthored', report.rows[1].interval.id)).toBeNull();
  const outside = selectContributionTimeline(sample, {
    grouping: 'month',
    range: {
      start: '2023-01-01T00:00:00.000Z',
      end: '2024-01-01T00:00:00.000Z',
      endInclusive: false,
    },
  });
  expect(outside.rows).toHaveLength(12);
  expect(outside.summary.prsAuthored.value).toBeNull();
  const selected = defaultContributionSelection(sample.contributions);
  selected.population = { kind: 'selected', accountIds: [], companyIds: [] };
  const empty = selectContributionTimeline(gap, request, selected);
  expect(empty.rows).toEqual([]);
  expect(values(empty)).toEqual([0, 0, 0, 0, 0, 0]);
  selected.population = { kind: 'all' };
  selected.repositoryIds = [];
  expect(selectContributionTimeline(gap, request, selected).rows).toEqual([]);
  const missing = contributionTimelineSample('missing');
  expect(
    selectContributionTimeline(missing, { range: missing.contributions.range, grouping: 'month' })
      .summary.prsAuthored,
  ).toMatchObject({ status: 'missing', value: null });
});
it('retains zero intervals, supplied partial coverage and record-specific missing diff values', () => {
  const partial = contributionTimelineSample('partial'),
    report = selectContributionTimeline(partial, {
      range: partial.contributions.range,
      grouping: 'month',
    });
  expect(report.summary.approvalContributions.status).toBe('partial');
  expect(report.rows[9].values['authored.filesModified'].status).toBe('partial');
  expect(contributionTimelineDetail(report, 'approvalContributions')?.basis).toBe('credit');
  expect(contributionTimelineDetail(report, 'inlineComments')?.basis).toBe('comments');
  expect(contributionTimelineDetail(report, 'reviewed.linesChanged')?.basis).toBe('merged-volume');
  expect(
    contributionTimelineDetail(report, 'prsAuthored', report.rows[0].interval.id)?.range,
  ).toEqual(report.rows[0].interval.covered);
});
it('keeps series payload bounded when unrelated directory accounts grow under global gaps', () => {
  const base = contributionTimelineSample('large', true),
    expanded = structuredClone(base);
  for (let i = 0; i < 3000; i++)
    expanded.contributions.accounts.push({
      id: 'idle-' + i,
      login: 'idle-' + i,
      name: 'Idle ' + i,
      companyId: null,
      actorType: 'human',
    });
  const query = { range: base.contributions.range, grouping: 'day' as const };
  const a = selectContributionTimeline(base, query),
    b = selectContributionTimeline(expanded, query);
  expect(a.rows.length).toBeGreaterThan(50);
  expect(a.rows).toEqual(b.rows);
  expect(a.summary).toEqual(b.summary);
  expect(b.scope.includedAccountCount).toBe(3251);
  expect(JSON.stringify(b).length - JSON.stringify(a).length).toBe(1);
  expect(JSON.stringify(b)).not.toContain('idle-');
});
it('rejects contradictory temporal source coverage and invalid detail selections', () => {
  const bad = structuredClone(sample);
  bad.availableRanges = [];
  expect(() => selectContributionTimeline(bad, request)).toThrow('Known contribution facts');
  bad.availableRanges = [{ ...request.range, start: '2023-01-01T00:00:00.000Z' }];
  expect(() => selectContributionTimeline(bad, request)).toThrow('exceeds contribution source');
  const report = selectContributionTimeline(sample, request);
  expect(() => contributionTimelineDetail(report, 'prsAuthored', 'unknown')).toThrow('interval');
  expect(() => contributionTimelineDetail(report, 'bad' as never)).toThrow('metric');
  const duplicate = structuredClone(sample);
  duplicate.contributions.credits.push(duplicate.contributions.credits[0]);
  expect(() => selectContributionTimeline(duplicate, request)).toThrow(
    'Duplicate contribution credits',
  );
});

it.each(reportMetricIds)(
  'reconciles interval supporting values for %s before comment grouping',
  (metric) => {
    const report = selectContributionTimeline(sample, request),
      scope = contributionScope(sample.contributions);
    for (const row of report.rows) {
      const context = {
        source: 'sample' as const,
        scenarioId: report.source.scenarioId,
        asOf: report.source.asOf,
        period: sample.contributions.period,
        range: row.interval.covered,
        selection: scope.selection,
        focus: scope.focus,
        companyAttribution: 'current-mapping' as const,
        includedAccountCount: scope.accounts.length,
      };
      const details = contributionDetailRows(sample.contributions, context, metric, scope.accounts);
      expect(details.reduce((sum, detail) => sum + (detail.value.value ?? 0), 0)).toBe(
        row.values[metric].value,
      );
      expect(
        details.every(
          (detail) =>
            inDateRange(detail.creditedAt, row.interval.covered) &&
            inDateRange(detail.lastAt, row.interval.covered),
        ),
      ).toBe(true);
    }
  },
);
it('separates repeated comments on one PR by interval without repeating its first review credit', () => {
  const input = structuredClone(sample),
    comment = input.contributions.activity.comments.find(
      (row) => row.id === 'comment-101-bob-2026-08-06',
    )!;
  expect(comment).toBeDefined();
  input.contributions.activity.comments.push({
    ...comment,
    id: 'later-comment',
    createdAt: '2024-10-01T00:00:00.000Z',
  });
  const report = selectContributionTimeline(input, request, undefined, {
    kind: 'contributor',
    accountId: 'account-bob',
  });
  expect(report.rows.slice(7, 10).map((row) => row.values.prComments.value)).toEqual([1, 0, 2]);
  expect(report.rows.slice(7, 10).map((row) => row.values.reviewerContributions.value)).toEqual([
    1, 1, 0,
  ]);
  const scope = contributionScope(input.contributions, undefined, {
    kind: 'contributor',
    accountId: 'account-bob',
  });
  const context = {
    source: 'sample' as const,
    scenarioId: report.source.scenarioId,
    asOf: report.source.asOf,
    period: input.contributions.period,
    range: report.rows[9].interval.covered,
    selection: scope.selection,
    focus: scope.focus,
    companyAttribution: 'current-mapping' as const,
    includedAccountCount: scope.accounts.length,
  };
  const details = contributionDetailRows(
    input.contributions,
    context,
    'prComments',
    scope.accounts,
  );
  expect(details.find((row) => row.record.number === 101)).toMatchObject({
    value: { status: 'complete', value: 1 },
    creditedAt: '2024-10-01T00:00:00.000Z',
  });
  expect(report.source.scenarioId).not.toBe(
    contributionTimelineSample('calendar', true).contributions.scenarioId,
  );
});
