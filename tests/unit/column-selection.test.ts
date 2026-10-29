import { expect, it } from 'vitest';
import {
  columnSelectionGroups,
  columnSelectionState,
  changeColumnSelection,
} from '@/lib/presentation/column-selection';
import { contributorValues } from '@/lib/presentation/contribution-table-values';
import type { SelectableColumn } from '@/models/column-selection';
const columns: SelectableColumn[] = [
  { id: 'name', label: 'Name', selectionGroup: 'Identity', required: true },
  { id: 'a', label: 'Added', group: 'Authored', selectionSection: 'Files' },
  { id: 'x', label: 'Identity detail', selectionGroup: 'Identity' },
  { id: 'b', label: 'Lines', group: 'Authored', selectionSection: 'Lines' },
  { id: 'c', label: 'Removed', group: 'Authored', selectionSection: 'Files' },
];
it('builds stable small groups without altering the input or table-heading metadata', () => {
  const before = structuredClone(columns);
  const groups = columnSelectionGroups(columns);
  expect(groups.map((group) => [group.label, group.columns.map((column) => column.id)])).toEqual([
    ['Identity', ['name', 'x']],
    ['Authored', ['a', 'b', 'c']],
  ]);
  expect(
    groups[1].sections.map((section) => [
      section.label,
      section.columns.map((column) => column.id),
    ]),
  ).toEqual([
    ['Files', ['a', 'c']],
    ['Lines', ['b']],
  ]);
  expect(columns).toEqual(before);
  expect(columnSelectionGroups([{ id: 'plain', label: 'Plain', group: '' }])[0].label).toBe(
    'Columns',
  );
  expect(columnSelectionGroups([])).toEqual([]);
});
it('reports required, partial, complete and empty selections consistently', () => {
  expect(columnSelectionState(columns, [])).toEqual({
    count: 1,
    total: 5,
    checked: 'indeterminate',
  });
  expect(
    columnSelectionState(
      columns,
      columns.map((column) => column.id),
    ),
  ).toEqual({ count: 5, total: 5, checked: true });
  expect(columnSelectionState(columns.slice(1), [])).toEqual({
    count: 0,
    total: 4,
    checked: false,
  });
  expect(columnSelectionState([], [])).toEqual({ count: 0, total: 0, checked: false });
});
it('bulk changes retain required and unrelated choices and can protect the last visible column', () => {
  expect(
    changeColumnSelection(columns, ['name', 'x', 'b'], [columns[1], columns[4]], true),
  ).toEqual(['name', 'a', 'x', 'b', 'c']);
  expect(
    changeColumnSelection(columns, ['name', 'a', 'x', 'b', 'c'], [columns[1], columns[4]], false),
  ).toEqual(['name', 'x', 'b']);
  expect(
    changeColumnSelection(
      columns,
      columns.map((column) => column.id),
      columns,
      false,
    ),
  ).toEqual(['name']);
  const optional = columns.filter((column) => !column.required);
  expect(changeColumnSelection(optional, ['a'], optional, false, false)).toEqual(['a']);
  expect(changeColumnSelection(optional, ['a'], optional, false, true)).toEqual([]);
});
it('gives contribution menus and exports the same domain groups and file/line sections', () => {
  const choices = contributorValues();
  const groups = columnSelectionGroups(choices);
  expect(groups.map((group) => group.label)).toEqual([
    'Identity',
    'Pull requests',
    'Reviews and approvals',
    'Issues',
    'Comment activity',
    'Authored merged PR volume',
    'Reviewed merged PR volume',
    'Approved merged PR volume',
  ]);
  expect(groups[1].columns.map((column) => column.id)).toEqual([
    'prsAuthored',
    'authoredPrsMerged',
    'mergesPerformed',
  ]);
  for (const group of groups.slice(5))
    expect(group.sections.map((section) => [section.label, section.columns.length])).toEqual([
      ['Files', 7],
      ['Lines', 3],
    ]);
  expect(choices.find((column) => column.id === 'prsAuthored')?.group).toBeUndefined();
  expect(choices.find((column) => column.id === 'authored.filesAdded')?.group).toBe(
    'Authored merged PR volume',
  );
});
