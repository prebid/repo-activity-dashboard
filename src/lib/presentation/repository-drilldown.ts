import { repositoryDrilldownSchema, type RepositoryDrilldown } from '@/models/repository-drilldown';
import type { OverviewRepository } from '@/models/repository-overview';

type ReadDrilldown =
  { status: 'none' } | { status: 'invalid' } | { status: 'valid'; value: RepositoryDrilldown };

/** The route supplies a catalog-resolved repository; malformed scope never becomes a default list. */
export function readRepositoryDrilldown(
  params: URLSearchParams,
  repo: OverviewRepository,
): ReadDrilldown {
  const fields = ['scope', 'metric', 'age', 'from', 'to', 'inclusive', 'branch', 'returnTo'];
  if (!fields.some((key) => params.has(key))) return { status: 'none' };
  const selection: Record<string, unknown> = {
    scope: params.get('scope'),
    metric: params.get('metric'),
  };
  if (params.has('age')) selection.ageDays = Number(params.get('age'));
  if (params.has('branch')) selection.branch = params.get('branch');
  if (['from', 'to', 'inclusive'].some((key) => params.has(key))) {
    const inclusive = params.get('inclusive');
    selection.range = {
      start: params.get('from'),
      end: params.get('to'),
      endInclusive: inclusive === '1' ? true : inclusive === '0' ? false : undefined,
    };
  }
  const parsed = repositoryDrilldownSchema.safeParse({
    selection,
    returnTo: params.get('returnTo') ?? '/repos',
  });
  if (!parsed.success) return { status: 'invalid' };
  const result = parsed.data;
  if (
    result.selection.scope === 'period' &&
    result.selection.branch !== undefined &&
    result.selection.branch !== repo.primaryBranch
  )
    return { status: 'invalid' };
  return { status: 'valid', value: result };
}

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
