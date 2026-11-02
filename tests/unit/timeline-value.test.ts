// @vitest-environment node
import { expect, it, vi } from 'vitest';
import {
  hasUnlinkedValue,
  isIncompleteValue,
  isRecordedZeroRange,
} from '@/components/reporting/timeline-value';
import type { Measurement } from '@/models/reporting-measurement';

const known: Measurement = { status: 'complete', value: 2 };
const absent: Measurement = { status: 'missing', value: null, reason: 'No sample.' };
const zero: Measurement = { status: 'complete', value: 0 };

it('calls a range a recorded zero only when every value is a complete zero', () => {
  expect(isRecordedZeroRange([zero, zero])).toBe(true);
  expect(isRecordedZeroRange([zero])).toBe(true);
  // A partial zero, a missing value or a not-applicable one is not a recorded zero.
  expect(
    isRecordedZeroRange([zero, { status: 'partial', value: 0, reason: 'Some history.' }]),
  ).toBe(false);
  expect(isRecordedZeroRange([zero, absent])).toBe(false);
  expect(
    isRecordedZeroRange([zero, { status: 'not-applicable', value: null, reason: 'No merges.' }]),
  ).toBe(false);
  expect(isRecordedZeroRange([zero, known])).toBe(false);
  // An empty range has no values to call zero.
  expect(isRecordedZeroRange([])).toBe(false);
  // Any iterable, not only an array.
  expect(isRecordedZeroRange([zero, zero].values())).toBe(true);
});

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
