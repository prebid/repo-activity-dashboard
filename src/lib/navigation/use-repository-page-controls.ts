'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { writeTableQuery } from '@/lib/presentation/table-query';
import { useSearchParams } from 'next/navigation';
import type { ColumnVisibility } from '@/components/tables/table-columns';
import type { RepositoryPageFilters, RepositoryPageSource } from '@/models/repository-page';
import {
  defaultRepositoryFilters,
  readRepositoryFilters,
  writeRepositoryFilters,
} from '@/lib/presentation/repository-page-query';
import {
  repositoryColumnDefaults,
  repositoryColumnsKey,
  readRepositoryColumns,
  serializeRepositoryColumns,
  resolveRepositoryColumns,
  writeRepositoryColumns,
} from '@/lib/presentation/repository-page-preferences';
import type { useTableController } from './use-table-controller';

export function useRepositoryPageControls(
  viewerId: string,
  source: RepositoryPageSource,
  columnIds: readonly string[],
  table: ReturnType<typeof useTableController>,
) {
  const search = useSearchParams().toString();
  const key = repositoryColumnsKey(viewerId, source.repository.id, source.kind);
  const [saved, setSaved] = useState<{ key: string; columns: Record<string, boolean> } | null>(
    null,
  );
  const [storageAvailable, setStorageAvailable] = useState(true);
  const defaults = useMemo(() => repositoryColumnDefaults(source), [source]);
  const filters = useMemo(() => readRepositoryFilters(search, source), [search, source]);
  const columns = resolveRepositoryColumns(
    search,
    source.kind,
    defaults,
    saved?.key === key ? saved.columns : {},
    columnIds,
  );
  useEffect(() => {
    try {
      setSaved({ key, columns: readRepositoryColumns(localStorage.getItem(key), columnIds) });
      setStorageAvailable(true);
    } catch {
      setSaved(null);
      setStorageAvailable(false);
    }
  }, [key, columnIds]);
  function remember(value: Record<string, boolean> | null) {
    setSaved(value ? { key, columns: value } : null);
    try {
      if (value) localStorage.setItem(key, serializeRepositoryColumns(value));
      else localStorage.removeItem(key);
      setStorageAvailable(true);
    } catch {
      setStorageAvailable(false);
    }
  }
  function changeColumns(value: Record<string, boolean>) {
    table.flushSearch();
    const url = new URL(window.location.href);
    url.search = writeRepositoryColumns(url.search, source.kind, columns, columnIds);
    if (url.href !== window.location.href) window.history.replaceState(null, '', url);
    url.search = writeRepositoryColumns(url.search, source.kind, value, columnIds);
    if (url.href !== window.location.href) window.history.pushState(null, '', url);
    // Save deliberate overrides only, so context-sensitive defaults still work on another cohort.
    const overrides = { ...(saved?.key === key ? saved.columns : {}) };
    for (const id of columnIds)
      if ((columns[id] !== false) !== (value[id] !== false)) overrides[id] = value[id] !== false;
    remember(overrides);
  }
  const updateFilters = useCallback(
    (value: RepositoryPageFilters) => {
      const captured = table.flushSearch();
      const url = new URL(window.location.href);
      url.search = writeRepositoryFilters(url.search, { ...value, search: captured.search });
      if (url.href !== window.location.href) window.history.pushState(null, '', url);
    },
    [table],
  );
  function clearFilters() {
    table.setSearch('');
    const url = new URL(window.location.href);
    url.search = writeRepositoryFilters(url.search, defaultRepositoryFilters(source.kind));
    if (url.href !== window.location.href) window.history.pushState(null, '', url);
  }
  function resetPresentation() {
    const captured = table.flushSearch();
    const url = new URL(window.location.href);
    url.search = writeTableQuery(url.search, source.kind, captured);
    url.search = writeRepositoryColumns(url.search, source.kind, columns, columnIds);
    if (url.href !== window.location.href) window.history.replaceState(null, '', url);
    url.search = writeTableQuery(url.search, source.kind, {
      sort: 'createdAt',
      descending: true,
      page: 1,
    });
    url.search = writeRepositoryColumns(url.search, source.kind, defaults, columnIds);
    if (url.href !== window.location.href) window.history.pushState(null, '', url);
    table.clearSavedSort();
    remember(null);
  }
  return {
    filters,
    updateFilters,
    clearFilters,
    resetPresentation,
    visibility: { value: columns, onChange: changeColumns } satisfies ColumnVisibility,
    storageAvailable: storageAvailable && table.storageAvailable,
  };
}
