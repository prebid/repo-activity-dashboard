import { readTableColumns } from './table-column-preferences';
import { repositoryCatalog } from '@/config/repositories';
import { contributionActorTypes, contributionDefaultPeriod } from '@/models/contributions';
import {
  contributionSettingsSchema,
  type ContributionSettings,
  type ContributionDirectory,
  type ContributionControlDirectory,
} from '@/models/contribution-settings';
import { periodSelectionSchema } from '@/models/reporting-period';
import { resolveReportingPeriod } from './reporting-period';

export const contributionScopeKeys = [
  'scope',
  'period',
  'from',
  'through',
  'repo',
  'type',
  'population',
  'account',
  'company',
  'exclude',
] as const;
export function hasContributionScope(params: URLSearchParams): boolean {
  return contributionScopeKeys.some((key) => params.has(key));
}
export function defaultContributionSettings(
  directory: ContributionControlDirectory,
): ContributionSettings {
  return {
    period: contributionDefaultPeriod,
    selection: {
      repositoryIds: directory.repositories.map((row) => row.id),
      actorTypes: [...contributionActorTypes],
      population: { kind: 'all' },
      excludedAccountIds: [],
    },
  };
}
export function readContributionPeriod(params: URLSearchParams, asOf: string) {
  const raw = params.get('period');
  const parsed = periodSelectionSchema.safeParse(
    raw === 'custom'
      ? { kind: 'custom', from: params.get('from'), through: params.get('through') }
      : raw !== null
        ? { kind: 'preset', preset: raw }
        : contributionDefaultPeriod,
  );
  if (!parsed.success || (raw !== 'custom' && (params.has('from') || params.has('through'))))
    return null;
  try {
    resolveReportingPeriod(parsed.data, asOf);
    return parsed.data;
  } catch {
    return null;
  }
}
/** Invalid identities are rejected rather than silently broadening a report. */
function normaliseSettings(
  input: unknown,
  directory: ContributionControlDirectory,
  asOf: string,
): ContributionSettings | null {
  const parsed = contributionSettingsSchema.safeParse(input);
  if (!parsed.success) return null;
  const { period, selection } = parsed.data;
  try {
    resolveReportingPeriod(period, asOf);
  } catch {
    return null;
  }
  const knownRepos = new Set(directory.repositories.map((row) => row.id));
  if (selection.repositoryIds.some((id) => !knownRepos.has(id))) return null;
  const population = selection.population;
  return {
    period,
    selection: {
      repositoryIds: [...new Set(selection.repositoryIds)].sort(),
      actorTypes: contributionActorTypes.filter((type) => selection.actorTypes.includes(type)),
      population:
        population.kind === 'all'
          ? population
          : {
              kind: 'selected',
              accountIds: [...new Set(population.accountIds)].sort(),
              companyIds: [...new Set(population.companyIds)].sort(),
            },
      excludedAccountIds: [...new Set(selection.excludedAccountIds)].sort(),
    },
  };
}
export function validateContributionSettings(
  input: unknown,
  directory: ContributionDirectory,
  asOf: string,
): ContributionSettings | null {
  const settings = normaliseSettings(input, directory, asOf);
  if (!settings) return null;
  const accounts = new Set(directory.accounts.map((row) => row.id));
  const companies = new Set(directory.companies.map((row) => row.id));
  const { selection } = settings,
    population = selection.population;
  if (
    selection.excludedAccountIds.some((id) => !accounts.has(id)) ||
    (population.kind === 'selected' &&
      (population.accountIds.some((id) => !accounts.has(id)) ||
        population.companyIds.some((id) => id !== null && !companies.has(id))))
  )
    return null;
  return settings;
}
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
/** Decode the URL scope with its defaults, before any directory or identity validation. */
export function readContributionScopeInput(
  params: URLSearchParams,
  directory: ContributionControlDirectory,
  asOf: string,
) {
  if (params.has('scope') && params.get('scope') !== '1') return null;
  const defaults = defaultContributionSettings(directory);
  const mode =
    params.get('population') ??
    (params.has('account') || params.has('company') ? 'selected' : 'all');
  if (
    !['all', 'selected'].includes(mode) ||
    (mode === 'all' && (params.has('account') || params.has('company')))
  )
    return null;
  const list = (key: string) => params.getAll(key).filter(Boolean);
  return {
    period: readContributionPeriod(params, asOf),
    selection: {
      repositoryIds: params.has('repo') ? list('repo') : defaults.selection.repositoryIds,
      actorTypes: params.has('type') ? list('type') : defaults.selection.actorTypes,
      population:
        mode === 'all'
          ? ({ kind: 'all' } as const)
          : {
              kind: 'selected' as const,
              accountIds: list('account'),
              companyIds: params.getAll('company').map((id) => id || null),
            },
      excludedAccountIds: list('exclude'),
    },
  };
}
export function readContributionSettings(
  params: URLSearchParams,
  directory: ContributionDirectory,
  asOf: string,
): ContributionSettings | null {
  const input = readContributionScopeInput(params, directory, asOf);
  return input && validateContributionSettings(input, directory, asOf);
}
/** Write the complete scope, including explicit empty selections and relative presets. */
export function writeContributionSettings(
  search: string,
  value: ContributionSettings,
  resetPages = false,
): string {
  const params = new URLSearchParams(search);
  for (const key of contributionScopeKeys) params.delete(key);
  params.set('scope', '1');
  params.set('period', value.period.kind === 'preset' ? value.period.preset : 'custom');
  if (value.period.kind === 'custom') {
    params.set('from', value.period.from);
    params.set('through', value.period.through);
  }
  const list = (key: string, values: readonly string[]) => {
    if (!values.length) params.set(key, '');
    else for (const value of values) params.append(key, value);
  };
  const equalIds = (a: readonly string[], b: readonly string[]) => {
    const left = new Set(a),
      right = new Set(b);
    return left.size === right.size && [...left].every((id) => right.has(id));
  };
  if (
    !value.selection.repositoryIds.length ||
    !equalIds(
      value.selection.repositoryIds,
      repositoryCatalog.filter((repo) => repo.enabled).map((repo) => repo.id),
    )
  )
    list('repo', [...new Set(value.selection.repositoryIds)].sort());
  if (!equalIds(value.selection.actorTypes, contributionActorTypes))
    list(
      'type',
      contributionActorTypes.filter((type) => value.selection.actorTypes.includes(type)),
    );
  if (value.selection.population.kind === 'selected') {
    params.set('population', 'selected');
    for (const id of [...new Set(value.selection.population.accountIds)].sort())
      params.append('account', id);
    for (const id of [...new Set(value.selection.population.companyIds)].sort())
      params.append('company', id ?? '');
  }
  for (const id of [...new Set(value.selection.excludedAccountIds)].sort())
    params.append('exclude', id);
  if (resetPages)
    for (const key of ['report', 'members', 'repositories', 'details'])
      params.delete(key + '.page');
  return params.toString();
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
