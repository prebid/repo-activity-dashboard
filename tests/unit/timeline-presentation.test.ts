import { expect, it } from 'vitest';
import { buildTimelineIntervals } from '@/lib/presentation/reporting-timeline';
import {
  timelineIntervalLabel,
  timelineIntervalDescription,
  timelineMeasurement,
  timelinePeriodDates,
  timelinePeriodHeading,
} from '@/lib/presentation/timeline-presentation';
import { timelineGroupings } from '@/models/reporting-timeline';
const range = {
  start: '2026-02-04T00:00:00.000Z',
  end: '2026-02-18T12:00:00.000Z',
  endInclusive: true,
};
it.each(timelineGroupings)(
  'labels %s by calendar identity and exact covered bounds',
  (grouping) => {
    const interval = buildTimelineIntervals({ range, grouping }, range.end)[0];
    const expected = {
      day: 'Feb 4, 2026',
      week: 'Feb 2, 2026 – Feb 8, 2026',
      month: 'Feb 2026',
      'two-months': 'Jan – Feb 2026',
      quarter: 'Q1 2026',
      'half-year': 'Jan – Jun 2026',
      year: '2026',
    };
    expect(timelineIntervalLabel(interval, grouping)).toBe(expected[grouping]);
    expect(timelineIntervalDescription(interval)).toContain('Feb 4, 2026, 12:00 AM UTC');
  },
);
it('preserves inclusivity and missing-value reasons without guessing absent metrics', () => {
  const interval = buildTimelineIntervals({ range, grouping: 'month' }, range.end)[0];
  expect(timelineIntervalDescription(interval)).toContain(
    'Feb 18, 2026, 12:00 PM UTC (inclusive end)',
  );
  expect(
    timelineIntervalDescription({ ...interval, covered: { ...range, endInclusive: false } }),
  ).toContain('exclusive end');
  expect(
    timelineMeasurement({ a: { status: 'missing', value: null, reason: 'Gap' } }, 'a'),
  ).toEqual({ status: 'missing', value: null, reason: 'Gap' });
  expect(() => timelineMeasurement({}, 'absent')).toThrow('Missing active timeline metric');
});
it('names a week that crosses years with both years', () => {
  const [week] = buildTimelineIntervals(
    {
      range: {
        start: '2024-12-30T00:00:00.000Z',
        end: '2025-01-06T00:00:00.000Z',
        endInclusive: false,
      },
      grouping: 'week',
    },
    range.end,
  );
  expect(timelineIntervalLabel(week, 'week')).toBe('Dec 30, 2024 – Jan 5, 2025');
});
it('heads a week with a compact range and adds covered dates only where they differ', () => {
  const [partial, full] = buildTimelineIntervals({ range, grouping: 'week' }, range.end);
  expect(timelinePeriodHeading(partial, 'week')).toBe('Feb 2–8, 2026');
  expect(timelinePeriodDates(partial, 'week')).toBe('Feb 4–8, 2026');
  expect(timelinePeriodHeading(full, 'week')).toBe('Feb 9–15, 2026');
  expect(timelinePeriodDates(full, 'week')).toBeNull();
  // Other groupings keep their labels, and a month still states its covered dates.
  const [month] = buildTimelineIntervals({ range, grouping: 'month' }, range.end);
  expect(timelinePeriodHeading(month, 'month')).toBe('Feb 2026');
  expect(timelinePeriodDates(month, 'month')).toBe('Feb 4–18, 2026');
  const [day] = buildTimelineIntervals({ range, grouping: 'day' }, range.end);
  expect(timelinePeriodDates(day, 'day')).toBeNull();
});
