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
import {
  contributionSettingsSchema,
  type ContributionSettings,
  type ContributionDirectory,
  type ContributionControlDirectory,
} from '@/models/contribution-settings';

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

export function readContributionPresentation(raw: string | null, columnIds: readonly string[]) {
  let hideZeroMembers = false;
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    hideZeroMembers = !!(
      value &&
      typeof value === 'object' &&
      'version' in value &&
      value.version === 1 &&
      'hideZeroMembers' in value &&
      value.hideZeroMembers === true
    );
  } catch {
    /* Invalid browser preferences use presentation defaults. */
  }
  return { columns: readTableColumns(raw, columnIds), hideZeroMembers };
}
export function serializeContributionPresentation(
  columns: Record<string, boolean>,
  hideZeroMembers: boolean,
): string {
  return JSON.stringify({ version: 1, columns, hideZeroMembers });
}
