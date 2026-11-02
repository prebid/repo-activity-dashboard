'use client';
import { pendingTableQuery } from '@/lib/presentation/table-controller';
import { useMemo, useState, useTransition } from 'react';
import type { ContributionPage } from '@/models/contribution-page';
import type {
  ContributionControlDirectory,
  ContributionSettings,
} from '@/models/contribution-settings';
import {
  isContributionPresentationDocument,
  type ContributionPresentation,
  type ContributionReportPreferences,
  type ContributionTableKind,
} from '@/models/contribution-preferences';
import type { ContributionLens } from '@/models/contribution-lens';
import {
  contributionPreferenceKey,
  defaultContributionSettings,
  readContributionPresentation,
  readContributionPresentationDocument,
  serializeContributionPresentation,
  type ContributionSettingField,
} from '@/lib/presentation/contribution-settings';
import {
  contributionLinkLimitMessage,
  contributionChangeLimitMessage,
} from '@/lib/presentation/contribution-return';
import {
  contributionColumnTokens,
  contributionColumnVisibility,
  contributionScopeFields,
  contributionScopeValues,
  omitValues,
} from '@/lib/presentation/contribution-url';
import { contributionHref } from '@/lib/presentation/contribution-navigation';
import { urlHref } from '@/lib/presentation/url/codec';
import type { UrlView } from '@/lib/presentation/url/back';
import type { UrlValue } from '@/lib/presentation/url/registry';
import type { useTableController } from './use-table-controller';
import { legacyContributionScope, mergedContributionScope } from './contribution-scope-storage';
import { readPreference, usePreferenceCookie } from './use-preference-cookie';
import { useUrlState } from './use-url-state';

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
/** The column choices a stored presentation of a lens's table holds, version 1 or 2. */
function storedColumns(
  raw: string | null,
  table: ContributionTableKind,
  lens: ContributionLens,
): Record<string, boolean> {
  return readContributionPresentationDocument(raw, table, lens)?.columns ?? {};
}

/**
 * Report scope, column and zero-member controls for one contribution report. The address holds
 * the view: absent fields are the v1 defaults, and saved values reached it through the server's
 * entry redirect or the link that opened it. Scope changes load the report again; column and
 * zero-member changes add a history entry. Deliberate changes save their own cookie section;
 * without `preferences` nothing is saved.
 */
export function useContributionControls(
  viewerId: string,
  page: ContributionPage,
  directory: ContributionControlDirectory,
  table: ReturnType<typeof useTableController>,
  tableKey: string,
  columnIds: readonly string[],
  preferences: ContributionReportPreferences | undefined,
  view: UrlView,
) {
  const state = useUrlState(view.route);
  const values = state.values ?? view.values;
  const current: UrlView = useMemo(() => ({ ...view, values }), [view, values]);
  const asOf = page.report.context.asOf;
  const legacyKey = contributionPreferenceKey(viewerId, page.sample);
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
  // A presentation saved in this session, until the server renders again.
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
  // Only the columns this table renders; a details table for a credit metric has no Last activity.
  const columns = Object.fromEntries(
    Object.entries(contributionColumnVisibility(view.route, values) ?? {}).filter(([id]) =>
      columnIds.includes(id),
    ),
  );
  const hideZeroMembers = tableKey === 'members' && values.zero === 'hide';
  /** Values with the table's pending search, so a change or a link keeps what was typed. */
  function proposal(base = state.values ?? values): Record<string, UrlValue> {
    const query = pendingTableQuery(table);
    const next = omitValues(base, ['q', 'page']);
    if (query.search) next.q = query.search;
    if (query.page > 1) next.page = String(query.page);
    return next;
  }
  function remember(next: ContributionSettings, field: ContributionSettingField | 'reset') {
    if (field === 'reset') scopeCookie.write(null);
    else if (preferences)
      scopeCookie.write(mergedContributionScope(preferences.scope, directory, asOf, next, field));
  }
  function update(next: ContributionSettings, field: ContributionSettingField | 'reset') {
    setNotice(undefined);
    const nextValues = {
      ...omitValues(proposal(), [...contributionScopeFields, 'page', 'v']),
      ...contributionScopeValues(next),
    };
    if (field === 'reset') delete nextValues.q;
    const href = state.href(nextValues);
    if (href === null) {
      setNotice(contributionChangeLimitMessage);
      return contributionChangeLimitMessage;
    }
    remember(next, field);
    startTransition(() => state.navigate(href));
  }
  function changePresentation(next: Record<string, boolean>, hideZero: boolean) {
    setNotice(undefined);
    const nextValues = omitValues(proposal(), ['cols', 'zero', 'v']);
    // Columns the choice does not name keep what the address shows.
    const tokens = contributionColumnTokens(view.route, nextValues, {
      ...contributionColumnVisibility(view.route, state.values ?? values),
      ...next,
    });
    if (tokens.length) nextValues.cols = tokens;
    if (hideZero) nextValues.zero = 'hide';
    if (hideZero !== hideZeroMembers) delete nextValues.page;
    if (!state.push(nextValues)) {
      setNotice(contributionChangeLimitMessage);
      return contributionChangeLimitMessage;
    }
    // Tables of one kind can render different columns, so only this table's columns are replaced
    // in the section the cookie holds; choices for columns it lacks stay for the tables that have it.
    const saving = preferences
      ? storedColumns(
          readPreference(preferences.presentation.binding, preferences.presentation.section),
          tableKey as ContributionTableKind,
          page.lens ?? 'contributors',
        )
      : {};
    for (const id of columnIds) {
      delete saving[id];
      if (typeof next[id] === 'boolean') saving[id] = next[id];
    }
    setChanged({
      basis: preferences?.presentation,
      table: tableKey,
      value: { columns: saving, hideZeroMembers: hideZero },
    });
    presentationCookie.write(JSON.parse(serializeContributionPresentation(saving, hideZero)));
  }
  const returnHref = urlHref(view.route, view.segments, proposal(values));
  const linkNotice = contributionHref(
    { kind: 'contributor', accountId: 'account' },
    page.sample,
    returnHref,
    value,
  )
    ? undefined
    : contributionLinkLimitMessage;
  const notice = feedback && feedback.basis === preferences ? feedback.text : preferences?.notice;
  return {
    value,
    values,
    current,
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
    /** The current report's canonical address, which links from it carry as their parent. */
    returnHref,
    /** Commit a pending table search to this history entry before following a link. */
    freezeReturn: () => {
      table.flushSearch();
    },
    /** The saved presentation changed in this session, which links opening this table carry. */
    changed: changed?.basis === preferences?.presentation ? changed : null,
  };
}
