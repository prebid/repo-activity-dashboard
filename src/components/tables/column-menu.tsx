'use client';
import { Fragment, useState } from 'react';
import { Columns3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { columnSections, type ColumnVisibility, type DataColumn } from './table-columns';
import styles from './data-table.module.css';

export function ColumnMenu<T>({
  columns,
  visibility,
}: {
  columns: DataColumn<T>[];
  visibility: ColumnVisibility;
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const visible = (column: DataColumn<T>) =>
    column.hideable === false || visibility.value[column.id] !== false;
  const count = columns.filter(visible).length;
  function change(targets: DataColumn<T>[], show: boolean) {
    const next = { ...visibility.value };
    for (const column of targets) if (column.hideable !== false) next[column.id] = show;
    visibility.onChange(next);
  }
  return (
    <div ref={setContainer}>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className={styles.control}>
            <Columns3 size={14} aria-hidden="true" />
            Columns
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent container={container} align="end" className={styles.columnMenu}>
          <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
          {columnSections(columns).map((section, index) => {
            const selected = section.columns.filter(visible).length;
            const hideable = section.columns.filter((column) => column.hideable !== false);
            return (
              <Fragment key={index}>
                {section.label && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      className="font-semibold"
                      checked={
                        selected === section.columns.length
                          ? true
                          : selected
                            ? 'indeterminate'
                            : false
                      }
                      disabled={
                        !hideable.length ||
                        (selected === count && selected === section.columns.length)
                      }
                      onSelect={(event) => event.preventDefault()}
                      onCheckedChange={(checked) => change(hideable, checked === true)}
                    >
                      {section.label}
                    </DropdownMenuCheckboxItem>
                  </>
                )}
                {section.columns.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={visible(column)}
                    disabled={column.hideable === false || (visible(column) && count === 1)}
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={(checked) => change([column], checked === true)}
                  >
                    {column.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </Fragment>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
