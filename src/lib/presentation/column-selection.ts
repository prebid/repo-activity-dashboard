import type { SelectableColumn } from '@/models/column-selection';
export interface SelectionSection {
  label: string;
  columns: SelectableColumn[];
}
export interface SelectionGroup {
  label: string;
  columns: SelectableColumn[];
  sections: SelectionSection[];
}
/** Group nonadjacent choices together while retaining first-seen group/section order. */
export function columnSelectionGroups(columns: readonly SelectableColumn[]): SelectionGroup[] {
  const groups: SelectionGroup[] = [];
  for (const column of columns) {
    const label = column.selectionGroup || column.group || 'Columns';
    let group = groups.find((item) => item.label === label);
    if (!group) {
      group = { label, columns: [], sections: [] };
      groups.push(group);
    }
    group.columns.push(column);
    const sectionLabel = column.selectionSection ?? '';
    let section = group.sections.find((item) => item.label === sectionLabel);
    if (!section) {
      section = { label: sectionLabel, columns: [] };
      group.sections.push(section);
    }
    section.columns.push(column);
  }
  return groups;
}
export function columnSelectionState(
  columns: readonly SelectableColumn[],
  selected: readonly string[],
) {
  const count = columns.filter((column) => column.required || selected.includes(column.id)).length;
  return {
    count,
    total: columns.length,
    checked:
      count > 0 && count === columns.length ? true : count ? ('indeterminate' as const) : false,
  };
}
/** Required columns survive bulk changes; a table may also require at least one visible column. */
export function changeColumnSelection(
  columns: readonly SelectableColumn[],
  selected: readonly string[],
  targets: readonly SelectableColumn[],
  show: boolean,
  allowEmpty = true,
): string[] {
  const targetIds = new Set(targets.map((column) => column.id));
  const next = columns
    .filter(
      (column) =>
        column.required || (targetIds.has(column.id) ? show : selected.includes(column.id)),
    )
    .map((column) => column.id);
  return !allowEmpty && !next.length
    ? columns
        .filter((column) => column.required || selected.includes(column.id))
        .map((column) => column.id)
    : next;
}
