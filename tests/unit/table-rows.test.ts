import { expect, it } from 'vitest';
import { selectTableRows } from '@/lib/presentation/table-rows';
import { measurementSortGroup } from '@/lib/presentation/measurement-order';
import type { Count } from '@/models/reporting-measurement';
const rows: { id: string; count: Count }[] = [
  { id: 'partial20', count: { status: 'partial', value: 20, reason: 'History incomplete' } },
  { id: 'missing', count: { status: 'missing', value: null, reason: 'Unavailable' } },
  { id: 'complete2', count: { status: 'complete', value: 2 } },
  { id: 'partial4', count: { status: 'partial', value: 4, reason: 'History incomplete' } },
  { id: 'complete10', count: { status: 'complete', value: 10 } },
  { id: 'na', count: { status: 'not-applicable', value: null, reason: 'Not applicable' } },
];
const columns = [
  {
    id: 'count',
    value: (row: (typeof rows)[number]) => row.count.value,
    sortGroup: (row: (typeof rows)[number]) => measurementSortGroup(row.count),
  },
];
it.each([false, true])(
  'ranks complete and partial values separately, with missing last (descending=%s)',
  (descending) => {
    const query = { search: '', sort: 'count', descending };
    expect(selectTableRows(rows, columns, query).map((row) => row.id)).toEqual(
      descending
        ? ['complete10', 'complete2', 'partial20', 'partial4', 'missing', 'na']
        : ['complete2', 'complete10', 'partial4', 'partial20', 'missing', 'na'],
    );
    expect(
      selectTableRows(
        rows.filter((row) => row.count.status === 'partial'),
        columns,
        query,
      ).map((row) => row.id),
    ).toEqual(descending ? ['partial20', 'partial4'] : ['partial4', 'partial20']);
    expect(rows[0].id).toBe('partial20');
  },
);
it('filters the full population before ordering and ignores search only when disabled', () => {
  expect(
    selectTableRows(rows, columns, { search: '20', sort: 'count', descending: true }).map(
      (row) => row.id,
    ),
  ).toEqual(['partial20']);
  expect(
    selectTableRows(rows, columns, { search: '20', sort: 'count', descending: true }, false),
  ).toHaveLength(6);
});
