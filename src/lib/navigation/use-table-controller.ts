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
import type { SavedPreference } from '@/models/preferences';
import type { TableController } from '@/lib/presentation/table-controller';
import { usePreferenceCookie } from './use-preference-cookie';
import { writeHistory } from './use-url-state';
import {
  boundLocationStamp,
  readBoundTableQuery,
  writeBoundTableQuery,
  type TableFields,
} from '@/lib/presentation/url/table-binding';
const noPeers: readonly string[] = [];
type SavedSort = Pick<TableQuery, 'sort' | 'descending'>;
export function useTableController({
  queryKey,
  columnIds,
  scopeKey,
  legacyScopeKey,
  viewerId,
  peerQueryKeys = noPeers,
  defaultSort,
  historyMode = 'replace',
  savedSort,
  fields,
}: {
  historyMode?: 'push' | 'replace';
  queryKey: string;
  columnIds: readonly string[];
  scopeKey?: string;
  /** A former localStorage scope whose saved sort is copied once into `savedSort`'s section. */
  legacyScopeKey?: string;
  viewerId?: string;
  peerQueryKeys?: readonly string[];
  defaultSort?: SavedSort;
  /**
   * The server-validated saved sort and the cookie section that keeps it. The first render uses it
   * when the URL names no sort; a deliberate sort change writes it and clearSavedSort deletes it.
   * Without it, sorts are not saved.
   */
  savedSort?: SavedPreference<SavedSort>;
  /**
   * The registry fields that hold this table's state (the URL codec). Without them the table reads
   * and writes the legacy `<queryKey>.q/.sort/.dir/.page` keys. With them an absent sort is the v1
   * default, never the saved sort, which applies only through a server redirect of an entry.
   */
  fields?: TableFields;
}): TableController & { clearSavedSort: () => void; storageAvailable: boolean } {
  const pathname = usePathname(),
    search = useSearchParams().toString();
  const scope = JSON.stringify([scopeKey ?? pathname, queryKey, viewerId]);
  const stampOf = useCallback(
    (path: string, query: string) =>
      fields
        ? boundLocationStamp(fields, path, query)
        : tableLocationStamp(path, query, peerQueryKeys),
    [fields, peerQueryKeys],
  );
  const readQuery = useCallback(
    (query: string, fallback: SavedSort | undefined, page?: number) =>
      fields
        ? readBoundTableQuery(fields, query, columnIds, defaultSort, page)
        : effectiveTableQuery(query, queryKey, columnIds, fallback, page),
    [fields, columnIds, defaultSort, queryKey],
  );
  const writeQuery = useCallback(
    (query: string, patch: Partial<TableQuery>) =>
      fields ? writeBoundTableQuery(fields, query, patch) : writeTableQuery(query, queryKey, patch),
    [fields, queryKey],
  );
  const stamp = stampOf(pathname, search);
  const legacyKeys = viewerId
    ? [
        ...new Set([
          preferenceKey(viewerId, scopeKey ?? pathname),
          ...(legacyScopeKey ? [preferenceKey(viewerId, legacyScopeKey)] : []),
        ]),
      ]
    : [];
  const { write: writeSort, storageAvailable } = usePreferenceCookie(
    savedSort,
    legacyKeys.length
      ? { keys: legacyKeys, read: (raw) => readSavedTableSort(raw, columnIds) }
      : undefined,
  );
  const [draft, setDraft] = useState<{ scope: string; stamp: string; value: string } | null>(null);
  // A sort saved or cleared in this session; until then the server-validated sort applies.
  const [changed, setChanged] = useState<{ scope: string; value: SavedSort | null } | null>(null);
  // A saved sort on a column this table lacks does not apply here; the default sort does.
  const applicable =
    savedSort?.value && columnIds.includes(savedSort.value.sort) ? savedSort.value : null;
  const saved = changed?.scope === scope ? changed.value : applicable;
  const [correction, setCorrection] = useState<{
    scope: string;
    stamp: string;
    page: number;
  } | null>(null);
  const searchEntry = useRef<{ scope: string; href: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const query = useMemo(
    () =>
      readQuery(
        search,
        saved ?? defaultSort,
        correction?.scope === scope && correction.stamp === stamp ? correction.page : undefined,
      ),
    [search, readQuery, saved, correction, scope, stamp, defaultSort],
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
      const currentStamp = stampOf(url.pathname, url.search);
      const current = readQuery(
        url.search,
        saved ?? defaultSort,
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
        url.search = writeQuery(url.search, current);
        if (url.href !== window.location.href) writeHistory('replace', url.pathname + url.search);
      }
      url.search = writeQuery(url.search, next);
      if (url.href !== window.location.href) {
        writeHistory(
          historyMode === 'push' && !replaceSearch ? 'push' : 'replace',
          url.pathname + url.search,
        );
      }
      searchEntry.current = historyMode === 'push' && searchOnly ? { scope, href: url.href } : null;
      setDraft(null);
      setCorrection(null);
      if ((viewerId || savedSort) && patch.sort !== undefined) {
        const value = { sort: next.sort, descending: next.descending };
        setChanged({ scope, value });
        writeSort(value);
      }
      return next;
    },
    [
      saved,
      scope,
      correction,
      draft,
      viewerId,
      savedSort,
      writeSort,
      defaultSort,
      historyMode,
      readQuery,
      writeQuery,
      stampOf,
    ],
  );
  useEffect(() => {
    searchEntry.current = null;
  }, [scope]);
  const clearSavedSort = useCallback(() => {
    cancel();
    setChanged({ scope, value: null });
    setCorrection(null);
    writeSort(null);
  }, [cancel, scope, writeSort]);

  useEffect(() => {
    if (draftSearch === query.search) return;
    timer.current = setTimeout(() => {
      if (stampOf(window.location.pathname, window.location.search) === stamp)
        commit({ search: draftSearch, page: 1 }, draftSearch);
    }, 250);
    return () => clearTimeout(timer.current);
  }, [draftSearch, query.search, stamp, scope, commit, stampOf]);
  useEffect(() => {
    if (draftSearch === query.search) return;
    // A later history write can cancel an in-flight Next navigation. Capture the
    // search before the link's router handler runs, including links outside the table.
    const beforeNavigation = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !(event.target instanceof Element)
      )
        return;
      const link = event.target.closest('a[href]');
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.hasAttribute('download') ||
        (link.target && link.target.toLowerCase() !== '_self')
      )
        return;
      let destination: URL;
      try {
        destination = new URL(link.href);
      } catch {
        return;
      }
      if (destination.origin === window.location.origin) commit({});
    };
    document.addEventListener('click', beforeNavigation, true);
    return () => document.removeEventListener('click', beforeNavigation, true);
  }, [draftSearch, query.search, commit]);
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
