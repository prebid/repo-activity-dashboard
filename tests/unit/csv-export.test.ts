import { expect, it } from 'vitest';
import { tableCsv } from '@/lib/presentation/csv-export';
const rows = [
  { name: 'Zero', count: 0 },
  { name: 'Unknown', count: null },
];
const columns = [
  { id: 'id', label: 'Identity', value: (row: (typeof rows)[number]) => row.name.toLowerCase() },
  { id: 'name', label: 'Name', value: (row: (typeof rows)[number]) => row.name },
  {
    id: 'count',
    label: 'Count',
    group: 'Activity',
    value: (row: (typeof rows)[number]) => row.count,
  },
  {
    id: 'count.coverage',
    label: 'Count coverage',
    exportWith: 'count',
    value: (row: (typeof rows)[number]) => (row.count === null ? 'missing' : 'complete'),
  },
  { id: 'scope', label: 'Scope', value: () => 'All matching' },
];
it('exports chosen values plus required metadata and only their associated coverage', () => {
  expect(tableCsv(rows, columns, ['name', 'count'], ['name'])).toBe(
    '"Identity","Name","Scope"\r\n"zero","Zero","All matching"\r\n"unknown","Unknown","All matching"',
  );
  expect(tableCsv(rows, columns, ['name', 'count'], ['name', 'count'])).toBe(
    '"Identity","Name","Activity — Count","Count coverage","Scope"\r\n"zero","Zero","0","complete","All matching"\r\n"unknown","Unknown",,"missing","All matching"',
  );
});
it('retains qualified group labels and protects spreadsheet text without changing numeric values', () => {
  const csv = tableCsv(
    [{ value: '=SUM(A1)', number: -2 }],
    [
      { id: 'value', group: 'Group', label: 'Group — Value', value: (row) => row.value },
      { id: 'number', label: 'Number', value: (row) => row.number },
    ],
    ['value', 'number'],
    ['value', 'number'],
  );
  expect(csv).toBe('"Group — Value","Number"\r\n"\'=SUM(A1)","-2"');
});
