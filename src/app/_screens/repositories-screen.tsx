'use client';
import { AllRepositoriesView } from '@/features/repositories/all-repositories-view';
import { backlogColumns, activityColumns } from '@/features/repositories/overview-columns';
import { useTableController } from '@/lib/navigation/use-table-controller';
import type { RepositoryOverview } from '@/models/repository-overview';
const backlogIds = backlogColumns(30).map((column) => column.id);
const activityIds = activityColumns(false).map((column) => column.id);
export function RepositoriesScreen({
  viewerId,
  data,
}: {
  viewerId: string;
  data: RepositoryOverview;
}) {
  const backlog = useTableController({
    queryKey: 'backlog',
    scopeKey: 'all-repositories:backlog',
    viewerId,
    columnIds: backlogIds,
  });
  const activity = useTableController({
    queryKey: 'activity',
    scopeKey: 'all-repositories:activity',
    viewerId,
    columnIds: activityIds,
  });
  return (
    <AllRepositoriesView
      key={backlog.scopeKey}
      data={data}
      backlogController={backlog}
      activityController={activity}
    />
  );
}
