'use client';
import { followCaptured } from '@/lib/navigation/follow-captured';
import { pendingTableQuery } from '@/lib/presentation/table-controller';
import type { RepositoryPageNavigation } from '@/models/repository-page';
import { usePathname, useSearchParams } from 'next/navigation';
import { repositoryTimelineEntry } from '@/lib/presentation/timeline-navigation';
import { useSavedTimelinePresentation } from '@/lib/navigation/use-saved-timeline';
import { defaultRepositoryFilters } from '@/lib/presentation/repository-page-query';
import type { RepositoryLinkPresentation } from '@/lib/presentation/repository-url';
import { writeBoundTableQuery, type TableFields } from '@/lib/presentation/url/table-binding';
import { useTableController } from '@/lib/navigation/use-table-controller';
import { usePendingNavigation } from '@/lib/navigation/use-pending-navigation';
import { authorTableColumnIds, type RepositoryInsight } from '@/models/repository-insights';
import {
  RepositoryInsightsView,
  contributionDetailColumns,
} from '@/features/repositories/repository-insights-view';
import { repositoryMergedPrColumns } from '@/features/repositories/repository-page-columns';
import type { SavedPreference } from '@/models/preferences';
import type { TableQuery } from '@/models/table-query';
const creditIds = contributionDetailColumns.map((column) => column.id),
  prIds = repositoryMergedPrColumns.map((column) => column.id);
const fields: TableFields = { route: '/repos/[slug]', search: 'q', sort: 'sort', page: 'page' };
type SavedSort = Pick<TableQuery, 'sort' | 'descending'>;
export function RepositoryInsightsScreen({
  insight,
  viewerId,
  navigation,
  savedSort,
  links,
}: {
  insight: RepositoryInsight;
  viewerId: string;
  navigation: RepositoryPageNavigation;
  /** The table's saved sort, checked for shape by route composition; without it, sorts are not saved. */
  savedSort?: SavedPreference<SavedSort>;
  /** Saved presentation of the repository lists, which links to them carry (decision C3). */
  links?: RepositoryLinkPresentation;
}) {
  const path = usePathname(),
    search = useSearchParams().toString(),
    pendingNavigation = usePendingNavigation();
  const key =
    insight.kind === 'duration' ? 'prs' : insight.kind === 'authors' ? 'authors' : 'credits';
  const columnIds =
    insight.kind === 'duration'
      ? prIds
      : insight.kind === 'authors'
        ? authorTableColumnIds
        : creditIds;
  // An absent sort is each table's v1 default: authors by count, others newest first.
  const controller = useTableController({
    queryKey: key,
    scopeKey: 'repository:' + insight.repository.slug + ':' + key,
    viewerId,
    columnIds,
    savedSort,
    fields,
  });
  const scope = {
    ...insight,
    kind: insight.kind === 'authors' ? insight.recordKind : ('prs' as const),
  };
  const filters = defaultRepositoryFilters(scope.kind);
  const saved = useSavedTimelinePresentation('timeline.repository', 'repository');
  /** This insight's own address with its table state written in, as a Timeline's parent. */
  const origin = (query: string, table: Partial<TableQuery>) => {
    const written = writeBoundTableQuery(fields, query, table);
    return written ? path + '?' + written : path;
  };
  return (
    <RepositoryInsightsView
      insight={insight}
      navigation={navigation}
      controller={controller}
      links={links}
      timelineHref={repositoryTimelineEntry(
        scope,
        filters,
        origin(search, pendingTableQuery(controller)),
        saved,
        insight.asOf,
      )}
      onTimeline={(event) =>
        followCaptured(
          event,
          () => {
            const parent = origin(window.location.search, controller.flushSearch());
            return {
              origin: parent,
              href: repositoryTimelineEntry(scope, filters, parent, saved, insight.asOf),
            };
          },
          (href) => pendingNavigation.push(href, 'timeline'),
        )
      }
      timelinePending={pendingNavigation.pendingKey === 'timeline'}
    />
  );
}
