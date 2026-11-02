'use client';
import { useSavedTimelinePresentation } from '@/lib/navigation/use-saved-timeline';
import { followCaptured } from '@/lib/navigation/follow-captured';
import { useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { repositoryTimelineEntry } from '@/lib/presentation/timeline-navigation';
import type { RepositoryPageSource, RepositoryPageNavigation } from '@/models/repository-page';
import type { SavedPreference } from '@/models/preferences';
import type { TableQuery } from '@/models/table-query';
import type { RepositoryPresentation } from '@/lib/presentation/repository-page-preferences';
import type { RepositoryLinkPresentation } from '@/lib/presentation/repository-url';
import { useTableController } from '@/lib/navigation/use-table-controller';
import { usePendingNavigation } from '@/lib/navigation/use-pending-navigation';
import {
  recordListRoute,
  useRepositoryPageControls,
} from '@/lib/navigation/use-repository-page-controls';
import {
  selectRepositoryPage,
  repositoryPageDefaultSort,
} from '@/lib/presentation/repository-page';
import { pendingTableQuery } from '@/lib/presentation/table-controller';
import { writeBoundTableQuery, type TableFields } from '@/lib/presentation/url/table-binding';
import { RepositoryPageView } from '@/features/repositories/repository-page-view';
import { RepositoryCharts } from '@/features/repositories/repository-charts';
import { toggleChartSelection } from '@/lib/presentation/repository-chart-selection';
import { RepositoryHeader } from '@/features/repositories/repository-header';
import { RepositoryFilterControls } from '@/features/repositories/repository-filter-controls';
import { RepositoryScopeControls } from '@/features/repositories/repository-scope-controls';
import {
  repositoryInlineColumnIds,
  repositoryPagePrColumns,
  repositoryPageIssueColumns,
} from '@/features/repositories/repository-page-columns';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/feedback/empty-state';
const prIds = repositoryPagePrColumns.map((column) => column.id),
  issueIds = repositoryPageIssueColumns.map((column) => column.id);
const prColumnIds = repositoryPagePrColumns
  .filter((column) => column.hideable !== false && !repositoryInlineColumnIds.has(column.id))
  .map((column) => column.id);
const issueColumnIds = repositoryPageIssueColumns
  .filter((column) => column.hideable !== false && !repositoryInlineColumnIds.has(column.id))
  .map((column) => column.id);
/** The viewer's saved sections for this list kind, validated by route composition. */
export interface RepositoryPagePreferences {
  sort: SavedPreference<Pick<TableQuery, 'sort' | 'descending'>>;
  presentation: SavedPreference<RepositoryPresentation>;
  /** Saved presentation of every repository list, which links to other lists carry (C3). */
  links?: RepositoryLinkPresentation;
}
export function RepositoryPageScreen({
  viewerId,
  source,
  navigation,
  preferences,
}: {
  viewerId: string;
  source: RepositoryPageSource;
  navigation: RepositoryPageNavigation;
  /** Without them, changes last for this page only. */
  preferences?: RepositoryPagePreferences;
}) {
  const pendingNavigation = usePendingNavigation();
  const savedTimeline = useSavedTimelinePresentation('timeline.repository', 'repository');
  const pathname = usePathname(),
    search = useSearchParams().toString();
  const route = recordListRoute(source);
  const fields = useMemo<TableFields>(
    () => ({ route, search: 'q', sort: 'sort', page: 'page' }),
    [route],
  );
  const controller = useTableController({
    queryKey: source.kind,
    scopeKey: 'repository:' + source.repository.slug + ':' + source.kind,
    viewerId,
    columnIds: source.kind === 'prs' ? prIds : issueIds,
    defaultSort: repositoryPageDefaultSort,
    historyMode: 'push',
    savedSort: preferences?.sort,
    fields,
  });
  const settings = useRepositoryPageControls(
    viewerId,
    source,
    source.kind === 'prs' ? prColumnIds : issueColumnIds,
    controller,
    preferences?.presentation,
  );
  const page = useMemo(
    () => (settings.filters ? selectRepositoryPage(source, settings.filters) : null),
    [source, settings.filters],
  );
  const links = preferences?.links;
  if (!page || !settings.filters)
    return (
      <>
        <RepositoryHeader
          repository={source.repository}
          asOf={source.asOf}
          returnTo={source.drilldown.returnTo}
          links={links}
          navigation={navigation}
          activeKind={source.kind}
        />
        <EmptyState
          kind="error"
          title="Invalid repository filters"
          action={
            <Button variant="secondary" onClick={settings.clearFilters}>
              Clear filters
            </Button>
          }
        >
          This link contains unsupported filters for the selected scope.
        </EmptyState>
      </>
    );
  /** This list's own address with its table state written in, as a Timeline's parent. */
  const origin = (query: string, table: Partial<TableQuery>) => {
    const written = writeBoundTableQuery(fields, query, table);
    return written ? pathname + '?' + written : pathname;
  };
  return (
    <RepositoryPageView
      page={page}
      navigation={navigation}
      controller={controller}
      links={links}
      controls={{
        timelineHref: repositoryTimelineEntry(
          source,
          { ...settings.filters, search: controller.draftSearch },
          origin(search, pendingTableQuery(controller)),
          savedTimeline,
          source.asOf,
        ),
        onTimeline: (event) =>
          followCaptured(
            event,
            () => {
              const captured = controller.flushSearch();
              const parent = origin(window.location.search, captured);
              return {
                origin: parent,
                href: repositoryTimelineEntry(
                  source,
                  { ...settings.filters!, search: captured.search },
                  parent,
                  savedTimeline,
                  source.asOf,
                ),
              };
            },
            (href) => pendingNavigation.push(href, 'timeline'),
          ),
        timelinePending: pendingNavigation.pendingKey === 'timeline',
        charts: (
          <RepositoryCharts
            page={page}
            visible={settings.chartsVisible}
            onVisibilityChange={settings.changeCharts}
            onSelect={(selection) =>
              settings.updateFilters(toggleChartSelection(page.filters, selection))
            }
          />
        ),
        scope: !source.author && (
          <RepositoryScopeControls source={source} onChange={settings.changeScope} />
        ),
        filters: (
          <RepositoryFilterControls
            source={source}
            filters={settings.filters}
            table={controller}
            onChange={settings.updateFilters}
            onClear={settings.clearFilters}
          />
        ),
        visibility: settings.visibility,
        preferences: {
          storageAvailable: settings.storageAvailable,
          onReset: settings.resetPresentation,
        },
      }}
    />
  );
}
