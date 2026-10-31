import { expect, it } from 'vitest';
import {
  buildTimelineIntervals,
  timelineIntervalIndex,
  rangeContains,
  validateTimelineAvailability,
  withTimelineAvailability,
} from '@/lib/presentation/reporting-timeline';
import { timelineGroupings } from '@/models/reporting-timeline';
import type { DateRange } from '@/models/reporting-period';
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
  ).toThrow('500 intervals');
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
      Array.from({ length: 257 }, () => range('2024-01-01', '2024-02-01')),
      clock,
    ),
  ).toThrow('Too many');
});
