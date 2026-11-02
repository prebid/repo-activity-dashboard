import { columnSetIds, type ColumnSetId } from './contribution-lens';
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
 * A stored presentation. Version 1 holds a map of column choices; supporting records keep it.
 * Version 2 holds `cols`, the URL's column diff (`id` shown, `-id` hidden, comma-joined) against a
 * base for the section's table: with `set`, that Column set's columns over the v1 identity
 * columns, so a choice matching a set stores its name and at most the identity columns that
 * differ; without `set`, the lens's v1 columns. `cols` may be absent only with `set`.
 */
export type ContributionPresentationDocument =
  | { version: 1; columns: Record<string, unknown>; hideZeroMembers?: boolean }
  | {
      version: 2;
      set?: ColumnSetId;
      cols?: string;
      hideZeroMembers?: boolean;
      showAllAccounts?: boolean;
    };

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
  if (value.version !== 2 || !optionalBoolean(value, 'showAllAccounts')) return false;
  const named = 'set' in value;
  if (named && !columnSetIds.some((id) => id === value.set)) return false;
  if (!('cols' in value)) return named;
  return (
    typeof value.cols === 'string' &&
    /^(?:-?[A-Za-z0-9._]+(?:,-?[A-Za-z0-9._]+)*)?$/.test(value.cols)
  );
}
