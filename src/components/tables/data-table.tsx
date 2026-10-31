'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useClientReady } from '@/lib/navigation/use-client-ready';
import {
  tableFeatures,
  useTable,
  rowPaginationFeature,
  columnVisibilityFeature,
  createPaginatedRowModel,
  type ColumnDef,
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageState } from '@/components/feedback/page-state';
import { countLabel, type CountLabels } from '@/lib/presentation/format';
import { selectTableRows } from '@/lib/presentation/table-rows';
import type { TableController } from '@/lib/presentation/table-controller';
import type { TableValueColumn } from '@/models/table-values';

const features = tableFeatures({
  rowPaginationFeature,
  columnVisibilityFeature,
  paginatedRowModel: createPaginatedRowModel(),
});
export type { DataColumn } from './table-columns';
import { columnSections, type ColumnVisibility, type DataColumn } from './table-columns';
import { ColumnMenu } from './column-menu';
import { ColumnDefinitions } from './column-definitions';
import {
  CsvExportDialog,
  type CsvExportAlternative,
  type CsvFile,
} from '@/components/exports/csv-export-dialog';
import { tableCsv } from '@/lib/presentation/csv-export';
import { cn } from '@/lib/utils';
import styles from './data-table.module.css';
import { tablePageSize } from '@/models/table-query';

export interface DataTableProps<T> {
  title: string;
  disabled?: boolean;
  emptyTitle?: string;
  rows: T[];
  columns: DataColumn<T>[];
  /** Full sortable/searchable axis when only a window of columns is rendered. */
  valueColumns?: readonly TableValueColumn<T>[];
  columnMenuColumns?: DataColumn<T>[];
  /** Some views control their columns through a dedicated axis/window control. */
  showColumnMenu?: boolean;
  controller: TableController;
  exportName?: string;
  /** Optional explicit CSV columns; never affects visible columns, search or sorting. */
  exportColumns?: DataColumn<T>[];
  csvAlternatives?: CsvExportAlternative[];
  csvDownload?: CsvExportAlternative['download'];
  exportContextKey?: string;
  description?: React.ReactNode;
  controls?: React.ReactNode;
  headerContent?: React.ReactNode;
  rowClassName?: (row: T) => string | undefined;
  footerNote?: React.ReactNode;
  visibility?: ColumnVisibility;
  itemLabel?: CountLabels;
  showSinglePageControls?: boolean;
  searchable?: boolean;
  pageSize?: number;
}
export function DataTable<T extends { id: string }>({
  title,
  disabled = false,
  emptyTitle,
  rows,
  columns,
  valueColumns = columns,
  columnMenuColumns,
  showColumnMenu = true,
  controller,
  exportName,
  exportColumns,
  csvAlternatives,
  csvDownload,
  exportContextKey,
  description,
  controls,
  headerContent,
  rowClassName,
  footerNote,
  visibility,
  itemLabel = { singular: 'item', plural: 'items' },
  showSinglePageControls = true,
  searchable = true,
  pageSize = tablePageSize,
}: DataTableProps<T>) {
  const ready = useClientReady();
  const interactive = ready && !disabled;
  const [localVisibility, setLocalVisibility] = useState<Record<string, boolean>>({});
  const id = useId();
  const scrollArea = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const effectiveVisibility = useMemo(
    () =>
      Object.fromEntries(
        columns.map((column) => [
          column.id,
          column.hideable === false || (visibility?.value ?? localVisibility)[column.id] !== false,
        ]),
      ),
    [columns, localVisibility, visibility?.value],
  );
  const visibleColumns = columns.filter((column) => effectiveVisibility[column.id]);
  const sections = columnSections(visibleColumns);
  const groupByColumn = Object.fromEntries(
    sections.flatMap((section, index) => section.columns.map((column) => [column.id, index])),
  );
  const grouped = visibleColumns.some((column) => column.group);
  const pinned = visibleColumns.some((column) => column.pinned);
  const sized = visibleColumns.some((column) => column.width);
  const minimumWidth = visibleColumns.reduce(
    (sum, column) => sum + (column.pinned ? 0 : (column.width ?? 140)),
    0,
  );
  const changeVisibility = (value: Record<string, boolean>) => {
    if (visibility) visibility.onChange(value);
    else setLocalVisibility(value);
  };
  const { query, update, reconcilePage } = controller;
  const matching = useMemo(
    () => selectTableRows(rows, valueColumns, query, searchable),
    [rows, valueColumns, query, searchable],
  );
  const defs = useMemo<ColumnDef<typeof features, T>[]>(
    () =>
      columns.map((column) => ({
        id: column.id,
        header: column.label,
        accessorFn: (row: T) => column.value(row) ?? undefined,
      })),
    [columns],
  );
  const resultCount = matching.length;
  useEffect(() => {
    const node = scrollArea.current;
    const measure = () => setOverflows(!!node && node.scrollWidth > node.clientWidth + 1);
    let frame: number | undefined;
    // Keep React/layout writes outside ResizeObserver delivery (notably after filters change row counts).
    const schedule = () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = undefined;
        measure();
      });
    };
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    if (node) observer?.observe(node);
    window.addEventListener('resize', schedule);
    return () => {
      observer?.disconnect();
      if (frame !== undefined) cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
    };
  }, [columns, effectiveVisibility, resultCount]);
  const rowsPerPage =
    Number.isSafeInteger(pageSize) && pageSize > 0
      ? Math.min(pageSize, tablePageSize)
      : tablePageSize;
  const pageCount = Math.max(1, Math.ceil(resultCount / rowsPerPage));
  const page = Math.min(query.page, pageCount);
  useEffect(() => {
    if (query.page > pageCount) reconcilePage(pageCount);
  }, [query.page, pageCount, reconcilePage]);
  const pagination = { pageIndex: page - 1, pageSize: rowsPerPage };
  const table = useTable({
    features,
    columns: defs,
    data: matching,
    getRowId: (row) => row.id,
    state: { pagination, columnVisibility: effectiveVisibility },
    onPaginationChange: () => {},
    autoResetPageIndex: false,
    rowCount: resultCount,
  });
  function download({
    layout,
    columnIds,
    signal,
  }: {
    layout: string;
    columnIds: string[];
    signal: AbortSignal;
  }): CsvFile | Promise<CsvFile> {
    const captured = controller.flushSearch();
    const alternative = csvAlternatives?.find((item) => item.id === layout);
    if (layout !== 'table') {
      if (!alternative) throw Error('Unknown CSV layout');
      return alternative.download({ columnIds, query: captured, signal });
    }
    if (csvDownload) return csvDownload({ columnIds, query: captured, signal });
    const fullRows = selectTableRows(rows, valueColumns, captured, searchable);
    const text = tableCsv(
      fullRows,
      exportColumns ?? columns,
      columns.map((column) => column.id),
      columnIds,
    );
    return { blob: new Blob([text], { type: 'text/csv;charset=utf-8;' }), fileName: exportName! };
  }
  function header(column: DataColumn<T>, rowSpan = 1) {
    const index = visibleColumns.indexOf(column);
    const start = !!column.group && visibleColumns[index - 1]?.group !== column.group;
    return (
      <th
        key={column.id}
        id={id + '-' + column.id}
        scope="col"
        rowSpan={rowSpan}
        aria-sort={
          query.sort === column.id ? (query.descending ? 'descending' : 'ascending') : 'none'
        }
        className={cn(
          column.pinned && styles.pinned,
          column.align === 'right' && styles.numeric,
          start && styles.groupStart,
        )}
      >
        <button
          type="button"
          disabled={!interactive}
          className={styles.sort}
          title={column.description}
          aria-describedby={column.description ? id + '-description-' + column.id : undefined}
          onClick={() =>
            update({
              sort: column.id,
              descending: query.sort === column.id ? !query.descending : false,
              page: 1,
            })
          }
        >
          {column.label}
          {query.sort === column.id ? (query.descending ? ' ↓' : ' ↑') : ''}
        </button>
      </th>
    );
  }
  return (
    <section className={styles.panel} aria-label={title}>
      <div className={styles.heading}>
        <div>
          <div className={styles.titleRow}>
            <h2 className={styles.title}>{title}</h2>
            <ColumnDefinitions title={title} columns={visibleColumns} disabled={!interactive} />
          </div>
          {description && <div className={styles.description}>{description}</div>}
        </div>
        <fieldset
          className={styles.controls}
          disabled={!interactive}
          aria-label={title + ' table controls'}
        >
          {controls}
          {searchable && (
            <Input
              aria-label={'Search ' + title}
              placeholder="Find in table…"
              className={styles.search}
              value={controller.draftSearch}
              onChange={(event) => controller.setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  controller.flushSearch();
                }
              }}
            />
          )}
          {showColumnMenu && (
            <ColumnMenu
              columns={columnMenuColumns ?? columns}
              visibility={{ value: effectiveVisibility, onChange: changeVisibility }}
            />
          )}
          {exportName && (
            <CsvExportDialog
              title={title}
              columns={columns.map((column) => ({
                id: column.id,
                label: column.label,
                group: column.group,
                selectionGroup: column.selectionGroup,
                selectionSection: column.selectionSection,
                description: column.description,
                required: column.hideable === false,
              }))}
              visibleColumnIds={visibleColumns.map((column) => column.id)}
              contextKey={exportContextKey ?? controller.scopeKey}
              layouts={csvAlternatives}
              onOpen={() => {
                controller.flushSearch();
              }}
              onDownload={download}
            />
          )}
        </fieldset>
      </div>
      {headerContent && <div className={styles.headerContent}>{headerContent}</div>}
      <div hidden>
        {columns
          .filter((column) => column.description)
          .map((column) => (
            <span key={column.id} id={id + '-description-' + column.id}>
              {column.description}
            </span>
          ))}
      </div>
      {overflows && (
        <p id={id + '-scroll-hint'} className={styles.scrollHint}>
          Scroll horizontally to see all columns <span aria-hidden="true">→</span>
        </p>
      )}
      {matching.length === 0 ? (
        <div className={styles.empty}>
          <PageState title={emptyTitle ?? (rows.length ? 'No matching items' : 'No items')}>
            {searchable ? 'Adjust the selected scope or search.' : 'Adjust the selected scope.'}
          </PageState>
        </div>
      ) : (
        <div
          className={styles.scroll}
          ref={scrollArea}
          role="region"
          aria-label={title + ' table scroll area'}
          aria-describedby={overflows ? id + '-scroll-hint' : undefined}
          tabIndex={0}
        >
          <table
            className={styles.table}
            style={
              sized
                ? {
                    tableLayout: 'fixed',
                    minWidth: pinned
                      ? 'calc(' + minimumWidth + 'px + var(--pinned-width))'
                      : minimumWidth,
                  }
                : undefined
            }
          >
            <caption className="sr-only">{title}</caption>
            {sections.map((section, index) => (
              <colgroup key={index}>
                {section.columns.map((column) => (
                  <col
                    key={column.id}
                    style={{
                      width: column.pinned
                        ? 'var(--pinned-width)'
                        : column.width === undefined
                          ? undefined
                          : `var(--table-column-width, ${column.width}px)`,
                    }}
                  />
                ))}
              </colgroup>
            ))}
            <thead>
              {grouped ? (
                <>
                  <tr>
                    {sections.map((section, index) =>
                      section.label ? (
                        <th
                          key={index}
                          scope="colgroup"
                          id={id + '-group-' + index}
                          colSpan={section.columns.length}
                          className={cn(styles.group, styles.groupStart)}
                        >
                          {section.label}
                        </th>
                      ) : (
                        section.columns.map((column) => header(column, 2))
                      ),
                    )}
                  </tr>
                  <tr>
                    {visibleColumns
                      .filter((column) => column.group)
                      .map((column) => header(column))}
                  </tr>
                </>
              ) : (
                <tr>{visibleColumns.map((column) => header(column))}</tr>
              )}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className={rowClassName?.(row.original)}>
                  {row.getVisibleCells().map((cell, index) => {
                    const column = visibleColumns[index];
                    const start =
                      !!column.group && visibleColumns[index - 1]?.group !== column.group;
                    return (
                      <td
                        key={cell.id}
                        headers={
                          (column.group ? id + '-group-' + groupByColumn[column.id] + ' ' : '') +
                          id +
                          '-' +
                          column.id
                        }
                        data-column={column.id}
                        className={cn(
                          column.pinned && styles.pinned,
                          column.align === 'right' && styles.numeric,
                          start && styles.groupStart,
                        )}
                      >
                        {column.cell
                          ? column.cell(row.original)
                          : String(column.value(row.original) ?? '—')}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className={styles.footer}>
        <span aria-live="polite">
          {resultCount.toLocaleString('en-US') +
            (searchable ? ' matching ' : ' ') +
            countLabel(resultCount, itemLabel)}
        </span>
        {valueColumns.find((column) => column.id === query.sort)?.sortNote && (
          <span>{valueColumns.find((column) => column.id === query.sort)?.sortNote}</span>
        )}
        {footerNote && <span>{footerNote}</span>}
        {(showSinglePageControls || pageCount > 1) && (
          <div className={styles.pages}>
            <Button
              type="button"
              variant="outline"
              disabled={!interactive || page <= 1}
              onClick={() => update({ page: page - 1 })}
            >
              Previous
            </Button>
            <span aria-live="polite">{'Page ' + page + ' of ' + pageCount}</span>
            <Button
              type="button"
              variant="outline"
              disabled={!interactive || page >= pageCount}
              onClick={() => update({ page: page + 1 })}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
