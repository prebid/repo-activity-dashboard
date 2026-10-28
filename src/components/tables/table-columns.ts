import type { ReactNode } from 'react';

export interface DataColumn<T> {
  id: string;
  label: string;
  value: (row: T) => string | number | null;
  cell?: (row: T) => ReactNode;
  group?: string;
  description?: string;
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
