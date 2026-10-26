'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DataTable, type DataTableProps } from './data-table';
import { initialTableQuery, type TableController } from '@/lib/presentation/table-controller';
import type { TableQuery } from '@/lib/presentation/table-query';
export function useLocalTableController(
  initial: TableQuery = initialTableQuery,
  onChange?: (query: TableQuery) => void,
): TableController {
  const [query, setQuery] = useState(initial);
  const notify = useRef(onChange);
  useEffect(() => {
    notify.current = onChange;
  }, [onChange]);
  useEffect(() => {
    notify.current?.(query);
  }, [query]);
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
  onQueryChange,
  ...props
}: Omit<DataTableProps<T>, 'controller'> & {
  initialQuery?: TableQuery;
  onQueryChange?: (query: TableQuery) => void;
}) {
  const controller = useLocalTableController(initialQuery, onQueryChange);
  return <DataTable {...props} controller={controller} />;
}
