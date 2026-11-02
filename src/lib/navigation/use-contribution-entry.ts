'use client';
import { useCallback, useMemo } from 'react';
import type { PreferenceSectionKey } from '@/models/preferences';
import {
  isContributionPresentationDocument,
  type ContributionTableKind,
} from '@/models/contribution-preferences';
import {
  contributionPreferenceNeedsLookup,
  readContributionPresentation,
  readStoredContributionPreferences,
} from '@/lib/presentation/contribution-settings';
import {
  contributionScopeValues,
  savedPresentationValues,
  type ContributionRoute,
} from '@/lib/presentation/contribution-url';
import { readSavedTableSort } from '@/lib/presentation/table-query';
import type { SavedViewValues } from '@/lib/presentation/url/entry';
import type { UrlSegments, UrlValues } from '@/lib/presentation/url/registry';
import { useEntryHref } from './use-entry-href';

type Read = (section: PreferenceSectionKey) => string | null;
function parsed(raw: string | null): unknown {
  try {
    return JSON.parse(raw ?? 'null');
  } catch {
    return null;
  }
}
/** A table's saved columns, zero-member choice and sort, read from the cookie. */
function savedTable(read: Read, table: ContributionTableKind) {
  const columns = read(`contributions.${table}.columns`);
  const document = parsed(columns);
  const presentation = isContributionPresentationDocument(document)
    ? readContributionPresentation(columns, Object.keys(document.columns))
    : undefined;
  const rawSort = read(`contributions.${table}.sort`);
  const sort = parsed(rawSort);
  return {
    columns: presentation?.columns,
    hideZeroMembers: presentation?.hideZeroMembers,
    sort:
      sort && typeof sort === 'object' && 'sort' in sort && typeof sort.sort === 'string'
        ? readSavedTableSort(rawSort, [sort.sort])
        : null,
  };
}
/**
 * A contribution entry's saved view from the cookie, as registry values. A saved scope that needs
 * the directory (a named account or company, a custom range, an unknown repository) returns null:
 * the entry link stays bare, and the server checks it and redirects.
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
    route === '/contributors'
      ? 'contributors'
      : route === '/companies'
        ? 'companies'
        : route === '/contributors/[accountId]' || selectors.view === 'repositories'
          ? 'repositories'
          : 'members';
  const presentation = savedPresentationValues(route, values, {
    [table]: savedTable(read, table),
  });
  if (route !== '/contributors' && route !== '/companies') return { presentation };
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
 * The masthead Contributions link: `/contributors` in the viewer's saved explicit form after
 * hydration, so an ordinary click opens the saved view in one request.
 */
export function useContributionEntry(
  viewerId: string | undefined,
  enabledRepositories: readonly { id: string }[],
): string {
  const key = enabledRepositories.map((repo) => repo.id).join(' ');
  const known = useMemo(() => new Set(key.split(' ')), [key]);
  // Only the signed-in viewer's saved view applies; a page without one links bare.
  const saved = useCallback(
    (read: Read) =>
      viewerId === undefined ? null : savedContributionEntry('/contributors', {}, {}, read, known),
    [known, viewerId],
  );
  return useEntryHref('/contributors', saved, { viewerId });
}
