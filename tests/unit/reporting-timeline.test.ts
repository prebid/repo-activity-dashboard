import { expect, it } from 'vitest';
import {
  buildTimelineIntervals,
  timelineIntervalIndex,
  rangeContains,
  validateTimelineAvailability,
  withTimelineAvailability,
  TimelineIntervalLimitError,
} from '@/lib/presentation/reporting-timeline';
import { resolveReportingPeriod } from '@/lib/presentation/reporting-period';
import {
  timelineCoverageWindowLimit,
  timelineGroupings,
  type TimelineGrouping,
} from '@/models/reporting-timeline';
import { periodPresets, type DateRange, type PeriodPreset } from '@/models/reporting-period';
const at = (date: string) => date + 'T00:00:00.000Z';
const range = (start: string, end: string, endInclusive = false): DateRange => ({
  start: at(start),
  end: at(end),
  endInclusive,
});
const clock = '2026-10-24T12:00:00.000Z';
it.each([
  ['day', 366],
  ['week', 53],
  ['month', 12],
  ['two-months', 6],
  ['quarter', 4],
  ['half-year', 2],
  ['year', 1],
] as const)('tiles leap year with %s intervals', (grouping, count) => {
  const rows = buildTimelineIntervals(
    { range: range('2024-01-01', '2025-01-01'), grouping },
    clock,
  );
  expect(rows).toHaveLength(count);
  expect(rows[0].covered.start).toBe(at('2024-01-01'));
  expect(rows.at(-1)!.covered).toMatchObject({ end: at('2025-01-01'), endInclusive: false });
  expect(new Set(rows.map((r) => r.id)).size).toBe(count);
  rows.slice(1).forEach((r, i) => expect(rows[i].covered.end).toBe(r.covered.start));
});
it('uses Monday weeks and clips both ends independently of coverage', () => {
  const rows = buildTimelineIntervals(
    { range: range('2024-12-29', '2025-01-08'), grouping: 'week' },
    clock,
  );
  expect(rows.map((r) => [r.calendar.start, r.covered.start, r.covered.end, r.partial])).toEqual([
    [at('2024-12-23'), at('2024-12-29'), at('2024-12-30'), true],
    [at('2024-12-30'), at('2024-12-30'), at('2025-01-06'), false],
    [at('2025-01-06'), at('2025-01-06'), at('2025-01-08'), true],
  ]);
});
it.each(timelineGroupings)('assigns exact boundary events once for %s', (grouping) => {
  const rows = buildTimelineIntervals(
    { range: range('2024-01-01', '2025-01-01', true), grouping },
    clock,
  );
  expect(timelineIntervalIndex(rows, at('2025-01-01'))).toBe(rows.length - 1);
  expect(timelineIntervalIndex(rows, at('2023-12-31'))).toBe(-1);
  expect(timelineIntervalIndex(rows, at('2025-01-02'))).toBe(-1);
  for (let i = 1; i < rows.length; i++)
    expect(timelineIntervalIndex(rows, rows[i].covered.start)).toBe(i);
});
it('retains an included zero-elapsed current period and exact sub-day bounds', () => {
  expect(
    buildTimelineIntervals(
      { range: range('2024-01-01', '2024-02-01', true), grouping: 'month' },
      clock,
    ).map((r) => r.covered),
  ).toEqual([range('2024-01-01', '2024-02-01'), range('2024-02-01', '2024-02-01', true)]);
  const exact = { start: '2026-10-24T10:00:00.000Z', end: clock, endInclusive: true };
  expect(buildTimelineIntervals({ range: exact, grouping: 'day' }, clock)[0]).toMatchObject({
    covered: exact,
    partial: true,
  });
});
it('bounds work before generating huge ranges, with no truncation or regrouping', () => {
  const start = at('2024-01-01');
  const end = at('2025-05-15');
  expect(
    buildTimelineIntervals({ range: { start, end, endInclusive: false }, grouping: 'day' }, clock),
  ).toHaveLength(500);
  expect(() =>
    buildTimelineIntervals({ range: { start, end, endInclusive: true }, grouping: 'day' }, clock),
  ).toThrow(TimelineIntervalLimitError);
  expect(() =>
    buildTimelineIntervals(
      { range: range('0003-01-01', '9998-01-01'), grouping: 'day' },
      at('9999-01-01'),
    ),
  ).toThrow('500 intervals');
});
it('rejects invalid/reversed/future dates and unsupported grouping', () => {
  for (const input of [
    { range: range('2025-02-29', '2025-03-01'), grouping: 'day' },
    { range: range('2025-02-01', '2025-01-01'), grouping: 'month' },
    { range: range('2026-10-01', '2027-01-01'), grouping: 'day' },
    { range: range('2025-01-01', '2025-02-01'), grouping: 'rolling' },
  ])
    expect(() => buildTimelineIntervals(input as never, clock)).toThrow();
  expect(
    rangeContains(range('2024-01-01', '2024-02-01'), range('2024-01-15', '2024-02-01', true)),
  ).toBe(false);
  expect(
    rangeContains(range('2024-01-01', '2024-02-01', true), range('2024-01-15', '2024-02-01', true)),
  ).toBe(true);
});
it('keeps known-zero, unavailable and partial values separate from calendar clipping', () => {
  const known = validateTimelineAvailability(
    [range('2024-01-01', '2024-02-01'), range('2024-03-01', '2024-04-01')],
    clock,
  );
  const zero = { status: 'complete' as const, value: 0 };
  expect(withTimelineAvailability(zero, range('2024-01-15', '2024-01-20'), known)).toEqual(zero);
  expect(withTimelineAvailability(zero, range('2024-02-01', '2024-03-01'), known)).toMatchObject({
    status: 'missing',
    value: null,
  });
  expect(withTimelineAvailability(zero, range('2024-01-01', '2024-04-01'), known)).toMatchObject({
    status: 'partial',
    value: 0,
  });
  const partial = withTimelineAvailability(
    { status: 'partial', value: 3, reason: 'Missing diff' },
    range('2024-01-01', '2024-04-01'),
    known,
  );
  expect(partial).toMatchObject({ status: 'partial', value: 3 });
  expect('reason' in partial && partial.reason).toContain('Missing diff');
  expect(
    withTimelineAvailability(
      { status: 'not-applicable', value: null, reason: 'No merges' },
      range('2024-01-01', '2024-04-01'),
      known,
    ),
  ).toMatchObject({ status: 'missing', value: null });
  expect(() =>
    validateTimelineAvailability(
      [range('2024-01-01', '2024-02-01', true), range('2024-02-01', '2024-03-01')],
      clock,
    ),
  ).toThrow('overlap');
  expect(() => validateTimelineAvailability([range('2027-01-01', '2027-02-01')], clock)).toThrow(
    'clock',
  );
  expect(() =>
    validateTimelineAvailability(
      Array.from({ length: timelineCoverageWindowLimit + 1 }, () =>
        range('2024-01-01', '2024-02-01'),
      ),
      clock,
    ),
  ).toThrow('Too many');
});
// Expected bounds are written by hand from the calendar, never read back from the builder.
const clipped: Record<TimelineGrouping, [number, string[], string[], string[], boolean[]]> = {
  day: [
    57,
    ['2024-12-15', '2025-02-09'],
    ['2024-12-15', '2025-02-09'],
    ['2024-12-16', '2025-02-10'],
    [false, false],
  ],
  week: [
    9,
    ['2024-12-09', '2025-02-03'],
    ['2024-12-15', '2025-02-03'],
    ['2024-12-16', '2025-02-10'],
    [true, false],
  ],
  month: [
    3,
    ['2024-12-01', '2025-02-01'],
    ['2024-12-15', '2025-02-01'],
    ['2025-01-01', '2025-02-10'],
    [true, true],
  ],
  'two-months': [
    2,
    ['2024-11-01', '2025-01-01'],
    ['2024-12-15', '2025-01-01'],
    ['2025-01-01', '2025-02-10'],
    [true, true],
  ],
  quarter: [
    2,
    ['2024-10-01', '2025-01-01'],
    ['2024-12-15', '2025-01-01'],
    ['2025-01-01', '2025-02-10'],
    [true, true],
  ],
  'half-year': [
    2,
    ['2024-07-01', '2025-01-01'],
    ['2024-12-15', '2025-01-01'],
    ['2025-01-01', '2025-02-10'],
    [true, true],
  ],
  year: [
    2,
    ['2024-01-01', '2025-01-01'],
    ['2024-12-15', '2025-01-01'],
    ['2025-01-01', '2025-02-10'],
    [true, true],
  ],
};
const calendarEnds: Record<TimelineGrouping, [string, string]> = {
  day: ['2024-12-16', '2025-02-10'],
  week: ['2024-12-16', '2025-02-10'],
  month: ['2025-01-01', '2025-03-01'],
  'two-months': ['2025-01-01', '2025-03-01'],
  quarter: ['2025-01-01', '2025-04-01'],
  'half-year': ['2025-01-01', '2025-07-01'],
  year: ['2025-01-01', '2026-01-01'],
};
it.each(timelineGroupings)(
  'pins clipped Dec/Jan calendar and covered bounds for %s',
  (grouping) => {
    const rows = buildTimelineIntervals(
      { range: range('2024-12-15', '2025-02-10'), grouping },
      clock,
    );
    const [count, calendarStarts, coveredStarts, coveredEnds, partial] = clipped[grouping];
    const ends = [rows[0], rows.at(-1)!];
    expect(rows).toHaveLength(count);
    expect(ends.map((row) => row.id)).toEqual(
      calendarStarts.map((day) => grouping + ':' + at(day)),
    );
    expect(ends.map((row) => row.calendar.start)).toEqual(calendarStarts.map(at));
    expect(ends.map((row) => row.calendar.end)).toEqual(calendarEnds[grouping].map(at));
    expect(ends.map((row) => row.covered.start)).toEqual(coveredStarts.map(at));
    expect(ends.map((row) => row.covered.end)).toEqual(coveredEnds.map(at));
    expect(ends.map((row) => row.covered.endInclusive)).toEqual([false, false]);
    expect(ends.map((row) => row.partial)).toEqual(partial);
  },
);
it.each([
  ['day', '2024-12-15T23:59:59.999Z', 0],
  ['day', '2024-12-16T00:00:00.000Z', 1],
  ['week', '2024-12-15T23:59:59.999Z', 0],
  ['week', '2024-12-16T00:00:00.000Z', 1],
  ['month', '2024-12-31T23:59:59.999Z', 0],
  ['month', '2025-01-01T00:00:00.000Z', 1],
  ['month', '2025-02-01T00:00:00.000Z', 2],
  ['two-months', '2024-12-31T23:59:59.999Z', 0],
  ['two-months', '2025-01-01T00:00:00.000Z', 1],
  ['quarter', '2025-01-01T00:00:00.000Z', 1],
  ['half-year', '2025-01-01T00:00:00.000Z', 1],
  ['year', '2024-12-31T23:59:59.999Z', 0],
  ['year', '2025-01-01T00:00:00.000Z', 1],
  ['year', '2025-02-10T00:00:00.000Z', -1],
] as const)('places %s event %s in interval %i', (grouping, event, index) => {
  const rows = buildTimelineIntervals(
    { range: range('2024-12-15', '2025-02-10'), grouping },
    clock,
  );
  expect(timelineIntervalIndex(rows, event)).toBe(index);
});
it('keeps leap day as its own day and inside February', () => {
  expect(
    buildTimelineIntervals(
      { range: range('2024-02-28', '2024-03-02'), grouping: 'day' },
      clock,
    ).map((row) => row.id),
  ).toEqual(['day:' + at('2024-02-28'), 'day:' + at('2024-02-29'), 'day:' + at('2024-03-01')]);
  expect(
    buildTimelineIntervals(
      { range: range('2024-02-15', '2024-03-15'), grouping: 'month' },
      clock,
    )[0],
  ).toMatchObject({
    calendar: range('2024-02-01', '2024-03-01'),
    covered: range('2024-02-15', '2024-03-01'),
    partial: true,
  });
});
it.each([
  ['week', '2017-01-02', '2026-08-03'],
  ['month', '1984-01-01', '2025-09-01'],
] as const)('stops %s timelines at exactly 500 intervals', (grouping, start, end) => {
  expect(buildTimelineIntervals({ range: range(start, end), grouping }, clock)).toHaveLength(500);
  expect(() => buildTimelineIntervals({ range: range(start, end, true), grouping }, clock)).toThrow(
    TimelineIntervalLimitError,
  );
});
it.each([
  ['this-week', 'week'],
  ['last-week', 'week'],
  ['this-month', 'month'],
  ['last-month', 'month'],
  ['this-year', 'year'],
  ['last-full-year', 'year'],
] as const satisfies readonly (readonly [PeriodPreset, TimelineGrouping])[])(
  'aligns the %s preset with one %s interval',
  (preset, grouping) => {
    expect(periodPresets).toContain(preset);
    const period = resolveReportingPeriod({ kind: 'preset', preset }, clock).range;
    const rows = buildTimelineIntervals({ range: period, grouping }, clock);
    expect(rows).toHaveLength(1);
    expect(rows[0].calendar.start).toBe(period.start);
  },
);
