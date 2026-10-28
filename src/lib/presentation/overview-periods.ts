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
  'last-year-to-date': 'Last year to the same date',
  'last-full-year': 'Last full year',
};

export function periodRangeLabel(range: DateRange): string {
  return (
    formatUtcDate(range.start) +
    ' – ' +
    formatUtcDate(
      new Date(new Date(range.end).getTime() - Number(!range.endInclusive)).toISOString(),
    )
  );
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

/** Repository pairs stay adjacent. Each row retains its own values and the first period's sort key. */
export function activityTableRows(
  primary: RepositoryOverview,
  secondary?: RepositoryOverview,
): RepositoryActivityRow[] {
  const second = new Map(secondary?.rows.map((row) => [row.repository.id, row]));
  if (secondary && (secondary.asOf !== primary.asOf || second.size !== primary.rows.length))
    throw new Error('Activity periods must share a snapshot and repository scope');
  return [...primary.rows]
    .sort((a, b) => a.repository.name.localeCompare(b.repository.name, 'en'))
    .flatMap((row) => {
      const first: RepositoryActivityRow = {
        ...row,
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
        id: row.repository.id + ':period-2',
        period: secondary.period,
        periodIndex: 1,
        showPeriodLabel: true,
        sortActivity: row.activity,
      };
      return [first, next];
    });
}
