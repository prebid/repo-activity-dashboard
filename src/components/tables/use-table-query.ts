'use client';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
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
  const query = readTableQuery(search, queryKey, columnIds);
  const update = useCallback(
    (patch: Partial<TableQuery>) => {
      const url = new URL(window.location.href);
      url.search = writeTableQuery(url.search, queryKey, patch);
      window.history.replaceState(null, '', url);
      window.dispatchEvent(new PopStateEvent('popstate'));
      onChange?.(readTableQuery(url.search, queryKey, columnIds));
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
    [queryKey, columnIds, viewerId, onChange],
  );
  useEffect(() => {
    if (!viewerId || new URLSearchParams(window.location.search).has(queryKey + '.sort')) return;
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem(preferenceKey(viewerId, queryKey)) ?? 'null',
      );
      if (!stored || typeof stored !== 'object' || !('sort' in stored) || !('descending' in stored))
        return;
      if (
        typeof stored.sort !== 'string' ||
        typeof stored.descending !== 'boolean' ||
        !columnIds.includes(stored.sort)
      )
        return;
      update({ sort: stored.sort, descending: stored.descending });
    } catch {
      /* Invalid saved preferences do not block rendering. */
    }
  }, [queryKey, columnIds, viewerId, update]);
  return { query, update };
}
