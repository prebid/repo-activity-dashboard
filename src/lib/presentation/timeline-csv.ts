import type { RepositoryTimelineMetric, RepositoryTimeline } from '@/models/repository-timeline';
import type { ContributionTimeline } from '@/models/contribution-timeline';
import type { RepositoryTimelineMatrix } from '@/models/repository-timeline-matrix';
import type { TimelineInterval, TimelineSourceIdentity } from '@/models/reporting-timeline';
import type { Measurement } from '@/models/reporting-measurement';
import type { TableQuery } from '@/models/table-query';
import { reportMetricIds } from '@/models/contribution-metrics';
import { serializeCsv } from './csv-export';
import { selectTableRows } from './table-rows';
import { sortRepositoryTimelineMatrix } from './repository-timeline-matrix';
import { timelineIntervalLabel, timelineValueColumns } from './timeline-presentation';
import { timelineMetricLabel, timelineMetricUnit } from './timeline-metric-label';

/** The file name every Timeline export is downloaded as. */
export const timelineExportFileName = 'timeline-sample.csv';

type Report = RepositoryTimeline | ContributionTimeline | RepositoryTimelineMatrix;
type CsvColumn<T> = { id: string; label: string; value: (row: T) => string | number | null };
/** Source provenance shared by parent and supporting Timeline exports. */
export function timelineSourceColumns<T>(source: TimelineSourceIdentity): CsvColumn<T>[] {
  return [
    { id: 'source', label: 'Source', value: () => source.source },
    { id: 'revision', label: 'Source revision', value: () => source.scenarioId },
    { id: 'asOf', label: 'Reporting as of (UTC)', value: () => source.asOf },
  ];
}
/** Calendar identity and exact covered dates, with the same labels in every Timeline export. */
export function timelineIntervalColumns<T>(read: (row: T) => TimelineInterval): CsvColumn<T>[] {
  return [
    ...(['calendar', 'covered'] as const).flatMap((kind) => {
      const name = kind === 'calendar' ? 'Calendar' : 'Covered';
      return [
        {
          id: kind + 'Start',
          label: name + ' start (UTC)',
          value: (row: T) => read(row)[kind].start,
        },
        { id: kind + 'End', label: name + ' end (UTC)', value: (row: T) => read(row)[kind].end },
        {
          id: kind + 'Inclusive',
          label: name + ' end inclusive',
          value: (row: T) => String(read(row)[kind].endInclusive),
        },
      ];
    }),
    {
      id: 'partialPeriod',
      label: 'Partial calendar period',
      value: (row: T) => String(read(row).partial),
    },
  ];
}
export class TimelineCsvColumnError extends Error {
  constructor() {
    super('Invalid Timeline CSV columns.');
  }
}
export function timelineCsv(
  report: Report,
  selected: readonly string[],
  query: TableQuery,
  rankMetric?: RepositoryTimelineMetric,
) {
  const matrix = report.kind === 'repository-matrix';
  const metrics = matrix
    ? report.scope.metrics
    : report.kind === 'repository'
      ? report.metrics
      : reportMetricIds;
  const allowed = ['period', ...(matrix ? ['repository'] : []), ...metrics];
  if (!selected.length || selected.some((id) => !allowed.includes(id)))
    throw new TimelineCsvColumnError();
  const chosen = metrics.filter((id) => selected.includes(id));
  type Row = {
    id: string;
    repositoryId: string | null;
    repository: string | null;
    interval: TimelineInterval;
    values: Partial<Record<string, Measurement>>;
  };
  const ordered = matrix
    ? sortRepositoryTimelineMatrix(
        report,
        query.sort === 'repository'
          ? { kind: 'repository', descending: query.descending }
          : {
              kind: 'interval',
              intervalId: query.sort,
              metric: rankMetric,
              descending: query.descending,
            },
      )
    : [];
  const groups = new Map<string, typeof ordered>();
  for (const row of ordered) {
    const group = groups.get(row.repository.id) ?? [];
    group.push(row);
    groups.set(row.repository.id, group);
  }
  const rows: Row[] = matrix
    ? [...groups.values()].flatMap((group) =>
        report.intervals.map((interval, index) => ({
          id: group[0].repository.id + interval.id,
          repositoryId: group[0].repository.id,
          repository: group[0].repository.name,
          interval,
          values: Object.fromEntries(group.map((row) => [row.metric, row.values[index]])),
        })),
      )
    : selectTableRows(
        report.rows.map((row) => ({
          ...row,
          id: row.interval.id,
          repositoryId: report.kind === 'repository' ? report.scope.repository.id : null,
          repository: report.kind === 'repository' ? report.scope.repository.name : null,
        })),
        timelineValueColumns<Row>(metrics),
        query,
        false,
      );
  const columns: CsvColumn<Row>[] = [
    // Over time reports aggregate repositories, so they carry no per-row repository columns.
    ...(report.kind === 'contributions'
      ? []
      : [
          { id: 'repositoryId', label: 'Repository ID', value: (row: Row) => row.repositoryId },
          { id: 'repository', label: 'Repository', value: (row: Row) => row.repository },
        ]),
    {
      id: 'period',
      label: 'Period',
      value: (row) => timelineIntervalLabel(row.interval, report.request.grouping),
    },
    ...timelineIntervalColumns<Row>((row) => row.interval),
    ...chosen.flatMap((id) => {
      const contribution = report.kind === 'contributions',
        label = timelineMetricLabel(id, contribution),
        unit = timelineMetricUnit(id, contribution);
      return [
        { id, label, value: (row: Row) => row.values[id]!.value },
        {
          id: id + '.status',
          label: label + ' coverage',
          value: (row: Row) => row.values[id]!.status,
        },
        {
          id: id + '.reason',
          label: label + ' coverage detail',
          value: (row: Row) => {
            const value = row.values[id]!;
            return value.status === 'complete' ? '' : value.reason;
          },
        },
        {
          id: id + '.unit',
          label: label + ' unit',
          value: () => unit,
        },
      ];
    }),
    { id: 'metrics', label: 'Metric IDs', value: () => JSON.stringify(chosen) },
    ...timelineSourceColumns<Row>(report.source),
    { id: 'grouping', label: 'Grouping', value: () => report.request.grouping },
    { id: 'rangeStart', label: 'Full range start (UTC)', value: () => report.request.range.start },
    { id: 'rangeEnd', label: 'Full range end (UTC)', value: () => report.request.range.end },
    {
      id: 'inclusive',
      label: 'Full range end inclusive',
      value: () => String(report.request.range.endInclusive),
    },
    { id: 'scope', label: 'Report scope', value: () => JSON.stringify(report.scope) },
    { id: 'sort', label: 'Sort column', value: () => query.sort },
    {
      id: 'rank',
      label: 'Sort metric',
      value: () => (matrix ? (rankMetric ?? report.scope.metrics[0] ?? null) : null),
    },
    { id: 'direction', label: 'Sort direction', value: () => (query.descending ? 'desc' : 'asc') },
  ];
  return serializeCsv(rows, columns);
}
