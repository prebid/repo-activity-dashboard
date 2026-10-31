import { beforeAll, describe, expect, it } from 'vitest';
import {
  repositoryTimelineMatrixSample,
  repositoryTimelineSample,
} from '@/mocks/repository-timeline';
import { selectRepositoryTimelineMatrix } from '@/lib/presentation/repository-timeline-matrix';
import {
  selectRepositoryTimeline,
  repositoryTimelineValue,
  repositoryTimelineDetail,
  createRepositoryTimelineProjection,
  repositoryTimelineMeasurementDetail,
} from '@/lib/presentation/repository-timeline';
import {
  repositoryTimelineMetricIds,
  repositoryTimelineMetricScope,
  type RepositoryTimeline,
} from '@/models/repository-timeline';
import { timelineGroupings, type TimelineRequest } from '@/models/reporting-timeline';
import { repositoryCatalog } from '@/config/repositories';
const annual: TimelineRequest = {
  grouping: 'month',
  range: {
    start: '2024-01-01T00:00:00.000Z',
    end: '2025-01-01T00:00:00.000Z',
    endInclusive: false,
  },
};
const reference: TimelineRequest = {
  grouping: 'month',
  range: { start: '2026-01-01T00:00:00.000Z', end: '2026-10-24T12:00:00.000Z', endInclusive: true },
};

describe.each(timelineGroupings)('%s matrix equivalence', (grouping) => {
  const sources = {
    prs: repositoryTimelineMatrixSample('prs', 'calendar'),
    issues: repositoryTimelineMatrixSample('issues', 'calendar'),
  };
  const request = { ...annual, grouping };
  const individuals = new Map<string, RepositoryTimeline>();
  beforeAll(() => {
    for (const kind of ['prs', 'issues'] as const)
      for (const family of ['activity', 'snapshot'] as const)
        for (const source of sources[kind].repositories)
          individuals.set(
            kind + ':' + family + ':' + source.repository.id,
            selectRepositoryTimeline(source, request, family),
          );
  });
  it.each(repositoryTimelineMetricIds)(
    'matches every individual %s value and its whole-range meaning',
    (metric) => {
      const definition = repositoryTimelineMetricScope(metric),
        source = sources[definition.recordKind];
      const matrix = selectRepositoryTimelineMatrix(source, request, {
        metric,
        repositoryIds: source.repositories.map((row) => row.repository.id),
      });
      expect(matrix.rows).toHaveLength(18);
      expect(matrix.scope.metrics).toEqual([metric]);
      expect(matrix).not.toHaveProperty('summary');
      for (const row of matrix.rows) {
        expect(row.metric).toBe(metric);
        const individual = individuals.get(
          definition.recordKind + ':' + definition.family + ':' + row.id,
        )!;
        expect(matrix.intervals).toEqual(individual.rows.map((item) => item.interval));
        expect(row.values).toEqual(
          individual.rows.map((item) => repositoryTimelineValue(item.values, metric)),
        );
        expect(row.summary).toEqual(repositoryTimelineValue(individual.summary, metric));
        expect(matrix.source).toEqual(individual.source);
      }
    },
  );
});

it('pins independent monthly repository counts and retains all selected zero rows', () => {
  const source = repositoryTimelineMatrixSample();
  expect(source.repositories.map((row) => row.repository.id)).toEqual(
    repositoryCatalog.filter((repo) => repo.enabled).map((repo) => repo.id),
  );
  const matrix = selectRepositoryTimelineMatrix(source, reference, {
    metric: 'prsOpened',
    repositoryIds: source.repositories.map((row) => row.repository.id),
  });
  expect(
    matrix.rows
      .find((row) => row.id === 'repo-prebidjs')!
      .values.slice(7)
      .map((value) => value.value),
  ).toEqual([1, 1, 3]);
  expect(
    matrix.rows
      .find((row) => row.id === 'repo-prebidserver')!
      .values.slice(7)
      .map((value) => value.value),
  ).toEqual([0, 0, 3]);
  expect(matrix.rows.find((row) => row.id === 'repo-prebidjs')!.summary.value).toBe(5);
  expect(matrix.rows.find((row) => row.id === 'repo-prebidserver')!.summary.value).toBe(3);
  expect(
    matrix.rows
      .filter((row) => row.id !== 'repo-prebidjs' && row.id !== 'repo-prebidserver')
      .every((row) =>
        row.values.every((value) => value.status === 'complete' && value.value === 0),
      ),
  ).toBe(true);
  const reversed = structuredClone(source);
  reversed.repositories.reverse();
  expect(
    selectRepositoryTimelineMatrix(reversed, reference, {
      metric: 'prsOpened',
      repositoryIds: [...matrix.scope.repositoryIds].reverse(),
    }),
  ).toEqual(matrix);
});
it('keeps distinct authors and medians per repository instead of blending or summing them', () => {
  const source = repositoryTimelineMatrixSample();
  const ids = ['repo-prebidjs', 'repo-prebidserver'];
  const authors = selectRepositoryTimelineMatrix(source, reference, {
    metric: 'prAuthors',
    repositoryIds: ids,
  });
  expect(authors.rows.find((row) => row.id === ids[0])!.summary.value).toBe(4);
  expect(authors.rows.find((row) => row.id === ids[1])!.summary.value).toBe(3);
  const aliceRepos = source.repositories
    .filter((repo) => repo.rows.some((row) => row.author === 'sample-alice'))
    .map((repo) => repo.repository.id);
  expect(aliceRepos).toEqual(ids);
  const median = selectRepositoryTimelineMatrix(source, reference, {
    metric: 'medianMergeDays',
    repositoryIds: ids,
  });
  const js = median.rows.find((row) => row.id === ids[0])!;
  expect(js.values[8].value).toBe(5);
  expect(js.values[9].value).toBe(31);
  expect(js.summary.value).toBe(5);
  expect(repositoryTimelineMetricScope(median.rows[0].metric).unit).toBe('days');
  expect(median).not.toHaveProperty('total');
});
it('preserves mixed coverage without changing the source identity between matrix and individual samples', () => {
  const source = repositoryTimelineMatrixSample('prs', 'mixed');
  const matrix = selectRepositoryTimelineMatrix(source, reference, {
    metric: 'prsOpened',
    repositoryIds: source.repositories.map((row) => row.repository.id),
  });
  expect(matrix.rows).toHaveLength(18);
  const js = matrix.rows.find((row) => row.id === 'repo-prebidjs')!,
    server = matrix.rows.find((row) => row.id === 'repo-prebidserver')!,
    java = matrix.rows.find((row) => row.id === 'repo-prebidserverjava')!;
  expect(js.values[0]).toEqual({ status: 'complete', value: 0 });
  expect(server.values[0]).toMatchObject({ status: 'missing', value: null });
  expect(server.summary).toMatchObject({ status: 'partial', value: 3 });
  expect(java.values.every((value) => value.status === 'missing' && value.value === null)).toBe(
    true,
  );
  for (const item of source.repositories) {
    expect(item).toEqual(repositoryTimelineSample('prs', item.repository.id, 'mixed'));
    expect(item.scenarioId).toBe(matrix.source.scenarioId);
  }
  const gapped = repositoryTimelineMatrixSample('prs', 'mixed', true);
  expect(gapped.scenarioId).not.toBe(source.scenarioId);
  const serverGap = gapped.repositories.find((item) => item.repository.id === 'repo-prebidserver')!;
  expect(serverGap.availableRanges[0].start).toBe('2026-03-01T00:00:00.000Z');
});
it('normalizes duplicate selections but keeps none distinct from all and rejects unknown repositories', () => {
  const source = repositoryTimelineMatrixSample();
  const one = selectRepositoryTimelineMatrix(source, reference, {
    metric: 'prsOpened',
    repositoryIds: ['repo-prebidjs', 'repo-prebidjs'],
  });
  expect(one.rows).toHaveLength(1);
  expect(one.scope.repositoryIds).toEqual(['repo-prebidjs']);
  const none = selectRepositoryTimelineMatrix(source, reference, {
    metric: 'prsOpened',
    repositoryIds: [],
  });
  expect(none.rows).toEqual([]);
  expect(none.scope.repositoryIds).toEqual([]);
  expect(none.intervals).toEqual(one.intervals);
  expect(() =>
    selectRepositoryTimelineMatrix(source, reference, {
      metric: 'prsOpened',
      repositoryIds: ['missing'],
    }),
  ).toThrow('Unknown selected');
});
it('keeps repository-entry and cell-detail intents distinct with exact interval and cutoff context', () => {
  const source = repositoryTimelineMatrixSample('prs', 'mixed');
  const request: TimelineRequest = {
    grouping: 'day',
    range: {
      start: '2026-10-11T00:00:00.000Z',
      end: '2026-10-22T00:00:00.000Z',
      endInclusive: false,
    },
  };
  const matrix = selectRepositoryTimelineMatrix(source, request, {
    metric: 'humanApprovals1',
    repositoryIds: ['repo-prebidjs', 'repo-prebidserver'],
  });
  expect(matrix.rows.find((row) => row.id === 'repo-prebidjs')!.values.at(-1)!.value).toBe(1);
  // Matrix cells link through the individual Timeline, so its descriptor is the cell's destination.
  const individual = (id: string, family: 'activity' | 'snapshot', query = request) =>
    selectRepositoryTimeline(
      source.repositories.find((row) => row.repository.id === id)!,
      query,
      family,
    );
  const last = matrix.intervals.at(-1)!;
  const prebidjs = individual('repo-prebidjs', 'snapshot');
  expect(prebidjs.rows.at(-1)!.values.humanApprovals1).toEqual(
    matrix.rows.find((row) => row.id === 'repo-prebidjs')!.values.at(-1),
  );
  expect(repositoryTimelineDetail(prebidjs, 'humanApprovals1', last.id)).toMatchObject({
    basis: 'snapshot',
    cutoff: { at: request.range.end, inclusive: false },
    repositoryId: 'repo-prebidjs',
    source: matrix.source,
  });
  expect(repositoryTimelineDetail(prebidjs, 'humanApprovals1', matrix.intervals[1].id)).toBeNull();
  expect(
    repositoryTimelineDetail(
      individual('repo-prebidserver', 'snapshot'),
      'humanApprovals1',
      last.id,
    ),
  ).not.toBeNull(); // known partial zero
  const activity = individual('repo-prebidjs', 'activity', reference);
  expect(
    repositoryTimelineDetail(activity, 'prsOpened', activity.rows[0].interval.id),
  ).toMatchObject({ basis: 'event', range: activity.rows[0].interval.covered });
});
it('owns one immutable calendar and projects only the chosen metric without affecting existing defaults', () => {
  const source = repositoryTimelineSample();
  const request = structuredClone(reference),
    projection = createRepositoryTimelineProjection(request, source.asOf);
  request.range.start = '2026-09-01T00:00:00.000Z';
  const report = projection.select(source, 'activity', undefined, ['prsOpened', 'prsOpened']);
  expect(report.metrics).toEqual(['prsOpened']);
  expect(Object.keys(report.summary)).toEqual(['prsOpened']);
  expect(
    report.rows.every(
      (row, index) =>
        row.interval === projection.intervals[index] && Object.keys(row.values).length === 1,
    ),
  ).toBe(true);
  expect(projection.request.range.start).toBe(reference.range.start);
  expect(() => {
    report.rows[0].interval.covered.start = '2026-09-01T00:00:00.000Z';
  }).toThrow();
  expect(projection.select(source).metrics).toEqual([
    'prsOpened',
    'prsMerged',
    'prAuthors',
    'medianMergeDays',
  ]);
  expect(() => projection.select({ ...source, asOf: '2026-10-23T12:00:00.000Z' })).toThrow(
    'shared calendar',
  );
  expect(() => projection.select(source, 'activity', undefined, [])).toThrow('Selected metric');
  expect(() => projection.select(source, 'activity', undefined, ['openIssues'])).toThrow(
    'Selected metric',
  );
  expect(() => repositoryTimelineMetricScope('bad' as never)).toThrow(
    'Unknown repository timeline metric',
  );
  expect(() =>
    repositoryTimelineMeasurementDetail(report, 'issuesClosed', reference.range, {
      status: 'complete',
      value: 0,
    }),
  ).toThrow('Detail metric');
});
it('groups mixed PR, issue and duration metrics per repository without changing their values', () => {
  const source = repositoryTimelineMatrixSample('mixed'),
    matrix = selectRepositoryTimelineMatrix(source, reference, {
      repositoryIds: ['repo-prebidjs', 'repo-prebidserver'],
      metrics: ['prsOpened', 'issuesClosed', 'medianMergeDays'],
    });
  expect(matrix.scope.metrics).toEqual(['prsOpened', 'issuesClosed', 'medianMergeDays']);
  expect(matrix.rows).toHaveLength(6);
  expect(new Set(matrix.rows.map((row) => row.id)).size).toBe(6);
  for (const repositoryId of matrix.scope.repositoryIds) {
    const group = matrix.rows.filter((row) => row.repository.id === repositoryId);
    expect(group.map((row) => row.metric)).toEqual(matrix.scope.metrics);
    for (const row of group) {
      const scope = repositoryTimelineMetricScope(row.metric),
        input = source.repositories.find(
          (item) => item.repository.id === repositoryId && item.kind === scope.recordKind,
        )!;
      const individual = selectRepositoryTimeline(input, reference, scope.family);
      expect(row.values).toEqual(individual.rows.map((item) => item.values[row.metric]));
      expect(row.summary).toEqual(individual.summary[row.metric]);
    }
  }
  const js = matrix.rows.filter((row) => row.repository.id === 'repo-prebidjs');
  expect(js[0].values[9].value).toBe(3);
  expect(js[1].values[8].value).toBe(1);
  expect(js[2].values[9].value).toBe(31);
  const detail = repositoryTimelineDetail(
    selectRepositoryTimeline(
      source.repositories.find(
        (item) => item.repository.id === 'repo-prebidjs' && item.kind === 'prs',
      )!,
      reference,
    ),
    'medianMergeDays',
    matrix.intervals[9].id,
  );
  expect(detail?.metric).toBe('medianMergeDays');
  expect(detail?.basis).toBe('duration');
  const empty = selectRepositoryTimelineMatrix(source, reference, {
    repositoryIds: ['repo-prebidjs'],
    metrics: [],
  });
  expect(empty.rows).toEqual([]);
});
