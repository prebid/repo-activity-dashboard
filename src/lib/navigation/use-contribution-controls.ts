'use client';
import { pendingTableQuery } from '@/lib/presentation/table-controller';
import type { ContributionOptions } from '@/models/contribution-options';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ContributionPage } from '@/models/contribution-page';
import type {
  ContributionControlDirectory,
  ContributionSettings,
} from '@/models/contribution-settings';
import { additionalMetricIds } from '@/models/contribution-activity';
import {
  contributionPreferenceKey,
  defaultContributionSettings,
  hasContributionScope,
  readContributionPreferenceCandidate,
  contributionPreferenceNeedsLookup,
  writeContributionSettings,
  readContributionPresentation,
  serializeContributionPresentation,
  type ContributionSettingField,
} from '@/lib/presentation/contribution-settings';
import {
  contributionUrlFits,
  contributionLinkLimitMessage,
  contributionChangeLimitMessage,
} from '@/lib/presentation/contribution-return';
import {
  resolveTableColumns,
  writeTableColumns,
} from '@/lib/presentation/table-column-preferences';
import { writeTableQuery } from '@/lib/presentation/table-query';
import { type TableQuery } from '@/models/table-query';
import type { useTableController } from './use-table-controller';
import {
  clearContributionScope,
  discardContributionScope,
  lookupSavedScope,
  saveContributionScope,
  savedScopeNotices,
  savedScopeUnchanged,
} from './contribution-scope-storage';
import { contributionHref } from '@/lib/presentation/contribution-navigation';

export function useContributionControls(
  viewerId: string,
  page: ContributionPage,
  directory: ContributionControlDirectory,
  table: ReturnType<typeof useTableController>,
  tableKey: string,
  columnIds: readonly string[],
  options: ContributionOptions,
) {
  const router = useRouter(),
    pathname = usePathname(),
    search = useSearchParams().toString();
  const preferenceKey = contributionPreferenceKey(viewerId, page.sample),
    columnKey = preferenceKey + ':columns:' + tableKey;
  const queryKey = tableKey === 'contributors' || tableKey === 'companies' ? 'report' : tableKey;
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
  const invalidStored = useRef<{ key: string; raw: string | null } | null>(null);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [pending, startTransition] = useTransition();
  const value: ContributionSettings = useMemo(
    () => ({
      period: page.report.context.period,
      selection: page.report.context.selection,
    }),
    [page.report.context.period, page.report.context.selection],
  );
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
    const controller = new AbortController();
    let raw: string | null = null;
    let scope: ContributionSettings | null = null;
    function rejectStored(checked: string | null) {
      invalidStored.current = { key: preferenceKey, raw: checked };
      setNotice('Saved filters could not be restored. Default filters are shown.');
      try {
        if (!discardContributionScope(preferenceKey, checked)) setNotice(savedScopeNotices.changed);
      } catch {
        recordStorage(preferenceKey, false);
      }
    }
    try {
      raw = localStorage.getItem(preferenceKey);
      scope = readContributionPreferenceCandidate(raw, directory, page.report.context.asOf);
      if (!explicit) {
        if (raw !== null && !scope) rejectStored(raw);
        else setNotice(undefined);
      }
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
    if (
      !explicit &&
      scope &&
      writeContributionSettings('', scope) !== writeContributionSettings('', value)
    ) {
      const candidate = scope;
      const url = new URL(window.location.href),
        before = url.pathname + url.search;
      url.search = writeContributionSettings(url.search, candidate);
      if (!contributionUrlFits(url.pathname + url.search)) {
        setNotice('Saved filters are too large for this link. Default filters are shown.');
      } else {
        const currentLocation = () =>
          !controller.signal.aborted &&
          window.location.pathname + window.location.search === before;
        const apply = (restored: ContributionSettings | null) => {
          if (!currentLocation()) return;
          try {
            if (!savedScopeUnchanged(preferenceKey, raw)) {
              setNotice(savedScopeNotices.changed);
              return;
            }
          } catch {
            recordStorage(preferenceKey, false);
            return;
          }
          if (!restored) {
            rejectStored(raw);
            return;
          }
          invalidStored.current = null;
          url.search = writeContributionSettings(url.search, restored);
          startTransition(() => router.replace(url.pathname + url.search, { scroll: false }));
        };
        if (contributionPreferenceNeedsLookup(candidate)) {
          setChecking(true);
          void lookupSavedScope(options, candidate, controller.signal)
            .then(apply)
            .catch(() => {
              if (currentLocation()) setNotice(savedScopeNotices.unchecked);
            })
            .finally(() => {
              if (!controller.signal.aborted) setChecking(false);
            });
          return () => controller.abort();
        }
        apply(candidate);
      }
    }
    setChecking(false);
    return () => controller.abort();
  }, [
    preferenceKey,
    columnKey,
    columnIds,
    directory,
    page.report.context.asOf,
    explicit,
    pathname,
    router,
    value,
    options,
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
    if (contributionUrlFits(url.pathname + url.search) && url.href !== window.location.href)
      window.history.replaceState(null, '', url);
    return url;
  }
  function remember(next: ContributionSettings, field: ContributionSettingField | 'reset') {
    try {
      if (field !== 'reset')
        saveContributionScope(
          preferenceKey,
          directory,
          page.report.context.asOf,
          next,
          field,
          invalidStored.current?.key === preferenceKey ? invalidStored.current.raw : undefined,
        );
      else clearContributionScope(preferenceKey);
      recordStorage(preferenceKey, true);
    } catch {
      recordStorage(preferenceKey, false);
    }
  }
  const renderedQuery = pendingTableQuery(table);
  function proposal() {
    const url = new URL(window.location.href);
    url.search = snapshot(url.search, renderedQuery);
    return url;
  }
  function update(next: ContributionSettings, field: ContributionSettingField | 'reset') {
    const reset = field === 'reset';
    setNotice(undefined);
    const url = proposal();
    url.search = writeContributionSettings(url.search, next, true);
    if (reset)
      for (const key of ['report', 'members', 'repositories', 'details'])
        url.searchParams.delete(key + '.q');
    if (!contributionUrlFits(url.pathname + url.search)) {
      setNotice(contributionChangeLimitMessage);
      return contributionChangeLimitMessage;
    }
    freezeReturn();
    remember(next, field);
    startTransition(() => router.push(url.pathname + url.search, { scroll: false }));
  }
  function changePresentation(next: Record<string, boolean>, hideZero: boolean) {
    setNotice(undefined);
    const url = proposal();
    url.search = presentation(url.search, next, hideZero);
    if (hideZero !== hideZeroMembers) url.searchParams.delete('members.page');
    if (!contributionUrlFits(url.pathname + url.search)) {
      setNotice(contributionChangeLimitMessage);
      return contributionChangeLimitMessage;
    }
    freezeReturn();
    if (url.href !== window.location.href) window.history.pushState(null, '', url);
    setSaved({ key: columnKey, columns: next, hideZeroMembers: hideZero });
    try {
      localStorage.setItem(columnKey, serializeContributionPresentation(next, hideZero));
      recordStorage(columnKey, true);
    } catch {
      recordStorage(columnKey, false);
    }
  }
  const returnHref = pathname + '?' + snapshot(search, renderedQuery);
  const linkNotice = contributionHref('contributors', page.sample, returnHref, value)
    ? undefined
    : contributionLinkLimitMessage;
  return {
    value,
    update: (next: ContributionSettings, field: ContributionSettingField) => update(next, field),
    reset: () => update(defaultContributionSettings(directory), 'reset'),
    pending: pending || checking,
    notice: notice ?? linkNotice,
    storageAvailable:
      storage[preferenceKey] !== false && storage[columnKey] !== false && table.storageAvailable,
    visibility: {
      value: columns,
      onChange: (next: Record<string, boolean>) => changePresentation(next, hideZeroMembers),
    },
    hideZeroMembers,
    changeHideZeroMembers: (hide: boolean) => changePresentation(columns, hide),
    returnHref,
    freezeReturn,
  };
}
