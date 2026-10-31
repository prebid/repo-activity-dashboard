import { expect, it } from 'vitest';
import { repositoryTimelineSample } from '@/mocks/repository-timeline';
import {
  selectRepositoryTimeline,
  repositoryTimelineDetail,
  repositoryTimelineValue,
  repositoryTimelineSupportingRows,
  validateRepositoryTimelineFilters,
} from '@/lib/presentation/repository-timeline';
import { repositoryPageFiltersSchema } from '@/models/repository-page';
import { timelineGroupings, type TimelineRequest } from '@/models/reporting-timeline';
import type { RepositoryTimelineSource } from '@/models/repository-timeline';
const range = {
  start: '2024-01-01T00:00:00.000Z',
  end: '2025-01-01T00:00:00.000Z',
  endInclusive: false,
};
const query: TimelineRequest = { range, grouping: 'month' };
const prs = repositoryTimelineSample('prs', 'repo-prebidjs', 'calendar');
it.each(timelineGroupings)('keeps repository activity coherent under %s', (grouping) => {
  const report = selectRepositoryTimeline(prs, { ...query, grouping });
  expect(report.summary).toEqual({
    prsOpened: { status: 'complete', value: 5 },
    prsMerged: { status: 'complete', value: 3 },
    prAuthors: { status: 'complete', value: 4 },
    medianMergeDays: { status: 'complete', value: 5 },
  });
  for (const metric of ['prsOpened', 'prsMerged'] as const)
    expect(report.rows.reduce((sum, row) => sum + row.values[metric]!.value!, 0)).toBe(
      report.summary[metric]!.value,
    );
  expect(JSON.stringify(report)).not.toContain('Sample PR');
});
it('recomputes distinct authors and medians for the full range without summing interval answers', () => {
  const report = selectRepositoryTimeline(prs, query);
  expect(report.rows.slice(7, 10).map((row) => row.values.prAuthors!.value)).toEqual([1, 1, 2]);
  // Bob authored both October PRs; authored PRs differ from unique authors.
  expect(report.rows[9].values.prsOpened!.value).toBe(3);
  expect(report.rows[8].values.medianMergeDays!.value).toBe(5);
  expect(report.rows[9].values.medianMergeDays!.value).toBe(31);
  expect(report.summary.medianMergeDays!.value).toBe(5);
  const overlap = structuredClone(prs);
  overlap.rows.forEach((row) => {
    row.author = 'same-author';
  });
  const same = selectRepositoryTimeline(overlap, query);
  expect(same.summary.prAuthors!.value).toBe(1);
  expect(same.rows.reduce((sum, row) => sum + row.values.prAuthors!.value!, 0)).toBe(3);
  expect(report.rows[0].values.medianMergeDays).toMatchObject({
    status: 'not-applicable',
    value: null,
  });
});
it('uses issue creation and closure dates independently with exact interval descriptors', () => {
  const source = repositoryTimelineSample('issues', 'repo-prebidjs', 'calendar');
  const report = selectRepositoryTimeline(source, query);
  expect(report.summary).toEqual({
    issuesOpened: { status: 'complete', value: 3 },
    issuesClosed: { status: 'complete', value: 1 },
    issueAuthors: { status: 'complete', value: 3 },
  });
  expect(
    repositoryTimelineDetail(report, 'issuesClosed', report.rows[8].interval.id),
  ).toMatchObject({
    basis: 'event',
    range: {
      start: '2024-09-01T00:00:00.000Z',
      end: '2024-10-01T00:00:00.000Z',
      endInclusive: false,
    },
    source: { scenarioId: source.scenarioId },
  });
  expect(repositoryTimelineDetail(report, 'issueAuthors')?.basis).toBe('distinct-authors');
  expect(
    repositoryTimelineDetail(report, 'issuesClosed', report.rows[0].interval.id),
  ).not.toBeNull();
  expect(
    repositoryTimelineDetail(selectRepositoryTimeline(prs, query), 'medianMergeDays')?.basis,
  ).toBe('duration');
});
it('uses supplied historical membership and approval state at the exact cutoff, never current state', () => {
  const request: TimelineRequest = {
    grouping: 'day',
    range: {
      start: '2024-10-11T00:00:00.000Z',
      end: '2024-10-22T00:00:00.000Z',
      endInclusive: false,
    },
  };
  const report = selectRepositoryTimeline(prs, request, 'snapshot');
  expect(report.rows[0].values.totalOpenPrs!.value).toBe(1);
  expect(report.summary.totalOpenPrs!.value).toBe(2);
  expect(report.summary.humanApprovals1!.value).toBe(1);
  expect(prs.rows.find((row) => row.number === 107)).toMatchObject({ approvals: 0 });
  expect(report.rows[1].values.totalOpenPrs).toMatchObject({ status: 'missing', value: null });
  expect(repositoryTimelineDetail(report, 'humanApprovals1')).toMatchObject({
    basis: 'snapshot',
    cutoff: { at: '2024-10-22T00:00:00.000Z', inclusive: false },
  });
  expect(repositoryTimelineDetail(report, 'totalOpenPrs', report.rows[1].interval.id)).toBeNull();
  const inclusive = selectRepositoryTimeline(
    prs,
    { ...request, range: { ...request.range, endInclusive: true } },
    'snapshot',
  );
  expect(inclusive.summary.totalOpenPrs!.value).toBeNull();
  const issues = selectRepositoryTimeline(
    repositoryTimelineSample('issues', 'repo-prebidjs', 'calendar'),
    request,
    'snapshot',
  );
  expect(issues.summary.openIssues!.value).toBe(2);
});
it('handles both primary branches, compatible metadata filtering, and unknown metadata without confident zeros', () => {
  const source = repositoryTimelineSample('prs', 'repo-prebidserver', 'calendar');
  expect(source.repository.primaryBranch).toBe('master');
  const filters = repositoryPageFiltersSchema.parse({
    kind: 'prs',
    authors: ['sample-alice'],
    draft: 'drafts',
  });
  expect(
    selectRepositoryTimeline(source, query, 'activity', filters).summary.prsOpened!.value,
  ).toBe(1);
  expect(
    selectRepositoryTimeline(source, query, 'activity', filters).summary.prsMerged!.value,
  ).toBe(0);
  const unknown = structuredClone(prs);
  unknown.rows.forEach((row) => {
    row.authorType = null;
  });
  const uncertain = selectRepositoryTimeline(
    unknown,
    query,
    'activity',
    repositoryPageFiltersSchema.parse({ kind: 'prs', authorTypes: ['human'] }),
  );
  expect(uncertain.summary.prsOpened).toMatchObject({ status: 'partial', value: 0 });
  expect(uncertain.summary.medianMergeDays).toMatchObject({ status: 'missing', value: null });
  const mixed = structuredClone(prs);
  mixed.rows[0].authorType = null;
  expect(
    selectRepositoryTimeline(
      mixed,
      query,
      'activity',
      repositoryPageFiltersSchema.parse({ kind: 'prs', authorTypes: ['human'] }),
    ).summary.medianMergeDays!.status,
  ).toBe('partial');
});
it('keeps missing/partial coverage and absent periods explicit', () => {
  const gap = selectRepositoryTimeline(
    repositoryTimelineSample('prs', 'repo-prebidjs', 'calendar', true),
    query,
  );
  expect(gap.rows[1].values.prsOpened).toMatchObject({ status: 'missing', value: null });
  expect(gap.rows[0].values.prsOpened).toEqual({ status: 'complete', value: 0 });
  expect(gap.summary.prsOpened).toMatchObject({ status: 'partial', value: 5 });
  const empty = repositoryTimelineSample('prs', 'repo-prebidjs', 'empty');
  expect(
    selectRepositoryTimeline(empty, {
      ...query,
      range: { ...range, start: '2026-01-01T00:00:00.000Z', end: empty.asOf, endInclusive: true },
    }).summary.prsOpened!.value,
  ).toBe(0);
  expect(repositoryTimelineDetail(gap, 'medianMergeDays', gap.rows[0].interval.id)).toBeNull();
});
it('rejects incompatible filters and malformed detail requests', () => {
  for (const field of [
    { ageBand: 30 },
    { reviewers: '1' },
    { approvals: '0' },
    { agentReviewer: 'yes' },
  ])
    expect(() =>
      validateRepositoryTimelineFilters(
        repositoryPageFiltersSchema.parse({ kind: 'prs', ...field }),
        'activity',
      ),
    ).toThrow('require Backlog at cutoff');
  expect(() =>
    validateRepositoryTimelineFilters(
      repositoryPageFiltersSchema.parse({ kind: 'prs', eventRange: range }),
      'snapshot',
    ),
  ).toThrow('Exact activity dates');
  expect(() =>
    selectRepositoryTimeline(
      prs,
      query,
      'activity',
      repositoryPageFiltersSchema.parse({ kind: 'issues' }),
    ),
  ).toThrow('kind');
  expect(() => selectRepositoryTimeline(prs, query, 'bad' as never)).toThrow('family');
  const report = selectRepositoryTimeline(prs, query);
  expect(() => repositoryTimelineValue(report.summary, 'issuesClosed')).toThrow('family');
  expect(() => repositoryTimelineDetail(report, 'prsOpened', 'unknown')).toThrow('interval');
  expect(() => repositoryTimelineSample('prs', 'missing')).toThrow('Unknown sample repository');
});

type PrSource = Extract<RepositoryTimelineSource, { kind: 'prs' }>;
const corruptions: [string, (source: PrSource) => void, string][] = [
  [
    'duplicate ID',
    (s) => {
      s.rows.push({ ...s.rows[0], number: 900 });
    },
    'Duplicate repository',
  ],
  [
    'duplicate number',
    (s) => {
      s.rows.push({ ...s.rows[0], id: 'another' });
    },
    'Duplicate repository',
  ],
  [
    'duplicate cutoff',
    (s) => {
      s.snapshots.push(structuredClone(s.snapshots[0]));
    },
    'duplicate historical cutoff',
  ],
  [
    'future cutoff',
    (s) => {
      s.snapshots[0].cutoff.at = '2027-01-01T00:00:00.000Z';
    },
    'historical cutoff',
  ],
  [
    'unknown snapshot record',
    (s) => {
      s.snapshots[0].rows[0].id = 'unknown';
    },
    'membership',
  ],
  [
    'non-open snapshot record',
    (s) => {
      s.snapshots[0].rows[0].state = 'Closed';
    },
    'membership',
  ],
  [
    'record created at excluded cutoff',
    (s) => {
      s.snapshots[0].rows[0].createdAt = s.snapshots[0].cutoff.at;
    },
    'membership',
  ],
  [
    'record created after cutoff',
    (s) => {
      s.snapshots[0].rows[0].createdAt = '2024-10-13T00:00:00.000Z';
    },
    'membership',
  ],
  [
    'future historical activity',
    (s) => {
      s.snapshots[0].rows[0].latestActivity!.at = s.snapshots[0].cutoff.at;
    },
    'Historical metadata',
  ],
  [
    'unavailable snapshot with rows',
    (s) => {
      s.snapshots[0].coverage = { status: 'missing', reason: 'Gap' };
    },
    'Unavailable snapshot',
  ],
  [
    'duplicate historical row',
    (s) => {
      s.snapshots[0].rows.push(s.snapshots[0].rows[0]);
    },
    'Duplicate historical',
  ],
  [
    'future record',
    (s) => {
      s.rows[0].createdAt = '2027-01-01T00:00:00.000Z';
    },
    'reporting clock',
  ],
  [
    'future activity',
    (s) => {
      s.rows[0].latestActivity!.at = '2027-01-01T00:00:00.000Z';
    },
    'reporting clock',
  ],
  [
    'merged draft',
    (s) => {
      s.rows[0].draft = true;
    },
    'merge metadata',
  ],
  [
    'missing merge date',
    (s) => {
      s.rows[0].mergedAt = null;
    },
    'merge metadata',
  ],
  [
    'unmerged with merge date',
    (s) => {
      s.rows[0].state = 'Open';
    },
    'merge metadata',
  ],
  [
    'merge before creation',
    (s) => {
      s.rows[0].mergedAt = '2024-01-01T00:00:00.000Z';
    },
    'merge date',
  ],
  [
    'merge after reporting clock',
    (s) => {
      s.rows[0].mergedAt = '2027-01-01T00:00:00.000Z';
    },
    'merge date',
  ],
];
it.each(corruptions)(
  'rejects %s rather than rendering plausible values',
  (_name, change, message) => {
    const source = structuredClone(prs);
    if (source.kind !== 'prs') throw Error('Expected PR fixture');
    change(source);
    expect(() => selectRepositoryTimeline(source, query)).toThrow(message);
  },
);
it.each(['missing date', 'open with date', 'before creation', 'after clock'])(
  'rejects issue closure %s',
  (mode) => {
    const source = repositoryTimelineSample('issues', 'repo-prebidjs', 'calendar');
    if (source.kind !== 'issues') throw Error('Expected issues');
    const row = source.rows.find((row) => row.number === 202)!;
    if (mode === 'missing date') row.closedAt = null;
    if (mode === 'open with date') row.state = 'Open';
    if (mode === 'before creation') row.closedAt = '2024-01-01T00:00:00.000Z';
    if (mode === 'after clock') row.closedAt = '2027-01-01T00:00:00.000Z';
    expect(() => selectRepositoryTimeline(source, query)).toThrow('closure metadata');
  },
);
it('supports partial/missing snapshots and carries unknown cutoff attributes into measurement coverage', () => {
  const source = structuredClone(prs);
  if (source.kind !== 'prs') throw Error('Expected PR fixture');
  const first = source.snapshots[0],
    second = source.snapshots[1];
  first.coverage = { status: 'missing', reason: 'Cutoff not collected' };
  first.rows = [];
  second.coverage = { status: 'partial', reason: 'Some records missing' };
  for (const row of second.rows) {
    row.humanReviewers = null;
    row.approvals = null;
    row.agentReviewer = null;
    row.botReviewer = null;
  }
  const request = {
    grouping: 'day' as const,
    range: {
      start: '2024-10-11T00:00:00.000Z',
      end: '2024-10-22T00:00:00.000Z',
      endInclusive: false,
    },
  };
  const report = selectRepositoryTimeline(source, request, 'snapshot');
  expect(report.rows[0].values.totalOpenPrs).toMatchObject({ status: 'missing', value: null });
  expect(report.summary.humanReviewers0).toMatchObject({ status: 'partial', value: 0 });
  expect(report.summary.agentFeedbackPrs).toMatchObject({ status: 'partial', value: 0 });
  second.coverage = { status: 'complete' };
  second.rows[0].authorType = null;
  const filtered = selectRepositoryTimeline(
    source,
    request,
    'snapshot',
    repositoryPageFiltersSchema.parse({ kind: 'prs', authorTypes: ['human'] }),
  );
  expect(filtered.summary.totalOpenPrs).toMatchObject({ status: 'partial', value: 1 });
  const none = selectRepositoryTimeline(
    source,
    request,
    'snapshot',
    repositoryPageFiltersSchema.parse({ kind: 'prs', authors: ['nobody'] }),
  );
  expect(none.summary.totalOpenPrs).toEqual({ status: 'complete', value: 0 });
});
it('handles historical drafts, primary-branch exclusion and prepared zero/partial sources', () => {
  const draft = repositoryTimelineSample('prs', 'repo-prebidserver', 'calendar');
  const request = {
    grouping: 'month' as const,
    range: {
      start: '2024-10-01T00:00:00.000Z',
      end: '2024-10-22T00:00:00.000Z',
      endInclusive: false,
    },
  };
  const report = selectRepositoryTimeline(draft, request, 'snapshot');
  expect(report.summary.draftPrs!.value).toBe(1);
  expect(report.summary.humanApprovals0!.value).toBe(0);
  const wrong = structuredClone(prs);
  if (wrong.kind !== 'prs') throw Error('Expected PR fixture');
  wrong.rows.forEach((row) => {
    row.baseBranch = 'feature';
    row.latestActivity = null;
  });
  expect(selectRepositoryTimeline(wrong, query).summary.prsMerged!.value).toBe(0);
  const partial = repositoryTimelineSample('prs', 'repo-prebidjs', 'partial');
  const actual = {
    ...request,
    range: {
      start: '2026-10-01T00:00:00.000Z',
      end: '2026-10-22T00:00:00.000Z',
      endInclusive: false,
    },
  };
  expect(selectRepositoryTimeline(partial, actual, 'snapshot').summary.totalOpenPrs!.status).toBe(
    'partial',
  );
  const missing = repositoryTimelineSample('issues', 'repo-prebidjs', 'missing');
  expect(selectRepositoryTimeline(missing, actual).summary.issuesOpened!.value).toBeNull();
});
it('keeps draft PRs in activity counts and support when filtering by latest activity', () => {
  const source = repositoryTimelineSample('prs', 'repo-prebidserver', 'reference');
  const range = {
    start: '2026-10-01T00:00:00.000Z',
    end: '2026-10-24T12:00:00.000Z',
    endInclusive: true,
  };
  const latest = repositoryPageFiltersSchema.parse({ kind: 'prs', latestActors: ['contributor'] });
  const report = selectRepositoryTimeline(source, { range, grouping: 'week' }, 'activity', latest);
  expect(report.summary.prsOpened).toEqual({ status: 'complete', value: 3 });
  expect(report.summary.prAuthors).toEqual({ status: 'complete', value: 3 });
  const detail = repositoryTimelineDetail(report, 'prsOpened')!;
  expect(repositoryTimelineSupportingRows(source, detail).map((row) => row.number)).toEqual([
    103, 104, 106,
  ]);
  const drafts = repositoryPageFiltersSchema.parse({
    kind: 'prs',
    draft: 'drafts',
    latestActors: ['contributor'],
  });
  expect(
    selectRepositoryTimeline(source, { range, grouping: 'week' }, 'activity', drafts).summary
      .prsOpened,
  ).toEqual({ status: 'complete', value: 1 });
});
it('keeps the non-draft population for latest-actor filters on backlog snapshots', () => {
  const source = repositoryTimelineSample('prs', 'repo-prebidserver', 'reference');
  const range = {
    start: '2026-10-01T00:00:00.000Z',
    end: '2026-10-22T00:00:00.000Z',
    endInclusive: false,
  };
  const latest = repositoryPageFiltersSchema.parse({ kind: 'prs', latestActors: ['contributor'] });
  const snapshot = selectRepositoryTimeline(source, { range, grouping: 'day' }, 'snapshot', latest);
  const all = selectRepositoryTimeline(source, { range, grouping: 'day' }, 'snapshot');
  expect(all.summary.draftPrs).toEqual({ status: 'complete', value: 1 });
  expect(snapshot.summary.totalOpenPrs!.value).toBe(all.summary.totalOpenPrs!.value! - 1);
});
const cutoffRange = (day: string) => ({
  start: '2026-10-01T00:00:00.000Z',
  end: '2026-10-' + day + 'T00:00:00.000Z',
  endInclusive: false,
});
it.each([
  [
    '12',
    {
      totalOpenPrs: 1,
      nonDraftPrs: 1,
      humanReviewers0: 1,
      humanReviewers1: 0,
      humanApprovals0: 1,
      humanApprovals1: 0,
      agentFeedbackPrs: 0,
      botFeedbackPrs: 0,
      lastContributor: 1,
    },
  ],
  [
    '22',
    {
      totalOpenPrs: 2,
      nonDraftPrs: 2,
      humanReviewers0: 0,
      humanReviewers1: 2,
      humanApprovals0: 1,
      humanApprovals1: 1,
      agentFeedbackPrs: 1,
      botFeedbackPrs: 1,
      lastContributor: 2,
    },
  ],
] as const)('derives Prebid.js backlog at the 10-%s cutoff from dated credits', (day, expected) => {
  const report = selectRepositoryTimeline(
    repositoryTimelineSample('prs', 'repo-prebidjs', 'reference'),
    { range: cutoffRange(day), grouping: 'day' },
    'snapshot',
  );
  for (const [metric, value] of Object.entries(expected))
    expect([metric, report.summary[metric as keyof typeof expected]]).toEqual([
      metric,
      { status: 'complete', value },
    ]);
});
it('keeps open records in every snapshot and dismissed approvals out of today', () => {
  const issues = repositoryTimelineSample('issues', 'repo-prebidserver', 'reference');
  expect(issues.snapshots.map((row) => row.rows.map((issue) => issue.number))).toEqual([
    [203, 204, 205],
    [203, 204, 205],
  ]);
  const prs = repositoryTimelineSample('prs', 'repo-prebidjs', 'reference');
  const cutoff = prs.snapshots[1].rows.find((row) => row.number === 107)!;
  const today = prs.rows.find((row) => row.number === 107)!;
  expect('approvals' in cutoff && cutoff.approvals).toBe(1);
  expect('approvals' in today && today.approvals).toBe(0);
  const draft = repositoryTimelineSample('prs', 'repo-prebidserver', 'reference').snapshots[1]
    .rows[0];
  expect([draft.number, 'humanReviewers' in draft && draft.humanReviewers]).toEqual([104, 0]);
});
it('dates issue closures by closedAt, separately from creation', () => {
  const source = structuredClone(repositoryTimelineSample('issues', 'repo-prebidjs', 'reference'));
  const closed = source.rows.find((row) => row.number === 202)!;
  expect(closed.createdAt.slice(0, 10)).toBe('2026-09-09');
  if ('closedAt' in closed) closed.closedAt = '2026-10-03T12:00:00.000Z';
  const year = {
    start: '2026-08-01T00:00:00.000Z',
    end: source.asOf,
    endInclusive: true,
  };
  const monthly = selectRepositoryTimeline(source, { range: year, grouping: 'month' });
  expect(monthly.rows.map((row) => row.values.issuesOpened!.value)).toEqual([1, 1, 1]);
  expect(monthly.rows.map((row) => row.values.issuesClosed!.value)).toEqual([0, 0, 1]);
  const daily = selectRepositoryTimeline(source, { range: year, grouping: 'day' });
  const value = (day: string) =>
    daily.rows.find((row) => row.interval.calendar.start === day + 'T00:00:00.000Z')!.values
      .issuesClosed!.value;
  expect([value('2026-09-09'), value('2026-10-03')]).toEqual([0, 1]);
  const detail = repositoryTimelineDetail(monthly, 'issuesClosed', monthly.rows[2].interval.id)!;
  expect(repositoryTimelineSupportingRows(source, detail).map((row) => row.number)).toEqual([202]);
});
it('rejects record states a backlog snapshot cannot contain', () => {
  expect(() =>
    validateRepositoryTimelineFilters(
      repositoryPageFiltersSchema.parse({ kind: 'issues', states: ['Closed'] }),
      'snapshot',
    ),
  ).toThrow('open at the cutoff');
  expect(
    validateRepositoryTimelineFilters(
      repositoryPageFiltersSchema.parse({ kind: 'issues', states: ['Open'] }),
      'snapshot',
    ).states,
  ).toEqual(['Open']);
});
