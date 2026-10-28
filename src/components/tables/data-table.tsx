'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  tableFeatures,
  useTable,
  rowSortingFeature,
  rowPaginationFeature,
  columnVisibilityFeature,
  createSortedRowModel,
  createPaginatedRowModel,
  type ColumnDef,
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageState } from '@/components/feedback/page-state';
import { compareValues, csvCell } from '@/lib/presentation/format';
import type { TableController } from '@/lib/presentation/table-controller';

const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
});
export type { DataColumn } from './table-columns';
import { columnSections, type ColumnVisibility, type DataColumn } from './table-columns';
import { ColumnMenu } from './column-menu';
import { cn } from '@/lib/utils';
import styles from './data-table.module.css';
export interface DataTableProps<T> {
  title: string;
  rows: T[];
  columns: DataColumn<T>[];
  controller: TableController;
  exportName?: string;
  description?: React.ReactNode;
  footerNote?: React.ReactNode;
  visibility?: ColumnVisibility;
  itemLabel?: string;
  showSinglePageControls?: boolean;
}
function filterRows<T>(rows: T[], columns: DataColumn<T>[], search: string): T[] {
  return rows.filter((row) =>
    columns.some((column) =>
      String(column.value(row) ?? '')
        .toLocaleLowerCase('en')
        .includes(search.toLocaleLowerCase('en')),
    ),
  );
}
export function DataTable<T extends { id: string }>({
  title,
  rows,
  columns,
  controller,
  exportName,
  description,
  footerNote,
  visibility,
  itemLabel = 'items',
  showSinglePageControls = true,
}: DataTableProps<T>) {
  const [exportError, setExportError] = useState('');
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
    () => filterRows(rows, columns, query.search),
    [rows, columns, query.search],
  );
  const defs = useMemo<ColumnDef<typeof features, T>[]>(
    () =>
      columns.map((column) => ({
        id: column.id,
        header: column.label,
        accessorFn: (row: T) => column.value(row) ?? undefined,
        sortUndefined: 'last',
        sortFn: (a, b) => compareValues(column.value(a.original), column.value(b.original), 'asc'),
        cell: ({ row }) =>
          column.cell ? column.cell(row.original) : String(column.value(row.original) ?? '—'),
      })),
    [columns],
  );
  const resultCount = matching.length;
  useEffect(() => {
    const node = scrollArea.current;
    const measure = () => setOverflows(!!node && node.scrollWidth > node.clientWidth + 1);
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    if (node) observer?.observe(node);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [columns, effectiveVisibility, resultCount]);
  const pageCount = Math.max(1, Math.ceil(resultCount / 100));
  const page = Math.min(query.page, pageCount);
  useEffect(() => {
    if (query.page > pageCount) reconcilePage(pageCount);
  }, [query.page, pageCount, reconcilePage]);
  const sorting = query.sort ? [{ id: query.sort, desc: query.descending }] : [];
  const pagination = { pageIndex: page - 1, pageSize: 100 };
  const table = useTable({
    features,
    columns: defs,
    data: matching,
    getRowId: (row) => row.id,
    state: { sorting, pagination, columnVisibility: effectiveVisibility },
    onSortingChange: () => {},
    onPaginationChange: () => {},
    autoResetPageIndex: false,
    rowCount: resultCount,
  });
  function download() {
    setExportError('');
    try {
      const captured = controller.flushSearch();
      const sortedBy = columns.find((column) => column.id === captured.sort);
      const fullRows = filterRows(rows, columns, captured.search).sort((a, b) =>
        sortedBy
          ? compareValues(
              sortedBy.value(a),
              sortedBy.value(b),
              captured.descending ? 'desc' : 'asc',
            )
          : 0,
      );
      const text = [
        columns.map((c) => csvCell(c.label)).join(','),
        ...fullRows.map((row) => columns.map((c) => csvCell(c.value(row))).join(',')),
      ].join('\r\n');
      const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8;' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = exportName ?? 'report.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError('Export failed. Please try again.');
    }
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
          <h2 className={styles.title}>{title}</h2>
          {description && <div className={styles.description}>{description}</div>}
        </div>
        <div className={styles.controls}>
          <Input
            aria-label={'Search ' + title}
            placeholder="Find in table…"
            className={styles.search}
            value={controller.draftSearch}
            onChange={(event) => controller.setSearch(event.target.value)}
            onBlur={() => controller.flushSearch()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                controller.flushSearch();
              }
            }}
          />
          <ColumnMenu
            columns={columns}
            visibility={{ value: effectiveVisibility, onChange: changeVisibility }}
          />
          {exportName && (
            <Button
              type="button"
              variant="outline"
              onClick={download}
              title="Export all columns and all matching rows"
            >
              Export CSV
            </Button>
          )}
        </div>
      </div>
      {exportError && (
        <p role="alert" className={styles.error}>
          {exportError}
        </p>
      )}
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
          <PageState title={rows.length ? 'No matching items' : 'No items'}>
            Adjust the selected scope or search.
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
                    style={{ width: column.pinned ? 'var(--pinned-width)' : column.width }}
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
                <tr key={row.id}>
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
                        <table.FlexRender cell={cell} />
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
          {resultCount.toLocaleString('en-US') + ' matching ' + itemLabel}
        </span>
        {footerNote && <span>{footerNote}</span>}
        {(showSinglePageControls || pageCount > 1) && (
          <div className={styles.pages}>
            <Button
              type="button"
              variant="outline"
              disabled={page <= 1}
              onClick={() => update({ page: page - 1 })}
            >
              Previous
            </Button>
            <span aria-live="polite">{'Page ' + page + ' of ' + pageCount}</span>
            <Button
              type="button"
              variant="outline"
              disabled={page >= pageCount}
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
