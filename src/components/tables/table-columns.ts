import type { TableValueColumn } from '@/models/table-values';
import type { SelectableColumn } from '@/models/column-selection';
import type { ReactNode } from 'react';

export interface DataColumn<T> extends Omit<SelectableColumn, 'required'>, TableValueColumn<T> {
  /** Pure render callback: return a component element for stateful UI; do not call hooks here. */
  cell?: (row: T) => ReactNode;
  /** Export-only metadata follows this selected display column; omitted means always included. */
  exportWith?: string;
  width?: number;
  /**
   * A heading over contiguous columns that is drawn only on screen, like `group`'s, but never
   * reaches metric names, the Columns menu, the CSV dialog or CSV headers. `group` wins when both
   * are set.
   */
  displayGroup?: string;
  align?: 'left' | 'right';
  pinned?: boolean;
  hideable?: boolean;
}
export interface ColumnVisibility {
  value: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
}

/**
 * Contiguous sections retain the feature's column order when columns are hidden. A section's label
 * is the heading drawn over it: the columns' group, or else their display-only group.
 */
export function columnSections<T>(
  columns: DataColumn<T>[],
): { label: string; columns: DataColumn<T>[] }[] {
  const sections: { label: string; columns: DataColumn<T>[] }[] = [];
  for (const column of columns) {
    const label = column.group ?? column.displayGroup ?? '';
    const last = sections.at(-1);
    if (last && last.label === label) last.columns.push(column);
    else sections.push({ label, columns: [column] });
  }
  return sections;
}
