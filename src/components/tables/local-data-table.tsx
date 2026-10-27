'use client';
import { useCallback, useState } from 'react';
import { DataTable, type DataTableProps } from './data-table';
import { initialTableQuery, type TableController } from '@/lib/presentation/table-controller';
import type { TableQuery } from '@/lib/presentation/table-query';
export function useLocalTableController(initial: TableQuery = initialTableQuery): TableController {
  const [query, setQuery] = useState(initial);
  const update = useCallback(
    (patch: Partial<TableQuery>) => setQuery((value) => ({ ...value, ...patch })),
    [],
  );
  return {
    scopeKey: 'local',
    query,
    draftSearch: query.search,
    setSearch: (value) => update({ search: value, page: 1 }),
    update,
    flushSearch: () => query,
    reconcilePage: (page) => update({ page }),
  };
}
export function LocalDataTable<T extends { id: string }>({
  initialQuery,
  ...props
}: Omit<DataTableProps<T>, 'controller'> & {
  initialQuery?: TableQuery;
}) {
  const controller = useLocalTableController(initialQuery);
  return <DataTable {...props} controller={controller} />;
}
