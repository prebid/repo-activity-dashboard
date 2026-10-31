import { expect, it } from 'vitest';
import { buildTimelineIntervals } from '@/lib/presentation/reporting-timeline';
import {
  timelineIntervalLabel,
  timelineIntervalDescription,
  timelineMeasurement,
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
