import 'server-only';
import type { ContributionPage } from '@/models/contribution-page';
import {
  isContributionPresentationDocument,
  type ContributionPresentation,
  type ContributionReportPreferences,
  type ContributionTableKind,
} from '@/models/contribution-preferences';
import type { PreferenceSectionKey } from '@/models/preferences';
import { contributionDirectorySample, contributionSampleAsOf } from '@/mocks/contributions';
import { readContributionPresentation } from '@/lib/presentation/contribution-settings';
import { contributionUrlFits } from '@/lib/presentation/contribution-return';
import {
  contributionScopeValues,
  savedPresentationValues,
  type SavedContributionTables,
} from '@/lib/presentation/contribution-url';
import { readSavedTableSort } from '@/lib/presentation/table-query';
import { urlHref } from '@/lib/presentation/url/codec';
import { appliesSavedScope, entryValues, type SavedViewValues } from '@/lib/presentation/url/entry';
import type { UrlRoute, UrlSegments, UrlValues } from '@/lib/presentation/url/registry';
import type { ContributionSampleScenario } from '@/models/contribution-page';
import type { PageSearchParams } from '@/lib/presentation/search-params';
import type { CanonicalPageOptions } from './canonical-page';
import {
  readPreferences,
  savedContributionScope,
  savedPreference,
  type PreferenceSnapshot,
  type SavedTableSort,
} from './preferences';

/** Why a saved report scope was not applied to an entry. */
export const contributionEntryNotices = {
  invalid: 'Saved filters could not be restored. Default filters are shown.',
  unfit: 'Saved filters are too large for this link. Default filters are shown.',
} as const;

export function contributionTableKind(page: ContributionPage): ContributionTableKind {
  return page.details ? 'details' : page.report.table!.kind;
}

/** A stored presentation document; the client keeps only the columns its table renders. */
function readPresentation(raw: string): ContributionPresentation | null {
  const value: unknown = JSON.parse(raw);
  return isContributionPresentationDocument(value)
    ? readContributionPresentation(raw, Object.keys(value.columns))
    : null;
}
/** A well-formed saved sort on any column; links apply it only to a table that has the column. */
function readSort(raw: string): SavedTableSort | null {
  const value: unknown = JSON.parse(raw);
  return value && typeof value === 'object' && 'sort' in value && typeof value.sort === 'string'
    ? readSavedTableSort(raw, [value.sort])
    : null;
}
const tableKinds: readonly ContributionTableKind[] = [
  'details',
  'contributors',
  'companies',
  'members',
  'repositories',
];
const sections = (table: ContributionTableKind) => ({
  columns: `contributions.${table}.columns` as PreferenceSectionKey,
  sort: `contributions.${table}.sort` as PreferenceSectionKey,
});
/** Every table's well-formed saved presentation, for entries and the links that open tables (C3). */
export function savedContributionTables(snapshot: PreferenceSnapshot): SavedContributionTables {
  return Object.fromEntries(
    tableKinds.map((table) => {
      const presentation = savedPreference(snapshot, sections(table).columns, readPresentation);
      const sort = savedPreference(snapshot, sections(table).sort, readSort);
      return [
        table,
        {
          columns: presentation.value?.columns,
          hideZeroMembers: presentation.value?.hideZeroMembers,
          sort: sort.value,
        },
      ];
    }),
  );
}

export interface ContributionEntry {
  /** The saved values an entry applies, or null when none apply. */
  saved: SavedViewValues | null;
  /** The saved scope section as read, so the client can save into it or delete a rejected value. */
  scope: ContributionReportPreferences['scope'];
  notice?: string;
}
/**
 * The saved values a contribution entry applies (decisions C1 and C2): on `/contributors` and
 * `/companies` the saved scope and the table's saved presentation, on a contributor or company page
 * the presentation only. A saved scope the directory rejects, or one too large for a link, is not
 * applied, and the entry renders the defaults with a notice.
 */
export function contributionEntry(
  snapshot: PreferenceSnapshot,
  route: UrlRoute,
  segments: UrlSegments,
  values: UrlValues,
  entry: boolean,
): ContributionEntry {
  const unread = {
    section: 'contributions.scope' as const,
    binding: snapshot.binding,
    value: null,
  };
  if (!entry) return { saved: null, scope: unread };
  const presentation = savedPresentationValues(route, values, savedContributionTables(snapshot));
  const fits = (saved: SavedViewValues) =>
    contributionUrlFits(urlHref(route, segments, entryValues(route, values, saved)));
  if (!appliesSavedScope(route)) return { saved: { presentation }, scope: unread };
  const sample = (
    typeof values.sample === 'string' ? values.sample : 'reference'
  ) as ContributionSampleScenario;
  const scope = savedContributionScope(
    snapshot,
    contributionDirectorySample(sample),
    contributionSampleAsOf,
  );
  // The entry then renders at its own address, so the notice shows and the client can delete the
  // rejected section; the saved presentation applies again on the next entry.
  if (scope.invalid !== undefined)
    return { saved: null, scope, notice: contributionEntryNotices.invalid };
  const saved = { scope: scope.value ? contributionScopeValues(scope.value) : {}, presentation };
  return fits(saved)
    ? { saved, scope }
    : { saved: null, scope, notice: contributionEntryNotices.unfit };
}
/**
 * The page helper's options for a contribution route: entries read the saved view, and an Over
 * time view keeps its legacy screens until the Timeline reads codec values.
 */
export function contributionPageOptions(
  route: UrlRoute,
  segments: UrlSegments,
  query: PageSearchParams,
): CanonicalPageOptions {
  return {
    legacyScreens: query.timeline !== undefined,
    saved: async (_screen, values) =>
      contributionEntry(await readPreferences('contributions'), route, segments, values, true)
        .saved,
  };
}

/**
 * The server-validated saved values a report render's controls start from: the scope section an
 * entry read (with its notice), and the shown table's saved columns and sort, which deliberate
 * changes save into.
 */
export function contributionReportPreferences(
  snapshot: PreferenceSnapshot,
  page: ContributionPage,
  entry: ContributionEntry,
): ContributionReportPreferences {
  const table = contributionTableKind(page);
  return {
    scope: entry.scope,
    presentation: savedPreference(snapshot, sections(table).columns, readPresentation),
    sort: savedPreference(snapshot, sections(table).sort, readSort),
    ...(entry.notice ? { notice: entry.notice } : {}),
  };
}
