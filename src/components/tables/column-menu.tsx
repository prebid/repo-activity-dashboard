'use client';
import { useId, useState } from 'react';
import { ColumnsIcon, type IconComponent } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { matchingColumnSet } from '@/lib/presentation/column-selection';
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
  const setsLabel = useId();
  const visible = (column: DataColumn<T>) =>
    column.hideable === false || visibility.value[column.id] !== false;
  const visibleIds = columns.filter(visible).map((column) => column.id);
  const { sets } = visibility;
  // The trigger names the set the visible columns show, or Custom; the menu takes its name.
  const match = sets && matchingColumnSet(sets, visibleIds);
  return (
    <div ref={setContainer}>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary">
            <Icon size={14} />
            {sets ? label + ' · ' + (match?.label ?? 'Custom') : label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent container={container} align="end" size="lg">
          {sets && (
            <>
              <DropdownMenuLabel id={setsLabel}>{sets.label}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                aria-labelledby={setsLabel}
                value={match?.id ?? ''}
                // Choosing the set already shown changes nothing, so it writes nothing.
                onValueChange={(id) => {
                  if (id !== match?.id) sets.onChoose(id);
                }}
              >
                {sets.options.map((option) => (
                  <DropdownMenuRadioItem
                    key={option.id}
                    value={option.id}
                    // The menu stays open, as it does for the column checkboxes below.
                    onSelect={(event) => event.preventDefault()}
                  >
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuLabel>{title}</DropdownMenuLabel>
          <ColumnSelection
            mode="menu"
            columns={columns.map((column) => ({ ...column, required: column.hideable === false }))}
            selectedIds={visibleIds}
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
