// Frozen pre-codec URL readers, moved unchanged. They decode old links for the 307 to the
// canonical form and serve callers that have not moved to the codec yet.
import { contributionDefaultPeriod, type ContributionFocus } from '@/models/contributions';
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
