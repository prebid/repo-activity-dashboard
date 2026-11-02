import type { ColumnSetChoice, ColumnSetOption, SelectableColumn } from '@/models/column-selection';
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
const isList = (value: unknown): value is readonly string[] => Array.isArray(value);
/**
 * The set the visible columns show, or undefined for a custom selection: every column in the
 * choice's domain or in the set's own list is visible exactly when the set lists it. Columns
 * outside both, such as identity columns, do not decide. `visible` is a visibility map or the IDs
 * shown.
 */
export function matchingColumnSet(
  choice: Pick<ColumnSetChoice, 'domain' | 'options'>,
  visible: Readonly<Record<string, boolean>> | readonly string[],
): ColumnSetOption | undefined {
  const shown = new Set(
    isList(visible) ? visible : Object.keys(visible).filter((id) => visible[id]),
  );
  return choice.options.find((option) => {
    const listed = new Set(option.columnIds);
    return [...choice.domain, ...option.columnIds].every((id) => shown.has(id) === listed.has(id));
  });
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
