'use client';
import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  repositoryTimelineEntry,
  repositoryTimelineOrigin,
} from '@/lib/presentation/timeline-navigation';
import type { RepositoryPageSource, RepositoryPageNavigation } from '@/models/repository-page';
import { useTableController } from '@/lib/navigation/use-table-controller';
import { useRepositoryPageControls } from '@/lib/navigation/use-repository-page-controls';
import {
  selectRepositoryPage,
  repositoryPageDefaultSort,
} from '@/lib/presentation/repository-page';
import { repositoryScopeHref } from '@/lib/presentation/repository-page-navigation';
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
import { PageState } from '@/components/feedback/page-state';
import styles from '@/features/repositories/repository-controls.module.css';
const prIds = repositoryPagePrColumns.map((column) => column.id),
  issueIds = repositoryPageIssueColumns.map((column) => column.id);
const prColumnIds = repositoryPagePrColumns
  .filter((column) => column.hideable !== false && !repositoryInlineColumnIds.has(column.id))
  .map((column) => column.id);
const issueColumnIds = repositoryPageIssueColumns
  .filter((column) => column.hideable !== false && !repositoryInlineColumnIds.has(column.id))
  .map((column) => column.id);
export function RepositoryPageScreen({
  viewerId,
  source,
  navigation,
}: {
  viewerId: string;
  source: RepositoryPageSource;
  navigation: RepositoryPageNavigation;
}) {
  const router = useRouter();
  const search = useSearchParams().toString();
  const controller = useTableController({
    queryKey: source.kind,
    scopeKey: 'repository:' + source.repository.slug + ':' + source.kind,
    viewerId,
    columnIds: source.kind === 'prs' ? prIds : issueIds,
    defaultSort: repositoryPageDefaultSort,
    historyMode: 'push',
  });
  const settings = useRepositoryPageControls(
    viewerId,
    source,
    source.kind === 'prs' ? prColumnIds : issueColumnIds,
    controller,
  );
  const page = useMemo(
    () => (settings.filters ? selectRepositoryPage(source, settings.filters) : null),
    [source, settings.filters],
  );
  if (!page || !settings.filters)
    return (
      <>
        <RepositoryHeader
          repository={source.repository}
          asOf={source.asOf}
          returnTo={source.drilldown.returnTo}
          navigation={navigation}
          activeKind={source.kind}
        />
        <PageState title="Invalid repository filters">
          This link contains unsupported filters for the selected scope.{' '}
          <Button variant="outline" onClick={settings.clearFilters}>
            Clear filters
          </Button>
        </PageState>
      </>
    );
  return (
    <RepositoryPageView
      page={page}
      navigation={navigation}
      controller={controller}
      controls={{
        timelineHref: repositoryTimelineEntry(
          source,
          { ...settings.filters, search: controller.draftSearch },
          repositoryTimelineOrigin(
            source,
            { ...settings.filters, search: controller.draftSearch },
            search,
            {
              ...controller.query,
              search: controller.draftSearch,
              page: controller.draftSearch === controller.query.search ? controller.query.page : 1,
            },
            settings.visibility.value,
            source.kind === 'prs' ? prColumnIds : issueColumnIds,
            settings.chartsVisible,
          ),
        ),
        onTimeline: (event) => {
          if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          event.preventDefault();
          const captured = controller.flushSearch();
          const origin = repositoryTimelineOrigin(
            source,
            { ...settings.filters!, search: captured.search },
            window.location.search,
            captured,
            settings.visibility.value,
            source.kind === 'prs' ? prColumnIds : issueColumnIds,
            settings.chartsVisible,
          );
          const href = repositoryTimelineEntry(
            source,
            { ...settings.filters!, search: captured.search },
            origin,
          );
          if (href) {
            window.history.replaceState(null, '', origin);
            router.push(href);
          }
        },
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
          <RepositoryScopeControls
            source={source}
            onChange={(mode, range) => {
              controller.flushSearch();
              router.push(repositoryScopeHref(source, mode, range, window.location.search), {
                scroll: false,
              });
            }}
          />
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
        preferences: (
          <div className={styles.preferences}>
            <span>
              {settings.storageAvailable
                ? 'Columns, sorting and chart visibility saved for this repository on this browser.'
                : 'Browser storage is unavailable. Changes still work for this visit.'}
            </span>
            <Button variant="ghost" size="sm" onClick={settings.resetPresentation}>
              Reset view preferences
            </Button>
          </div>
        ),
      }}
    />
  );
}
