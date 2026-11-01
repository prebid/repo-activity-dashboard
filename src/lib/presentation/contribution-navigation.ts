import type { ContributionContext } from '@/models/contributions';
import type { ReportMetric } from '@/models/contribution-metrics';
import type { ContributionSettings } from '@/models/contribution-settings';
import { writeContributionSettings } from './contribution-settings';
import {
  contributionSampleScenarios,
  type ContributionArea,
  type ContributionSampleScenario,
  type CompanyBreakdown,
} from '@/models/contribution-page';
import type { ContributionFocus } from '@/models/contributions';
import { withContributionReturn } from './contribution-return';

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
  settings?: ContributionSettings,
): string | null {
  const params = new URLSearchParams();
  if (sample !== 'reference') params.set('sample', sample);
  const search = settings
    ? writeContributionSettings(params.toString(), settings)
    : params.toString();
  return withContributionReturn(contributionPath(target) + (search ? '?' + search : ''), returnTo);
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
export const companyBreakdownLabels: Record<CompanyBreakdown, string> = {
  members: 'By contributor',
  repositories: 'By repository',
};
export function companyBreakdownHref(path: string, search: string, view: CompanyBreakdown): string {
  const params = new URLSearchParams(search);
  if (view === 'members') params.delete('view');
  else params.set('view', view);
  return path + (params.size ? '?' + params.toString() : '');
}

export function contributionMetricHref(
  target: Parameters<typeof contributionPath>[0],
  sample: ContributionSampleScenario,
  context: ContributionContext,
  metric: ReportMetric,
  returnTo: string,
  repositoryId?: string,
): string | null {
  const settings = {
    period: context.period,
    selection: { ...context.selection, ...(repositoryId ? { repositoryIds: [repositoryId] } : {}) },
  };
  const search = new URLSearchParams(writeContributionSettings('', settings));
  if (sample !== 'reference') search.set('sample', sample);
  const url = new URL(contributionPath(target), 'https://dashboard.invalid');
  url.search = search.toString();
  url.searchParams.set('metric', metric);
  return withContributionReturn(url.pathname + url.search, returnTo);
}
