import { agingThresholds, type Count } from '@/models/repository-overview';
import type { DateRange } from '@/models/reporting-period';
import type { AgeBand, RepositoryPageSource, ReviewBucket } from '@/models/repository-page';

export function ageBandFor(days: number): AgeBand {
  if (!Number.isFinite(days) || days < 0) throw new Error('Invalid record age');
  return [...agingThresholds].reverse().find((threshold) => days > threshold) ?? 0;
}
export const ageBands = [0, ...agingThresholds].map((key, index) => ({
  key: key as AgeBand,
  label:
    index === 0
      ? 'Up to 30 days'
      : index === agingThresholds.length
        ? 'Over 360 days'
        : 'Over ' + key + ' through ' + agingThresholds[index] + ' days',
}));
export function reviewBucket(value: number | null): ReviewBucket {
  if (value === null) return 'unknown';
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid review count');
  return value > 2 ? 'more' : value === 0 ? '0' : value === 1 ? '1' : '2';
}
export function subsetCount(base: Count, count: number, uncertain = 0): Count {
  if (base.value === null) return { ...base };
  if (base.status === 'partial') return { ...base, value: count };
  return uncertain > 0
    ? {
        status: 'partial',
        value: count,
        reason: 'Some records have unknown values for this measure or filter.',
      }
    : { status: 'complete', value: count };
}
export function inDateRange(at: string, range: DateRange): boolean {
  return at >= range.start && (range.endInclusive ? at <= range.end : at < range.end);
}
export function activityDateBasis(
  source: RepositoryPageSource,
): 'createdAt' | 'mergedAt' | 'closedAt' {
  const metric = source.drilldown.selection.metric;
  return metric === 'prsMerged' ? 'mergedAt' : metric === 'issuesClosed' ? 'closedAt' : 'createdAt';
}
export function recordEventDate(
  row: RepositoryPageSource['rows'][number],
  source: RepositoryPageSource,
): string {
  const basis = activityDateBasis(source);
  const at =
    basis === 'mergedAt' && 'mergedAt' in row
      ? row.mergedAt
      : basis === 'closedAt' && 'closedAt' in row
        ? row.closedAt
        : row.createdAt;
  if (at === null) throw new Error('Missing event date for selected cohort');
  return at;
}
