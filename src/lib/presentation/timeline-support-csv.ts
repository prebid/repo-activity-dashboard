import type { TimelineSupportContext } from '@/models/timeline-support';
import type { TableQuery } from '@/models/table-query';
import { timelineIntervalColumns, timelineSourceColumns } from './timeline-csv';
import { timelineMetricUnit } from './timeline-metric-label';
/** Automatic provenance accompanies each exported support row; no synthetic rows are added for zero. */
export function timelineSupportContextColumns<T>(
  context: TimelineSupportContext,
  query: TableQuery,
  author?: string,
  contribution = false,
) {
  return [
    ...timelineSourceColumns<T>(context.source),
    { id: 'metric', label: 'Metric ID', value: () => context.metric },
    {
      id: 'unit',
      label: 'Metric unit',
      value: () => timelineMetricUnit(context.metric, contribution),
    },
    { id: 'grouping', label: 'Grouping', value: () => context.interval.id.split(':')[0] },
    { id: 'interval', label: 'Interval ID', value: () => context.interval.id },
    ...timelineIntervalColumns<T>(() => context.interval),
    { id: 'total', label: 'Full Timeline interval value', value: () => context.measurement.value },
    { id: 'coverage', label: 'Timeline coverage', value: () => context.measurement.status },
    {
      id: 'reason',
      label: 'Timeline coverage detail',
      value: () => (context.measurement.status === 'complete' ? '' : context.measurement.reason),
    },
    { id: 'scope', label: 'Timeline scope URL', value: () => context.scope },
    { id: 'selectedAuthor', label: 'Selected author', value: () => author ?? null },
    { id: 'search', label: 'Export row search', value: () => query.search },
    { id: 'sort', label: 'Export sort', value: () => query.sort },
    {
      id: 'direction',
      label: 'Export direction',
      value: () => (query.descending ? 'desc' : 'asc'),
    },
  ] satisfies { id: string; label: string; value: (row: T) => string | number | null }[];
}
