'use client';
import type { RepositoryPageNavigation } from '@/models/repository-page';
import { useTableController } from '@/lib/navigation/use-table-controller';
import { authorTableColumnIds, type RepositoryInsight } from '@/models/repository-insights';
import {
  RepositoryInsightsView,
  contributionDetailColumns,
} from '@/features/repositories/repository-insights-view';
import { recordPrColumns } from '@/features/repositories/repository-records-view';
const creditIds = contributionDetailColumns.map((column) => column.id),
  prIds = recordPrColumns.map((column) => column.id);
const defaults = {
  authors: { sort: 'recordCount', descending: true },
  contributions: { sort: 'firstCreditAt', descending: true },
  duration: { sort: 'createdAt', descending: true },
};
export function RepositoryInsightsScreen({
  insight,
  viewerId,
  navigation,
}: {
  insight: RepositoryInsight;
  viewerId: string;
  navigation: RepositoryPageNavigation;
}) {
  const key =
    insight.kind === 'duration' ? 'prs' : insight.kind === 'authors' ? 'authors' : 'credits';
  const controller = useTableController({
    queryKey: key,
    scopeKey: 'repository:' + insight.repository.slug + ':' + key,
    viewerId,
    columnIds:
      insight.kind === 'duration'
        ? prIds
        : insight.kind === 'authors'
          ? authorTableColumnIds
          : creditIds,
    defaultSort: defaults[insight.kind],
  });
  return (
    <RepositoryInsightsView insight={insight} navigation={navigation} controller={controller} />
  );
}
