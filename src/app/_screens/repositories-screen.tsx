'use client';
import { useMemo } from 'react';
import { AllRepositoriesView } from '@/features/repositories/all-repositories-view';
import { overviewSettingsColumns } from '@/features/repositories/overview-columns';
import { useTableController } from '@/lib/navigation/use-table-controller';
import { useOverviewSettings } from '@/lib/navigation/use-overview-settings';
import { useUrlState } from '@/lib/navigation/use-url-state';
import { selectOverviewSample } from '@/lib/presentation/overview-samples';
import { withOverviewSort } from '@/lib/presentation/overview-sort';
import type { RepositoryLinkPresentation } from '@/lib/presentation/repository-url';
import { urlHref } from '@/lib/presentation/url/codec';
import type { TableFields } from '@/lib/presentation/url/table-binding';
import type { OverviewSettings } from '@/models/overview-settings';
import type { RepositoryOverviewSamples } from '@/models/repository-overview';
import type { SavedPreference } from '@/models/preferences';
import type { TableQuery } from '@/models/table-query';
const backlogFields: TableFields = {
  route: '/repos',
  sort: 'bsort',
  page: 'bpage',
  peers: ['asort', 'apage'],
};
const activityFields: TableFields = {
  route: '/repos',
  sort: 'asort',
  page: 'apage',
  peers: ['bsort', 'bpage'],
};
type SavedSort = Pick<TableQuery, 'sort' | 'descending'>;
/** The viewer's saved sections, validated by route composition for the first render. */
export interface RepositoriesPreferences {
  overview: SavedPreference<OverviewSettings>;
  backlogSort: SavedPreference<SavedSort>;
  activitySort: SavedPreference<SavedSort>;
  /** Saved record and insight presentation, which the Summary's links carry (decision C3). */
  links?: RepositoryLinkPresentation;
}
export function RepositoriesScreen({
  viewerId,
  samples,
  preferences,
}: {
  viewerId: string;
  samples: RepositoryOverviewSamples;
  /** Without them, changes last for this page only. */
  preferences?: RepositoriesPreferences;
}) {
  const repositories = useMemo(
    () => samples.repositories.map((row) => row.repository),
    [samples.repositories],
  );
  const definition = useMemo(
    () => ({ ...overviewSettingsColumns, repositoryIds: repositories.map((repo) => repo.id) }),
    [repositories],
  );
  const settings = useOverviewSettings(viewerId, definition, samples.asOf, preferences?.overview);
  const backlogTable = useTableController({
    queryKey: 'backlog',
    scopeKey: 'all-repositories:backlog',
    viewerId,
    columnIds: overviewSettingsColumns.backlogColumns,
    savedSort: preferences?.backlogSort,
    fields: backlogFields,
  });
  const activityTable = useTableController({
    queryKey: 'activity',
    scopeKey: 'all-repositories:activity',
    viewerId,
    columnIds: overviewSettingsColumns.activityColumns,
    savedSort: preferences?.activitySort,
    fields: activityFields,
  });
  const backlog = withOverviewSort(backlogTable, 'backlog', settings.value);
  const activity = withOverviewSort(activityTable, 'activity', settings.value);
  // The Summary this view shows: the parent its drilldowns and Timeline return to.
  const { values } = useUrlState('/repos');
  const returnTo = urlHref('/repos', {}, values ?? {});
  const data = useMemo(
    () => selectOverviewSample(samples, settings.value.periods[0], settings.value.repositoryIds),
    [samples, settings.value.periods, settings.value.repositoryIds],
  );
  const secondaryData = useMemo(
    () =>
      settings.value.periods.length === 2
        ? selectOverviewSample(samples, settings.value.periods[1], settings.value.repositoryIds)
        : undefined,
    [samples, settings.value.periods, settings.value.repositoryIds],
  );
  function reset() {
    backlog.clearSavedSort();
    activity.clearSavedSort();
    settings.reset();
  }
  return (
    <AllRepositoriesView
      data={data}
      secondaryData={secondaryData}
      repositories={repositories}
      backlogController={backlog}
      activityController={activity}
      returnTo={returnTo}
      links={preferences?.links}
      settings={{
        ...settings,
        reset,
        storageAvailable:
          settings.storageAvailable && backlog.storageAvailable && activity.storageAvailable,
      }}
    />
  );
}
