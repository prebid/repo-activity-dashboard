'use client';
import { StaleExportError } from './csv-download';
import { ScrollableDialogContent, ScrollableDialogBody } from '@/components/ui/scrollable-dialog';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ExportIcon } from '@/components/ui/icons';
import { Callout } from '@/components/feedback/callout';
import {
  Dialog,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { ColumnSelection } from '@/components/tables/column-selection';
import type { SelectableColumn } from '@/models/column-selection';
import { type TableQuery } from '@/models/table-query';
import styles from './csv-export.module.css';
export interface CsvFile {
  blob: Blob;
  fileName: string;
}
export type CsvColumnChoice = SelectableColumn;
export interface CsvLayoutChoice {
  id: string;
  label: string;
  description?: string;
  columnIds?: readonly string[];
}
export interface CsvExportAlternative extends CsvLayoutChoice {
  download: (selection: {
    columnIds: string[];
    query: TableQuery;
    signal: AbortSignal;
  }) => Promise<CsvFile>;
}
interface CsvExportDialogProps {
  description?: React.ReactNode;
  title: string;
  columns: CsvColumnChoice[];
  visibleColumnIds: string[];
  contextKey: string;
  layouts?: readonly CsvLayoutChoice[];
  onOpen?: () => void;
  onDownload: (selection: {
    layout: string;
    columnIds: string[];
    signal: AbortSignal;
  }) => CsvFile | Promise<CsvFile>;
}
const noLayouts: readonly CsvLayoutChoice[] = [];
export function CsvExportDialog({
  title,
  columns,
  visibleColumnIds,
  contextKey,
  layouts = noLayouts,
  onOpen,
  onDownload,
  description,
}: CsvExportDialogProps) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null),
    [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]),
    [layout, setLayout] = useState('table');
  const [pending, setPending] = useState(false),
    [error, setError] = useState('');
  const active = useRef<{
    controller: AbortController;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const alternative = layouts.find((item) => item.id === layout);
  const choices = alternative?.columnIds
    ? columns.filter((column) => alternative.columnIds!.includes(column.id))
    : columns;
  const chosen = choices
    .filter((column) => column.required || selected.includes(column.id))
    .map((column) => column.id);
  useEffect(() => {
    if (active.current) {
      clearTimeout(active.current.timer);
      active.current.controller.abort();
      active.current = null;
    }
    setOpen(false);
    setPending(false);
    setError('');
  }, [contextKey]);
  useEffect(
    () => () => {
      if (active.current) {
        clearTimeout(active.current.timer);
        active.current.controller.abort();
        active.current = null;
      }
    },
    [],
  );
  function cancel() {
    if (active.current) {
      clearTimeout(active.current.timer);
      active.current.controller.abort();
      active.current = null;
    }
    setPending(false);
  }
  function choose(ids: string[]) {
    const allowed = new Set(choices.map((column) => column.id));
    setSelected((previous) => [...previous.filter((id) => !allowed.has(id)), ...ids]);
  }
  async function download() {
    if (active.current || !chosen.length) return;
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 30_000);
    active.current = { controller, timer };
    setPending(true);
    setError('');
    try {
      const file = await onDownload({ layout, columnIds: chosen, signal: controller.signal });
      if (active.current?.controller !== controller || controller.signal.aborted) return;
      const url = URL.createObjectURL(file.blob);
      try {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = file.fileName;
        anchor.click();
      } finally {
        URL.revokeObjectURL(url);
      }
      setOpen(false);
    } catch (error) {
      if (active.current?.controller === controller)
        setError(
          error instanceof StaleExportError
            ? error.message
            : timedOut
              ? 'Export took too long. Try again.'
              : 'Export failed. Please try again.',
        );
    } finally {
      clearTimeout(timer);
      if (active.current?.controller === controller) {
        active.current = null;
        setPending(false);
      }
    }
  }
  return (
    <div ref={setContainer}>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) cancel();
          else {
            onOpen?.();
            setSelected([...visibleColumnIds]);
            setLayout('table');
            setError('');
          }
          setOpen(next);
        }}
      >
        <DialogTrigger asChild>
          <Button type="button" variant="secondary">
            <ExportIcon size={14} />
            Export CSV
          </Button>
        </DialogTrigger>
        <ScrollableDialogContent container={container}>
          <DialogHeader className="text-left">
            <DialogTitle>{title} CSV export</DialogTitle>
            <DialogDescription>
              {description ?? (
                <>
                  Export all matching results with the current filters and sorting, beyond the
                  current page. Columns start with your table selection; changing them here only
                  affects this export.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <ScrollableDialogBody label="CSV export choices">
            {layouts.length > 0 && (
              <fieldset className={styles.layout} disabled={pending}>
                <legend>Layout</legend>
                <label>
                  <input
                    type="radio"
                    name="csv-layout"
                    checked={layout === 'table'}
                    onChange={() => setLayout('table')}
                  />
                  Current table
                </label>
                {layouts.map((item) => (
                  <label key={item.id}>
                    <input
                      type="radio"
                      name="csv-layout"
                      checked={layout === item.id}
                      onChange={() => setLayout(item.id)}
                    />
                    {item.label}
                  </label>
                ))}
              </fieldset>
            )}
            {alternative?.description && <p className={styles.note}>{alternative.description}</p>}
            <p className={styles.note}>
              Required identity fields, report context and coverage for selected metrics are
              included automatically.
            </p>
            <div className={styles.actions}>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  choose(
                    visibleColumnIds.filter((id) => choices.some((column) => column.id === id)),
                  )
                }
              >
                Visible columns
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => choose(choices.map((column) => column.id))}
              >
                All columns
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => choose([])}
              >
                Clear selection
              </Button>
              <span>{chosen.length} selected</span>
            </div>
            <ColumnSelection
              mode="form"
              columns={choices}
              selectedIds={chosen}
              disabled={pending}
              onChange={choose}
            />
          </ScrollableDialogBody>
          {error && (
            <Callout tone="error" as="p" role="alert">
              {error}
            </Callout>
          )}
          <DialogFooter className="gap-2 sm:space-x-0">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="primary"
              disabled={pending || !chosen.length}
              onClick={() => {
                void download();
              }}
            >
              {pending ? 'Preparing export…' : 'Download CSV'}
            </Button>
          </DialogFooter>
        </ScrollableDialogContent>
      </Dialog>
    </div>
  );
}
