import type { TimelineGrouping, TimelineInterval } from '@/models/reporting-timeline';
import type { TimelineDisplayRow } from '@/models/timeline-presentation';
import { formatUtcDate, formatAsOf } from './format';
import { periodRangeLabel } from './overview-periods';

export function timelineIntervalLabel(
  interval: TimelineInterval,
  grouping: TimelineGrouping,
): string {
  const start = new Date(interval.calendar.start),
    year = start.getUTCFullYear();
  if (grouping === 'day') return formatUtcDate(interval.calendar.start);
  if (grouping === 'week') return periodRangeLabel(interval.calendar);
  if (grouping === 'year') return String(year);
  if (grouping === 'quarter') return `Q${Math.floor(start.getUTCMonth() / 3) + 1} ${year}`;
  const month = (date: Date) => formatUtcDate(date.toISOString()).split(' ')[0];
  return grouping === 'month'
    ? `${month(start)} ${year}`
    : `${month(start)} – ${month(new Date(Date.parse(interval.calendar.end) - 1))} ${year}`;
}
export function timelineIntervalDescription(interval: TimelineInterval): string {
  return `${formatAsOf(interval.covered.start)} through ${formatAsOf(interval.covered.end)} (${interval.covered.endInclusive ? 'inclusive' : 'exclusive'} end).`;
}
export function timelineMeasurement(values: TimelineDisplayRow['values'], metric: string) {
  const value = values[metric];
  if (!value) throw Error('Missing active timeline metric: ' + metric);
  return value;
}
