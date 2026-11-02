import { describe, it, expect } from 'vitest';
import {
  formatCount,
  formatDayNumber,
  formatDays,
  formatMeasure,
  formatAsOf,
  formatUtcDate,
  compareValues,
  csvCell,
} from '@/lib/presentation/format';
import { safeReturnPath } from '@/lib/presentation/navigation';
import { readTableQuery, writeTableQuery, preferenceKey } from '@/lib/presentation/table-query';
import { encodeSearchParams, firstSearchParam } from '@/lib/presentation/search-params';
describe('presentation contracts', () => {
  it('renders identical UTC timestamp text without engine-specific locale connectors', () => {
    expect(formatAsOf('2026-10-24T12:00:00.000Z')).toBe('Oct 24, 2026, 12:00 PM UTC');
    expect(formatAsOf('2026-01-01T00:05:00.000Z')).toBe('Jan 1, 2026, 12:05 AM UTC');
    expect(formatAsOf('2026-01-01T07:09:00.000Z')).toBe('Jan 1, 2026, 7:09 AM UTC');
    expect(formatUtcDate('2026-10-24T23:00:00-04:00')).toBe('Oct 25, 2026');
    expect(formatUtcDate('invalid')).toBe('—');
  });
  it('preserves repeated URL parameters across the server/client boundary', () => {
    expect(encodeSearchParams({ repo: ['one', 'two'], view: 'issues', unused: undefined })).toBe(
      '?repo=one&repo=two&view=issues',
    );
    // Scalar table fields use the first value consistently on server and browser.
    expect(readTableQuery('?prs.page=2&prs.page=9', 'prs', []).page).toBe(2);
    expect(firstSearchParam(['issues', 'prs'])).toBe('issues');
    expect(firstSearchParam('issues')).toBe('issues');
    expect(firstSearchParam(undefined)).toBeUndefined();
    expect(firstSearchParam([])).toBeUndefined();
  });
  it.each(['0', '-1', '1.5', 'Infinity', 'nope', '9007199254740992'])(
    'rejects invalid page %s',
    (value) => {
      expect(readTableQuery('?prs.page=' + value, 'prs', []).page).toBe(1);
    },
  );
  it('distinguishes zero from missing', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(null)).toBe('—');
    expect(formatCount(12345)).toBe('12,345');
  });
  it('shows negatives with the minus sign, not the hyphen, and never a signed zero', () => {
    expect(formatCount(-6)).toBe('\u22126');
    expect(formatCount(-12345)).toBe('\u221212,345');
    expect(formatCount(-0)).toBe('0');
  });
  it.each([
    ['null', null, '—', '—'],
    ['0', 0, '0', '0 d'],
    ['-0', -0, '0', '0 d'],
    ['1e-9', 1e-9, '<0.1', '<0.1 d'],
    ['0.0499', 0.0499, '<0.1', '<0.1 d'],
    ['-0.01', -0.01, '\u2212<0.1', '\u2212<0.1 d'],
    ['0.05', 0.05, '0.1', '0.1 d'],
    ['4', 4, '4.0', '4.0 d'],
    ['4.853', 4.853, '4.9', '4.9 d'],
    ['8.3', 8.3, '8.3', '8.3 d'],
    ['5.999', 5.999, '6.0', '6.0 d'],
    ['1234.56', 1234.56, '1,234.6', '1,234.6 d'],
    ['-0.5', -0.5, '\u22120.5', '\u22120.5 d'],
  ] as const)('formats %s days at one decimal', (_, value, number, days) => {
    expect(formatDayNumber(value)).toBe(number);
    expect(formatDays(value)).toBe(days);
    expect(formatMeasure(value, 'days')).toBe(days);
  });
  it('formats counts unchanged and days with their unit by measure', () => {
    expect(formatMeasure(4.853, 'count')).toBe('4.853');
    expect(formatMeasure(12345, 'count')).toBe('12,345');
    expect(formatMeasure(null, 'count')).toBe('—');
    expect(formatMeasure(61, 'days')).toBe('61.0 d');
  });
  it('formats provenance in UTC independently of the machine timezone', () => {
    expect(formatAsOf('not a date')).toBe('—');
    expect(formatAsOf('2026-10-01T12:30:00Z')).toBe('Oct 1, 2026, 12:30 PM UTC');
  });
  it('keeps missing values last in both directions', () => {
    expect(compareValues(null, 1, 'asc')).toBe(1);
    expect(compareValues(null, 1, 'desc')).toBe(1);
    expect(compareValues(2, 1, 'desc')).toBeLessThan(0);
    expect(compareValues(null, null, 'desc')).toBe(0);
    expect(compareValues(1, null, 'asc')).toBe(-1);
    expect(compareValues('b', 'a', 'asc')).toBeGreaterThan(0);
  });
  it.each([
    'https://evil.test',
    '//evil.test',
    '/\\\\evil.test',
    '/auth/login',
    'javascript:alert(1)',
  ])('rejects unsafe return path %s', (value) => {
    expect(safeReturnPath(value)).toBe('/repos');
  });
  it('preserves valid filtered destinations', () => {
    expect(safeReturnPath('/repos/prebidjs?view=issues&issues.page=3')).toBe(
      '/repos/prebidjs?view=issues&issues.page=3',
    );
  });
  it('validates query state', () => {
    expect(readTableQuery('?prs.sort=unknown&prs.page=-3', 'prs', ['title'])).toEqual({
      search: '',
      sort: '',
      descending: false,
      page: 1,
    });
  });
  it('preserves unrelated filters and resets the page', () => {
    const result = writeTableQuery('?view=issues&issues.page=9', 'issues', {
      search: 'keyboard',
      page: 1,
    });
    expect(new URLSearchParams(result).get('view')).toBe('issues');
    expect(new URLSearchParams(result).get('issues.q')).toBe('keyboard');
    expect(new URLSearchParams(result).has('issues.page')).toBe(false);
  });
  it('namespaces preferences by account', () => {
    expect(preferenceKey('alice', 'repos')).not.toBe(preferenceKey('bob', 'repos'));
  });
  it('exports safe CSV values and preserves missing data', () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell('=1+1')).toBe('"\'=1+1"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(0)).toBe('"0"');
  });
  it.each(['\n=1+1', '＝1+1', '＋1+1', '－1+1', '＠SUM(1)', '   =1+1'])(
    'escapes spreadsheet formula prefixes in %j',
    (value) => {
      expect(csvCell(value)).toBe('"\'' + value + '"');
    },
  );
});
