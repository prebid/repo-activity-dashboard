'use client';
import { useEffect, useMemo, useState } from 'react';
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
import { sameTableQuery, type TableQuery } from '@/lib/presentation/table-query';
import { useTableQuery } from './use-table-query';

const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
});
export interface DataColumn<T> {
  id: string;
  label: string;
  value: (row: T) => string | number | null;
  cell?: (row: T) => React.ReactNode;
}
interface Props<T> {
  title: string;
  rows: T[];
  columns: DataColumn<T>[];
  queryKey: string;
  initialSearch?: string;
  exportName?: string;
  viewerId?: string;
  paging?: {
    /** Query that produced rows and totalCount. Stale results are never relabeled. */
    query: TableQuery;
    totalCount: number;
    onQueryChange: (query: TableQuery) => void;
    onExport?: (query: Omit<TableQuery, 'page'>) => void | Promise<void>;
    pending?: boolean;
    error?: string;
    onRetry?: () => void;
  };
}
export function DataTable<T extends { id: string }>({
  title,
  rows,
  columns,
  queryKey,
  initialSearch = '',
  exportName,
  viewerId,
  paging,
}: Props<T>) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const columnIds = useMemo(() => columns.map((column) => column.id), [columns]);
  const { query, update } = useTableQuery({
    queryKey,
    columnIds,
    initialSearch,
    viewerId,
    onChange: paging?.onQueryChange,
  });
  const matching = useMemo(
    () =>
      paging
        ? rows
        : rows.filter((row) =>
            columns.some((column) =>
              String(column.value(row) ?? '')
                .toLocaleLowerCase('en')
                .includes(query.search.toLocaleLowerCase('en')),
            ),
          ),
    [paging, rows, columns, query.search],
  );
  if (
    paging &&
    (!Number.isSafeInteger(paging.totalCount) ||
      paging.totalCount < rows.length ||
      rows.length > 100)
  )
    throw new Error('Paged results require a valid total and at most 100 rows.');
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
  const resultCount = paging?.totalCount ?? matching.length;
  const pageCount = Math.max(1, Math.ceil(resultCount / 100));
  const current = !paging || sameTableQuery(query, paging.query);
  const correcting = current && query.page > pageCount;
  const waiting = Boolean(paging && (paging.pending || !current || correcting));
  const page = paging ? query.page : Math.min(query.page, pageCount);
  useEffect(() => {
    if (correcting && !paging?.pending && !paging?.error) update({ page: pageCount });
  }, [correcting, pageCount, paging?.pending, paging?.error, update]);
  const sorting = query.sort ? [{ id: query.sort, desc: query.descending }] : [];
  const pagination = { pageIndex: page - 1, pageSize: 100 };
  const table = useTable({
    features,
    columns: defs,
    data: matching,
    getRowId: (row) => row.id,
    state: { sorting, pagination },
    onSortingChange: () => {},
    onPaginationChange: () => {},
    autoResetPageIndex: false,
    manualPagination: Boolean(paging),
    manualSorting: Boolean(paging),
    rowCount: resultCount,
  });
  async function download() {
    setExporting(true);
    setExportError('');
    try {
      if (paging) {
        const { page: _page, ...scope } = query;
        await paging.onExport?.(scope);
        return;
      }
      const fullRows = table.getPrePaginatedRowModel().rows;
      const text = [
        columns.map((c) => csvCell(c.label)).join(','),
        ...fullRows.map((row) => columns.map((c) => csvCell(c.value(row.original))).join(',')),
      ].join('\r\n');
      const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8;' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = exportName ?? 'report.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }
  return (
    <section className="space-y-3" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            aria-label={'Search ' + title}
            placeholder="Search…"
            className="w-64"
            value={query.search}
            onChange={(e) => update({ search: e.target.value, page: 1 })}
          />
          <details className="relative">
            <summary className="cursor-pointer rounded-md border px-3 py-2">Columns</summary>
            <div className="absolute right-0 z-10 mt-2 min-w-56 space-y-2 rounded-md border bg-popover p-3 shadow-md">
              {columns.map((c) => {
                const column = table.getColumn(c.id);
                if (!column) throw new Error('Missing table column: ' + c.id);
                return (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={column.getIsVisible()}
                      disabled={column.getIsVisible() && table.getVisibleLeafColumns().length === 1}
                      onChange={(e) => column.toggleVisibility(e.target.checked)}
                    />
                    {c.label}
                  </label>
                );
              })}
            </div>
          </details>
          {(paging ? paging.onExport : exportName) && (
            <Button
              type="button"
              variant="outline"
              onClick={() => void download()}
              disabled={exporting || waiting || Boolean(paging?.error)}
              title="Export all columns and all matching rows"
            >
              {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
          )}
        </div>
      </div>
      {exportError && <p role="alert">{exportError}</p>}
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {waiting || paging?.error
          ? 'Waiting for matching items'
          : `${resultCount.toLocaleString('en-US')} matching items`}
      </p>
      {paging?.error ? (
        <PageState title="Unable to load items" onRetry={paging.onRetry}>
          {paging.error}
        </PageState>
      ) : waiting ? (
        <PageState title="Loading items" />
      ) : matching.length === 0 ? (
        <PageState title={rows.length ? 'No matching items' : 'No items'}>
          Adjust the selected scope or search.
        </PageState>
      ) : (
        <div className="overflow-auto rounded-lg border">
          <table className="w-full text-sm">
            <caption className="sr-only">{title}</caption>
            <thead className="bg-muted text-left">
              <tr>
                {columns
                  .filter((c) => table.getColumn(c.id)?.getIsVisible())
                  .map((c) => (
                    <th
                      key={c.id}
                      scope="col"
                      aria-sort={
                        query.sort === c.id
                          ? query.descending
                            ? 'descending'
                            : 'ascending'
                          : 'none'
                      }
                      className="whitespace-nowrap p-3"
                    >
                      <button
                        type="button"
                        className="rounded text-left font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                        onClick={() =>
                          update({
                            sort: c.id,
                            descending: query.sort === c.id ? !query.descending : false,
                            page: 1,
                          })
                        }
                      >
                        {c.label}
                        {query.sort === c.id ? (query.descending ? ' ↓' : ' ↑') : ''}
                      </button>
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/50">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="p-3 align-top">
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={waiting || Boolean(paging?.error) || page <= 1}
          onClick={() => update({ page: page - 1 })}
        >
          Previous
        </Button>
        <span className="text-sm" aria-live="polite">
          {waiting || paging?.error ? `Page ${page}` : `Page ${page} of ${pageCount}`}
        </span>
        <Button
          type="button"
          variant="outline"
          disabled={waiting || Boolean(paging?.error) || page >= pageCount}
          onClick={() => update({ page: page + 1 })}
        >
          Next
        </Button>
      </div>
    </section>
  );
}
