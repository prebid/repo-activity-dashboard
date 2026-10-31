import { expect, it } from 'vitest';
import { repositoryTimelineMatrixSample } from '@/mocks/repository-timeline';
import {
  selectRepositoryTimelineMatrix,
  repositoryTimelineMatrixWindow,
  sortRepositoryTimelineMatrix,
} from '@/lib/presentation/repository-timeline-matrix';
import type { RepositoryTimelineMatrixSource } from '@/models/repository-timeline-matrix';
import type { TimelineRequest } from '@/models/reporting-timeline';
import { repositoryTimelineMetricScope } from '@/models/repository-timeline';
const request: TimelineRequest = {
  grouping: 'day',
  range: { start: '2025-06-12T00:00:00.000Z', end: '2026-10-24T12:00:00.000Z', endInclusive: true },
};
const ids = (source: RepositoryTimelineMatrixSource) =>
  source.repositories.map((item) => item.repository.id);
it.each(['prsOpened', 'issuesClosed', 'medianMergeDays', 'humanApprovals1'] as const)(
  'keeps %s payload to one metric and one interval axis at the 9,000-cell catalog bound',
  (metric) => {
    const kind = repositoryTimelineMetricScope(metric).recordKind;
    const source = repositoryTimelineMatrixSample(kind, 'large', true);
    const matrix = selectRepositoryTimelineMatrix(source, request, {
      metric,
      repositoryIds: ids(source),
    });
    expect(matrix.intervals).toHaveLength(500);
    expect(matrix.rows).toHaveLength(18);
    expect(matrix.rows.reduce((sum, row) => sum + row.values.length, 0)).toBe(9000);
    expect(matrix.scope.metrics).toEqual([metric]);
    const json = JSON.stringify(matrix);
    expect(Buffer.byteLength(json)).toBeLessThan(1_500_000);
    expect(json.match(/"calendar":/g)).toHaveLength(500);
    for (const field of ['"records"', '"snapshots"', '"accounts"', '"mergedDiff"'])
      expect(json).not.toContain(field);
    expect(json).not.toContain('Sample PR');
  },
);
it('windows preserve the full matrix, including the short latest window and explicit invalid requests', () => {
  const source = repositoryTimelineMatrixSample(),
    matrix = selectRepositoryTimelineMatrix(source, request, {
      metric: 'prsOpened',
      repositoryIds: ids(source),
    });
  const before = JSON.stringify(matrix),
    latest = repositoryTimelineMatrixWindow(matrix);
  expect(latest).toMatchObject({
    page: 42,
    pageCount: 42,
    startIndex: 492,
    endIndex: 500,
    earlierPage: 41,
    laterPage: null,
  });
  expect(latest.intervals).toHaveLength(8);
  const first = repositoryTimelineMatrixWindow(matrix, 1),
    middle = repositoryTimelineMatrixWindow(matrix, 20);
  expect(first).toMatchObject({ startIndex: 0, endIndex: 12, earlierPage: null, laterPage: 2 });
  expect(middle).toMatchObject({ startIndex: 228, endIndex: 240, earlierPage: 19, laterPage: 21 });
  const all = [];
  for (let page = 1; page <= latest.pageCount; page++)
    all.push(...repositoryTimelineMatrixWindow(matrix, page).intervals);
  expect(all).toEqual(matrix.intervals);
  expect(JSON.stringify(matrix)).toBe(before);
  for (const page of [0, -1, 1.5, 43, NaN])
    expect(() => repositoryTimelineMatrixWindow(matrix, page)).toThrow(
      'Invalid matrix period window',
    );
  const short = selectRepositoryTimelineMatrix(
    source,
    { ...request, grouping: 'year' },
    { metric: 'prsOpened', repositoryIds: [] },
  );
  expect(repositoryTimelineMatrixWindow(short)).toMatchObject({
    page: 1,
    pageCount: 1,
    earlierPage: null,
    laterPage: null,
  });
});
function extended(count: number): RepositoryTimelineMatrixSource {
  const source = repositoryTimelineMatrixSample(),
    base = source.repositories[0];
  source.repositories = Array.from({ length: count }, (_, i) => ({
    ...structuredClone(base),
    repository: {
      ...base.repository,
      id: 'repo-' + String(i).padStart(3, '0'),
      slug: 'repo-' + i,
      name: 'Repository ' + String(i).padStart(3, '0'),
    },
    rows: [],
    snapshots: [],
  }));
  return source;
}
it('enforces interval and cell limits before producing oversized matrix values', () => {
  const source = extended(20);
  expect(
    selectRepositoryTimelineMatrix(source, request, {
      metric: 'prsOpened',
      repositoryIds: ids(source),
    }).rows,
  ).toHaveLength(20);
  const tooMany = extended(21);
  expect(() =>
    selectRepositoryTimelineMatrix(tooMany, request, {
      metric: 'prsOpened',
      repositoryIds: ids(tooMany),
    }),
  ).toThrow('Matrix exceeds 10000 cells');
  const over = { ...request, range: { ...request.range, start: '2025-06-11T00:00:00.000Z' } };
  expect(() =>
    selectRepositoryTimelineMatrix(source, over, { metric: 'prsOpened', repositoryIds: [] }),
  ).toThrow('500 intervals');
  expect(
    selectRepositoryTimelineMatrix(
      tooMany,
      { ...request, grouping: 'month' },
      { metric: 'prsOpened', repositoryIds: ids(tooMany) },
    ).rows,
  ).toHaveLength(21);
});
it('sorts every repository by an offscreen period before paging, without mutating the model', () => {
  const source = extended(51),
    base = repositoryTimelineMatrixSample().repositories[0];
  source.repositories[50].rows = [base.rows[0]] as typeof base.rows;
  const query = {
    ...request,
    range: { ...request.range, start: '2026-01-01T00:00:00.000Z' },
    grouping: 'week' as const,
  };
  const matrix = selectRepositoryTimelineMatrix(source, query, {
    metric: 'prsOpened',
    repositoryIds: ids(source),
  });
  const period = 'week:2026-08-03T00:00:00.000Z',
    window = repositoryTimelineMatrixWindow(matrix);
  expect(window.intervals.some((interval) => interval.id === period)).toBe(false);
  const before = JSON.stringify(matrix),
    ranked = sortRepositoryTimelineMatrix(matrix, {
      kind: 'interval',
      intervalId: period,
      descending: true,
    });
  expect(ranked).toHaveLength(51);
  expect(ranked[0].id).toBe('repo-050');
  expect(ranked.slice(0, 50).some((row) => row.id === 'repo-050')).toBe(true);
  expect(sortRepositoryTimelineMatrix(matrix)[0].id).toBe('repo-000');
  expect(sortRepositoryTimelineMatrix(matrix, { kind: 'repository', descending: true })[0].id).toBe(
    'repo-050',
  );
  expect(JSON.stringify(matrix)).toBe(before);
  expect(() =>
    sortRepositoryTimelineMatrix(matrix, {
      kind: 'interval',
      intervalId: 'absent',
      descending: false,
    }),
  ).toThrow('Unknown matrix interval');
});
it.each([true, false])(
  'keeps coverage ranking and deterministic ties in either numeric direction: descending=%s',
  (descending) => {
    const source = extended(4),
      matrix = selectRepositoryTimelineMatrix(
        source,
        { ...request, grouping: 'month' },
        { metric: 'prsOpened', repositoryIds: ids(source) },
      );
    matrix.rows[0].values[0] = { status: 'missing', value: null, reason: 'Gap' };
    matrix.rows[1].values[0] = { status: 'partial', value: 99, reason: 'Incomplete' };
    matrix.rows[2].values[0] = { status: 'complete', value: 0 };
    matrix.rows[3].values[0] = {
      status: 'not-applicable',
      value: null,
      reason: 'No applicable measure',
    };
    expect(
      sortRepositoryTimelineMatrix(matrix, {
        kind: 'interval',
        intervalId: matrix.intervals[0].id,
        descending,
      }).map((row) => row.id),
    ).toEqual(['repo-002', 'repo-001', 'repo-000', 'repo-003']);
    source.repositories[0].repository.name = source.repositories[1].repository.name;
    source.repositories.reverse();
    const ties = selectRepositoryTimelineMatrix(
      source,
      { ...request, grouping: 'month' },
      { metric: 'prsOpened', repositoryIds: ids(source) },
    );
    expect(ties.rows.slice(0, 2).map((row) => row.id)).toEqual(['repo-000', 'repo-001']);
  },
);
it.each([
  ['clock', 'must share their source revision, clock and record kind'],
  ['revision', 'must share their source revision, clock and record kind'],
  ['kind', 'must share their source revision, clock and record kind'],
  ['duplicate-id', 'Duplicate matrix repository identity'],
  ['duplicate-slug', 'Duplicate matrix repository identity'],
] as const)('rejects mixed or duplicate source context: %s', (corruption, message) => {
  const source = repositoryTimelineMatrixSample();
  if (corruption === 'clock') source.repositories[0].asOf = '2026-10-23T12:00:00.000Z';
  if (corruption === 'revision') source.repositories[0].scenarioId = 'other';
  if (corruption === 'kind')
    source.repositories[0] = repositoryTimelineMatrixSample('issues').repositories[0];
  if (corruption === 'duplicate-id')
    source.repositories[0].repository.id = source.repositories[1].repository.id;
  if (corruption === 'duplicate-slug')
    source.repositories[0].repository.slug = source.repositories[1].repository.slug;
  expect(() =>
    selectRepositoryTimelineMatrix(source, request, { metric: 'prsOpened', repositoryIds: [] }),
  ).toThrow(message);
});
it('rejects unknown metrics and wrong record kinds, and keeps complete/missing/zero samples separate', () => {
  const source = repositoryTimelineMatrixSample();
  expect(() =>
    selectRepositoryTimelineMatrix(source, request, { metric: 'bad' as never, repositoryIds: [] }),
  ).toThrow('invalid_value');
  expect(() =>
    selectRepositoryTimelineMatrix(source, request, { metric: 'issuesOpened', repositoryIds: [] }),
  ).toThrow('record kind');
  for (const scenario of ['empty', 'missing'] as const) {
    const input = repositoryTimelineMatrixSample('prs', scenario),
      query = {
        ...request,
        grouping: 'month' as const,
        range: { ...request.range, start: '2026-01-01T00:00:00.000Z' },
      };
    const matrix = selectRepositoryTimelineMatrix(input, query, {
      metric: 'prsOpened',
      repositoryIds: ids(input),
    });
    expect(matrix.rows).toHaveLength(18);
    expect(
      matrix.rows.every((row) =>
        row.values.every((value) =>
          scenario === 'empty'
            ? value.status === 'complete' && value.value === 0
            : value.status === 'missing' && value.value === null,
        ),
      ),
    ).toBe(true);
  }
});
it('counts every selected metric against the cell budget and sorts complete repository groups', () => {
  const source = repositoryTimelineMatrixSample('mixed'),
    repos = [...new Set(ids(source))];
  expect(() =>
    selectRepositoryTimelineMatrix(source, request, {
      repositoryIds: repos,
      metrics: ['prsOpened', 'prsMerged'],
    }),
  ).toThrow('10000');
  const matrix = selectRepositoryTimelineMatrix(
    source,
    { ...request, grouping: 'month' },
    { repositoryIds: repos, metrics: ['prsOpened', 'prsMerged', 'medianMergeDays'] },
  );
  const sorted = sortRepositoryTimelineMatrix(matrix, {
    kind: 'interval',
    intervalId: matrix.intervals[15].id,
    metric: 'prsOpened',
    descending: true,
  });
  for (let i = 0; i < sorted.length; i += 3) {
    expect(new Set(sorted.slice(i, i + 3).map((row) => row.repository.id)).size).toBe(1);
    expect(sorted.slice(i, i + 3).map((row) => row.metric)).toEqual(matrix.scope.metrics);
  }
  expect(() =>
    sortRepositoryTimelineMatrix(matrix, {
      kind: 'interval',
      intervalId: matrix.intervals[0].id,
      metric: 'issuesClosed',
      descending: false,
    }),
  ).toThrow('Unknown matrix sort metric');
  const mismatch = structuredClone(source);
  mismatch.repositories[1].repository.name = 'Different';
  expect(() =>
    selectRepositoryTimelineMatrix(mismatch, request, { repositoryIds: repos, metrics: [] }),
  ).toThrow('identities disagree');
});
