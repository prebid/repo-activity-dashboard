'use client';
import { useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { DataColumn } from './table-columns';
import styles from './data-table.module.css';

/** The same column metadata supplies mouse hover, screen-reader descriptions and this touch/keyboard view. */
export function ColumnDefinitions<T>({
  title,
  columns,
  disabled = false,
}: {
  title: string;
  columns: DataColumn<T>[];
  disabled?: boolean;
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const explained = columns.filter((column) => column.description);
  if (!explained.length) return null;
  return (
    <div ref={setContainer}>
      <Dialog>
        <DialogTrigger asChild>
          <Button
            type="button"
            disabled={disabled}
            variant="ghost"
            size="icon"
            className={styles.helpTrigger}
            aria-label={'Column definitions for ' + title}
            title="Column definitions"
          >
            <CircleHelp size={15} aria-hidden="true" />
          </Button>
        </DialogTrigger>
        <DialogContent container={container} className={styles.definitionsDialog}>
          <DialogHeader>
            <DialogTitle>{title} column definitions</DialogTitle>
            <DialogDescription>
              Definitions for the columns currently shown. The same explanations are available by
              hovering their headings.
            </DialogDescription>
          </DialogHeader>
          <div
            role="region"
            aria-label="Column definitions"
            tabIndex={0}
            className={styles.definitionsList}
          >
            <dl>
              {explained.map((column) => (
                <div key={column.id}>
                  <dt>
                    {column.group ? column.group + ' — ' : ''}
                    {column.label}
                  </dt>
                  <dd>{column.description}</dd>
                </div>
              ))}
            </dl>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
