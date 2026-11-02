import { expect, it } from 'vitest';
import { activityColumns } from '@/features/repositories/overview-columns';
import { repositoryOverviewSample } from '@/mocks/repository-overview';
import {
  activityPeriodLabel,
  activityTableRows,
  compactRangeLabel,
  periodRangeLabel,
  validateActivityPeriods,
  zonedRangeLabel,
} from '@/lib/presentation/overview-periods';
import { resolveReportingPeriod } from '@/lib/presentation/reporting-period';
import {
  defaultOverviewSettings,
  normalizeOverviewSettings,
  readOverviewPreferences,
  resolveOverviewSettings,
  serializeOverviewPreferences,
  writeOverviewSettings,
} from '@/lib/presentation/overview-settings';
import type { PeriodSelection } from '@/models/reporting-period';

const asOf = '2026-10-24T12:00:00.000Z';
const month: PeriodSelection = { kind: 'preset', preset: 'this-month' };
const week: PeriodSelection = { kind: 'preset', preset: 'this-week' };
const custom: PeriodSelection = { kind: 'custom', from: '2026-10-06', through: '2026-10-08' };
const custom2: PeriodSelection = { kind: 'custom', from: '2026-10-13', through: '2026-10-15' };
const definition = {
  repositoryIds: ['a'],
  backlogColumns: ['name'],
  activityColumns: ['name'],
  defaultBacklogColumns: ['name'],
  defaultActivityColumns: ['name'],
};
const defaults = defaultOverviewSettings(definition);
it('accepts one or two distinct periods, including two independent custom ranges', () => {
  expect(validateActivityPeriods([month], asOf)).toBeUndefined();
  expect(validateActivityPeriods([month, week], asOf)).toBeUndefined();
  expect(validateActivityPeriods([custom, custom2], asOf)).toBeUndefined();
  expect(validateActivityPeriods([], asOf)).toBe('Select one or two periods.');
  expect(validateActivityPeriods([month, week, custom], asOf)).toBe('Select one or two periods.');
  expect(validateActivityPeriods([month, month], asOf)).toBe('Choose two different periods.');
  expect(
    validateActivityPeriods(
      [week, { kind: 'custom', from: '2026-10-19', through: '2026-10-24' }],
      asOf,
    ),
  ).toBe('Choose two different periods.');
  expect(
    validateActivityPeriods([{ kind: 'custom', from: '2027-01-01', through: '2027-01-02' }], asOf),
  ).toContain('valid date range');
});
it('round-trips two custom ranges, preserves empty age choices, and retires Show change', () => {
  const settings = { ...defaults, periods: [custom, custom2], ageThresholds: [] };
  const query = writeOverviewSettings('change=1&tag=a&tag=b', settings);
  const params = new URLSearchParams(query);
  expect(params.get('period')).toBe('custom');
  expect(params.get('from')).toBe('2026-10-06');
  expect(params.get('period2')).toBe('custom');
  expect(params.get('through2')).toBe('2026-10-15');
  expect(params.get('age')).toBe('');
  expect(params.has('change')).toBe(false);
  expect(params.getAll('tag')).toEqual(['a', 'b']);
  expect(resolveOverviewSettings(query, null, definition, asOf).value).toEqual(settings);
  expect(readOverviewPreferences(serializeOverviewPreferences(settings), definition, asOf)).toEqual(
    settings,
  );
  const single = new URLSearchParams(writeOverviewSettings(query, defaults));
  expect(single.has('period2')).toBe(false);
  expect(single.has('from2')).toBe(false);
  expect(() =>
    normalizeOverviewSettings({ ...defaults, periods: [month, month] }, definition, asOf),
  ).toThrow('different periods');
});
it('rejects invalid second periods without discarding the primary period', () => {
  for (const second of [
    'period2=this-week',
    'period2=unknown',
    'period2=custom&from2=2027-01-01&through2=2027-01-02',
  ]) {
    const result = resolveOverviewSettings('period=this-week&' + second, null, definition, asOf);
    expect(result.value.periods).toEqual([week]);
    expect(result.notice).toContain('second period');
  }
  expect(resolveOverviewSettings('change=1', defaults, definition, asOf).value).not.toHaveProperty(
    'showChange',
  );
});
it('migrates v2 single-period preferences and discards the removed comparison flag', () => {
  const { periods, ...rest } = defaults;
  const old = {
    version: 2,
    settings: { ...rest, period: periods[0], showChange: true, ageThresholds: [] },
  };
  const migrated = readOverviewPreferences(JSON.stringify(old), definition, asOf);
  expect(migrated).toEqual({ ...defaults, ageThresholds: [] });
  expect(migrated).not.toHaveProperty('showChange');
});
it('builds repository pairs with independent display values and primary-period ranking values', () => {
  const primary = repositoryOverviewSample(month, ['repo-prebidjs', 'repo-salesagent']);
  const secondary = repositoryOverviewSample({ kind: 'preset', preset: 'last-month' }, [
    'repo-prebidjs',
    'repo-salesagent',
  ]);
  const rows = activityTableRows(primary, secondary);
  expect(
    rows.map((row) => [
      row.repository.name,
      row.kind,
      row.kind === 'period' ? row.periodIndex : null,
    ]),
  ).toEqual([
    ['Prebid.js', 'period', 0],
    ['Prebid.js', 'period', 1],
    ['Prebid.js', 'difference', null],
    ['SalesAgent', 'period', 0],
    ['SalesAgent', 'period', 1],
    ['SalesAgent', 'difference', null],
  ]);
  expect(new Set(rows.map((row) => row.id)).size).toBe(6);
  const opened = activityColumns().find((column) => column.id === 'prsOpened')!;
  const duration = activityColumns().find((column) => column.id === 'medianMergeDays')!;
  // Display values come from each period's input; ranking always uses the primary period.
  const count = (report: typeof primary, index: number) =>
    report.rows[index].activity.counts.prsOpened.value!;
  const [js, js2, sa, sa2] = [
    count(primary, 0),
    count(secondary, 0),
    count(primary, 1),
    count(secondary, 1),
  ];
  expect(js).not.toBe(js2);
  expect(rows.map((row) => opened.value(row))).toEqual([js, js2, js - js2, sa, sa2, sa - sa2]);
  expect(rows.map((row) => opened.sortValue!(row))).toEqual([js, js, js, sa, sa, sa]);
  expect(duration.value(rows[2])).toBe(
    primary.rows[0].activity.mergeDuration.days.value! -
      secondary.rows[0].activity.mergeDuration.days.value!,
  );
  expect(rows.filter((row) => row.kind === 'period').every((row) => row.showPeriodLabel)).toBe(
    true,
  );
  expect(
    activityTableRows(primary).every((row) => row.kind === 'period' && !row.showPeriodLabel),
  ).toBe(true);
  expect(activityTableRows({ ...primary, rows: [] }).length).toBe(0);
  expect(() =>
    activityTableRows(primary, { ...secondary, asOf: '2025-01-01T00:00:00.000Z' }),
  ).toThrow('share a snapshot');
  const wrong = structuredClone(secondary);
  wrong.rows[1].repository.id = 'another';
  expect(() => activityTableRows(primary, wrong)).toThrow('Missing repository');
});
it('labels preset and custom rows from their effective UTC date ranges', () => {
  expect(activityPeriodLabel(resolveReportingPeriod(week, asOf))).toBe('This week');
  expect(activityPeriodLabel(resolveReportingPeriod(custom, asOf))).toBe(
    'Oct 6, 2026 – Oct 8, 2026',
  );
  expect(periodRangeLabel(resolveReportingPeriod(month, asOf).range)).toBe(
    'Oct 1, 2026 – Oct 24, 2026',
  );
  expect(zonedRangeLabel(resolveReportingPeriod(month, asOf).range)).toBe(
    'Oct 1, 2026 – Oct 24, 2026 · UTC',
  );
  // An exclusive end shows the last included day; an inclusive end shows itself.
  const days = { start: '2026-10-01T00:00:00.000Z', end: '2026-10-08T00:00:00.000Z' };
  expect(zonedRangeLabel({ ...days, endInclusive: false })).toBe('Oct 1, 2026 – Oct 7, 2026 · UTC');
  expect(zonedRangeLabel({ ...days, endInclusive: true })).toBe('Oct 1, 2026 – Oct 8, 2026 · UTC');
  expect(repositoryOverviewSample(custom2, ['repo-prebidjs']).period.range).toEqual({
    start: '2026-10-13T00:00:00.000Z',
    end: '2026-10-16T00:00:00.000Z',
    endInclusive: false,
  });
});
it('says a shared month and year once in a compact range', () => {
  const range = (start: string, end: string, endInclusive = false) => ({
    start: start + 'T00:00:00.000Z',
    end: end + 'T00:00:00.000Z',
    endInclusive,
  });
  expect(compactRangeLabel(range('2026-09-21', '2026-09-28'))).toBe('Sep 21–27, 2026');
  expect(compactRangeLabel(range('2026-09-28', '2026-10-05'))).toBe('Sep 28 – Oct 4, 2026');
  expect(compactRangeLabel(range('2025-12-29', '2026-01-05'))).toBe('Dec 29, 2025 – Jan 4, 2026');
  // An inclusive end shows itself, and a range inside one day reads as that day.
  expect(compactRangeLabel(range('2026-10-19', '2026-10-24', true))).toBe('Oct 19–24, 2026');
  expect(compactRangeLabel(range('2026-10-24', '2026-10-25'))).toBe('Oct 24, 2026');
});
