import type { ContributionContext } from '@/models/contributions';
import type { ReportMetric } from '@/models/contribution-metrics';
import type { ContributionSettings } from '@/models/contribution-settings';
import { writeContributionSettings } from './contribution-settings';
import { contributionActorTypes, type ContributionAccount } from '@/models/contributions';
import {
  contributionSampleScenarios,
  type ContributionArea,
  type ContributionSampleScenario,
  type CompanyBreakdown,
} from '@/models/contribution-page';
import type { ContributionFocus } from '@/models/contributions';
import { safeReturnPath } from './navigation';

export function contributionPath(
  target: ContributionArea | Exclude<ContributionFocus, { kind: 'overview' }>,
): string {
  if (typeof target === 'string') return '/' + target;
  if (target.kind === 'contributor') return '/contributors/' + encodeURIComponent(target.accountId);
  return target.companyId === null
    ? '/companies/unmapped'
    : '/companies/id/' + encodeURIComponent(target.companyId);
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
export function contributionHref(
  target: Parameters<typeof contributionPath>[0],
  sample: ContributionSampleScenario,
  returnTo?: string,
  actorTypes: readonly ContributionAccount['actorType'][] = contributionActorTypes,
  settings?: ContributionSettings,
): string {
  const params = new URLSearchParams();
  if (sample !== 'reference') params.set('sample', sample);
  writeContributionActorTypes(params, actorTypes);
  if (returnTo) params.set('returnTo', safeContributionReturn(returnTo, '/contributors'));
  const search = settings
    ? writeContributionSettings(params.toString(), settings)
    : params.toString();
  return contributionPath(target) + (search ? '?' + search : '');
}
export function safeContributionReturn(value: string | null | undefined, fallback: string): string {
  if (!value || value.length > 65536) return fallback;
  const path = safeReturnPath(value);
  return /^\/(contributors|companies)(?:[/?#]|$)/.test(path) ? path : fallback;
}
export function readContributionLayoutQuery(params: URLSearchParams): {
  sample: ContributionSampleScenario;
  breakdown: CompanyBreakdown;
  actorTypes: ContributionAccount['actorType'][];
} | null {
  const requestedTypes = params.has('type')
    ? params.getAll('type').filter(Boolean)
    : [...contributionActorTypes];
  if (requestedTypes.some((type) => !contributionActorTypes.some((known) => known === type)))
    return null;
  const actorTypes = contributionActorTypes.filter((type) => requestedTypes.includes(type));
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
    actorTypes,
  };
}
export function companyBreakdownHref(path: string, search: string, view: CompanyBreakdown): string {
  const params = new URLSearchParams(search);
  if (view === 'members') params.delete('view');
  else params.set('view', view);
  return path + (params.size ? '?' + params.toString() : '');
}

export function writeContributionActorTypes(
  params: URLSearchParams,
  selected: readonly ContributionAccount['actorType'][],
): void {
  params.delete('type');
  const types = contributionActorTypes.filter((type) => selected.includes(type));
  if (types.length === contributionActorTypes.length) return;
  if (!types.length) params.set('type', '');
  else for (const type of types) params.append('type', type);
}
export function contributionMetricHref(
  target: Parameters<typeof contributionPath>[0],
  sample: ContributionSampleScenario,
  context: ContributionContext,
  metric: ReportMetric,
  returnTo: string,
  repositoryId?: string,
): string {
  const settings = {
    period: context.period,
    selection: { ...context.selection, ...(repositoryId ? { repositoryIds: [repositoryId] } : {}) },
  };
  const url = new URL(
    contributionHref(target, sample, returnTo, settings.selection.actorTypes, settings),
    'https://dashboard.invalid',
  );
  url.searchParams.set('metric', metric);
  return url.pathname + url.search;
}
