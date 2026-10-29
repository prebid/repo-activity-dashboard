import type {
  AgeBand,
  RepositoryChart,
  RepositoryPageFilters,
  ReviewBucket,
} from '@/models/repository-page';
import type { DateRange } from '@/models/reporting-period';

export type RepositoryChartSelection =
  | { kind: 'age'; key: AgeBand }
  | { kind: 'reviewers' | 'approvals'; key: ReviewBucket }
  | { kind: 'activity'; range: DateRange };
export function isChartSelection(
  filters: RepositoryPageFilters,
  selection: RepositoryChartSelection,
): boolean {
  if (selection.kind === 'age') return filters.ageBand === selection.key;
  if (selection.kind === 'activity')
    return (
      !!filters.eventRange &&
      filters.eventRange.start === selection.range.start &&
      filters.eventRange.end === selection.range.end &&
      filters.eventRange.endInclusive === selection.range.endInclusive
    );
  return filters.kind === 'prs' && filters[selection.kind] === selection.key;
}
export function toggleChartSelection(
  filters: RepositoryPageFilters,
  selection: RepositoryChartSelection,
): RepositoryPageFilters {
  const selected = isChartSelection(filters, selection);
  if (selection.kind === 'age')
    return { ...filters, ageBand: selected ? undefined : selection.key };
  if (selection.kind === 'activity')
    return { ...filters, eventRange: selected ? undefined : selection.range };
  if (filters.kind !== 'prs') throw new Error('Review charts require PR filters');
  return { ...filters, [selection.kind]: selected ? undefined : selection.key };
}
export function chartPointSelection(
  chart: RepositoryChart,
  index: number,
): RepositoryChartSelection {
  if (chart.kind === 'activity') return { kind: 'activity', range: chart.points[index].range };
  // Numeric keys belong only to the age distribution; review keys are strings.
  const key = chart.points[index].key;
  if (chart.kind === 'age' && typeof key === 'number') return { kind: 'age', key };
  if (chart.kind !== 'age' && typeof key === 'string') return { kind: chart.kind, key };
  throw new Error('Chart point does not match its distribution');
}
