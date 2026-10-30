import type { TableValueColumn } from '@/models/table-values';
import type { SelectableColumn } from '@/models/column-selection';
import type { ReactNode } from 'react';

export interface DataColumn<T> extends Omit<SelectableColumn, 'required'>, TableValueColumn<T> {
  /** Pure render callback: return a component element for stateful UI; do not call hooks here. */
  cell?: (row: T) => ReactNode;
  /** Export-only metadata follows this selected display column; omitted means always included. */
  exportWith?: string;
  width?: number;
  align?: 'left' | 'right';
  pinned?: boolean;
  hideable?: boolean;
}
export interface ColumnVisibility {
  value: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
}

/** Contiguous sections retain the feature's column order when columns are hidden. */
export function columnSections<T>(
  columns: DataColumn<T>[],
): { label: string; columns: DataColumn<T>[] }[] {
  const sections: { label: string; columns: DataColumn<T>[] }[] = [];
  for (const column of columns) {
    const label = column.group ?? '';
    const last = sections.at(-1);
    if (last && last.label === label) last.columns.push(column);
    else sections.push({ label, columns: [column] });
  }
  return sections;
}
