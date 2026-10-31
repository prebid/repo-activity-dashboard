import type { RepositoryTimelineMetric, RepositoryTimeline } from '@/models/repository-timeline';
import type { ContributionTimeline } from '@/models/contribution-timeline';
import type { RepositoryTimelineMatrix } from '@/models/repository-timeline-matrix';
import type { TimelineInterval } from '@/models/reporting-timeline';
import type { Measurement } from '@/models/reporting-measurement';
import type { TableQuery } from '@/models/table-query';
import { reportMetricIds } from '@/models/contribution-metrics';
import { serializeCsv } from './csv-export';
import { selectTableRows } from './table-rows';
import { measurementSortGroup } from './measurement-order';
import { sortRepositoryTimelineMatrix } from './repository-timeline-matrix';
import { timelineIntervalLabel } from './timeline-presentation';
import { timelineMetricLabel, timelineMetricUnit } from './timeline-metric-label';

type Report = RepositoryTimeline | ContributionTimeline | RepositoryTimelineMatrix;
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
    throw Error('Invalid Timeline CSV columns.');
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
        [
          { id: 'period', value: (row) => row.interval.calendar.start },
          ...metrics.map((id) => ({
            id,
            value: (row: Row) => row.values[id]!.value,
            sortGroup: (row: Row) => measurementSortGroup(row.values[id]!),
          })),
        ],
        query,
        false,
      );
  const columns: { id: string; label: string; value: (row: Row) => string | number | null }[] = [
    { id: 'repositoryId', label: 'Repository ID', value: (row) => row.repositoryId },
    { id: 'repository', label: 'Repository', value: (row) => row.repository },
    {
      id: 'period',
      label: 'Period',
      value: (row) => timelineIntervalLabel(row.interval, report.request.grouping),
    },
    ...(['calendar', 'covered'] as const).flatMap((kind) => [
      {
        id: kind + 'Start',
        label: kind + ' start (UTC)',
        value: (row: Row) => row.interval[kind].start,
      },
      { id: kind + 'End', label: kind + ' end (UTC)', value: (row: Row) => row.interval[kind].end },
      {
        id: kind + 'Inclusive',
        label: kind + ' end inclusive',
        value: (row: Row) => String(row.interval[kind].endInclusive),
      },
    ]),
    {
      id: 'partialPeriod',
      label: 'Partial calendar period',
      value: (row) => String(row.interval.partial),
    },
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
    { id: 'source', label: 'Source', value: () => report.source.source },
    { id: 'revision', label: 'Source revision', value: () => report.source.scenarioId },
    { id: 'asOf', label: 'Reporting as of (UTC)', value: () => report.source.asOf },
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
