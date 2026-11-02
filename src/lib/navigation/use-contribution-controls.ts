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
import { columnSetIds, type ColumnSetId } from '@/models/contribution-lens';
import type { ColumnSetChoice } from '@/models/column-selection';
import {
  contributionPreferenceKey,
  defaultContributionSettings,
  readContributionPresentation,
  readContributionPresentationDocument,
  serializeContributionPresentation,
  type ContributionSettingField,
} from '@/lib/presentation/contribution-settings';
import {
  columnSetChange,
  columnSetChoice,
  type ColumnSetSort,
} from '@/lib/presentation/contribution-lens';
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
const isColumnSet = (id: string): id is ColumnSetId =>
  (columnSetIds as readonly string[]).includes(id);

/**
 * Report scope, column, Column set, zero-member and Show all controls for one contribution report,
 * in the report's lens. The address holds the view: absent fields are the v1 defaults of the lens,
 * and saved values reached it through the server's entry redirect or the link that opened it.
 * Scope and Show all changes load the report again; column, Column set and zero-member changes add
 * one history entry. Deliberate changes save their own cookie section, which is the lens's own for
 * report tables; without `preferences` nothing is saved.
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
  const lens = page.lens ?? 'contributors';
  const tableKind = tableKey as ContributionTableKind;
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
  /** The presentation the cookie holds for this table in this lens, version 1 or 2. */
  function storedPresentation() {
    return preferences
      ? readContributionPresentationDocument(
          readPreference(preferences.presentation.binding, preferences.presentation.section),
          tableKind,
          lens,
        )
      : null;
  }
  function save(next: ContributionPresentation) {
    setChanged({ basis: preferences?.presentation, table: tableKey, value: next });
    presentationCookie.write(
      JSON.parse(
        serializeContributionPresentation(
          next.columns,
          next.hideZeroMembers,
          next.showAllAccounts,
          lens,
          tableKind,
        ),
      ),
    );
  }
  /**
   * Columns and the zero-member choice, and with `sort` the table's sort on page 1, in one
   * history entry. The sort is saved in its own section.
   */
  function changePresentation(
    next: Record<string, boolean>,
    hideZero: boolean,
    sort?: ColumnSetSort,
  ) {
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
    if (sort) {
      nextValues.sort = (sort.descending ? '-' : '') + sort.sort;
      delete nextValues.page;
    }
    if (!state.push(nextValues)) {
      setNotice(contributionChangeLimitMessage);
      return contributionChangeLimitMessage;
    }
    // Tables of one kind can render different columns, so only this table's columns are replaced
    // in the section the cookie holds; choices for columns it lacks stay for the tables that have it.
    const stored = storedPresentation();
    const saving = { ...stored?.columns };
    for (const id of columnIds) {
      delete saving[id];
      if (typeof next[id] === 'boolean') saving[id] = next[id];
    }
    // Show all is saved only by its own switch.
    save({
      columns: saving,
      hideZeroMembers: hideZero,
      showAllAccounts: stored?.showAllAccounts ?? false,
    });
    if (sort) table.rememberSort(sort);
  }
  /** A Column set: its columns and, when it hides the sorted metric, its lead sort (D8, D9). */
  function chooseColumnSet(id: string) {
    if (!isColumnSet(id)) return;
    const change = columnSetChange(
      id,
      lens,
      {
        visible: columns,
        sort: { sort: table.query.sort, descending: table.query.descending },
      },
      'report',
    );
    return changePresentation(change.visible, hideZeroMembers, change.sort);
  }
  /**
   * The Reviewers lens's Show all switch: the overview lists every account (or company) with
   * activity. The population is the server's, so the report loads again, on page 1.
   */
  function changeShowAllAccounts(on: boolean) {
    setNotice(undefined);
    const nextValues = omitValues(proposal(), ['all', 'page', 'v']);
    if (on) nextValues.all = true;
    const href = state.href(nextValues);
    if (href === null) {
      setNotice(contributionChangeLimitMessage);
      return contributionChangeLimitMessage;
    }
    const stored = storedPresentation();
    save({
      columns: { ...stored?.columns },
      hideZeroMembers: stored?.hideZeroMembers ?? false,
      showAllAccounts: on,
    });
    startTransition(() => state.navigate(href));
  }
  // Report tables offer the Column set choice; supporting records have no metric columns.
  const sets: ColumnSetChoice | undefined =
    tableKind === 'details'
      ? undefined
      : columnSetChoice(
          columnIds.filter((id) => id !== 'name'),
          chooseColumnSet,
        );
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
      ...(sets && { sets }),
    },
    hideZeroMembers,
    changeHideZeroMembers: (hide: boolean) => changePresentation(columns, hide),
    /** Switch a Reviewers-lens overview between reviewers and every account with activity. */
    changeShowAllAccounts,
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
