import 'server-only';
import type { ContributionPage } from '@/models/contribution-page';
import {
  isContributionPresentationDocument,
  type ContributionPresentation,
  type ContributionReportPreferences,
  type ContributionTableKind,
} from '@/models/contribution-preferences';
import { contributionDirectorySample } from '@/mocks/contributions';
import {
  hasContributionScope,
  readContributionPresentation,
  writeContributionSettings,
} from '@/lib/presentation/contribution-settings';
import { contributionUrlFits } from '@/lib/presentation/contribution-return';
import { readSavedTableSort } from '@/lib/presentation/table-query';
import {
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
/** A well-formed saved sort on any column; the client applies it only to a column it renders. */
function readSort(raw: string): SavedTableSort | null {
  const value: unknown = JSON.parse(raw);
  return value && typeof value === 'object' && 'sort' in value && typeof value.sort === 'string'
    ? readSavedTableSort(raw, [value.sort])
    : null;
}

export type ContributionReportEntry =
  | { status: 'redirect'; href: string }
  | { status: 'ready'; preferences: ContributionReportPreferences };

/**
 * Resolve one contribution report render against the viewer's saved preferences. A URL without
 * report scope is an entry: when the saved scope differs from the rendered one it is answered with
 * a redirect to the explicit-scope URL, as the client restoration did before. A saved scope that no
 * longer resolves against the directory, or that does not fit a link, renders the requested view
 * with a notice; a rejected section carries its stored value so the client can delete it.
 */
export function resolveContributionReport(
  snapshot: PreferenceSnapshot,
  { path, params, page }: { path: string; params: URLSearchParams; page: ContributionPage },
): ContributionReportEntry {
  const table = contributionTableKind(page);
  const presentation = savedPreference(
    snapshot,
    `contributions.${table}.columns`,
    readPresentation,
  );
  const sort = savedPreference(snapshot, `contributions.${table}.sort`, readSort);
  const ready = (
    scope: ContributionReportPreferences['scope'],
    notice?: string,
  ): ContributionReportEntry => ({
    status: 'ready',
    preferences: { scope, presentation, sort, ...(notice ? { notice } : {}) },
  });
  // An explicit scope is authoritative, so the saved one is neither applied nor checked.
  if (hasContributionScope(params))
    return ready({ section: 'contributions.scope', binding: snapshot.binding, value: null });
  const { asOf, period, selection } = page.report.context;
  const scope = savedContributionScope(snapshot, contributionDirectorySample(page.sample), asOf);
  if (scope.invalid !== undefined) return ready(scope, contributionEntryNotices.invalid);
  if (
    !scope.value ||
    writeContributionSettings('', scope.value) ===
      writeContributionSettings('', { period, selection })
  )
    return ready(scope);
  const href = path + '?' + writeContributionSettings(params.toString(), scope.value);
  return contributionUrlFits(href)
    ? { status: 'redirect', href }
    : ready(scope, contributionEntryNotices.unfit);
}
