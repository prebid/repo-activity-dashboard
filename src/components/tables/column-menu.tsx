'use client';
import { useState } from 'react';
import { Columns3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ColumnVisibility, DataColumn } from './table-columns';
import { ColumnSelection } from './column-selection';
import styles from './data-table.module.css';

export function ColumnMenu<T>({
  columns,
  visibility,
  label = 'Columns',
  title = 'Visible columns',
  allowEmpty = false,
}: {
  columns: DataColumn<T>[];
  visibility: ColumnVisibility;
  label?: string;
  title?: string;
  allowEmpty?: boolean;
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const visible = (column: DataColumn<T>) =>
    column.hideable === false || visibility.value[column.id] !== false;
  return (
    <div ref={setContainer}>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className={styles.control}>
            <Columns3 size={14} aria-hidden="true" />
            {label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent container={container} align="end" className={styles.columnMenu}>
          <DropdownMenuLabel>{title}</DropdownMenuLabel>
          <ColumnSelection
            mode="menu"
            columns={columns.map((column) => ({ ...column, required: column.hideable === false }))}
            selectedIds={columns.filter(visible).map((column) => column.id)}
            allowEmpty={allowEmpty}
            onChange={(ids) =>
              visibility.onChange({
                ...visibility.value,
                ...Object.fromEntries(
                  columns.map((column) => [column.id, ids.includes(column.id)]),
                ),
              })
            }
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
