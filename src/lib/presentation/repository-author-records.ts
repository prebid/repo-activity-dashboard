import type { DrilldownSelection, RepositoryDrilldown } from '@/models/repository-drilldown';
import type { OverviewRepository } from '@/models/repository-overview';
import type { RecordSelection } from '@/models/repository-records';
import {
  authorAccountSchema,
  authorTableColumnIds,
  type AuthorSelection,
} from '@/models/repository-insights';
import { repositoryDrilldownHref } from './repository-drilldown';
import { readTableQuery, writeTableQuery } from './table-query';
import { type TableQuery } from '@/models/table-query';

/** Decode the route segment once; keep logical account validation strict and shared. */
export function readAuthorAccountSegment(segment: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    return null;
  }
  const account = authorAccountSchema.safeParse(decoded);
  return account.success ? account.data : null;
}

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
