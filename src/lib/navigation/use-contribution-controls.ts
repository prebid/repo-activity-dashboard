'use client';
import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ContributionPage } from '@/models/contribution-page';
import type { ContributionDirectory, ContributionSettings } from '@/models/contribution-settings';
import { additionalMetricIds } from '@/models/contribution-activity';
import {
  contributionPreferenceKey,
  defaultContributionSettings,
  hasContributionScope,
  readContributionPreferences,
  serializeContributionPreferences,
  writeContributionSettings,
  readContributionPresentation,
  serializeContributionPresentation,
} from '@/lib/presentation/contribution-settings';
import {
  resolveTableColumns,
  writeTableColumns,
} from '@/lib/presentation/table-column-preferences';
import { writeTableQuery, type TableQuery } from '@/lib/presentation/table-query';
import type { useTableController } from './use-table-controller';

export function useContributionControls(
  viewerId: string,
  page: ContributionPage,
  directory: ContributionDirectory,
  table: ReturnType<typeof useTableController>,
  tableKey: string,
  columnIds: readonly string[],
) {
  const router = useRouter(),
    pathname = usePathname(),
    search = useSearchParams().toString();
  const preferenceKey = contributionPreferenceKey(viewerId, page.sample),
    columnKey = preferenceKey + ':columns:' + tableKey;
  const queryKey = tableKey === 'contributors' || tableKey === 'companies' ? 'report' : tableKey;
  const [loaded, setLoaded] = useState('');
  const [saved, setSaved] = useState<{
    key: string;
    columns: Record<string, boolean>;
    hideZeroMembers: boolean;
  } | null>(null);
  // Independent writes must not clear each other's failures (a smaller column save may fit while a scope save fails).
  const [storage, setStorage] = useState<Record<string, boolean>>({});
  function recordStorage(key: string, available: boolean) {
    setStorage((previous) => ({ ...previous, [key]: available }));
  }
  const [notice, setNotice] = useState<string>();
  const [pending, startTransition] = useTransition();
  const value: ContributionSettings = {
    period: page.report.context.period,
    selection: page.report.context.selection,
  };
  const explicit = hasContributionScope(new URLSearchParams(search));
  const defaults = Object.fromEntries(additionalMetricIds.map((id) => [id, false]));
  const columns = resolveTableColumns(
    search,
    tableKey,
    defaults,
    saved?.key === columnKey ? saved.columns : {},
    columnIds,
  );
  const zero = new URLSearchParams(search).get('members.zero');
  const hideZeroMembers =
    tableKey === 'members' &&
    (zero !== null ? zero === 'hide' : saved?.key === columnKey && saved.hideZeroMembers);
  useEffect(() => {
    let scope: ContributionSettings | null = null;
    try {
      const raw = localStorage.getItem(preferenceKey);
      scope = readContributionPreferences(raw, directory, page.report.context.asOf);
      if (!explicit)
        setNotice(
          raw && !scope
            ? 'Saved filters could not be restored. Default filters are shown.'
            : undefined,
        );
      setStorage((previous) =>
        preferenceKey in previous ? previous : { ...previous, [preferenceKey]: true },
      );
    } catch {
      setStorage((previous) => ({ ...previous, [preferenceKey]: false }));
    }
    try {
      setSaved({
        key: columnKey,
        ...readContributionPresentation(localStorage.getItem(columnKey), columnIds),
      });
      setStorage((previous) =>
        columnKey in previous ? previous : { ...previous, [columnKey]: true },
      );
    } catch {
      setSaved(null);
      setStorage((previous) => ({ ...previous, [columnKey]: false }));
    }
    setLoaded(preferenceKey);
    if (!explicit) {
      const url = new URL(window.location.href);
      if (url.pathname === pathname && !hasContributionScope(url.searchParams)) {
        url.search = writeContributionSettings(
          url.search,
          scope ?? defaultContributionSettings(directory),
        );
        startTransition(() => router.replace(url.pathname + url.search, { scroll: false }));
      }
    }
  }, [
    preferenceKey,
    columnKey,
    columnIds,
    directory,
    page.report.context.asOf,
    explicit,
    pathname,
    router,
  ]);
  function presentation(search: string, visible = columns, hideZero = hideZeroMembers) {
    const params = new URLSearchParams(writeTableColumns(search, tableKey, visible, columnIds));
    if (tableKey === 'members') params.set('members.zero', hideZero ? 'hide' : 'show');
    return params.toString();
  }
  function snapshot(search: string, query: TableQuery) {
    const params = new URLSearchParams(
      presentation(writeTableQuery(writeContributionSettings(search, value), queryKey, query)),
    );
    params.sort();
    return params.toString();
  }
  function freezeReturn() {
    const query = table.flushSearch(),
      url = new URL(window.location.href);
    url.search = snapshot(url.search, query);
    if (url.href !== window.location.href) window.history.replaceState(null, '', url);
    return url;
  }
  function remember(next: ContributionSettings | null) {
    try {
      if (next) localStorage.setItem(preferenceKey, serializeContributionPreferences(next));
      else localStorage.removeItem(preferenceKey);
      recordStorage(preferenceKey, true);
    } catch {
      recordStorage(preferenceKey, false);
    }
  }
  function update(next: ContributionSettings, reset = false) {
    setNotice(undefined);
    const url = freezeReturn();
    url.search = writeContributionSettings(url.search, next, true);
    if (reset)
      for (const key of ['report', 'members', 'repositories', 'details'])
        url.searchParams.delete(key + '.q');
    remember(reset ? null : next);
    startTransition(() => router.push(url.pathname + url.search, { scroll: false }));
  }
  function changePresentation(next: Record<string, boolean>, hideZero: boolean) {
    const url = freezeReturn();
    url.search = presentation(url.search, next, hideZero);
    if (hideZero !== hideZeroMembers) url.searchParams.delete('members.page');
    if (url.href !== window.location.href) window.history.pushState(null, '', url);
    setSaved({ key: columnKey, columns: next, hideZeroMembers: hideZero });
    try {
      localStorage.setItem(columnKey, serializeContributionPresentation(next, hideZero));
      recordStorage(columnKey, true);
    } catch {
      recordStorage(columnKey, false);
    }
  }
  const renderedQuery = {
    ...table.query,
    search: table.draftSearch,
    page: table.draftSearch === table.query.search ? table.query.page : 1,
  };
  return {
    value,
    update,
    reset: () => update(defaultContributionSettings(directory), true),
    ready: loaded === preferenceKey && explicit,
    pending,
    notice,
    storageAvailable:
      storage[preferenceKey] !== false && storage[columnKey] !== false && table.storageAvailable,
    visibility: {
      value: columns,
      onChange: (next: Record<string, boolean>) => changePresentation(next, hideZeroMembers),
    },
    hideZeroMembers,
    changeHideZeroMembers: (hide: boolean) => changePresentation(columns, hide),
    returnHref: pathname + '?' + snapshot(search, renderedQuery),
    freezeReturn,
  };
}
