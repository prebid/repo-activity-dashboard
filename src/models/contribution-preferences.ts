import type { ContributionSettings } from './contribution-settings';
import type { SavedPreference } from './preferences';
import type { TableQuery } from './table-query';

/** The table a contribution report page shows; its sort and columns are saved per kind. */
export type ContributionTableKind =
  'details' | 'contributors' | 'companies' | 'members' | 'repositories';

/**
 * Saved column overrides, for company members whether zero totals are hidden, and for a
 * Reviewers-lens overview whether every account with activity is listed.
 */
export interface ContributionPresentation {
  columns: Record<string, boolean>;
  hideZeroMembers: boolean;
  showAllAccounts?: boolean;
}

/**
 * The server-validated saved values one contribution report render starts from. Column and sort
 * values may name columns this table lacks; the client applies only the columns it renders.
 */
export interface ContributionReportPreferences {
  scope: SavedPreference<ContributionSettings>;
  presentation: SavedPreference<ContributionPresentation>;
  sort: SavedPreference<Pick<TableQuery, 'sort' | 'descending'>>;
  /** Why a saved scope was not applied to this entry, shown with the report filters. */
  notice?: string;
}

/** Whether a stored presentation value has the shape serializeContributionPresentation writes. */
export function isContributionPresentationDocument(
  value: unknown,
): value is { version: 1; columns: Record<string, unknown>; hideZeroMembers?: boolean } {
  return (
    !!value &&
    typeof value === 'object' &&
    'version' in value &&
    value.version === 1 &&
    'columns' in value &&
    !!value.columns &&
    typeof value.columns === 'object' &&
    !Array.isArray(value.columns) &&
    (!('hideZeroMembers' in value) || typeof value.hideZeroMembers === 'boolean')
  );
}
