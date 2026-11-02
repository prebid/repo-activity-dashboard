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

/**
 * A stored presentation. Version 1 holds a map of column choices. Version 2 holds `cols`, the URL's
 * column diff (`id` shown, `-id` hidden, comma-joined) against the lens's v1 columns for the
 * section's table, so a section stays tens of bytes; supporting records keep version 1.
 */
export type ContributionPresentationDocument =
  | { version: 1; columns: Record<string, unknown>; hideZeroMembers?: boolean }
  | { version: 2; cols: string; hideZeroMembers?: boolean; showAllAccounts?: boolean };

const optionalBoolean = (value: object, key: string) =>
  !(key in value) || typeof (value as Record<string, unknown>)[key] === 'boolean';
/** Whether a stored presentation value has a shape serializeContributionPresentation writes. */
export function isContributionPresentationDocument(
  value: unknown,
): value is ContributionPresentationDocument {
  if (!value || typeof value !== 'object' || !('version' in value)) return false;
  if (!optionalBoolean(value, 'hideZeroMembers')) return false;
  if (value.version === 1)
    return (
      'columns' in value &&
      !!value.columns &&
      typeof value.columns === 'object' &&
      !Array.isArray(value.columns)
    );
  return (
    value.version === 2 &&
    'cols' in value &&
    typeof value.cols === 'string' &&
    /^(?:-?[A-Za-z0-9._]+(?:,-?[A-Za-z0-9._]+)*)?$/.test(value.cols) &&
    optionalBoolean(value, 'showAllAccounts')
  );
}
