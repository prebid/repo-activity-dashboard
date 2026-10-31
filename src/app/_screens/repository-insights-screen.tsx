'use client';
import type { RepositoryPageNavigation } from '@/models/repository-page';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { repositoryTimelineEntry } from '@/lib/presentation/timeline-navigation';
import { defaultRepositoryFilters } from '@/lib/presentation/repository-page-query';
import { writeTableQuery } from '@/lib/presentation/table-query';
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
  const path = usePathname(),
    search = useSearchParams().toString(),
    router = useRouter();
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
    path +
      '?' +
      writeTableQuery(search, key, {
        ...controller.query,
        search: controller.draftSearch,
        page: controller.draftSearch === controller.query.search ? controller.query.page : 1,
      }),
  );
  return (
    <RepositoryInsightsView
      insight={insight}
      navigation={navigation}
      controller={controller}
      timelineHref={href}
      onTimeline={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          return;
        event.preventDefault();
        const captured = controller.flushSearch(),
          origin = path + '?' + writeTableQuery(window.location.search, key, captured),
          next = repositoryTimelineEntry(scope, filters, origin);
        if (next) {
          window.history.replaceState(null, '', origin);
          router.push(next);
        }
      }}
    />
  );
}
