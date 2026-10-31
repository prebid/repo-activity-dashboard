// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { hasUnlinkedValue, isIncompleteValue } from '@/components/reporting/timeline-value';
import type { Measurement } from '@/models/reporting-measurement';

const known: Measurement = { status: 'complete', value: 2 };
const absent: Measurement = { status: 'missing', value: null, reason: 'No sample.' };

it('treats partial and missing values as incomplete', () => {
  expect(isIncompleteValue({ status: 'partial', value: 1, reason: 'Some history.' })).toBe(true);
  expect(isIncompleteValue(absent)).toBe(true);
  expect(isIncompleteValue(known)).toBe(false);
  expect(isIncompleteValue({ status: 'not-applicable', value: null, reason: 'None.' })).toBe(false);
});
it('checks each row once at the longest interval and sweeps every cell only when one does not fit', () => {
  const rows = ['a', 'longest-metric'],
    intervals = ['week:1', 'week:22'];
  const fits = vi.fn(() => '/link');
  expect(hasUnlinkedValue(rows, intervals, () => known, fits)).toBe(false);
  expect(fits.mock.calls).toEqual([
    ['a', 'week:22'],
    ['longest-metric', 'week:22'],
  ]);
  // Links over budget only for the longest metric: its known value is reported.
  const budget = (row: string) => (row === 'longest-metric' ? null : '/link');
  expect(hasUnlinkedValue(rows, intervals, () => known, budget)).toBe(true);
  // A value with nothing to open needs no link.
  expect(
    hasUnlinkedValue(rows, intervals, (row) => (row === 'longest-metric' ? absent : known), budget),
  ).toBe(false);
  expect(hasUnlinkedValue([], intervals, () => known, budget)).toBe(false);
});
it('finds an unlinked row whose key is shorter but whose link carries its longer part twice', () => {
  // Matrix links carry the slug once and the metric twice, so the longest key is not the longest link.
  const rows = [
    { slug: 'a-very-long-repository-slug', metric: 'prs' },
    { slug: 'js', metric: 'humanApprovalsMoreThan2' },
  ];
  const href = (row: (typeof rows)[number]) =>
    row.slug.length + 2 * row.metric.length > 40 ? null : '/link';
  expect(hasUnlinkedValue(rows, ['month:1'], () => known, href)).toBe(true);
});
