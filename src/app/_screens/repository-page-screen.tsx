'use client';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { RepositoryPageModel, RepositoryPageNavigation } from '@/models/repository-page';
import { useTableController } from '@/lib/navigation/use-table-controller';
import { useRepositoryPageControls } from '@/lib/navigation/use-repository-page-controls';
import { selectRepositoryPage } from '@/lib/presentation/repository-page';
import { repositoryScopeHref } from '@/lib/presentation/repository-page-navigation';
import { RepositoryPageView } from '@/features/repositories/repository-page-view';
import { RepositoryHeader } from '@/features/repositories/repository-header';
import { RepositoryFilterControls } from '@/features/repositories/repository-filter-controls';
import { RepositoryScopeControls } from '@/features/repositories/repository-scope-controls';
import {
  repositoryPagePrColumns,
  repositoryPageIssueColumns,
} from '@/features/repositories/repository-page-columns';
import { Button } from '@/components/ui/button';
import { PageState } from '@/components/feedback/page-state';
import styles from '@/features/repositories/repository-controls.module.css';
const prIds = repositoryPagePrColumns.map((column) => column.id),
  issueIds = repositoryPageIssueColumns.map((column) => column.id);
const inline = new Set(['labels', 'state', 'authorType']);
const prColumnIds = repositoryPagePrColumns
  .filter((column) => column.hideable !== false && !inline.has(column.id))
  .map((column) => column.id);
const issueColumnIds = repositoryPageIssueColumns
  .filter((column) => column.hideable !== false && !inline.has(column.id))
  .map((column) => column.id);
export function RepositoryPageScreen({
  viewerId,
  page: source,
  navigation,
}: {
  viewerId: string;
  page: RepositoryPageModel;
  navigation: RepositoryPageNavigation;
}) {
  const router = useRouter();
  const controller = useTableController({
    queryKey: source.kind,
    scopeKey: 'repository:' + source.repository.slug + ':' + source.kind,
    viewerId,
    columnIds: source.kind === 'prs' ? prIds : issueIds,
    defaultSort: source.defaultSort,
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
                ? 'Columns and sorting saved for this repository on this browser.'
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
