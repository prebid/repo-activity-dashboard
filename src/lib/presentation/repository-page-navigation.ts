import type { RepositoryPageSource } from '@/models/repository-page';
import { repositoryPageFiltersSchema } from '@/models/repository-page';
import { periodPresets, type DateRange, type ResolvedPeriod } from '@/models/reporting-period';
import { resolveReportingPeriod } from './reporting-period';
import { repositoryDrilldownHref } from './repository-drilldown';
import { readRepositoryFilters, writeRepositoryFilters } from './repository-page-query';

export type RepositoryActivityMode = 'current' | 'created' | 'completed';
export function repositoryActivityMode(source: RepositoryPageSource): RepositoryActivityMode {
  const selection = source.drilldown.selection;
  return selection.scope === 'current'
    ? 'current'
    : ['prsMerged', 'issuesClosed'].includes(selection.metric)
      ? 'completed'
      : 'created';
}
export function repositoryActivityPeriod(source: RepositoryPageSource): ResolvedPeriod {
  const selection = source.drilldown.selection;
  if (selection.scope === 'current')
    return resolveReportingPeriod({ kind: 'preset', preset: 'this-month' }, source.asOf);
  for (const preset of periodPresets) {
    const period = resolveReportingPeriod({ kind: 'preset', preset }, source.asOf);
    if (JSON.stringify(period.range) === JSON.stringify(selection.range)) return period;
  }
  const range = selection.range;
  return {
    selection: {
      kind: 'custom',
      from: range.start.slice(0, 10),
      through: new Date(new Date(range.end).getTime() - Number(!range.endInclusive))
        .toISOString()
        .slice(0, 10),
    },
    range,
    comparison: range,
    timezone: 'UTC',
  };
}
/** A deliberate scope change keeps compatible filters and presentation, but starts on page one. */
export function repositoryScopeHref(
  source: RepositoryPageSource,
  mode: RepositoryActivityMode,
  range: DateRange,
  search: string,
): string {
  const metric =
    source.kind === 'prs'
      ? mode === 'created'
        ? 'prsOpened'
        : 'prsMerged'
      : mode === 'created'
        ? 'issuesOpened'
        : 'issuesClosed';
  const base = repositoryDrilldownHref(source.repository, {
    selection:
      mode === 'current'
        ? { scope: 'current', metric: source.kind === 'prs' ? 'totalOpenPrs' : 'openIssues' }
        : {
            scope: 'period',
            metric,
            range,
            ...(metric === 'prsMerged' ? { branch: source.repository.primaryBranch } : {}),
          },
    returnTo: source.drilldown.returnTo,
  });
  const [path, query] = base.split('?'),
    params = new URLSearchParams(query),
    previous = new URLSearchParams(search);
  for (const field of ['sort', 'dir', 'columns', 'charts'])
    for (const value of previous.getAll(source.kind + '.' + field))
      params.append(source.kind + '.' + field, value);
  const filters = readRepositoryFilters(search, source);
  if (!filters) return path + '?' + params.toString();
  const next = {
    ...filters,
    eventRange: undefined,
    states: mode === 'current' ? [] : filters.states,
    ageBand: mode === 'current' ? filters.ageBand : undefined,
  };
  if (next.kind === 'prs' && mode !== 'current') {
    next.reviewers = undefined;
    next.approvals = undefined;
    next.agentReviewer = undefined;
    next.botReviewer = undefined;
  }
  return (
    path + '?' + writeRepositoryFilters(params.toString(), repositoryPageFiltersSchema.parse(next))
  );
}
