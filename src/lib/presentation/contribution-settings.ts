import {
  contributionScopeKeys,
  readContributionPeriod,
  readContributionScopeInput,
  readContributionSettings,
  hasContributionScope,
  writeContributionSettings,
} from './url/legacy/contribution';
import {
  defaultContributionSettings,
  normaliseSettings,
  validateContributionSettings,
} from './contribution-settings-rules';
export {
  contributionScopeKeys,
  defaultContributionSettings,
  hasContributionScope,
  readContributionPeriod,
  readContributionScopeInput,
  readContributionSettings,
  validateContributionSettings,
  writeContributionSettings,
};
import { readTableColumns } from './table-column-preferences';
import { columnTokens, contributionColumnTable, visibleColumns } from './url/defaults';
import {
  contributionSettingsSchema,
  type ContributionSettings,
  type ContributionDirectory,
  type ContributionControlDirectory,
} from '@/models/contribution-settings';
import {
  isContributionPresentationDocument,
  type ContributionPresentation,
  type ContributionTableKind,
} from '@/models/contribution-preferences';
import type { ContributionLens } from '@/models/contribution-lens';

export function readContributionPreferenceCandidate(
  raw: string | null,
  directory: ContributionControlDirectory,
  asOf: string,
): ContributionSettings | null {
  const stored = readStoredContributionPreferences(raw);
  return stored ? normaliseSettings(stored, directory, asOf) : null;
}
export function contributionPreferenceNeedsLookup(settings: ContributionSettings): boolean {
  return (
    settings.selection.excludedAccountIds.length > 0 ||
    (settings.selection.population.kind === 'selected' &&
      (settings.selection.population.accountIds.length > 0 ||
        settings.selection.population.companyIds.some((id) => id !== null)))
  );
}
export function contributionPreferenceKey(viewerId: string, sample: string): string {
  return 'dashboard:contributions:v1:' + [viewerId, sample].map(encodeURIComponent).join(':');
}
export function contributionTableScope(sample: string, table: string): string {
  return 'contributions:' + sample + ':' + table;
}
export type ContributionSettingField = 'period' | 'repositoryIds' | 'actorTypes' | 'population';
/** Persist explicit user intent, never unrelated scope inherited from a drilldown. */
export function mergeContributionPreferences(
  saved: ContributionSettings,
  next: ContributionSettings,
  field: ContributionSettingField,
): ContributionSettings {
  return {
    period: field === 'period' ? next.period : saved.period,
    selection: {
      repositoryIds:
        field === 'repositoryIds' ? next.selection.repositoryIds : saved.selection.repositoryIds,
      actorTypes: field === 'actorTypes' ? next.selection.actorTypes : saved.selection.actorTypes,
      population: field === 'population' ? next.selection.population : saved.selection.population,
      excludedAccountIds:
        field === 'population'
          ? next.selection.excludedAccountIds
          : saved.selection.excludedAccountIds,
    },
  };
}
export function serializeContributionPreferences(value: ContributionSettings): string {
  return JSON.stringify({ version: 1, settings: value });
}
export function readContributionPreferences(
  raw: string | null,
  directory: ContributionDirectory,
  asOf: string,
): ContributionSettings | null {
  const settings = readStoredContributionPreferences(raw);
  return settings ? validateContributionSettings(settings, directory, asOf) : null;
}
/** Shape validation for entry links; the authenticated loader owns identity/range validation. */
export function readStoredContributionPreferences(raw: string | null): ContributionSettings | null {
  try {
    const parsed: unknown = JSON.parse(raw ?? 'null');
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('version' in parsed) ||
      parsed.version !== 1 ||
      !('settings' in parsed)
    )
      return null;
    const settings = contributionSettingsSchema.safeParse(parsed.settings);
    return settings.success ? settings.data : null;
  } catch {
    return null;
  }
}

/**
 * A stored presentation for one table of a lens, or null when it is not a presentation document:
 * version 1's column map as stored, or version 2's `cols` diff expanded against the lens's v1
 * columns for `table` into a choice for every column. A version 2 diff naming a column the table
 * lacks, or stored for supporting records, is not a document.
 */
export function readContributionPresentationDocument(
  raw: string | null,
  table: ContributionTableKind,
  lens: ContributionLens = 'contributors',
): Required<ContributionPresentation> | null {
  let value: unknown;
  try {
    value = JSON.parse(raw ?? 'null');
  } catch {
    return null;
  }
  if (!isContributionPresentationDocument(value)) return null;
  const hideZeroMembers = value.hideZeroMembers === true;
  if (value.version === 1)
    return {
      columns: readTableColumns(raw, Object.keys(value.columns)),
      hideZeroMembers,
      showAllAccounts: false,
    };
  if (table === 'details') return null;
  const defaults = contributionColumnTable(table, lens);
  const visible = visibleColumns(defaults, value.cols ? value.cols.split(',') : []);
  return (
    visible && {
      columns: Object.fromEntries(defaults.ids.map((id) => [id, visible.includes(id)])),
      hideZeroMembers,
      showAllAccounts: value.showAllAccounts === true,
    }
  );
}
/**
 * A stored presentation's choices for the columns a table renders. `table` and `lens` expand a
 * version 2 section; without them only version 1 column choices are read.
 */
export function readContributionPresentation(
  raw: string | null,
  columnIds: readonly string[],
  table?: ContributionTableKind,
  lens?: ContributionLens,
): Required<ContributionPresentation> {
  const stored = readContributionPresentationDocument(raw, table ?? 'details', lens);
  if (!stored) return { columns: {}, hideZeroMembers: false, showAllAccounts: false };
  return {
    ...stored,
    columns: Object.fromEntries(
      Object.entries(stored.columns).filter(([id]) => columnIds.includes(id)),
    ),
  };
}
/**
 * A presentation section's JSON. With a report `table`, version 2: the column choices as a `cols`
 * diff against the lens's v1 columns (a column without a choice keeps its v1 state), and
 * `showAllAccounts` only when on. Supporting records, and callers that name no table, write
 * version 1's column map.
 */
export function serializeContributionPresentation(
  columns: Record<string, boolean>,
  hideZeroMembers: boolean,
  showAllAccounts = false,
  lens: ContributionLens = 'contributors',
  table?: ContributionTableKind,
): string {
  if (table === undefined || table === 'details')
    return JSON.stringify({ version: 1, columns, hideZeroMembers });
  const defaults = contributionColumnTable(table, lens);
  const visible = defaults.ids.filter((id) => columns[id] ?? defaults.visible.has(id));
  return JSON.stringify({
    version: 2,
    cols: columnTokens(defaults, visible).join(','),
    hideZeroMembers,
    ...(showAllAccounts && { showAllAccounts: true }),
  });
}
