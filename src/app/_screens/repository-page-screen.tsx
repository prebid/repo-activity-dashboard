'use client';
import type { RepositoryPageModel, RepositoryPageNavigation } from '@/models/repository-page';
import { useTableController } from '@/lib/navigation/use-table-controller';
import { RepositoryPageView } from '@/features/repositories/repository-page-view';
import {
  repositoryPagePrColumns,
  repositoryPageIssueColumns,
} from '@/features/repositories/repository-page-columns';
const prIds = repositoryPagePrColumns.map((column) => column.id),
  issueIds = repositoryPageIssueColumns.map((column) => column.id);
export function RepositoryPageScreen({
  viewerId,
  page,
  navigation,
}: {
  viewerId: string;
  page: RepositoryPageModel;
  navigation: RepositoryPageNavigation;
}) {
  const controller = useTableController({
    queryKey: page.kind,
    scopeKey: 'repository:' + page.repository.slug + ':' + page.kind,
    viewerId,
    columnIds: page.kind === 'prs' ? prIds : issueIds,
    defaultSort: page.defaultSort,
  });
  return <RepositoryPageView page={page} navigation={navigation} controller={controller} />;
}
