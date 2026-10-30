'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  preferenceKey,
  tableLocationStamp,
  readSavedTableSort,
  effectiveTableQuery,
  writeTableQuery,
} from '@/lib/presentation/table-query';
import { type TableQuery } from '@/models/table-query';
import type { TableController } from '@/lib/presentation/table-controller';
const noPeers: readonly string[] = [];
export function useTableController({
  queryKey,
  columnIds,
  scopeKey,
  legacyScopeKey,
  viewerId,
  peerQueryKeys = noPeers,
  defaultSort,
  historyMode = 'replace',
}: {
  historyMode?: 'push' | 'replace';
  queryKey: string;
  columnIds: readonly string[];
  scopeKey?: string;
  /** One-time migration from a formerly narrower scope; other accounts/reports are untouched. */
  legacyScopeKey?: string;
  viewerId?: string;
  peerQueryKeys?: readonly string[];
  defaultSort?: Pick<TableQuery, 'sort' | 'descending'>;
}): TableController & { clearSavedSort: () => void; storageAvailable: boolean } {
  const pathname = usePathname(),
    search = useSearchParams().toString();
  const scope = JSON.stringify([scopeKey ?? pathname, queryKey, viewerId]);
  const stamp = tableLocationStamp(pathname, search, peerQueryKeys);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [draft, setDraft] = useState<{ scope: string; stamp: string; value: string } | null>(null);
  const [saved, setSaved] = useState<{ scope: string; sort: string; descending: boolean } | null>(
    null,
  );
  const [correction, setCorrection] = useState<{
    scope: string;
    stamp: string;
    page: number;
  } | null>(null);
  const searchEntry = useRef<{ scope: string; href: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const query = useMemo(
    () =>
      effectiveTableQuery(
        search,
        queryKey,
        columnIds,
        saved?.scope === scope ? saved : defaultSort,
        correction?.scope === scope && correction.stamp === stamp ? correction.page : undefined,
      ),
    [search, queryKey, columnIds, saved, correction, scope, stamp, defaultSort],
  );
  const draftSearch = draft?.scope === scope && draft.stamp === stamp ? draft.value : query.search;
  const cancel = useCallback(() => {
    searchEntry.current = null;
    clearTimeout(timer.current);
    setDraft(null);
  }, []);
  const commit = useCallback(
    (patch: Partial<TableQuery>, explicitSearch?: string): TableQuery => {
      clearTimeout(timer.current);
      const url = new URL(window.location.href);
      const currentStamp = tableLocationStamp(url.pathname, url.search, peerQueryKeys);
      const current = effectiveTableQuery(
        url.search,
        queryKey,
        columnIds,
        saved?.scope === scope ? saved : defaultSort,
        correction?.scope === scope && correction.stamp === currentStamp
          ? correction.page
          : undefined,
      );
      const pending =
        explicitSearch ??
        (draft?.scope === scope && draft.stamp === currentStamp ? draft.value : current.search);
      const dirty = pending !== current.search;
      if (!dirty && Object.keys(patch).length === 0) {
        setDraft(null);
        return current;
      }
      const next = { ...current, ...patch, search: patch.search ?? pending };
      if (dirty || (patch.search !== undefined && patch.search !== current.search)) next.page = 1;
      const searchOnly =
        (dirty || patch.search !== undefined) &&
        Object.keys(patch).every((key) => key === 'search' || key === 'page') &&
        (patch.page === undefined || patch.page === 1);
      const replaceSearch =
        historyMode === 'push' &&
        searchOnly &&
        searchEntry.current?.scope === scope &&
        searchEntry.current.href === url.href;
      if (historyMode === 'push' && !replaceSearch) {
        // Freeze saved defaults in the previous entry before they can change.
        url.search = writeTableQuery(url.search, queryKey, current);
        if (url.href !== window.location.href) window.history.replaceState(null, '', url);
      }
      url.search = writeTableQuery(url.search, queryKey, next);
      if (url.href !== window.location.href) {
        if (historyMode === 'push' && !replaceSearch) window.history.pushState(null, '', url);
        else window.history.replaceState(null, '', url);
      }
      searchEntry.current = historyMode === 'push' && searchOnly ? { scope, href: url.href } : null;
      setDraft(null);
      setCorrection(null);
      if (viewerId && patch.sort !== undefined) {
        setSaved({ scope, sort: next.sort, descending: next.descending });
        try {
          localStorage.setItem(
            preferenceKey(viewerId, scopeKey ?? pathname),
            JSON.stringify({ sort: next.sort, descending: next.descending }),
          );
          setStorageAvailable(true);
        } catch {
          setStorageAvailable(false);
        }
      }
      return next;
    },
    [
      queryKey,
      columnIds,
      saved,
      scope,
      correction,
      draft,
      viewerId,
      scopeKey,
      pathname,
      peerQueryKeys,
      defaultSort,
      historyMode,
    ],
  );
  useEffect(() => {
    searchEntry.current = null;
  }, [scope]);
  useEffect(() => {
    if (!viewerId) return;
    let restored: ReturnType<typeof readSavedTableSort> | undefined;
    try {
      const key = preferenceKey(viewerId, scopeKey ?? pathname);
      const raw = localStorage.getItem(key);
      restored = readSavedTableSort(raw, columnIds);
      const legacyKey = legacyScopeKey ? preferenceKey(viewerId, legacyScopeKey) : undefined;
      if (!raw && legacyKey && legacyKey !== key) {
        restored = readSavedTableSort(localStorage.getItem(legacyKey), columnIds);
        if (restored) localStorage.setItem(key, JSON.stringify(restored));
      }
      if (legacyKey && legacyKey !== key && restored) localStorage.removeItem(legacyKey);
      setStorageAvailable(true);
    } catch {
      setStorageAvailable(false);
    }
    if (restored !== undefined) {
      const value = restored;
      setSaved((previous) =>
        value
          ? previous?.scope === scope &&
            previous.sort === value.sort &&
            previous.descending === value.descending
            ? previous
            : { scope, ...value }
          : null,
      );
    }
  }, [viewerId, scopeKey, legacyScopeKey, pathname, scope, columnIds]);
  const clearSavedSort = useCallback(() => {
    cancel();
    setSaved(null);
    setCorrection(null);
    if (!viewerId) return;
    try {
      localStorage.removeItem(preferenceKey(viewerId, scopeKey ?? pathname));
      setStorageAvailable(true);
    } catch {
      setStorageAvailable(false);
    }
  }, [cancel, viewerId, scopeKey, pathname]);

  useEffect(() => {
    if (draftSearch === query.search) return;
    timer.current = setTimeout(() => {
      if (
        tableLocationStamp(window.location.pathname, window.location.search, peerQueryKeys) ===
        stamp
      )
        commit({ search: draftSearch, page: 1 }, draftSearch);
    }, 250);
    return () => clearTimeout(timer.current);
  }, [draftSearch, query.search, stamp, scope, commit, peerQueryKeys]);
  useEffect(() => {
    window.addEventListener('popstate', cancel);
    return () => {
      clearTimeout(timer.current);
      window.removeEventListener('popstate', cancel);
    };
  }, [cancel, scope]);
  const reconcilePage = useCallback(
    (page: number) => setCorrection({ scope, stamp, page }),
    [scope, stamp],
  );
  return {
    clearSavedSort,
    storageAvailable,
    scopeKey: scope,
    query,
    draftSearch,
    setSearch: (value) => setDraft({ scope, stamp, value }),
    update: (patch) => {
      commit(patch);
    },
    flushSearch: () => commit({}),
    reconcilePage,
  };
}
