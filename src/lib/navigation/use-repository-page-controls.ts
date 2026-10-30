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
  readRepositoryCharts,
  serializeRepositoryColumns,
} from '@/lib/presentation/repository-page-preferences';
import {
  readTableColumns,
  resolveTableColumns,
  writeTableColumns,
} from '@/lib/presentation/table-column-preferences';
import type { useTableController } from './use-table-controller';

export function useRepositoryPageControls(
  viewerId: string,
  source: RepositoryPageSource,
  columnIds: readonly string[],
  table: ReturnType<typeof useTableController>,
) {
  const search = useSearchParams().toString();
  const key = repositoryColumnsKey(viewerId, source.repository.id, source.kind);
  const [saved, setSaved] = useState<{
    key: string;
    columns: Record<string, boolean>;
    chartsVisible: boolean;
  } | null>(null);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const defaults = useMemo(() => repositoryColumnDefaults(source), [source]);
  const filters = useMemo(() => readRepositoryFilters(search, source), [search, source]);
  const columns = resolveTableColumns(
    search,
    source.kind,
    defaults,
    saved?.key === key ? saved.columns : {},
    columnIds,
  );
  const chartParam = new URLSearchParams(search).get(source.kind + '.charts');
  const chartsVisible =
    chartParam === null ? (saved?.key === key ? saved.chartsVisible : false) : chartParam !== '0';
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      setSaved({
        key,
        columns: readTableColumns(raw, columnIds),
        chartsVisible: readRepositoryCharts(raw),
      });
      setStorageAvailable(true);
    } catch {
      setSaved(null);
      setStorageAvailable(false);
    }
  }, [key, columnIds]);
  function remember(value: Record<string, boolean> | null, showCharts = chartsVisible) {
    setSaved(value ? { key, columns: value, chartsVisible: showCharts } : null);
    try {
      if (value) localStorage.setItem(key, serializeRepositoryColumns(value, showCharts));
      else localStorage.removeItem(key);
      setStorageAvailable(true);
    } catch {
      setStorageAvailable(false);
    }
  }
  function changeColumns(value: Record<string, boolean>) {
    table.flushSearch();
    const url = new URL(window.location.href);
    url.search = writeTableColumns(url.search, source.kind, columns, columnIds);
    if (url.href !== window.location.href) window.history.replaceState(null, '', url);
    url.search = writeTableColumns(url.search, source.kind, value, columnIds);
    if (url.href !== window.location.href) window.history.pushState(null, '', url);
    // Save deliberate overrides only, so context-sensitive defaults still work on another cohort.
    const overrides = { ...(saved?.key === key ? saved.columns : {}) };
    for (const id of columnIds)
      if ((columns[id] !== false) !== (value[id] !== false)) overrides[id] = value[id] !== false;
    remember(overrides);
  }
  function changeCharts(show: boolean) {
    table.flushSearch();
    const url = new URL(window.location.href);
    url.searchParams.set(source.kind + '.charts', chartsVisible ? '1' : '0');
    if (url.href !== window.location.href) window.history.replaceState(null, '', url);
    url.searchParams.set(source.kind + '.charts', show ? '1' : '0');
    if (url.href !== window.location.href) window.history.pushState(null, '', url);
    remember(saved?.key === key ? saved.columns : {}, show);
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
    url.searchParams.set(source.kind + '.charts', chartsVisible ? '1' : '0');
    url.search = writeTableColumns(url.search, source.kind, columns, columnIds);
    if (url.href !== window.location.href) window.history.replaceState(null, '', url);
    url.search = writeTableQuery(url.search, source.kind, {
      sort: 'createdAt',
      descending: true,
      page: 1,
    });
    url.search = writeTableColumns(url.search, source.kind, defaults, columnIds);
    url.searchParams.set(source.kind + '.charts', '0');
    if (url.href !== window.location.href) window.history.pushState(null, '', url);
    table.clearSavedSort();
    remember(null);
  }
  return {
    filters,
    chartsVisible,
    changeCharts,
    updateFilters,
    clearFilters,
    resetPresentation,
    visibility: { value: columns, onChange: changeColumns } satisfies ColumnVisibility,
    storageAvailable: storageAvailable && table.storageAvailable,
  };
}
