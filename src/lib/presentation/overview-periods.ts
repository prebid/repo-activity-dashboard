import type { DateRange, PeriodSelection, ResolvedPeriod } from '@/models/reporting-period';
import type { RepositoryActivityRow, RepositoryOverview } from '@/models/repository-overview';
import { resolveReportingPeriod } from './reporting-period';
import { formatUtcDate } from './format';

export const periodLabels = {
  'this-week': 'This week',
  'last-week': 'Last week',
  'this-month': 'This month',
  'last-month': 'Last month',
  'this-year': 'This year to date',
  'last-year-to-date': 'Last year to date',
  'last-full-year': 'Last full year',
};

/** The last instant a range includes, so an exclusive end reads as the day before it. */
function lastIncluded(range: DateRange): Date {
  return new Date(new Date(range.end).getTime() - Number(!range.endInclusive));
}
export function periodRangeLabel(range: DateRange): string {
  return formatUtcDate(range.start) + ' – ' + formatUtcDate(lastIncluded(range).toISOString());
}
/**
 * A range that says a shared month and year once: "Sep 21–27, 2026", "Sep 28 – Oct 4, 2026", and
 * "Dec 29, 2025 – Jan 4, 2026" across years. A single day reads as that day. No-break spaces
 * keep each date whole, so a wrapped range breaks only around its dash.
 */
export function compactRangeLabel(range: DateRange): string {
  const first = new Date(range.start),
    last = lastIncluded(range);
  const year = last.getUTCFullYear();
  const month = (date: Date) => formatUtcDate(date.toISOString()).split(' ')[0];
  const day = (date: Date) => `${month(date)} ${date.getUTCDate()}`;
  const dated = (date: Date) => `${day(date)}, ${date.getUTCFullYear()}`;
  if (first.getUTCFullYear() !== year) return `${dated(first)} – ${dated(last)}`;
  if (first.getUTCMonth() !== last.getUTCMonth()) return `${day(first)} – ${dated(last)}`;
  return first.getUTCDate() === last.getUTCDate()
    ? dated(first)
    : `${day(first)}–${last.getUTCDate()}, ${year}`;
}
/** The one notation for a range shown as a fact: "Oct 1, 2026 – Oct 24, 2026 · UTC". */
export function zonedRangeLabel(range: DateRange): string {
  return periodRangeLabel(range) + ' · UTC';
}
export function activityPeriodLabel(period: ResolvedPeriod): string {
  return period.selection.kind === 'preset'
    ? periodLabels[period.selection.preset]
    : periodRangeLabel(period.range);
}
export function validateActivityPeriods(
  selections: readonly PeriodSelection[],
  asOf: string,
): string | undefined {
  if (!selections.length || selections.length > 2) return 'Select one or two periods.';
  try {
    const ranges = selections.map((selection) =>
      JSON.stringify(resolveReportingPeriod(selection, asOf).range),
    );
    if (new Set(ranges).size !== ranges.length) return 'Choose two different periods.';
  } catch {
    return 'Choose a valid date range within the reporting snapshot.';
  }
}

/** Each repository stays together: first period, second period, then their derived difference. */
export function activityTableRows(
  primary: RepositoryOverview,
  secondary?: RepositoryOverview,
): RepositoryActivityRow[] {
  const second = new Map(secondary?.rows.map((row) => [row.repository.id, row]));
  if (secondary && (secondary.asOf !== primary.asOf || second.size !== primary.rows.length))
    throw new Error('Activity periods must share a snapshot and repository scope');
  return [...primary.rows]
    .sort((a, b) => a.repository.name.localeCompare(b.repository.name, 'en'))
    .flatMap<RepositoryActivityRow>((row) => {
      const first: RepositoryActivityRow = {
        ...row,
        kind: 'period',
        id: row.repository.id + ':period-1',
        period: primary.period,
        periodIndex: 0,
        showPeriodLabel: !!secondary,
        sortActivity: row.activity,
      };
      if (!secondary) return [first];
      const other = second.get(row.repository.id);
      if (!other) throw new Error('Missing repository in second period');
      const next: RepositoryActivityRow = {
        ...other,
        kind: 'period',
        id: row.repository.id + ':period-2',
        period: secondary.period,
        periodIndex: 1,
        showPeriodLabel: true,
        sortActivity: row.activity,
      };
      return [
        first,
        next,
        {
          kind: 'difference',
          id: row.repository.id + ':difference',
          repository: row.repository,
          primary: row.activity,
          secondary: other.activity,
          sortActivity: row.activity,
        },
      ];
    });
}
