'use client';
import { useCallback, useMemo } from 'react';
import type { PreferenceSectionKey } from '@/models/preferences';
import type { ContributionTableKind } from '@/models/contribution-preferences';
import type { ContributionLens } from '@/models/contribution-lens';
import {
  contributionPreferenceNeedsLookup,
  readContributionPresentationDocument,
  readStoredContributionPreferences,
} from '@/lib/presentation/contribution-settings';
import { contributionTableSections } from '@/lib/presentation/contribution-lens';
import { lensOf } from '@/lib/presentation/url/defaults';
import {
  contributionScopeValues,
  savedPresentationValues,
  type ContributionRoute,
} from '@/lib/presentation/contribution-url';
import { readSavedTableSort } from '@/lib/presentation/table-query';
import type { SavedViewValues } from '@/lib/presentation/url/entry';
import type { UrlSegments, UrlValues } from '@/lib/presentation/url/registry';
import { derive, type UrlView } from '@/lib/presentation/url/back';
import { isEntry } from '@/lib/presentation/url/codec';
import { useEntryHref } from './use-entry-href';

type Read = (section: PreferenceSectionKey) => string | null;
function parsed(raw: string | null): unknown {
  try {
    return JSON.parse(raw ?? 'null');
  } catch {
    return null;
  }
}
/** A lens's table's saved columns, zero-member and Show all choices and sort, from the cookie. */
function savedTable(read: Read, table: ContributionTableKind, lens: ContributionLens) {
  const sections = contributionTableSections(lens, table);
  const presentation = readContributionPresentationDocument(read(sections.columns), table, lens);
  const rawSort = read(sections.sort);
  const sort = parsed(rawSort);
  return {
    columns: presentation?.columns,
    hideZeroMembers: presentation?.hideZeroMembers,
    showAllAccounts: presentation?.showAllAccounts,
    sort:
      sort && typeof sort === 'object' && 'sort' in sort && typeof sort.sort === 'string'
        ? readSavedTableSort(rawSort, [sort.sort])
        : null,
  };
}
/**
 * A contribution entry's saved view from the cookie, as registry values, in the entry's lens
 * (/reviewers, or `lens` among the selectors). A saved scope that needs the directory (a named
 * account or company, a custom range, an unknown repository) returns null: the entry link stays
 * bare, and the server checks it and redirects.
 */
export function savedContributionEntry(
  route: ContributionRoute,
  segments: UrlSegments,
  selectors: UrlValues,
  read: Read,
  enabledRepositoryIds?: ReadonlySet<string>,
): SavedViewValues | null {
  const values = { ...selectors };
  const table: ContributionTableKind =
    route === '/contributors' || route === '/reviewers'
      ? 'contributors'
      : route === '/companies'
        ? 'companies'
        : route === '/contributors/[accountId]' || selectors.view === 'repositories'
          ? 'repositories'
          : 'members';
  const presentation = savedPresentationValues(route, values, {
    [table]: savedTable(read, table, lensOf(route, values)),
  });
  if (route !== '/contributors' && route !== '/reviewers' && route !== '/companies')
    return { presentation };
  const raw = read('contributions.scope');
  if (raw === null) return { presentation };
  const settings = readStoredContributionPreferences(raw);
  if (
    !settings ||
    settings.period.kind !== 'preset' ||
    contributionPreferenceNeedsLookup(settings) ||
    (enabledRepositoryIds &&
      !settings.selection.repositoryIds.every((id) => enabledRepositoryIds.has(id)))
  )
    return null;
  return { scope: contributionScopeValues(settings), presentation };
}
/**
 * A masthead lens link: `/contributors` or `/reviewers` in the viewer's saved explicit form after
 * hydration (the shared scope and that lens's table), so an ordinary click opens the saved view in
 * one request.
 */
export function useContributionEntry(
  viewerId: string | undefined,
  enabledRepositories: readonly { id: string }[],
  route: '/contributors' | '/reviewers' = '/contributors',
): string {
  const key = enabledRepositories.map((repo) => repo.id).join(' ');
  const known = useMemo(() => new Set(key.split(' ')), [key]);
  // Only the signed-in viewer's saved view applies; a page without one links bare.
  const saved = useCallback(
    (read: Read) =>
      viewerId === undefined ? null : savedContributionEntry(route, {}, {}, read, known),
    [known, viewerId, route],
  );
  return useEntryHref(route, saved, { viewerId });
}
/**
 * A contribution crumb whose parent is an area entry (an overview at the default scope, reached
 * without a `back` frame): the entry in the viewer's saved explicit form, as the masthead opens it.
 * `parent` is null for any other crumb, which keeps its own href.
 */
export function useAreaEntryHref(parent: UrlView | null, viewerId: string): string | null {
  const route = (parent?.route ?? '/contributors') as ContributionRoute;
  const selectorsKey = JSON.stringify(parent?.values ?? {});
  const selectors = useMemo(() => JSON.parse(selectorsKey) as UrlValues, [selectorsKey]);
  const saved = useCallback(
    (read: Read) => savedContributionEntry(route, {}, selectors, read),
    [route, selectors],
  );
  const href = useEntryHref(route, saved, { viewerId, selectors });
  return parent ? href : null;
}
/** The area entry a view's parent crumb opens when the view names no frame, or null. */
export function areaEntryParent(view: UrlView | null): UrlView | null {
  if (!view || view.values.back !== undefined) return null;
  const derivation = derive(view);
  return derivation.kind === 'derived' && isEntry(derivation.parent.route, derivation.parent.values)
    ? derivation.parent
    : null;
}
