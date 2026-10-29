import { readTableColumns } from './table-column-preferences';
import { contributionActorTypes, contributionDefaultPeriod } from '@/models/contributions';
import {
  contributionSettingsSchema,
  type ContributionSettings,
  type ContributionDirectory,
} from '@/models/contribution-settings';
import { periodSelectionSchema } from '@/models/reporting-period';
import { resolveReportingPeriod } from './reporting-period';

const scopeKeys = [
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
  return scopeKeys.some((key) => params.has(key));
}
export function defaultContributionSettings(
  directory: ContributionDirectory,
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
export function validateContributionSettings(
  input: unknown,
  directory: ContributionDirectory,
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
  const known = (ids: readonly string[], rows: readonly { id: string }[]) =>
    ids.every((id) => rows.some((row) => row.id === id));
  if (
    !known(selection.repositoryIds, directory.repositories) ||
    !known(selection.excludedAccountIds, directory.accounts)
  )
    return null;
  const population = selection.population;
  if (
    population.kind === 'selected' &&
    (!known(population.accountIds, directory.accounts) ||
      !known(
        population.companyIds.filter((id): id is string => id !== null),
        directory.companies,
      ))
  )
    return null;
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
export function readContributionSettings(
  params: URLSearchParams,
  directory: ContributionDirectory,
  asOf: string,
): ContributionSettings | null {
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
  return validateContributionSettings(
    {
      period: readContributionPeriod(params, asOf),
      selection: {
        repositoryIds: params.has('repo') ? list('repo') : defaults.selection.repositoryIds,
        actorTypes: params.has('type') ? list('type') : defaults.selection.actorTypes,
        population:
          mode === 'all'
            ? { kind: 'all' }
            : {
                kind: 'selected',
                accountIds: list('account'),
                companyIds: params.getAll('company').map((id) => id || null),
              },
        excludedAccountIds: list('exclude'),
      },
    },
    directory,
    asOf,
  );
}
/** Write the complete scope, including explicit empty selections and relative presets. */
export function writeContributionSettings(
  search: string,
  value: ContributionSettings,
  resetPages = false,
): string {
  const params = new URLSearchParams(search);
  for (const key of scopeKeys) params.delete(key);
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
  list('repo', value.selection.repositoryIds);
  list('type', value.selection.actorTypes);
  params.set('population', value.selection.population.kind);
  if (value.selection.population.kind === 'selected') {
    for (const id of value.selection.population.accountIds) params.append('account', id);
    for (const id of value.selection.population.companyIds) params.append('company', id ?? '');
  }
  for (const id of value.selection.excludedAccountIds) params.append('exclude', id);
  if (resetPages)
    for (const key of ['report', 'members', 'repositories', 'details'])
      params.delete(key + '.page');
  return params.toString();
}
export function contributionPreferenceKey(viewerId: string, sample: string): string {
  return 'dashboard:contributions:v1:' + [viewerId, sample].map(encodeURIComponent).join(':');
}
export function serializeContributionPreferences(value: ContributionSettings): string {
  return JSON.stringify({ version: 1, settings: value });
}
export function readContributionPreferences(
  raw: string | null,
  directory: ContributionDirectory,
  asOf: string,
): ContributionSettings | null {
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
    return validateContributionSettings(parsed.settings, directory, asOf);
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
