'use client';
import { useMemo } from 'react';
import { AllRepositoriesView } from '@/features/repositories/all-repositories-view';
import { overviewSettingsColumns } from '@/features/repositories/overview-columns';
import { useTableController } from '@/lib/navigation/use-table-controller';
import { useOverviewSettings } from '@/lib/navigation/use-overview-settings';
import {
  changesOverviewScope,
  writeOverviewTableQueries,
} from '@/lib/presentation/overview-settings';
import { selectOverviewSample } from '@/lib/presentation/overview-samples';
import type { OverviewSettings } from '@/models/overview-settings';
import type { RepositoryOverviewSamples } from '@/models/repository-overview';
const backlogPeers = ['activity'];
const activityPeers = ['backlog'];
const defaultSort = { sort: 'name', descending: false };
export function RepositoriesScreen({
  viewerId,
  samples,
}: {
  viewerId: string;
  samples: RepositoryOverviewSamples;
}) {
  const repositories = useMemo(
    () => samples.repositories.map((row) => row.repository),
    [samples.repositories],
  );
  const definition = useMemo(
    () => ({ ...overviewSettingsColumns, repositoryIds: repositories.map((repo) => repo.id) }),
    [repositories],
  );
  const settings = useOverviewSettings(viewerId, definition, samples.asOf);
  const backlog = useTableController({
    queryKey: 'backlog',
    scopeKey: 'all-repositories:backlog',
    viewerId,
    columnIds: overviewSettingsColumns.backlogColumns,
    peerQueryKeys: backlogPeers,
    defaultSort,
  });
  const activity = useTableController({
    queryKey: 'activity',
    scopeKey: 'all-repositories:activity',
    viewerId,
    columnIds: overviewSettingsColumns.activityColumns,
    peerQueryKeys: activityPeers,
    defaultSort,
  });
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
  function captureTableContext() {
    const backlogQuery = backlog.flushSearch();
    const activityQuery = activity.flushSearch();
    const url = new URL(window.location.href);
    url.search = writeOverviewTableQueries(url.search, backlogQuery, activityQuery);
    if (url.href !== window.location.href) window.history.replaceState(null, '', url);
  }
  function update(patch: Partial<OverviewSettings>) {
    if (changesOverviewScope(patch)) captureTableContext();
    settings.update(patch);
  }
  function reset() {
    captureTableContext();
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
      settings={{
        ...settings,
        update,
        reset,
        storageAvailable:
          settings.storageAvailable && backlog.storageAvailable && activity.storageAvailable,
      }}
    />
  );
}
