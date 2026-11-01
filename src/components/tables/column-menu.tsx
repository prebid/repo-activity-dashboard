'use client';
import { useState } from 'react';
import { ColumnsIcon, type IconComponent } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ColumnVisibility, DataColumn } from './table-columns';
import { ColumnSelection } from './column-selection';

export function ColumnMenu<T>({
  columns,
  visibility,
  label = 'Columns',
  title = 'Visible columns',
  icon: Icon = ColumnsIcon,
  allowEmpty = false,
}: {
  columns: DataColumn<T>[];
  visibility: ColumnVisibility;
  label?: string;
  title?: string;
  icon?: IconComponent;
  allowEmpty?: boolean;
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const visible = (column: DataColumn<T>) =>
    column.hideable === false || visibility.value[column.id] !== false;
  return (
    <div ref={setContainer}>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary">
            <Icon size={14} />
            {label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent container={container} align="end" size="lg">
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
