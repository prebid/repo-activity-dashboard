import { expect, it } from 'vitest';
import {
  repositoryTimelineSample,
  repositoryTimelineMatrixSample,
} from '@/mocks/repository-timeline';
import { contributionTimelineSample } from '@/mocks/contribution-timeline';
import {
  selectRepositoryTimeline,
  repositoryTimelineDetail,
  repositoryTimelineSupportingRows,
} from '@/lib/presentation/repository-timeline';
import { selectContributionTimeline } from '@/lib/presentation/contribution-timeline';
import { selectRepositoryTimelineMatrix } from '@/lib/presentation/repository-timeline-matrix';
import {
  selectRepositoryTimelineSupport,
  selectContributionTimelineSupport,
} from '@/lib/presentation/timeline-support';
import {
  timelineSupportHref,
  timelineParentQuery,
  readTimelineSupportQuery,
  timelineAuthorHref,
  timelineSupportScopeKey,
} from '@/lib/presentation/timeline-support-query';
import { timelineCsv } from '@/lib/presentation/timeline-csv';
import { timelineSupportContextColumns } from '@/lib/presentation/timeline-support-csv';
import {
  repositoryTimelineMetricIds,
  repositoryTimelineMetricScope,
} from '@/models/repository-timeline';
import { reportMetricIds } from '@/models/contribution-metrics';
import { timelineGroupings, type TimelineRequest } from '@/models/reporting-timeline';
import type { TimelineSupportContext } from '@/models/timeline-support';
import type { TimelineDisplayRow } from '@/models/timeline-presentation';
const request: TimelineRequest = {
  grouping: 'month',
  range: { start: '2026-01-01T00:00:00.000Z', end: '2026-10-24T12:00:00.000Z', endInclusive: true },
};
function context(
  report: { source: TimelineSupportContext['source'] },
  row: TimelineDisplayRow,
  metric: string,
): TimelineSupportContext {
  return {
    source: report.source,
    interval: row.interval,
    metric,
    measurement: row.values[metric]!,
    scope: '/repos?timeline=1',
    parentHref: '/repos?timeline=1',
    href: '/repos?timeline=1',
  };
}
it.each(timelineGroupings)(
  'reconciles every repository metric with its known supporting population for %s',
  (grouping) => {
    for (const metric of repositoryTimelineMetricIds) {
      const scope = repositoryTimelineMetricScope(metric),
        source = repositoryTimelineSample(scope.recordKind),
        report = selectRepositoryTimeline(source, { ...request, grouping }, scope.family);
      for (const row of report.rows) {
        const value = row.values[metric]!;
        if (value.value === null) continue;
        const detail = selectRepositoryTimelineSupport(
          source,
          report,
          context(report, row, metric),
        );
        if (detail.kind === 'authors') expect(detail.rows.length).toBe(value.value);
        else if (detail.kind === 'repository') {
          if (metric === 'medianMergeDays') {
            const days = detail.rows
              .map(
                (row) =>
                  (Date.parse('mergedAt' in row ? row.mergedAt! : '') - Date.parse(row.createdAt)) /
                  86400000,
              )
              .sort((a, b) => a - b);
            const half = Math.floor(days.length / 2);
            expect(days.length % 2 ? days[half] : (days[half - 1] + days[half]) / 2).toBe(
              value.value,
            );
          } else expect(detail.rows.length).toBe(value.value);
        } else throw Error('Unexpected detail family');
      }
    }
  },
);
it.each(timelineGroupings)(
  'reconciles all contribution credits, comments and volume units for %s',
  (grouping) => {
    const source = contributionTimelineSample(),
      report = selectContributionTimeline(source, { ...request, grouping });
    for (const row of report.rows)
      for (const metric of reportMetricIds) {
        const value = row.values[metric];
        if (value.value === null) continue;
        const detail = selectContributionTimelineSupport(
          source,
          report,
          context(report, row, metric),
        );
        if (detail.kind !== 'contribution') throw Error('Expected contribution');
        expect(detail.details.rows.reduce((sum, row) => sum + (row.value.value ?? 0), 0)).toBe(
          value.value,
        );
        expect(new Set(detail.details.rows.map((row) => row.id)).size).toBe(
          detail.details.rows.length,
        );
      }
  },
);
it('pins decisive PR/author/duration records and refuses unknown or mismatched supporting sources', () => {
  const source = repositoryTimelineSample(),
    report = selectRepositoryTimeline(source, request),
    oct = report.rows[9];
  const opened = selectRepositoryTimelineSupport(source, report, context(report, oct, 'prsOpened'));
  expect(opened.kind === 'repository' && opened.rows.map((row) => row.number)).toEqual([
    105, 107, 108,
  ]);
  const authors = selectRepositoryTimelineSupport(
    source,
    report,
    context(report, oct, 'prAuthors'),
  );
  expect(
    authors.kind === 'authors' && authors.rows.map((row) => [row.account, row.recordCount]),
  ).toEqual([
    ['sample-bob', 2],
    ['sample-drew', 1],
  ]);
  const bob = selectRepositoryTimelineSupport(
    source,
    report,
    context(report, oct, 'prAuthors'),
    'sample-bob',
  );
  expect(bob.kind === 'repository' && bob.rows.map((row) => row.number)).toEqual([105, 108]);
  const median = selectRepositoryTimelineSupport(
    source,
    report,
    context(report, oct, 'medianMergeDays'),
  );
  expect(median.context.measurement.value).toBe(31);
  expect(median.kind === 'repository' && median.rows.map((row) => row.number)).toEqual([101, 108]);
  expect(() =>
    selectRepositoryTimelineSupport(source, report, context(report, oct, 'prAuthors'), 'absent'),
  ).toThrow('Unknown author');
  expect(() =>
    selectRepositoryTimelineSupport(
      source,
      report,
      context(report, oct, 'prsOpened'),
      'sample-bob',
    ),
  ).toThrow('unique-author');
  expect(() =>
    selectRepositoryTimelineSupport(
      source,
      report,
      context(report, report.rows[0], 'medianMergeDays'),
    ),
  ).toThrow('unavailable');
  const descriptor = repositoryTimelineDetail(report, 'prsOpened', oct.interval.id)!;
  expect(() =>
    repositoryTimelineSupportingRows({ ...source, scenarioId: 'changed' }, descriptor),
  ).toThrow('source');
  expect(() =>
    repositoryTimelineSupportingRows(source, {
      ...descriptor,
      filters: {
        kind: 'issues',
        search: '',
        labels: [],
        authors: [],
        authorTypes: [],
        latestActors: [],
        states: [],
        assignees: [],
        assignment: 'any',
      },
    }),
  ).toThrow('scope');
});
it('uses the supplied historical approvals and keeps partial/zero membership honest', () => {
  const source = repositoryTimelineSample(),
    r = {
      grouping: 'day' as const,
      range: {
        start: '2026-10-21T00:00:00.000Z',
        end: '2026-10-22T00:00:00.000Z',
        endInclusive: false,
      },
    },
    report = selectRepositoryTimeline(source, r, 'snapshot');
  const details = selectRepositoryTimelineSupport(
    source,
    report,
    context(report, report.rows[0], 'humanApprovals1'),
  );
  expect(
    details.kind === 'repository' &&
      details.rows.map((row) => [row.number, 'approvals' in row ? row.approvals : null]),
  ).toEqual([[107, 1]]);
  expect(source.kind === 'prs' && source.rows.find((row) => row.number === 107)?.approvals).toBe(0);
  const descriptor = repositoryTimelineDetail(
    report,
    'humanApprovals1',
    report.rows[0].interval.id,
  )!;
  if (descriptor.basis !== 'snapshot') throw Error('Expected snapshot');
  expect(() =>
    repositoryTimelineSupportingRows(source, {
      ...descriptor,
      cutoff: { at: '2026-01-01T00:00:00.000Z', inclusive: false },
    }),
  ).toThrow('unavailable');
  const partial = repositoryTimelineSample('prs', 'repo-prebidserver', 'mixed'),
    p = selectRepositoryTimeline(partial, r, 'snapshot');
  const detail = selectRepositoryTimelineSupport(partial, p, context(p, p.rows[0], 'totalOpenPrs'));
  expect(detail.context.measurement.status).toBe('partial');
});
it('preserves exclusions and interval dating for comments and final merged review volume, even after display renaming', () => {
  const source = structuredClone(contributionTimelineSample());
  source.contributions.accounts.find((row) => row.id === 'account-bob')!.name = 'Renamed reviewer';
  const selection = {
    repositoryIds: ['repo-prebidjs'],
    actorTypes: ['human' as const],
    population: { kind: 'all' as const },
    excludedAccountIds: ['account-alice'],
  };
  const report = selectContributionTimeline(source, request, selection, {
    kind: 'contributor',
    accountId: 'account-bob',
  });
  const metric = 'reviewed.filesChanged',
    detail = selectContributionTimelineSupport(
      source,
      report,
      context(report, report.rows[9], metric),
    );
  expect(
    detail.kind === 'contribution' &&
      detail.details.rows.map((row) => [row.record.number, row.value.value, row.account.name]),
  ).toEqual([[101, 10, 'Renamed reviewer']]);
  expect(detail.context.measurement.value).toBe(10);
  for (const row of report.rows) {
    const d = selectContributionTimelineSupport(source, report, context(report, row, 'prComments'));
    expect(
      d.kind === 'contribution' &&
        d.details.rows.every(
          (record) =>
            record.creditedAt >= row.interval.covered.start &&
            record.lastAt <= row.interval.covered.end,
        ),
    ).toBe(true);
  }
  expect(() =>
    selectContributionTimelineSupport(
      { ...source, contributions: { ...source.contributions, scenarioId: 'other' } },
      report,
      context(report, report.rows[9], metric),
    ),
  ).toThrow('stale');
});
it('keeps source, exact interval and independent nested author table state in bounded URLs', () => {
  const report = selectRepositoryTimeline(repositoryTimelineSample(), request),
    row = report.rows[9];
  const href = timelineSupportHref(
    '/repos/prebidjs?timeline=1&timeline.sort=prsOpened&timeline.page=2',
    report.source,
    'prAuthors',
    row.interval.id,
  )!;
  const params = new URL(href, 'https://example.test').searchParams;
  expect(readTimelineSupportQuery(params)).toMatchObject({
    metric: 'prAuthors',
    interval: row.interval.id,
    origin: 'timeline',
  });
  params.set('support.authors.q', 'bob');
  params.set('support.authors.page', '2');
  const child = timelineAuthorHref('/repos/prebidjs?' + params.toString(), 'sample-bob')!;
  const nested = new URL(child, 'https://example.test');
  nested.searchParams.set('support.records.q', 'matching');
  nested.searchParams.set('support.records.page', '3');
  const back = timelineAuthorHref(nested.pathname + nested.search, null)!;
  expect(back).toContain('support.authors.q=bob');
  expect(back).not.toContain('support.records');
  expect(back).not.toContain('support.author=');
  expect(timelineParentQuery(params).get('timeline.page')).toBe('2');
  expect(timelineParentQuery(params).has('timeline.detail')).toBe(false);
  expect(timelineSupportScopeKey(href)).toBe(
    timelineSupportScopeKey('/repos/prebidjs?' + params.toString()),
  );
  expect(
    timelineSupportHref('https://evil.test', report.source, 'prsOpened', row.interval.id),
  ).toBeNull();
  expect(
    timelineSupportHref(
      '/repos?q=' + 'x'.repeat(7400),
      report.source,
      'prsOpened',
      row.interval.id,
    ),
  ).toBeNull();
  expect(timelineAuthorHref('/repos?q=' + 'x'.repeat(7499), 'alice')).toBeNull();
  for (const suffix of [
    '&support.bad=1',
    '&support.records.q=' + 'a'.repeat(201),
    '&support.records.page=0',
    '&support.records.dir=bad',
    '&support.author=a&support.author=b',
    '&support.records.q=a&support.records.q=b',
  ])
    expect(readTimelineSupportQuery(new URLSearchParams(params.toString() + suffix))).toBeNull();
});
it('exports a full matrix beyond its window and an individual timeline beyond fifty rows', () => {
  const input = repositoryTimelineMatrixSample(),
    range = {
      grouping: 'day' as const,
      range: { start: '2025-06-12T00:00:00.000Z', end: request.range.end, endInclusive: true },
    },
    matrix = selectRepositoryTimelineMatrix(input, range, {
      repositoryIds: input.repositories.map((row) => row.repository.id),
      metric: 'prsOpened',
    });
  const csv = timelineCsv(matrix, ['repository', 'period', 'prsOpened'], {
    search: 'ignored',
    sort: 'repository',
    descending: false,
    page: 8,
  });
  expect(csv.split('\r\n')).toHaveLength(9001);
  expect(csv).toContain('2025-06-12T00:00:00.000Z');
  expect(csv).toContain('2026-10-24T12:00:00.000Z');
  expect(csv).toContain('Source revision');
  expect(csv).toContain('coverage detail');
  const individual = selectRepositoryTimeline(input.repositories[0], range),
    detailCsv = timelineCsv(individual, ['period', 'prsOpened'], {
      search: 'ignored',
      sort: 'prsOpened',
      descending: true,
      page: 3,
    });
  expect(detailCsv.split('\r\n')).toHaveLength(501);
  const named = selectRepositoryTimelineMatrix(input, request, {
    repositoryIds: ['repo-prebidjs', 'repo-prebidserver'],
    metric: 'prsOpened',
  });
  const ordered = timelineCsv(named, ['repository', 'period', 'prsOpened'], {
    search: '',
    sort: named.intervals[7].id,
    descending: true,
    page: 1,
  });
  expect(ordered.split('\r\n')[1]).toContain('repo-prebidjs');
  const contributions = selectContributionTimeline(contributionTimelineSample(), request);
  expect(
    timelineCsv(contributions, ['period', 'prsAuthored'], {
      search: '',
      sort: 'period',
      descending: false,
      page: 9,
    }).split('\r\n'),
  ).toHaveLength(11);
  expect(() =>
    timelineCsv(individual, ['bad'], { search: '', sort: 'period', descending: false, page: 1 }),
  ).toThrow('columns');
  expect(() =>
    timelineCsv(individual, [], { search: '', sort: 'period', descending: false, page: 1 }),
  ).toThrow('columns');
});
it('attaches the original source/coverage to support exports', () => {
  const report = selectRepositoryTimeline(repositoryTimelineSample(), request),
    c = context(report, report.rows[9], 'prsOpened');
  const query = { search: 'text', sort: 'number', descending: true, page: 2 };
  const columns = timelineSupportContextColumns(c, query, 'sample-bob');
  const values = Object.fromEntries(columns.map((column) => [column.id, column.value()]));
  expect(values).toMatchObject({
    asOf: request.range.end,
    total: 3,
    search: 'text',
    selectedAuthor: 'sample-bob',
    direction: 'desc',
    coverage: 'complete',
    reason: '',
  });
});
it('exports partial coverage, missing author selection and ascending ordering explicitly', () => {
  const report = selectRepositoryTimeline(repositoryTimelineSample(), request),
    c = {
      ...context(report, report.rows[9], 'prsOpened'),
      measurement: { status: 'partial' as const, value: 0, reason: 'Incomplete history' },
    };
  const columns = timelineSupportContextColumns(c, {
    search: '',
    sort: 'createdAt',
    descending: false,
    page: 1,
  });
  const values = Object.fromEntries(columns.map((column) => [column.id, column.value()]));
  expect(values).toMatchObject({
    reason: 'Incomplete history',
    selectedAuthor: null,
    direction: 'asc',
    total: 0,
    coverage: 'partial',
  });
});
