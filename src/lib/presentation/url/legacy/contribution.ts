// Frozen pre-codec URL readers, moved unchanged. They decode old links for the 307 to the
// canonical form and serve callers that have not moved to the codec yet.
import { repositoryCatalog } from '@/config/repositories';
import {
  contributionActorTypes,
  contributionDefaultPeriod,
  type ContributionFocus,
} from '@/models/contributions';
import type {
  ContributionSettings,
  ContributionDirectory,
  ContributionControlDirectory,
} from '@/models/contribution-settings';
import { periodSelectionSchema } from '@/models/reporting-period';
import {
  contributionSampleScenarios,
  type ContributionSampleScenario,
  type CompanyBreakdown,
} from '@/models/contribution-page';
import { resolveReportingPeriod } from '../../reporting-period';
import {
  defaultContributionSettings,
  validateContributionSettings,
} from '../../contribution-settings-rules';
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
export function companyFocus(
  segments: string[],
): Extract<ContributionFocus, { kind: 'company' }> | null {
  if (segments.length === 1 && segments[0] === 'unmapped')
    return { kind: 'company', companyId: null };
  if (segments.length === 2 && segments[0] === 'id' && segments[1])
    return { kind: 'company', companyId: segments[1] };
  return null;
}
export function readContributionLayoutQuery(params: URLSearchParams): {
  sample: ContributionSampleScenario;
  breakdown: CompanyBreakdown;
} | null {
  const sample = params.get('sample') ?? 'reference',
    view = params.get('view') ?? 'members';
  if (
    !contributionSampleScenarios.some((value) => value === sample) ||
    !['members', 'repositories'].includes(view)
  )
    return null;
  return {
    sample: sample as ContributionSampleScenario,
    breakdown: view as CompanyBreakdown,
  };
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
