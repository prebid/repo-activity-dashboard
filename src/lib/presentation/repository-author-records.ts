import type { DrilldownSelection, RepositoryDrilldown } from '@/models/repository-drilldown';
import type { OverviewRepository } from '@/models/repository-overview';
import {
  authorAccountSchema,
  authorTableColumnIds,
  type AuthorSelection,
} from '@/models/repository-insights';
import { repositoryDrilldownHref } from './repository-drilldown';
import { readTableQuery, writeTableQuery, type TableQuery } from './table-query';

export function isAuthorSelection(selection: DrilldownSelection): selection is AuthorSelection {
  return (
    selection.scope === 'period' &&
    (selection.metric === 'prAuthors' || selection.metric === 'issueAuthors')
  );
}
export function repositoryAuthorsHref(
  repo: OverviewRepository,
  drilldown: RepositoryDrilldown,
  query: TableQuery,
): string {
  if (!isAuthorSelection(drilldown.selection)) throw new Error('Expected author-list scope');
  const [path, search] = repositoryDrilldownHref(repo, drilldown).split('?');
  return path + '?' + writeTableQuery(search, 'authors', query);
}
export function repositoryAuthorRecordsHref(
  repo: OverviewRepository,
  drilldown: RepositoryDrilldown,
  account: string,
  query: TableQuery,
): string {
  const [path, search] = repositoryAuthorsHref(repo, drilldown, query).split('?');
  return path + '/authors/' + encodeURIComponent(authorAccountSchema.parse(account)) + '?' + search;
}
export function authorListQuery(params: URLSearchParams): TableQuery {
  return readTableQuery(params.toString(), 'authors', authorTableColumnIds);
}
