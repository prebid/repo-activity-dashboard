import { expect, it } from 'vitest';
import { selectRepositoryPage } from '@/lib/presentation/repository-page';
import { ageBandFor, reviewBucket, subsetCount } from '@/lib/presentation/repository-page-values';
import { repositoryPageFiltersSchema, type RepositoryPageSource } from '@/models/repository-page';
import { repositoryPageSample } from '@/mocks/repository-page';
import { repositoryOverviewSamples } from '@/mocks/repository-overview';
const samples = repositoryOverviewSamples();
const repo = samples.repositories[0].repository;
function prs(): Extract<RepositoryPageSource, { kind: 'prs' }> {
  const base = repositoryPageSample(repo, {
    selection: { scope: 'current', metric: 'totalOpenPrs' },
    returnTo: '/repos',
  });
  if (base.kind !== 'prs') throw new Error('Expected PRs');
  const ages = [0, 30, 30.01, 60, 361, 180],
    reviewers = [0, 0, 1, 2, 3, null],
    approvals = [0, 1, 0, 2, null, 1];
  return {
    ...base,
    measurement: { status: 'complete', value: 6 },
    rows: ages.map((ageDays, index) => ({
      ...base.rows[0],
      id: String(index),
      number: index + 1,
      title: 'Record ' + (index + 1),
      author: 'author-' + (index + 1),
      authorType: index === 5 ? null : index === 1 ? 'agent' : index === 2 ? 'bot' : 'human',
      draft: index === 0,
      ageDays,
      humanReviewers: reviewers[index],
      approvals: approvals[index],
      labels: index < 3 ? ['one'] : ['two'],
      agentReviewer: index === 5 ? null : index === 1,
      botReviewer: index === 5 ? null : index === 2,
      baseBranch: index === 2 ? 'main' : index === 4 ? 'release/v2' : 'master',
      latestActivity:
        index === 5
          ? null
          : { at: base.asOf, account: 'actor', category: index === 1 ? 'agent' : 'contributor' },
    })),
  };
}
function issues(): Extract<RepositoryPageSource, { kind: 'issues' }> {
  const base = repositoryPageSample(repo, {
    selection: { scope: 'current', metric: 'openIssues' },
    returnTo: '/repos',
  });
  if (base.kind !== 'issues') throw new Error('Expected issues');
  return {
    ...base,
    measurement: { status: 'complete', value: 3 },
    rows: base.rows.slice(0, 3).map((row, index) => ({
      ...row,
      id: String(index),
      assignees: index === 0 ? [] : index === 1 ? ['sample-maintainer'] : null,
    })),
  };
}
const ids = (model: ReturnType<typeof selectRepositoryPage>) => model.rows.map((row) => row.id);
it('keeps age bands disjoint at exact and fractional boundaries', () => {
  const page = selectRepositoryPage(prs());
  const chart = page.charts[0];
  if (chart.kind !== 'age') throw new Error('Expected age');
  expect(chart.points.map((p) => p.count.value)).toEqual([2, 2, 0, 0, 1, 0, 1]);
  expect(ids(selectRepositoryPage(prs(), { kind: 'prs', ageBand: 30 }))).toEqual(['2', '3']);
  expect(ids(selectRepositoryPage(prs(), { kind: 'prs', ageBand: 0 }))).toEqual(['0', '1']);
  expect(ageBandFor(360)).toBe(180);
  expect(ageBandFor(360.01)).toBe(360);
  for (const value of [-1, NaN, Infinity])
    expect(() => ageBandFor(value)).toThrow('Invalid record age');
});
it('separates reviewers and approvals, excludes drafts, and exposes unknown/over-two counts', () => {
  const page = selectRepositoryPage(prs());
  const reviewers = page.charts[1],
    approvals = page.charts[2];
  if (reviewers.kind !== 'reviewers' || approvals.kind !== 'approvals')
    throw new Error('Expected separate charts');
  expect(reviewers.points.map((p) => p.count.value)).toEqual([1, 1, 1, 1, 1]);
  expect(approvals.points.map((p) => p.count.value)).toEqual([1, 2, 1, 0, 1]);
  expect(reviewers.excludedDrafts).toBe(1);
  expect(reviewers.measurement.value).toBe(5);
  expect(reviewers.points[0].count.status).toBe('partial');
  expect(reviewers.points[4].count.status).toBe('complete');
  expect(ids(selectRepositoryPage(prs(), { kind: 'prs', reviewers: '0' }))).toEqual(['1']);
  expect(selectRepositoryPage(prs(), { kind: 'prs', reviewers: '0' }).measurement.status).toBe(
    'partial',
  );
  expect(ids(selectRepositoryPage(prs(), { kind: 'prs', approvals: '0' }))).toEqual(['2']);
  expect(ids(selectRepositoryPage(prs(), { kind: 'prs', reviewers: 'unknown' }))).toEqual(['5']);
  expect(ids(selectRepositoryPage(prs(), { kind: 'prs', reviewers: 'more' }))).toEqual(['4']);
  expect(
    selectRepositoryPage(prs(), { kind: 'prs', draft: 'drafts', reviewers: '0' }).measurement,
  ).toEqual({ status: 'complete', value: 0 });
  for (const value of [-1, 1.5, NaN])
    expect(() => reviewBucket(value)).toThrow('Invalid review count');
});
it('combines facets without counting unknown metadata as a proved zero', () => {
  const knownUnknown = prs();
  knownUnknown.rows[5].latestActivity = {
    at: knownUnknown.asOf,
    account: null,
    category: 'unknown',
  };
  expect(
    ids(
      selectRepositoryPage(prs(), {
        kind: 'prs',
        labels: ['one', 'two'],
        authors: ['AUTHOR-2'],
        authorTypes: ['agent'],
        branches: ['master'],
        draft: 'non-drafts',
        agentReviewer: 'yes',
        botReviewer: 'no',
        latestActors: ['agent'],
      }),
    ),
  ).toEqual(['1']);
  expect(ids(selectRepositoryPage(prs(), { kind: 'prs', search: 'Draft' }))).toEqual(['0']);
  expect(
    ids(
      selectRepositoryPage(prs(), {
        kind: 'prs',
        search: 'record 3',
        labels: ['one'],
        states: ['Open'],
        botReviewer: 'yes',
        branches: ['main'],
      }),
    ),
  ).toEqual(['2']);
  expect(
    selectRepositoryPage(prs(), { kind: 'prs', authorTypes: ['human'] }).measurement,
  ).toMatchObject({ status: 'partial', value: 3 });
  expect(
    selectRepositoryPage(prs(), { kind: 'prs', authorTypes: ['human'], search: 'not present' })
      .measurement,
  ).toEqual({ status: 'complete', value: 0 });
  expect(
    ids(
      selectRepositoryPage(knownUnknown, {
        kind: 'prs',
        authorTypes: ['unknown'],
        latestActors: ['unknown'],
        agentReviewer: 'unknown',
      }),
    ),
  ).toEqual(['5']);
  expect(ids(selectRepositoryPage(prs(), { kind: 'prs', states: ['Merged'] }))).toEqual([]);
  expect(
    ids(selectRepositoryPage(prs(), { kind: 'prs', agentReviewer: 'no', botReviewer: 'no' })),
  ).toEqual(['3', '4']);
  expect(ids(selectRepositoryPage(prs(), { kind: 'prs', draft: 'drafts' }))).toEqual(['0']);
  expect(
    selectRepositoryPage(prs(), { kind: 'prs', latestActors: ['bot'] }).measurement,
  ).toMatchObject({ status: 'partial', value: 0 });
});
it('distinguishes missing assignment metadata from assigned and unassigned issues', () => {
  expect(ids(selectRepositoryPage(issues(), { kind: 'issues', assignment: 'unknown' }))).toEqual([
    '2',
  ]);
  expect(
    selectRepositoryPage(issues(), { kind: 'issues', assignment: 'unassigned' }).measurement,
  ).toMatchObject({ status: 'partial', value: 1 });
  expect(ids(selectRepositoryPage(issues(), { kind: 'issues', assignment: 'assigned' }))).toEqual([
    '1',
  ]);
  expect(
    ids(selectRepositoryPage(issues(), { kind: 'issues', assignees: ['SAMPLE-MAINTAINER'] })),
  ).toEqual(['1']);
  expect(
    selectRepositoryPage(issues(), { kind: 'issues', assignees: ['someone-else'] }).measurement,
  ).toMatchObject({ status: 'partial', value: 0 });
  expect(
    selectRepositoryPage(issues(), { kind: 'issues', states: ['Closed'] }).measurement,
  ).toEqual({ status: 'complete', value: 0 });
});
it('preserves availability and snapshot context without changing or paging its source', () => {
  const source = prs(),
    before = structuredClone(source);
  const page = selectRepositoryPage(source, { kind: 'prs', labels: ['one'] });
  expect(source).toEqual(before);
  expect(page.rows).not.toBe(source.rows);
  expect(page.cohortMeasurement).toEqual({ status: 'complete', value: 6 });
  expect(page.measurement).toEqual({ status: 'complete', value: 3 });
  expect(page.defaultSort).toEqual({ sort: 'createdAt', descending: true });
  expect(page.drilldown).toEqual(source.drilldown);
  const partial = {
    ...source,
    measurement: { status: 'partial' as const, value: 6, reason: 'Limited collection' },
  };
  expect(selectRepositoryPage(partial, { kind: 'prs', search: 'absent' }).measurement).toEqual({
    status: 'partial',
    value: 0,
    reason: 'Limited collection',
  });
  const missing = {
    ...source,
    rows: [],
    measurement: { status: 'missing' as const, value: null, reason: 'No sample' },
  };
  expect(selectRepositoryPage(missing).charts[0].measurement).toEqual(missing.measurement);
  expect(
    subsetCount({ status: 'not-applicable', value: null, reason: 'Not applicable' }, 0),
  ).toEqual({ status: 'not-applicable', value: null, reason: 'Not applicable' });
});
it('validates filter kinds and bounds instead of accepting cross-tab or historical-review state', () => {
  for (const filters of [
    { kind: 'issues', reviewers: '0' },
    { kind: 'prs', ageBand: 45 },
    { kind: 'prs', states: ['Draft'] },
    { kind: 'prs', authors: ['bad/actor'] },
    { kind: 'prs', search: 'x'.repeat(201) },
  ])
    expect(repositoryPageFiltersSchema.safeParse(filters).success).toBe(false);
  expect(() => selectRepositoryPage(prs(), { kind: 'issues' })).toThrow('record kind');
  const eventRange = {
    start: '2026-10-01T00:00:00.000Z',
    end: '2026-10-02T00:00:00.000Z',
    endInclusive: false,
  };
  expect(() => selectRepositoryPage(prs(), { kind: 'prs', eventRange })).toThrow('period activity');
  const period = {
    ...prs(),
    drilldown: {
      selection: { scope: 'period' as const, metric: 'prsOpened' as const, range: eventRange },
      returnTo: '/repos',
    },
  };
  for (const filters of [
    { kind: 'prs', ageBand: 30 },
    { kind: 'prs', approvals: '0' },
  ])
    expect(() => selectRepositoryPage(period, filters)).toThrow('Current age and review');
  for (const range of [
    { ...eventRange, start: '2026-09-30T00:00:00.000Z' },
    { ...eventRange, end: '2026-10-03T00:00:00.000Z' },
    { ...eventRange, endInclusive: true },
  ])
    expect(() => selectRepositoryPage(period, { kind: 'prs', eventRange: range })).toThrow(
      'outside',
    );
});
it('uses the selected event date, UTC boundary ownership and zero buckets in activity charts', () => {
  const range = {
    start: '2026-01-31T12:00:00.000Z',
    end: '2026-02-02T00:00:00.000Z',
    endInclusive: true,
  };
  const source: Extract<RepositoryPageSource, { kind: 'prs' }> = {
    ...prs(),
    measurement: { status: 'complete', value: 3 },
    drilldown: {
      selection: { scope: 'period', metric: 'prsMerged', range, branch: 'master' },
      returnTo: '/repos',
    },
    rows: prs()
      .rows.slice(0, 3)
      .map((row, index) => ({
        ...row,
        state: 'Merged',
        draft: false,
        createdAt: '2025-12-01T00:00:00.000Z',
        mergedAt: [
          '2026-01-31T12:00:00.000Z',
          '2026-02-01T00:00:00.000Z',
          '2026-02-02T00:00:00.000Z',
        ][index],
      })),
  };
  const chart = selectRepositoryPage(source).charts[0];
  if (chart.kind !== 'activity') throw new Error('Expected activity');
  expect(chart.dateBasis).toBe('mergedAt');
  expect(chart.points.map((p) => p.count.value)).toEqual([1, 1, 1]);
  expect(chart.points.map((p) => p.range.endInclusive)).toEqual([false, false, true]);
  const filtered = selectRepositoryPage(source, { kind: 'prs', eventRange: chart.points[1].range });
  expect(ids(filtered)).toEqual(['1']);
  expect(filtered.charts[0].kind).toBe('activity');
  const incomplete = {
    ...source,
    measurement: { status: 'partial' as const, value: 3, reason: 'Incomplete' },
  };
  expect(selectRepositoryPage(incomplete).charts[0].measurement.status).toBe('partial');
  const invalidDate = { ...source, rows: [{ ...source.rows[0], mergedAt: 'invalid' }] };
  expect(() => selectRepositoryPage(invalidDate)).toThrow();
  expect(() =>
    selectRepositoryPage({
      ...source,
      measurement: { status: 'complete', value: 1 },
      rows: [{ ...source.rows[0], mergedAt: null }],
    }),
  ).toThrow('Missing event');
  expect(() =>
    selectRepositoryPage({
      ...source,
      measurement: { status: 'complete', value: 1 },
      rows: [{ ...source.rows[0], mergedAt: '2026-01-01T00:00:00.000Z' }],
    }),
  ).toThrow('outside');
});
it('clips monthly activity bins and preserves missing and known-empty periods', () => {
  const range = {
    start: '2026-01-15T00:00:00.000Z',
    end: '2026-03-01T00:00:00.000Z',
    endInclusive: false,
  };
  const source = {
    ...issues(),
    measurement: { status: 'complete' as const, value: 2 },
    drilldown: {
      selection: { scope: 'period' as const, metric: 'issuesClosed' as const, range },
      returnTo: '/repos',
    },
    rows: issues()
      .rows.slice(0, 2)
      .map((row, index) => ({
        ...row,
        closedAt: index === 0 ? '2026-01-31T23:59:59.999Z' : '2026-02-01T00:00:00.000Z',
      })),
  };
  const chart = selectRepositoryPage(source).charts[0];
  if (chart.kind !== 'activity') throw new Error('Expected activity');
  expect(chart.granularity).toBe('month');
  expect(chart.dateBasis).toBe('closedAt');
  expect(chart.points.map((p) => p.count.value)).toEqual([1, 1]);
  expect(chart.points[0].range.start).toBe(range.start);
  expect(() =>
    selectRepositoryPage({
      ...source,
      measurement: { status: 'complete', value: 1 },
      rows: [{ ...source.rows[0], closedAt: null }],
    }),
  ).toThrow('Missing event');
  const empty = selectRepositoryPage({
    ...source,
    rows: [],
    measurement: { status: 'complete', value: 0 },
  }).charts[0];
  if (empty.kind !== 'activity') throw new Error('Expected activity');
  expect(empty.points.map((p) => p.count.value)).toEqual([0, 0]);
  const missing = selectRepositoryPage({
    ...source,
    rows: [],
    measurement: { status: 'missing', value: null, reason: 'Unprepared' },
  }).charts[0];
  if (missing.kind !== 'activity') throw new Error('Expected activity');
  expect(missing.points).toEqual([]);
  expect(missing.measurement.value).toBeNull();
});

it('rejects a paginated or mismatched source instead of charting it as the full cohort', () => {
  expect(() => selectRepositoryPage({ ...prs(), rows: prs().rows.slice(0, 2) })).toThrow(
    'full available cohort',
  );
  expect(() =>
    selectRepositoryPage({
      ...prs(),
      drilldown: { selection: { scope: 'current', metric: 'openIssues' }, returnTo: '/repos' },
    }),
  ).toThrow('Record kind');
  expect(ids(selectRepositoryPage(prs(), { kind: 'prs', branches: ['release/v2'] }))).toEqual([
    '4',
  ]);
});
it('keeps leap-day events in distinct UTC daily buckets', () => {
  const range = {
    start: '2024-02-28T00:00:00.000Z',
    end: '2024-03-01T00:00:00.000Z',
    endInclusive: true,
  };
  const source = {
    ...issues(),
    drilldown: {
      selection: { scope: 'period' as const, metric: 'issuesOpened' as const, range },
      returnTo: '/repos',
    },
    rows: issues().rows.map((row, index) => ({
      ...row,
      createdAt: [
        '2024-02-28T00:00:00.000Z',
        '2024-02-29T00:00:00.000Z',
        '2024-03-01T00:00:00.000Z',
      ][index],
    })),
  };
  const chart = selectRepositoryPage(source).charts[0];
  if (chart.kind !== 'activity') throw new Error('Expected activity');
  expect(chart.points.map((point) => point.count.value)).toEqual([1, 1, 1]);
});
