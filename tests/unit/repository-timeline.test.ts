import { expect, it } from 'vitest';
import { repositoryTimelineSample } from '@/mocks/repository-timeline';
import {
  selectRepositoryTimeline,
  repositoryTimelineDetail,
  repositoryTimelineValue,
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
    ).toThrow('snapshot');
  expect(() =>
    validateRepositoryTimelineFilters(
      repositoryPageFiltersSchema.parse({ kind: 'prs', eventRange: range }),
      'snapshot',
    ),
  ).toThrow('exact');
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
