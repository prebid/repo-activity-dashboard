'use client';
import { useCallback, useMemo, useRef, useState } from 'react';
import { writeTableQuery } from '@/lib/presentation/table-query';
import { useSearchParams } from 'next/navigation';
import type { ColumnVisibility } from '@/components/tables/table-columns';
import type { RepositoryPageFilters, RepositoryPageSource } from '@/models/repository-page';
import type { SavedPreference } from '@/models/preferences';
import {
  defaultRepositoryFilters,
  readRepositoryFilters,
  writeRepositoryFilters,
} from '@/lib/presentation/repository-page-query';
import {
  repositoryColumnDefaults,
  repositoryColumnsKey,
  readRepositoryPresentation,
  serializeRepositoryColumns,
  type RepositoryPresentation,
} from '@/lib/presentation/repository-page-preferences';
import {
  resolveTableColumns,
  writeTableColumns,
} from '@/lib/presentation/table-column-preferences';
import type { useTableController } from './use-table-controller';
import { readPreference, usePreferenceCookie } from './use-preference-cookie';

/**
 * Record-list filters, columns and charts. Filters live in the URL only. Columns and charts start
 * from the server-validated `saved` value of this list kind, shared by every repository; a
 * deliberate change saves only the field it changed. Without `saved`, changes last for this page.
 */
export function useRepositoryPageControls(
  viewerId: string,
  source: RepositoryPageSource,
  columnIds: readonly string[],
  table: ReturnType<typeof useTableController>,
  saved?: SavedPreference<RepositoryPresentation>,
) {
  const search = useSearchParams().toString();
  const { write, storageAvailable } = usePreferenceCookie(saved, {
    keys: [repositoryColumnsKey(viewerId, source.repository.id, source.kind)],
    read: (raw) => {
      const value = readRepositoryPresentation(raw, columnIds);
      return value && (JSON.parse(serializePresentation(value)) as unknown);
    },
  });
  // Choices this page saved or reset, per viewer and list kind; until then the saved value applies.
  const owner = viewerId + ':' + source.kind;
  const [changed, setChanged] = useState<{
    owner: string;
    value: RepositoryPresentation | null;
  } | null>(null);
  const current = changed?.owner === owner ? changed.value : (saved?.value ?? null);
  // Choices for columns this list lacks stay saved for the lists that have them.
  const savedColumns = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(current?.columns ?? {}).filter(([id]) => columnIds.includes(id)),
      ),
    [current, columnIds],
  );
  // Once the browser refuses the cookie, the choices saved in this page are only in memory.
  const persisted = useRef(true);
  const defaults = useMemo(() => repositoryColumnDefaults(source), [source]);
  const filters = useMemo(() => readRepositoryFilters(search, source), [search, source]);
  const columns = resolveTableColumns(search, source.kind, defaults, savedColumns, columnIds);
  const chartParam = new URLSearchParams(search).get(source.kind + '.charts');
  const chartsVisible =
    chartParam === null ? (current?.chartsVisible ?? false) : chartParam !== '0';
  /** The saved choices a change applies to: the live cookie, so another tab's field survives. */
  function prior(): RepositoryPresentation {
    const value =
      saved && persisted.current
        ? readRepositoryPresentation(readPreference(saved.binding, saved.section), columnIds)
        : current;
    return value ?? { columns: {}, chartsVisible: false };
  }
  function remember(value: RepositoryPresentation | null) {
    setChanged({ owner, value });
    const result = write(value && (JSON.parse(serializePresentation(value)) as unknown));
    if (result && result.status !== 'too-large') persisted.current = result.status === 'saved';
  }
  function changeColumns(value: Record<string, boolean>) {
    table.flushSearch();
    const url = new URL(window.location.href);
    url.search = writeTableColumns(url.search, source.kind, columns, columnIds);
    if (url.href !== window.location.href) window.history.replaceState(null, '', url);
    url.search = writeTableColumns(url.search, source.kind, value, columnIds);
    if (url.href !== window.location.href) window.history.pushState(null, '', url);
    // Save deliberate overrides only, so context-sensitive defaults still work on another cohort.
    const saving = prior();
    const overrides = { ...saving.columns };
    for (const id of columnIds)
      if ((columns[id] !== false) !== (value[id] !== false)) overrides[id] = value[id] !== false;
    remember({ ...saving, columns: overrides });
  }
  function changeCharts(show: boolean) {
    table.flushSearch();
    const url = new URL(window.location.href);
    url.searchParams.set(source.kind + '.charts', chartsVisible ? '1' : '0');
    if (url.href !== window.location.href) window.history.replaceState(null, '', url);
    url.searchParams.set(source.kind + '.charts', show ? '1' : '0');
    if (url.href !== window.location.href) window.history.pushState(null, '', url);
    remember({ ...prior(), chartsVisible: show });
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

function serializePresentation(value: RepositoryPresentation) {
  return serializeRepositoryColumns(value.columns, value.chartsVisible);
}
