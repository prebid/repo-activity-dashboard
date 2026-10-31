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
it('checks the longest link once and sweeps every cell only when it does not fit', () => {
  const rows = ['a', 'longest-metric'],
    intervals = ['week:1', 'week:22'];
  const fits = vi.fn(() => '/link');
  expect(
    hasUnlinkedValue(
      rows,
      intervals,
      (row) => row,
      () => known,
      fits,
    ),
  ).toBe(false);
  expect(fits).toHaveBeenCalledTimes(1);
  expect(fits).toHaveBeenCalledWith('longest-metric', 'week:22');
  // Links over budget only for the longest metric: its known value is reported.
  const budget = (row: string) => (row === 'longest-metric' ? null : '/link');
  expect(
    hasUnlinkedValue(
      rows,
      intervals,
      (row) => row,
      () => known,
      budget,
    ),
  ).toBe(true);
  // A value with nothing to open needs no link.
  expect(
    hasUnlinkedValue(
      rows,
      intervals,
      (row) => row,
      (row) => (row === 'longest-metric' ? absent : known),
      budget,
    ),
  ).toBe(false);
  expect(
    hasUnlinkedValue(
      [],
      intervals,
      (row) => row,
      () => known,
      budget,
    ),
  ).toBe(false);
});
