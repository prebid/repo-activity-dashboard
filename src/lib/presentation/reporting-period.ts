import {
  dateRangeSchema,
  periodSelectionSchema,
  utcInstantSchema,
  type DateRange,
  type PeriodSelection,
  type ResolvedPeriod,
} from '@/models/reporting-period';

const day = 86_400_000;
function range(start: Date, end: Date, endInclusive = false): DateRange {
  return dateRangeSchema.parse({
    start: start.toISOString(),
    end: end.toISOString(),
    endInclusive,
  });
}
function monthStart(date: Date, offset = 0) {
  const result = new Date(date);
  result.setUTCDate(1);
  result.setUTCHours(0, 0, 0, 0);
  result.setUTCMonth(result.getUTCMonth() + offset);
  return result;
}
function yearStart(date: Date, offset = 0) {
  const result = monthStart(date);
  result.setUTCMonth(0);
  result.setUTCFullYear(result.getUTCFullYear() + offset);
  return result;
}
function previousYear(date: Date) {
  const result = new Date(date);
  result.setUTCFullYear(result.getUTCFullYear() - 1);
  // Feb 29 maps to Feb 28, retaining the time of day.
  if (result.getUTCMonth() !== date.getUTCMonth()) result.setUTCDate(0);
  return result;
}
function elapsed(start: Date, now: Date, previousStart: Date, previousEnd: Date): DateRange {
  const end = previousStart.getTime() + now.getTime() - start.getTime();
  return range(
    previousStart,
    new Date(Math.min(end, previousEnd.getTime())),
    end < previousEnd.getTime(),
  );
}

/** UTC display windows; this does not calculate reporting metrics. */
export function resolveReportingPeriod(
  input: PeriodSelection,
  reportingAsOf: string,
): ResolvedPeriod {
  const selection = periodSelectionSchema.parse(input);
  const now = new Date(utcInstantSchema.parse(reportingAsOf));
  if (now.getUTCFullYear() < 3)
    throw new RangeError('Reporting year must allow two preceding years');
  let selected: DateRange;
  let comparison: DateRange;
  if (selection.kind === 'custom') {
    const start = new Date(selection.from + 'T00:00:00.000Z');
    const end = new Date(selection.through + 'T00:00:00.000Z');
    end.setUTCDate(end.getUTCDate() + 1);
    if (start > now) throw new RangeError('Reporting range starts after the reporting clock');
    const capped = end > now;
    const effectiveEnd = capped ? now : end;
    selected = range(start, effectiveEnd, capped);
    // Inclusive current endpoints use the preceding instant, avoiding overlap.
    const duration = effectiveEnd.getTime() - start.getTime() + Number(capped);
    comparison = range(new Date(start.getTime() - duration), start);
  } else {
    const month = monthStart(now);
    const year = yearStart(now);
    const week = new Date(now);
    week.setUTCHours(0, 0, 0, 0);
    week.setUTCDate(week.getUTCDate() - ((week.getUTCDay() + 6) % 7));
    const lastWeek = new Date(week.getTime() - 7 * day);
    switch (selection.preset) {
      case 'this-week':
        selected = range(week, now, true);
        comparison = elapsed(week, now, lastWeek, week);
        break;
      case 'last-week':
        selected = range(lastWeek, week);
        comparison = range(new Date(lastWeek.getTime() - 7 * day), lastWeek);
        break;
      case 'this-month':
        selected = range(month, now, true);
        comparison = elapsed(month, now, monthStart(now, -1), month);
        break;
      case 'last-month':
        selected = range(monthStart(now, -1), month);
        comparison = range(monthStart(now, -2), monthStart(now, -1));
        break;
      case 'this-year':
        selected = range(year, now, true);
        comparison = range(yearStart(now, -1), previousYear(now), true);
        break;
      case 'last-year-to-date':
        selected = range(yearStart(now, -1), previousYear(now), true);
        comparison = range(yearStart(now, -2), previousYear(previousYear(now)), true);
        break;
      case 'last-full-year':
        selected = range(yearStart(now, -1), year);
        comparison = range(yearStart(now, -2), yearStart(now, -1));
    }
  }
  return { selection, range: selected, comparison, timezone: 'UTC' };
}

/** Inputs are normalized UTC instants; endpoints follow the reporting range contract. */
export function inDateRange(at: string, range: DateRange): boolean {
  return at >= range.start && (range.endInclusive ? at <= range.end : at < range.end);
}
