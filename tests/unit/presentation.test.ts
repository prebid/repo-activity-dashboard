import { describe, it, expect } from 'vitest';
import { formatCount, formatAsOf, compareValues, csvCell } from '@/lib/presentation/format';
import { safeReturnPath } from '@/lib/presentation/navigation';
import { readTableQuery, writeTableQuery, preferenceKey } from '@/lib/presentation/table-query';
import { encodeSearchParams } from '@/lib/presentation/search-params';
describe('presentation contracts', () => {
  it('preserves repeated URL parameters across the server/client boundary', () => {
    expect(encodeSearchParams({ repo: ['one', 'two'], view: 'issues', unused: undefined })).toBe(
      '?repo=one&repo=two&view=issues',
    );
    // Scalar table fields use the first value consistently on server and browser.
    expect(readTableQuery('?prs.page=2&prs.page=9', 'prs', []).page).toBe(2);
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
});
