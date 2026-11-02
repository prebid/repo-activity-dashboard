import { readRepositoryDrilldown } from './url/legacy/repository';
export { readRepositoryDrilldown };
import { repositoryDrilldownSchema, type RepositoryDrilldown } from '@/models/repository-drilldown';
import type { OverviewRepository } from '@/models/repository-overview';

export function repositoryDrilldownHref(
  repo: OverviewRepository,
  input: RepositoryDrilldown,
): string {
  const { selection, returnTo } = repositoryDrilldownSchema.parse(input);
  const params = new URLSearchParams({ scope: selection.scope, metric: selection.metric });
  if (selection.scope === 'current' && selection.metric === 'agedPrs')
    params.set('age', String(selection.ageDays));
  if (selection.scope === 'period') {
    params.set('from', selection.range.start);
    params.set('to', selection.range.end);
    params.set('inclusive', selection.range.endInclusive ? '1' : '0');
    if (selection.branch) params.set('branch', selection.branch);
  }
  if (returnTo !== '/repos') params.set('returnTo', returnTo);
  if (readRepositoryDrilldown(params, repo).status !== 'valid')
    throw new Error('Invalid repository drilldown');
  return '/repos/' + encodeURIComponent(repo.slug) + '?' + params.toString();
}
