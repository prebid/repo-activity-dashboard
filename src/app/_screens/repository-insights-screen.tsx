'use client';
import { followCaptured } from '@/lib/navigation/follow-captured';
import { pendingTableQuery } from '@/lib/presentation/table-controller';
import type { RepositoryPageNavigation } from '@/models/repository-page';
import { usePathname, useSearchParams } from 'next/navigation';
import { repositoryTimelineEntry } from '@/lib/presentation/timeline-navigation';
import { defaultRepositoryFilters } from '@/lib/presentation/repository-page-query';
import { writeTableQuery } from '@/lib/presentation/table-query';
import { useTableController } from '@/lib/navigation/use-table-controller';
import { usePendingNavigation } from '@/lib/navigation/use-pending-navigation';
import { authorTableColumnIds, type RepositoryInsight } from '@/models/repository-insights';
import {
  RepositoryInsightsView,
  contributionDetailColumns,
} from '@/features/repositories/repository-insights-view';
import { repositoryMergedPrColumns } from '@/features/repositories/repository-page-columns';
const creditIds = contributionDetailColumns.map((column) => column.id),
  prIds = repositoryMergedPrColumns.map((column) => column.id);
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
  const path = usePathname(),
    search = useSearchParams().toString(),
    pendingNavigation = usePendingNavigation();
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
  const scope = {
    ...insight,
    kind: insight.kind === 'authors' ? insight.recordKind : ('prs' as const),
  };
  const filters = defaultRepositoryFilters(scope.kind);
  const href = repositoryTimelineEntry(
    scope,
    filters,
    path + '?' + writeTableQuery(search, key, pendingTableQuery(controller)),
  );
  return (
    <RepositoryInsightsView
      insight={insight}
      navigation={navigation}
      controller={controller}
      timelineHref={href}
      onTimeline={(event) =>
        followCaptured(
          event,
          () => {
            const origin =
              path + '?' + writeTableQuery(window.location.search, key, controller.flushSearch());
            return { origin, href: repositoryTimelineEntry(scope, filters, origin) };
          },
          (href) => pendingNavigation.push(href, 'timeline'),
        )
      }
      timelinePending={pendingNavigation.pendingKey === 'timeline'}
    />
  );
}
