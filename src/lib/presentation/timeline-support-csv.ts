import type { TimelineSupportContext } from '@/models/timeline-support';
import type { TableQuery } from '@/models/table-query';
/** Automatic provenance accompanies each exported support row; no synthetic rows are added for zero. */
export function timelineSupportContextColumns<T>(
  context: TimelineSupportContext,
  query: TableQuery,
  author?: string,
) {
  return [
    { id: 'source', label: 'Source', value: () => context.source.source },
    { id: 'revision', label: 'Source revision', value: () => context.source.scenarioId },
    { id: 'asOf', label: 'Reporting as of (UTC)', value: () => context.source.asOf },
    { id: 'metric', label: 'Metric ID', value: () => context.metric },
    { id: 'interval', label: 'Interval ID', value: () => context.interval.id },
    { id: 'from', label: 'Covered start (UTC)', value: () => context.interval.covered.start },
    { id: 'to', label: 'Covered end (UTC)', value: () => context.interval.covered.end },
    {
      id: 'inclusive',
      label: 'Covered end inclusive',
      value: () => String(context.interval.covered.endInclusive),
    },
    {
      id: 'partialPeriod',
      label: 'Partial calendar period',
      value: () => String(context.interval.partial),
    },
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
