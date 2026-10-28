import { describe, expect, it } from 'vitest';
import {
  calendarDateSchema,
  dateRangeSchema,
  periodSelectionSchema,
  utcInstantSchema,
  type PeriodPreset,
} from '@/models/reporting-period';
import { resolveReportingPeriod } from '@/lib/presentation/reporting-period';

const asOf = '2026-10-24T12:00:00.000Z';
const cases: [PeriodPreset, string, string, boolean, string, string, boolean][] = [
  [
    'this-week',
    '2026-10-19T00:00:00.000Z',
    asOf,
    true,
    '2026-10-12T00:00:00.000Z',
    '2026-10-17T12:00:00.000Z',
    true,
  ],
  [
    'last-week',
    '2026-10-12T00:00:00.000Z',
    '2026-10-19T00:00:00.000Z',
    false,
    '2026-10-05T00:00:00.000Z',
    '2026-10-12T00:00:00.000Z',
    false,
  ],
  [
    'this-month',
    '2026-10-01T00:00:00.000Z',
    asOf,
    true,
    '2026-09-01T00:00:00.000Z',
    '2026-09-24T12:00:00.000Z',
    true,
  ],
  [
    'last-month',
    '2026-09-01T00:00:00.000Z',
    '2026-10-01T00:00:00.000Z',
    false,
    '2026-08-01T00:00:00.000Z',
    '2026-09-01T00:00:00.000Z',
    false,
  ],
  [
    'this-year',
    '2026-01-01T00:00:00.000Z',
    asOf,
    true,
    '2025-01-01T00:00:00.000Z',
    '2025-10-24T12:00:00.000Z',
    true,
  ],
  [
    'last-year-to-date',
    '2025-01-01T00:00:00.000Z',
    '2025-10-24T12:00:00.000Z',
    true,
    '2024-01-01T00:00:00.000Z',
    '2024-10-24T12:00:00.000Z',
    true,
  ],
  [
    'last-full-year',
    '2025-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z',
    false,
    '2024-01-01T00:00:00.000Z',
    '2025-01-01T00:00:00.000Z',
    false,
  ],
];
describe('reporting period selection', () => {
  it.each(cases)(
    'resolves %s and its exact comparison window',
    (preset, start, end, endInclusive, previousStart, previousEnd, previousInclusive) => {
      expect(resolveReportingPeriod({ kind: 'preset', preset }, asOf)).toEqual({
        selection: { kind: 'preset', preset },
        timezone: 'UTC',
        range: { start, end, endInclusive },
        comparison: { start: previousStart, end: previousEnd, endInclusive: previousInclusive },
      });
    },
  );
  it('caps elapsed month comparisons at the end of a shorter previous month', () => {
    expect(
      resolveReportingPeriod({ kind: 'preset', preset: 'this-month' }, '2026-03-31T12:00:00.000Z')
        .comparison,
    ).toEqual({
      start: '2026-02-01T00:00:00.000Z',
      end: '2026-03-01T00:00:00.000Z',
      endInclusive: false,
    });
  });
  it('clamps leap day to February 28 and preserves the time of day', () => {
    expect(
      resolveReportingPeriod({ kind: 'preset', preset: 'this-year' }, '2024-02-29T12:34:56.789Z')
        .comparison,
    ).toEqual({
      start: '2023-01-01T00:00:00.000Z',
      end: '2023-02-28T12:34:56.789Z',
      endInclusive: true,
    });
  });
  it('starts a week on Monday across the year boundary, including the as-of instant', () => {
    const period = resolveReportingPeriod(
      { kind: 'preset', preset: 'this-week' },
      '2026-01-05T00:00:00.000Z',
    );
    expect(period.range).toEqual({
      start: '2026-01-05T00:00:00.000Z',
      end: '2026-01-05T00:00:00.000Z',
      endInclusive: true,
    });
    expect(period.comparison).toEqual({
      start: '2025-12-29T00:00:00.000Z',
      end: '2025-12-29T00:00:00.000Z',
      endInclusive: true,
    });
  });
  it('uses inclusive custom calendar dates and a non-overlapping equal-duration comparison', () => {
    const period = resolveReportingPeriod(
      { kind: 'custom', from: '2026-10-05', through: '2026-10-11' },
      asOf,
    );
    expect(period.range).toEqual({
      start: '2026-10-05T00:00:00.000Z',
      end: '2026-10-12T00:00:00.000Z',
      endInclusive: false,
    });
    expect(period.comparison).toEqual({
      start: '2026-09-28T00:00:00.000Z',
      end: '2026-10-05T00:00:00.000Z',
      endInclusive: false,
    });
  });
  it('caps custom ranges at as-of without counting future time', () => {
    const period = resolveReportingPeriod(
      { kind: 'custom', from: '2026-10-20', through: '2026-10-30' },
      asOf,
    );
    expect(period.range).toEqual({
      start: '2026-10-20T00:00:00.000Z',
      end: asOf,
      endInclusive: true,
    });
    expect(period.comparison).toEqual({
      start: '2026-10-15T11:59:59.999Z',
      end: '2026-10-20T00:00:00.000Z',
      endInclusive: false,
    });
  });
  it('rejects future ranges, invalid clocks, and years without comparison history', () => {
    expect(() =>
      resolveReportingPeriod({ kind: 'custom', from: '2027-01-01', through: '2027-01-02' }, asOf),
    ).toThrow('after the reporting clock');
    expect(() =>
      resolveReportingPeriod({ kind: 'preset', preset: 'this-month' }, 'invalid'),
    ).toThrow();
    expect(() =>
      resolveReportingPeriod({ kind: 'preset', preset: 'this-year' }, '0002-01-01T00:00:00.000Z'),
    ).toThrow('preceding years');
  });
  it.each(['2026-02-29', '2026-02-30', '2026-13-01', '2026-1-01', 'not-a-date'])(
    'rejects invalid calendar date %s',
    (value) => {
      expect(calendarDateSchema.safeParse(value).success).toBe(false);
    },
  );
  it('rejects unknown selections, reversed dates, non-UTC clocks and empty exclusive ranges', () => {
    expect(periodSelectionSchema.safeParse({ kind: 'preset', preset: 'tomorrow' }).success).toBe(
      false,
    );
    expect(
      periodSelectionSchema.safeParse({ kind: 'custom', from: '2026-10-10', through: '2026-10-01' })
        .success,
    ).toBe(false);
    expect(utcInstantSchema.safeParse('2026-02-30T00:00:00.000Z').success).toBe(false);
    expect(utcInstantSchema.safeParse('2026-10-24T12:00:00.000-06:00').success).toBe(false);
    expect(dateRangeSchema.safeParse({ start: asOf, end: asOf, endInclusive: false }).success).toBe(
      false,
    );
    expect(
      dateRangeSchema.safeParse({
        start: asOf,
        end: '2026-10-01T00:00:00.000Z',
        endInclusive: true,
      }).success,
    ).toBe(false);
    expect(calendarDateSchema.parse('2024-02-29')).toBe('2024-02-29');
  });
});
