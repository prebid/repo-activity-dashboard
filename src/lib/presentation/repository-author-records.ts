export { authorListQuery, readAuthorAccountSegment } from './url/legacy/repository';
import type { DrilldownSelection, RepositoryDrilldown } from '@/models/repository-drilldown';
import type { OverviewRepository } from '@/models/repository-overview';
import type { RecordSelection } from '@/models/repository-records';
import { authorAccountSchema, type AuthorSelection } from '@/models/repository-insights';
import type { TableQuery } from '@/models/table-query';
import {
  childHref,
  drilldownValues,
  repositoryDrilldownHref,
  summaryBack,
} from './repository-drilldown';
import { mergeValues, sortToken } from './repository-url';
import { defaultValue } from './url/defaults';
import type { UrlValues } from './url/registry';

export function isAuthorSelection(selection: DrilldownSelection): selection is AuthorSelection {
  return (
    selection.scope === 'period' &&
    (selection.metric === 'prAuthors' || selection.metric === 'issueAuthors')
  );
}
/** The period record list an author list counts, which an author's page narrows to one author. */
export function authorRecordSelection(selection: AuthorSelection): RecordSelection {
  return {
    scope: 'period',
    metric: selection.metric === 'prAuthors' ? 'prsOpened' : 'issuesOpened',
    range: selection.range,
  };
}
/** An author list's search, sort and page as its own fields; its default sort is not written. */
function authorListFields(selection: AuthorSelection, query: TableQuery) {
  const sort = sortToken(query);
  return {
    q: query.search || undefined,
    sort:
      sort === defaultValue('/repos/[slug]', 'sort', { metric: selection.metric }, 'insight')
        ? undefined
        : sort,
    page: query.page > 1 ? String(query.page) : undefined,
  };
}
/** The author list an author's records came from, with its search, sort and page. */
export function repositoryAuthorsHref(
  repo: OverviewRepository,
  drilldown: RepositoryDrilldown,
  query: TableQuery,
): string {
  const { selection } = drilldown;
  if (!isAuthorSelection(selection)) throw new Error('Expected author-list scope');
  return repositoryDrilldownHref(
    repo,
    drilldown,
    mergeValues({}, authorListFields(selection, query)),
  );
}
/**
 * One author's records. The page keeps its author list's search, sort and page (`listq`,
 * `listsort`, `listpage`) and that list's return context, so its parent is always that list;
 * `presentation` is the viewer's saved record-list choices (decision C3).
 */
export function repositoryAuthorRecordsHref(
  repo: OverviewRepository,
  drilldown: RepositoryDrilldown,
  account: string,
  query: TableQuery,
  presentation: UrlValues = {},
): string {
  const { selection } = drilldown;
  if (!isAuthorSelection(selection)) throw new Error('Expected author-list scope');
  const list = {
    route: '/repos/[slug]' as const,
    segments: { slug: [repo.slug] },
    values: drilldownValues(selection),
  };
  const { q, sort, page } = authorListFields(selection, query);
  return childHref({
    route: '/repos/[slug]/authors/[account]',
    segments: { slug: [repo.slug], account: [authorAccountSchema.parse(account)] },
    values: {
      ...presentation,
      ...list.values,
      ...mergeValues({}, { listq: q, listsort: sort, listpage: page }),
      back: summaryBack(list, drilldown.returnTo),
    },
  });
}
