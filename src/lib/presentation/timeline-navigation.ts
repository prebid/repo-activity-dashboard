import { safeReturnPath } from './navigation';
import {
  contributionReturnHref,
  contributionUrlFits,
  withContributionReturn,
} from './contribution-return';
import { readContributionScopeInput, writeContributionSettings } from './contribution-settings';
import type {
  ContributionControlDirectory,
  ContributionSettings,
} from '@/models/contribution-settings';
import type { RepositoryPageSource, RepositoryPageFilters } from '@/models/repository-page';
import { writeRepositoryFilters } from './repository-page-query';
import { currentReviewFilterKeys, withoutCurrentReviewFilters } from './repository-page-rules';
import type { TimelineControlContext } from '@/models/timeline-controls';
import { writeTimelineView } from './timeline-controls';
import { writeTableQuery } from './table-query';
import { writeTableColumns } from './table-column-preferences';
import type { TableQuery } from '@/models/table-query';
import { overviewReturnPathSchema, type RepositoryDrilldown } from '@/models/repository-drilldown';
import {
  repositoryTimelineFamilyMetrics,
  repositoryTimelineMetricSchema,
  repositoryTimelineMetricScope,
} from '@/models/repository-timeline';
export function repositoryTimelineOrigin(
  source: RepositoryPageSource,
  filters: RepositoryPageFilters,
  search: string,
  query: TableQuery,
  columns: Record<string, boolean>,
  columnIds: readonly string[],
  charts: boolean,
) {
  const params = new URLSearchParams(
    writeTableColumns(
      writeTableQuery(writeRepositoryFilters(search, filters), source.kind, query),
      source.kind,
      columns,
      columnIds,
    ),
  );
  params.set(source.kind + '.charts', charts ? '1' : '0');
  // Author record lists keep their own path, so Back and the parent link return to that list.
  return (
    '/repos/' +
    encodeURIComponent(source.repository.slug) +
    (source.author ? '/authors/' + encodeURIComponent(source.author.account) : '') +
    '?' +
    params.toString()
  );
}

/**
 * The Over time Report tab: the entry list's path and presentation (search, ranking, page), with
 * the current Over time population and period. List pages restart when that scope changed.
 */
export function contributionTimelineReportHref(
  params: URLSearchParams,
  path: string,
  settings: ContributionSettings,
  directory: ContributionControlDirectory,
  asOf: string,
): string {
  const fallback = new URLSearchParams(params);
  for (const key of [...fallback.keys()])
    if (key === 'timeline' || key.startsWith('timeline.')) fallback.delete(key);
  const fallbackHref = path + '?' + writeContributionSettings(fallback.toString(), settings);
  const restored = new URL(
    contributionReturnHref(params, fallbackHref),
    'https://dashboard.invalid',
  );
  const previous = readContributionScopeInput(restored.searchParams, directory, asOf);
  const changed =
    !previous?.period ||
    // The entry URL is unvalidated; only its serialized scope is compared.
    writeContributionSettings('', {
      ...previous,
      period: previous.period,
    } as ContributionSettings) !== writeContributionSettings('', settings);
  const href =
    restored.pathname +
    '?' +
    writeContributionSettings(restored.searchParams.toString(), settings, changed);
  return contributionUrlFits(href) ? href : fallbackHref;
}
export function contributionTimelineEntry(
  href: string,
  settings: ContributionSettings,
): string | null {
  const url = new URL(href, 'https://dashboard.invalid');
  const params = new URLSearchParams(writeContributionSettings('', settings));
  if (url.searchParams.has('sample')) params.set('sample', url.searchParams.get('sample')!);
  params.set('timeline', '1');
  return withContributionReturn(url.pathname + '?' + params.toString(), href);
}
/** The All Repositories origin a repository Timeline returns to, carried by its parent page. */
export function repositoryTimelineReturnTo(parent: string | null | undefined): string {
  if (!parent) return '/repos';
  const url = new URL(parent, 'https://dashboard.invalid');
  const origin = url.pathname === '/repos' ? parent : url.searchParams.get('returnTo');
  return overviewReturnPathSchema.safeParse(origin).success ? origin! : '/repos';
}
export function safeTimelineParent(value: string | null, path: string): string | null {
  if (!value) return null;
  if (!contributionUrlFits(value) || safeReturnPath(value) !== value) return null;
  const url = new URL(value, 'https://dashboard.invalid');
  if (url.searchParams.has('timelineParent')) return null;
  const author = url.pathname.startsWith(path + '/authors/')
    ? url.pathname.slice(path.length + '/authors/'.length)
    : null;
  return url.pathname === '/repos' ||
    url.pathname === path ||
    (author !== null && author !== '' && !author.includes('/'))
    ? value
    : null;
}
export function repositoryTimelineEntry(
  source: Pick<RepositoryPageSource, 'repository' | 'kind' | 'author'> & {
    drilldown: RepositoryDrilldown;
  },
  filters: RepositoryPageFilters,
  currentHref: string,
): string | null {
  const path = '/repos/' + encodeURIComponent(source.repository.slug);
  if (!safeTimelineParent(currentHref, path)) return null;
  if (
    filters.kind !== source.kind ||
    (source.author &&
      filters.authors.length > 0 &&
      !filters.authors.includes(source.author.account))
  )
    return null;
  const next = withoutCurrentReviewFilters(filters);
  const omitted =
    (source.drilldown.selection.scope === 'current' &&
      !['totalOpenPrs', 'openIssues'].includes(source.drilldown.selection.metric)) ||
    filters.ageBand !== undefined ||
    (filters.kind === 'prs' && currentReviewFilterKeys.some((key) => filters[key] !== undefined));
  next.ageBand = undefined;
  next.eventRange = undefined;
  if (source.author) next.authors = [source.author.account];
  const params = new URLSearchParams(writeRepositoryFilters('', next));
  params.set('timeline', '1');
  params.set('timeline.kind', source.kind);
  params.set('timeline.family', 'activity');
  if (
    source.drilldown.selection.scope === 'period' &&
    repositoryTimelineFamilyMetrics(source.kind, 'activity').some(
      (metric) => metric === source.drilldown.selection.metric,
    )
  )
    params.set('timeline.metric', source.drilldown.selection.metric);
  params.set('timelineParent', currentHref);
  if (omitted) params.set('timeline.omitted', 'current');
  const range =
    filters.eventRange ??
    (source.drilldown.selection.scope === 'period' ? source.drilldown.selection.range : null);
  if (range) {
    params.set('period', 'custom');
    params.set('from', range.start.slice(0, 10));
    params.set(
      'through',
      new Date(Date.parse(range.end) - Number(!range.endInclusive)).toISOString().slice(0, 10),
    );
    params.set('timeline.from', range.start);
    params.set('timeline.to', range.end);
    params.set('timeline.inclusive', range.endInclusive ? '1' : '0');
  } else params.set('period', 'this-year');
  const href = path + '?' + params.toString();
  return contributionUrlFits(href) ? href : null;
}
export function matrixRepositoryTimelineHref(
  context: TimelineControlContext,
  slug: string,
  currentHref: string,
  metric = context.view.metric,
) {
  const params = new URLSearchParams(currentHref.split('?')[1]);
  params.delete('repo');
  params.delete('summary');
  params.delete('timeline.window');
  params.delete('timeline.sort');
  params.delete('timeline.dir');
  params.delete('timeline.page');
  const selected = repositoryTimelineMetricSchema.parse(metric),
    scope = repositoryTimelineMetricScope(selected);
  const view = {
    ...context.view,
    metric: selected,
    kind: scope.recordKind,
    family: scope.family,
    selectedMetrics: undefined,
    sort: 'period',
    descending: false,
    page: 1,
  };
  const path = '/repos/' + encodeURIComponent(slug);
  const url = new URL(path, 'https://dashboard.invalid');
  url.search = writeTimelineView(params.toString(), 'repository', view);
  // The incoming data scope is explicit; chart/column defaults belong to the destination account.
  url.searchParams.delete('timeline.state');
  url.searchParams.delete('timeline.chart');
  url.searchParams.set('timelineParent', currentHref);
  return contributionUrlFits(url.pathname + url.search) ? url.pathname + url.search : null;
}
