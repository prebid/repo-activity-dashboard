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
import { SearchField } from '@/components/ui/search-field';
import { ScrollHintIcon } from '@/components/ui/icons';
import { DataLegend, type DataLegendMark } from '@/components/feedback/data-legend';
import { EmptyState, type EmptyStateKind } from '@/components/feedback/empty-state';
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
import { Pager } from './pager';
import {
  CsvExportDialog,
  type CsvExportAlternative,
  type CsvFile,
} from '@/components/exports/csv-export-dialog';
import { tableCsv } from '@/lib/presentation/csv-export';
import { cn } from '@/lib/utils';
import styles from './data-table.module.css';
import { tablePageSize } from '@/models/table-query';

/**
 * Where a table's search happens: `local` renders the toolbar field and filters the rows here,
 * `external` means the feature renders the field and supplies rows it already filtered by the
 * controller's query, and `none` means the table has no search.
 */
export type DataTableSearch = 'local' | 'external' | 'none';
/** The state an empty table shows in its body, under the header row. */
export interface DataTableEmpty {
  kind: EmptyStateKind;
  title: string;
  /** Replaces the hint to adjust the scope or search. */
  description?: React.ReactNode;
}
export interface DataTableProps<T> {
  title: string;
  disabled?: boolean;
  /** Defaults to "No matching items" when the search hides every row, otherwise "No items". */
  empty?: DataTableEmpty;
  search: DataTableSearch;
  /** Set while filters outside the table narrow `rows`, so the count says "matching". */
  filtered?: boolean;
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
  /** The feature's toolbar controls, between the search field and Columns. */
  controls?: React.ReactNode;
  /** The toolbar's last control; replaces the CSV dialog that `exportName` provides. */
  exportControl?: React.ReactNode;
  /** Panel content under the title row, such as a breakdown switch or a period window. */
  headerContent?: React.ReactNode;
  rowClassName?: (row: T) => string | undefined;
  /** A footer note after the count. */
  footerNote?: React.ReactNode;
  /** The value marks the table's cells show, explained by a DataLegend in the footer notes. */
  legend?: readonly DataLegendMark[];
  visibility?: ColumnVisibility;
  itemLabel?: CountLabels;
  /** Longest search a URL codec for this table accepts. */
  searchMaxLength?: number;
  pageSize?: number;
}
export function DataTable<T extends { id: string }>({
  title,
  disabled = false,
  empty,
  search,
  filtered = false,
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
  exportControl,
  headerContent,
  rowClassName,
  footerNote,
  legend = [],
  visibility,
  itemLabel = { singular: 'item', plural: 'items' },
  searchMaxLength,
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
  const localSearch = search === 'local';
  const matching = useMemo(
    () => selectTableRows(rows, valueColumns, query, localSearch),
    [rows, valueColumns, query, localSearch],
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
  // A count says "matching" only while a search or the caller's filters narrow it.
  const narrowed = filtered || (search !== 'none' && query.search !== '');
  const sortNote = valueColumns.find((column) => column.id === query.sort)?.sortNote;
  const emptyState: DataTableEmpty =
    empty ??
    (rows.length
      ? { kind: 'no-match', title: 'No matching items' }
      : { kind: 'empty', title: 'No items' });
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
    const fullRows = selectTableRows(rows, valueColumns, captured, localSearch);
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
          {localSearch && (
            <span className={styles.search}>
              <SearchField
                aria-label={'Search ' + title}
                placeholder="Find in table…"
                maxLength={searchMaxLength}
                value={controller.draftSearch}
                onChange={(event) => controller.setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    controller.flushSearch();
                  }
                }}
              />
            </span>
          )}
          {controls}
          {showColumnMenu && (
            <ColumnMenu
              columns={columnMenuColumns ?? columns}
              visibility={{ value: effectiveVisibility, onChange: changeVisibility }}
            />
          )}
          {exportControl ??
            (exportName ? (
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
            ) : null)}
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
          Scroll horizontally to see all columns <ScrollHintIcon size={14} />
        </p>
      )}
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
                  {visibleColumns.filter((column) => column.group).map((column) => header(column))}
                </tr>
              </>
            ) : (
              <tr>{visibleColumns.map((column) => header(column))}</tr>
            )}
          </thead>
          <tbody>
            {matching.length === 0 && (
              <tr className={styles.emptyRow}>
                <td colSpan={visibleColumns.length} className={styles.emptyCell}>
                  <div className={styles.emptyState}>
                    <EmptyState variant="embedded" kind={emptyState.kind} title={emptyState.title}>
                      {emptyState.description ??
                        (search === 'none'
                          ? 'Adjust the selected scope.'
                          : 'Adjust the selected scope or search.')}
                    </EmptyState>
                  </div>
                </td>
              </tr>
            )}
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className={rowClassName?.(row.original)}>
                {row.getVisibleCells().map((cell, index) => {
                  const column = visibleColumns[index];
                  const start = !!column.group && visibleColumns[index - 1]?.group !== column.group;
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
      <div className={styles.footer}>
        <div className={styles.summary}>
          <p className={styles.count} aria-live="polite">
            {resultCount.toLocaleString('en-US') +
              (narrowed ? ' matching ' : ' ') +
              countLabel(resultCount, itemLabel)}
          </p>
          {(sortNote || footerNote || legend.length > 0) && (
            <div className={styles.notes}>
              {sortNote && <p>{sortNote}</p>}
              {footerNote && <p>{footerNote}</p>}
              <DataLegend marks={legend} />
            </div>
          )}
        </div>
        <Pager
          label={title + ' pages'}
          page={page}
          pageCount={pageCount}
          disabled={!interactive}
          onPageChange={(next) => update({ page: next })}
        />
      </div>
    </section>
  );
}
