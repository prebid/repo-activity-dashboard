import {
  timelineRequestSchema,
  timelineIntervalLimit,
  timelineCoverageWindowLimit,
  type TimelineRequest,
  type TimelineInterval,
  type TimelineGrouping,
} from '@/models/reporting-timeline';
import { dateRangeSchema, utcInstantSchema, type DateRange } from '@/models/reporting-period';
import type { Measurement } from '@/models/reporting-measurement';
import { utcMonthStart, utcWeekStart } from './reporting-period';

const day = 86_400_000;
export class TimelineIntervalLimitError extends RangeError {
  constructor() {
    super(
      `Timeline exceeds ${timelineIntervalLimit} intervals; narrow the range or choose a coarser grouping`,
    );
  }
}
const monthSteps = { month: 1, 'two-months': 2, quarter: 3, 'half-year': 6, year: 12 } as const;
function startOf(at: string, grouping: TimelineGrouping): Date {
  const date = new Date(at);
  if (grouping === 'week') return utcWeekStart(date);
  if (grouping === 'day') {
    date.setUTCHours(0, 0, 0, 0);
    return date;
  }
  const month = utcMonthStart(date);
  const step = monthSteps[grouping];
  month.setUTCMonth(Math.floor(month.getUTCMonth() / step) * step);
  return month;
}
function advance(date: Date, grouping: TimelineGrouping) {
  const next = new Date(date);
  if (grouping === 'day' || grouping === 'week')
    next.setUTCDate(next.getUTCDate() + (grouping === 'day' ? 1 : 7));
  else next.setUTCMonth(next.getUTCMonth() + monthSteps[grouping]);
  return next;
}
/** Bound calendar work before allocating any intervals, including huge but valid dates. */
export function buildTimelineIntervals(input: TimelineRequest, asOf: string): TimelineInterval[] {
  const { range, grouping } = timelineRequestSchema.parse(input);
  utcInstantSchema.parse(asOf);
  if (range.end > asOf) throw Error('Timeline ends after the reporting clock');
  const first = startOf(range.start, grouping);
  const last = startOf(
    new Date(Date.parse(range.end) - Number(!range.endInclusive)).toISOString(),
    grouping,
  );
  const count =
    1 +
    (grouping === 'day' || grouping === 'week'
      ? (last.getTime() - first.getTime()) / (day * (grouping === 'day' ? 1 : 7))
      : ((last.getUTCFullYear() - first.getUTCFullYear()) * 12 +
          last.getUTCMonth() -
          first.getUTCMonth()) /
        monthSteps[grouping]);
  if (count > timelineIntervalLimit) throw new TimelineIntervalLimitError();
  const rows: TimelineInterval[] = [];
  let cursor = first;
  for (let index = 0; index < count; index++) {
    const next = advance(cursor, grouping);
    const calendar = dateRangeSchema.parse({
      start: cursor.toISOString(),
      end: next.toISOString(),
      endInclusive: false,
    });
    const covered = {
      start: calendar.start < range.start ? range.start : calendar.start,
      end: calendar.end < range.end ? calendar.end : range.end,
      endInclusive: index === count - 1 && range.endInclusive,
    };
    rows.push({
      id: `${grouping}:${calendar.start}`,
      calendar,
      covered,
      partial: covered.start !== calendar.start || covered.end !== calendar.end,
    });
    cursor = next;
  }
  return rows;
}
/** Ranges come from buildTimelineIntervals; events and ranges are normalized UTC instants. */
export function timelineIntervalIndex(intervals: readonly TimelineInterval[], at: string): number {
  let left = 0,
    right = intervals.length - 1;
  while (left <= right) {
    const middle = Math.floor((left + right) / 2),
      range = intervals[middle].covered;
    if (at < range.start) right = middle - 1;
    else if (at > range.end || (at === range.end && !range.endInclusive)) left = middle + 1;
    else return middle;
  }
  return -1;
}
export function rangeContains(outer: DateRange, inner: DateRange): boolean {
  return (
    inner.start >= outer.start &&
    inner.end <= outer.end &&
    (inner.end !== outer.end || !inner.endInclusive || outer.endInclusive)
  );
}
/** Known collection windows are explicit sample facts, not inferred from event presence. */
export function validateTimelineAvailability(
  input: readonly DateRange[],
  asOf: string,
): DateRange[] {
  utcInstantSchema.parse(asOf);
  if (input.length > timelineCoverageWindowLimit) throw Error('Too many timeline coverage windows');
  const ranges = input
    .map((range) => dateRangeSchema.parse(range))
    .sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 0; i < ranges.length; i++) {
    const prior = ranges[i - 1],
      range = ranges[i];
    if (
      range.end > asOf ||
      (prior && (prior.end > range.start || (prior.end === range.start && prior.endInclusive)))
    )
      throw Error('Timeline coverage windows overlap or exceed the reporting clock');
  }
  return ranges;
}
/** Apply time coverage without turning an unknown value into zero, or clipping into missing data. */
export function withTimelineAvailability(
  value: Measurement,
  range: DateRange,
  available: readonly DateRange[],
): Measurement {
  const from = Date.parse(range.start),
    through = Date.parse(range.end) + Number(range.endInclusive);
  const known = available.reduce(
    (sum, part) =>
      sum +
      Math.max(
        0,
        Math.min(through, Date.parse(part.end) + Number(part.endInclusive)) -
          Math.max(from, Date.parse(part.start)),
      ),
    0,
  );
  if (known === through - from) return value;
  const reason = 'This time range has incomplete prepared sample coverage.';
  return known === 0 || value.value === null
    ? { status: 'missing', value: null, reason }
    : {
        status: 'partial',
        value: value.value,
        reason: value.status === 'complete' ? reason : value.reason + '; ' + reason,
      };
}
