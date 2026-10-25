'use client';
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  preferenceKey,
  readTableQuery,
  writeTableQuery,
  type TableQuery,
} from '@/lib/presentation/table-query';

function subscribe(listener: () => void) {
  window.addEventListener('popstate', listener);
  return () => window.removeEventListener('popstate', listener);
}
const snapshot = () => window.location.search;
export function useTableQuery({
  queryKey,
  columnIds,
  initialSearch,
  viewerId,
  onChange,
}: {
  queryKey: string;
  columnIds: readonly string[];
  initialSearch: string;
  viewerId?: string;
  onChange?: (query: TableQuery) => void;
}) {
  const search = useSyncExternalStore(subscribe, snapshot, () => initialSearch);
  const query = useMemo(
    () => readTableQuery(search, queryKey, columnIds),
    [search, queryKey, columnIds],
  );
  const change = useRef(onChange);
  useEffect(() => {
    change.current = onChange;
  }, [onChange]);
  // Notify adapters for initial state, UI changes, and browser back/forward alike.
  // Callback identity changes alone must not create a request/render loop.
  useEffect(() => {
    change.current?.({
      search: query.search,
      sort: query.sort,
      descending: query.descending,
      page: query.page,
    });
  }, [query.search, query.sort, query.descending, query.page]);
  const update = useCallback(
    (patch: Partial<TableQuery>) => {
      const url = new URL(window.location.href);
      url.search = writeTableQuery(url.search, queryKey, patch);
      window.history.replaceState(window.history.state, '', url);
      window.dispatchEvent(new PopStateEvent('popstate'));
      if (viewerId && patch.sort !== undefined) {
        try {
          localStorage.setItem(
            preferenceKey(viewerId, queryKey),
            JSON.stringify({ sort: patch.sort, descending: patch.descending ?? false }),
          );
        } catch {
          /* A disabled store must not prevent URL-driven interaction. */
        }
      }
    },
    [queryKey, viewerId],
  );
  const restored = useRef('');
  useEffect(() => {
    const scope = JSON.stringify([viewerId, queryKey]);
    if (restored.current === scope) return;
    restored.current = scope;
    if (!viewerId || new URLSearchParams(window.location.search).has(queryKey + '.sort')) return;
    let stored: unknown;
    try {
      stored = JSON.parse(localStorage.getItem(preferenceKey(viewerId, queryKey)) ?? 'null');
    } catch {
      return; // Storage denial or invalid saved JSON must not block URL interaction.
    }
    if (!stored || typeof stored !== 'object' || !('sort' in stored) || !('descending' in stored))
      return;
    if (
      typeof stored.sort !== 'string' ||
      typeof stored.descending !== 'boolean' ||
      !columnIds.includes(stored.sort)
    )
      return;
    update({ sort: stored.sort, descending: stored.descending });
  }, [queryKey, columnIds, viewerId, update]);
  return { query, update };
}
