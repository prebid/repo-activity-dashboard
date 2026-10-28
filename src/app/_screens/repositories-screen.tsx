'use client';
import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { AllRepositoriesView } from '@/features/repositories/all-repositories-view';
import { overviewSettingsColumns } from '@/features/repositories/overview-columns';
import { useTableController } from '@/lib/navigation/use-table-controller';
import { useOverviewSettings } from '@/lib/navigation/use-overview-settings';
import {
  changesOverviewScope,
  writeOverviewTableQueries,
  writeOverviewSettings,
} from '@/lib/presentation/overview-settings';
import { selectOverviewSample } from '@/lib/presentation/overview-samples';
import { withOverviewSort } from '@/lib/presentation/overview-sort';
import type { OverviewSettings } from '@/models/overview-settings';
import type { RepositoryOverviewSamples } from '@/models/repository-overview';
const backlogPeers = ['activity'];
const activityPeers = ['backlog'];
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
  const backlogTable = useTableController({
    queryKey: 'backlog',
    scopeKey: 'all-repositories:backlog',
    viewerId,
    columnIds: overviewSettingsColumns.backlogColumns,
    peerQueryKeys: backlogPeers,
  });
  const activityTable = useTableController({
    queryKey: 'activity',
    scopeKey: 'all-repositories:activity',
    viewerId,
    columnIds: overviewSettingsColumns.activityColumns,
    peerQueryKeys: activityPeers,
  });
  const backlog = withOverviewSort(backlogTable, 'backlog', settings.value);
  const activity = withOverviewSort(activityTable, 'activity', settings.value);
  const search = useSearchParams().toString();
  const returnTo =
    '/repos?' +
    writeOverviewTableQueries(
      writeOverviewSettings(search, settings.value),
      backlog.query,
      activity.query,
    );
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
      returnTo={returnTo}
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
