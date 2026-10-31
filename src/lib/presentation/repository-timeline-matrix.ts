import {
  repositoryTimelineMatrixSourceSchema,
  repositoryTimelineMatrixSelectionSchema,
  repositoryTimelineMatrixSortSchema,
  repositoryTimelineMatrixCellLimit,
  repositoryTimelineMatrixWindowSize,
  type RepositoryTimelineMatrixSource,
  type RepositoryTimelineMatrixSelection,
  type RepositoryTimelineMatrix,
  type RepositoryTimelineMatrixRow,
  type RepositoryTimelineMatrixWindow,
  type RepositoryTimelineMatrixSort,
} from '@/models/repository-timeline-matrix';
import { repositoryTimelineMetricScope } from '@/models/repository-timeline';
import type { TimelineRequest } from '@/models/reporting-timeline';
import { createRepositoryTimelineProjection, repositoryTimelineValue } from './repository-timeline';
import { selectTableRows } from './table-rows';
import { measurementSortGroup, measurementSortNote } from './measurement-order';
import type { TableValueColumn } from '@/models/table-values';

function byRepository(a: RepositoryTimelineMatrixRow, b: RepositoryTimelineMatrixRow) {
  return (
    a.repository.name.localeCompare(b.repository.name, 'en') ||
    a.repository.id.localeCompare(b.repository.id, 'en')
  );
}
export class RepositoryTimelineMatrixLimitError extends RangeError {}
/** One shared axis; each repository's selected metrics remain contiguous rows. */
export function selectRepositoryTimelineMatrix(
  input: RepositoryTimelineMatrixSource,
  requested: TimelineRequest,
  selected: RepositoryTimelineMatrixSelection,
): RepositoryTimelineMatrix {
  const projection = createRepositoryTimelineProjection(requested, input.asOf),
    source = repositoryTimelineMatrixSourceSchema.parse(input),
    selection = repositoryTimelineMatrixSelectionSchema.parse(selected);
  if (
    source.kind !== 'mixed' &&
    selection.metrics.some(
      (metric) => repositoryTimelineMetricScope(metric).recordKind !== source.kind,
    )
  )
    throw Error('Matrix metric does not match the source record kind');
  const repositories = new Map<
    string,
    Map<'prs' | 'issues', (typeof source.repositories)[number]>
  >();
  const slugs = new Map<string, string>();
  for (const item of source.repositories) {
    if (
      item.asOf !== source.asOf ||
      item.scenarioId !== source.scenarioId ||
      (source.kind !== 'mixed' && item.kind !== source.kind)
    )
      throw Error('Matrix repositories must share their source revision, clock and record kind');
    const previous =
      repositories.get(item.repository.id) ?? new Map<'prs' | 'issues', typeof item>();
    if (previous.has(item.kind)) throw Error('Duplicate matrix repository identity');
    const other = [...previous.values()][0];
    if (other && JSON.stringify(other.repository) !== JSON.stringify(item.repository))
      throw Error('Matrix repository identities disagree across record kinds');
    if (slugs.has(item.repository.slug) && slugs.get(item.repository.slug) !== item.repository.id)
      throw Error('Duplicate matrix repository identity');
    slugs.set(item.repository.slug, item.repository.id);
    previous.set(item.kind, item);
    repositories.set(item.repository.id, previous);
  }
  const repositoryIds = [...new Set(selection.repositoryIds)].sort();
  if (repositoryIds.some((id) => !repositories.has(id)))
    throw Error('Unknown selected matrix repository');
  if (
    repositoryIds.length * selection.metrics.length * projection.intervals.length >
    repositoryTimelineMatrixCellLimit
  )
    throw new RepositoryTimelineMatrixLimitError(
      `Matrix exceeds ${repositoryTimelineMatrixCellLimit} cells; select fewer repositories/metrics or a coarser grouping`,
    );
  const rows: RepositoryTimelineMatrixRow[] = [];
  for (const id of repositoryIds) {
    const inputs = repositories.get(id)!;
    const reports = new Map<string, ReturnType<typeof projection.select>>();
    for (const metric of selection.metrics) {
      const definition = repositoryTimelineMetricScope(metric),
        key = definition.recordKind + ':' + definition.family;
      if (!reports.has(key)) {
        const item = inputs.get(definition.recordKind);
        if (!item) throw Error('Matrix metric does not match the source record kind');
        const metrics = selection.metrics.filter((id) => {
          const next = repositoryTimelineMetricScope(id);
          return next.recordKind === definition.recordKind && next.family === definition.family;
        });
        reports.set(key, projection.select(item, definition.family, undefined, metrics));
      }
      const report = reports.get(key)!;
      rows.push({
        id: selection.metrics.length === 1 ? id : JSON.stringify([id, metric]),
        repository: report.scope.repository,
        metric,
        values: report.rows.map((row) => repositoryTimelineValue(row.values, metric)),
        summary: repositoryTimelineValue(report.summary, metric),
      });
    }
  }
  return {
    kind: 'repository-matrix',
    source: { source: source.source, scenarioId: source.scenarioId, asOf: source.asOf },
    request: projection.request,
    scope: { repositoryIds, metrics: selection.metrics },
    intervals: projection.intervals,
    rows: rows.sort(byRepository),
  };
}
/** Presentation only: a window never replaces or truncates matrix values. Pages are one-based. */
export function repositoryTimelineMatrixWindow(
  matrix: RepositoryTimelineMatrix,
  requestedPage?: number,
): RepositoryTimelineMatrixWindow {
  const pageCount = Math.ceil(matrix.intervals.length / repositoryTimelineMatrixWindowSize);
  const page = requestedPage ?? pageCount;
  if (!Number.isInteger(page) || page < 1 || page > pageCount)
    throw Error('Invalid matrix period window');
  const startIndex = (page - 1) * repositoryTimelineMatrixWindowSize;
  const endIndex = Math.min(
    startIndex + repositoryTimelineMatrixWindowSize,
    matrix.intervals.length,
  );
  return {
    page,
    pageCount,
    startIndex,
    endIndex,
    intervals: matrix.intervals.slice(startIndex, endIndex),
    earlierPage: page > 1 ? page - 1 : null,
    laterPage: page < pageCount ? page + 1 : null,
  };
}
function intervalIndex(matrix: RepositoryTimelineMatrix, id: string) {
  const index = matrix.intervals.findIndex((interval) => interval.id === id);
  if (index < 0) throw Error('Unknown matrix interval');
  return index;
}
/** Full value axis, shared by pure sorting and tables that render only a period window. */
export function repositoryTimelineMatrixValues(
  matrix: RepositoryTimelineMatrix,
  metric = matrix.scope.metrics[0],
): TableValueColumn<RepositoryTimelineMatrixRow>[] {
  if (!matrix.scope.metrics.includes(metric)) throw Error('Unknown matrix sort metric');
  const ranked = new Map(
    matrix.rows.filter((row) => row.metric === metric).map((row) => [row.repository.id, row]),
  );
  return [
    { id: 'repository', value: (row) => row.repository.name },
    ...matrix.intervals.map((interval, index) => ({
      id: interval.id,
      value: (row: RepositoryTimelineMatrixRow) =>
        ranked.get(row.repository.id)!.values[index].value,
      sortGroup: (row: RepositoryTimelineMatrixRow) =>
        measurementSortGroup(ranked.get(row.repository.id)!.values[index]),
      sortNote: measurementSortNote,
    })),
  ];
}
export function sortRepositoryTimelineMatrix(
  matrix: RepositoryTimelineMatrix,
  requested: RepositoryTimelineMatrixSort = { kind: 'repository', descending: false },
) {
  if (!matrix.rows.length) return [];
  const sort = repositoryTimelineMatrixSortSchema.parse(requested),
    rows = [...matrix.rows].sort(byRepository);
  if (sort.kind === 'interval') intervalIndex(matrix, sort.intervalId);
  return selectTableRows(
    rows,
    repositoryTimelineMatrixValues(
      matrix,
      sort.kind === 'interval' ? (sort.metric ?? matrix.scope.metrics[0]) : matrix.scope.metrics[0],
    ),
    {
      search: '',
      sort: sort.kind === 'repository' ? 'repository' : sort.intervalId,
      descending: sort.descending,
    },
    false,
  );
}
