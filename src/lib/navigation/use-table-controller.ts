'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  preferenceKey,
  readTableQuery,
  writeTableQuery,
  type TableQuery,
} from '@/lib/presentation/table-query';
import type { TableController } from '@/lib/presentation/table-controller';
export function useTableController({
  queryKey,
  columnIds,
  scopeKey,
  viewerId,
  onChange,
}: {
  queryKey: string;
  columnIds: readonly string[];
  scopeKey?: string;
  viewerId?: string;
  onChange?: (query: TableQuery) => void;
}): TableController {
  const pathname = usePathname(),
    search = useSearchParams().toString();
  const scope = JSON.stringify([scopeKey ?? pathname, queryKey, viewerId]);
  const stamp = pathname + '?' + search;
  const [draft, setDraft] = useState<{ scope: string; stamp: string; value: string } | null>(null);
  const [saved, setSaved] = useState<{ scope: string; sort: string; descending: boolean } | null>(
    null,
  );
  const [correction, setCorrection] = useState<{
    scope: string;
    stamp: string;
    page: number;
  } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const query = useMemo(() => {
    const value = readTableQuery(search, queryKey, columnIds);
    if (
      !new URLSearchParams(search).has(queryKey + '.sort') &&
      saved?.scope === scope &&
      columnIds.includes(saved.sort)
    ) {
      value.sort = saved.sort;
      value.descending = saved.descending;
    }
    if (correction?.scope === scope && correction.stamp === stamp) value.page = correction.page;
    return value;
  }, [search, queryKey, columnIds, saved, correction, scope, stamp]);
  const draftSearch = draft?.scope === scope && draft.stamp === stamp ? draft.value : query.search;
  const cancel = useCallback(() => {
    clearTimeout(timer.current);
    setDraft(null);
  }, []);
  const commit = useCallback(
    (patch: Partial<TableQuery>, explicitSearch?: string): TableQuery => {
      clearTimeout(timer.current);
      const url = new URL(window.location.href);
      const currentStamp = url.pathname + '?' + url.searchParams.toString();
      const current = readTableQuery(url.search, queryKey, columnIds);
      if (
        !url.searchParams.has(queryKey + '.sort') &&
        saved?.scope === scope &&
        columnIds.includes(saved.sort)
      ) {
        current.sort = saved.sort;
        current.descending = saved.descending;
      }
      if (correction?.scope === scope && correction.stamp === currentStamp)
        current.page = correction.page;
      const pending =
        explicitSearch ??
        (draft?.scope === scope && draft.stamp === currentStamp ? draft.value : current.search);
      const dirty = pending !== current.search;
      const next = { ...current, ...patch, search: patch.search ?? pending };
      if (dirty || (patch.search !== undefined && patch.search !== current.search)) next.page = 1;
      url.search = writeTableQuery(url.search, queryKey, next);
      if (url.href !== window.location.href) window.history.replaceState(null, '', url);
      setDraft(null);
      setCorrection(null);
      if (viewerId && patch.sort !== undefined) {
        try {
          localStorage.setItem(
            preferenceKey(viewerId, scopeKey ?? pathname),
            JSON.stringify({ sort: next.sort, descending: next.descending }),
          );
          setSaved({ scope, sort: next.sort, descending: next.descending });
        } catch {
          /* Storage is only a preference. */
        }
      }
      return next;
    },
    [queryKey, columnIds, saved, scope, correction, draft, viewerId, scopeKey, pathname],
  );
  useEffect(() => {
    if (!viewerId) return;
    try {
      const value: unknown = JSON.parse(
        localStorage.getItem(preferenceKey(viewerId, scopeKey ?? pathname)) ?? 'null',
      );
      if (
        value &&
        typeof value === 'object' &&
        'sort' in value &&
        typeof value.sort === 'string' &&
        columnIds.includes(value.sort) &&
        'descending' in value &&
        typeof value.descending === 'boolean'
      )
        setSaved((previous) =>
          previous?.scope === scope &&
          previous.sort === value.sort &&
          previous.descending === value.descending
            ? previous
            : { scope, sort: value.sort as string, descending: value.descending as boolean },
        );
    } catch {
      /* Invalid/disabled storage must not block navigation. */
    }
  }, [viewerId, scopeKey, pathname, scope, columnIds]);
  useEffect(() => {
    if (draftSearch === query.search) return;
    timer.current = setTimeout(() => {
      if (
        window.location.pathname + '?' + new URLSearchParams(window.location.search).toString() ===
        stamp
      )
        commit({ search: draftSearch, page: 1 }, draftSearch);
    }, 250);
    return () => clearTimeout(timer.current);
  }, [draftSearch, query.search, stamp, scope, commit]);
  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const link =
        event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (link && link.target !== '_blank' && new URL(link.href).origin === window.location.origin)
        cancel();
    };
    document.addEventListener('click', click, true);
    window.addEventListener('popstate', cancel);
    return () => {
      clearTimeout(timer.current);
      document.removeEventListener('click', click, true);
      window.removeEventListener('popstate', cancel);
    };
  }, [cancel, scope]);
  const notify = useRef(onChange);
  useEffect(() => {
    notify.current = onChange;
  }, [onChange]);
  useEffect(() => {
    notify.current?.({
      search: query.search,
      sort: query.sort,
      descending: query.descending,
      page: query.page,
    });
  }, [scope, query.search, query.sort, query.descending, query.page]);
  const reconcilePage = useCallback(
    (page: number) => setCorrection({ scope, stamp, page }),
    [scope, stamp],
  );
  return {
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
