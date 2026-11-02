'use client';
import { pendingTableQuery } from '@/lib/presentation/table-controller';
import { useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ContributionPage } from '@/models/contribution-page';
import type {
  ContributionControlDirectory,
  ContributionSettings,
} from '@/models/contribution-settings';
import {
  isContributionPresentationDocument,
  type ContributionPresentation,
  type ContributionReportPreferences,
} from '@/models/contribution-preferences';
import { additionalMetricIds } from '@/models/contribution-activity';
import {
  contributionPreferenceKey,
  defaultContributionSettings,
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
import { legacyContributionScope, mergedContributionScope } from './contribution-scope-storage';
import { usePreferenceCookie } from './use-preference-cookie';
import { contributionHref } from '@/lib/presentation/contribution-navigation';

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Report scope, column and zero-member controls for one contribution report. The first render uses
 * the URL and the server-validated `preferences`; deliberate changes save their own cookie section.
 * Without `preferences` nothing is saved.
 */
export function useContributionControls(
  viewerId: string,
  page: ContributionPage,
  directory: ContributionControlDirectory,
  table: ReturnType<typeof useTableController>,
  tableKey: string,
  columnIds: readonly string[],
  preferences?: ContributionReportPreferences,
) {
  const router = useRouter(),
    pathname = usePathname(),
    search = useSearchParams().toString();
  const asOf = page.report.context.asOf;
  const legacyKey = contributionPreferenceKey(viewerId, page.sample);
  const queryKey = tableKey === 'contributors' || tableKey === 'companies' ? 'report' : tableKey;
  const scopeCookie = usePreferenceCookie(
    preferences?.scope,
    legacyContributionScope(viewerId, page.sample, directory, asOf),
  );
  const presentationCookie = usePreferenceCookie(preferences?.presentation, {
    keys: [legacyKey + ':columns:' + tableKey],
    read: (raw) => {
      if (!isContributionPresentationDocument(parseJson(raw))) return null;
      const stored = readContributionPresentation(raw, columnIds);
      return JSON.parse(
        serializeContributionPresentation(stored.columns, stored.hideZeroMembers),
      ) as unknown;
    },
  });
  // A presentation saved in this session applies until the server renders again.
  const [changed, setChanged] = useState<{
    basis: ContributionReportPreferences['presentation'] | undefined;
    table: string;
    value: ContributionPresentation;
  } | null>(null);
  // Feedback from this session replaces the server's notice until the server renders again.
  const [feedback, setFeedback] = useState<{
    basis: ContributionReportPreferences | undefined;
    text?: string;
  } | null>(null);
  function setNotice(text?: string) {
    setFeedback({ basis: preferences, text });
  }
  const [pending, startTransition] = useTransition();
  const value: ContributionSettings = useMemo(
    () => ({
      period: page.report.context.period,
      selection: page.report.context.selection,
    }),
    [page.report.context.period, page.report.context.selection],
  );
  const saved =
    changed?.basis === preferences?.presentation && changed?.table === tableKey
      ? changed.value
      : (preferences?.presentation.value ?? null);
  const defaults = Object.fromEntries(additionalMetricIds.map((id) => [id, false]));
  const columns = resolveTableColumns(
    search,
    tableKey,
    defaults,
    Object.fromEntries(
      Object.entries(saved?.columns ?? {}).filter(([id]) => columnIds.includes(id)),
    ),
    columnIds,
  );
  const zero = new URLSearchParams(search).get('members.zero');
  const hideZeroMembers =
    tableKey === 'members' && (zero !== null ? zero === 'hide' : !!saved?.hideZeroMembers);
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
    if (field === 'reset') scopeCookie.write(null);
    else if (preferences)
      scopeCookie.write(mergedContributionScope(preferences.scope, directory, asOf, next, field));
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
    setChanged({
      basis: preferences?.presentation,
      table: tableKey,
      value: { columns: next, hideZeroMembers: hideZero },
    });
    presentationCookie.write(JSON.parse(serializeContributionPresentation(next, hideZero)));
  }
  const returnHref = pathname + '?' + snapshot(search, renderedQuery);
  const linkNotice = contributionHref('contributors', page.sample, returnHref, value)
    ? undefined
    : contributionLinkLimitMessage;
  const notice = feedback && feedback.basis === preferences ? feedback.text : preferences?.notice;
  return {
    value,
    update: (next: ContributionSettings, field: ContributionSettingField) => update(next, field),
    reset: () => update(defaultContributionSettings(directory), 'reset'),
    pending,
    notice: notice ?? linkNotice,
    storageAvailable:
      scopeCookie.storageAvailable && presentationCookie.storageAvailable && table.storageAvailable,
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
