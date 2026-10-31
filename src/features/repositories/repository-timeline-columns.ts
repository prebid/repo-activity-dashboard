import type { TimelineMetricDefinition } from '@/models/timeline-presentation';
import {
  repositoryTimelineMetricScope,
  type RepositoryTimelineMetric,
} from '@/models/repository-timeline';
import { activityColumns, backlogColumns, defaultBacklogColumns } from './overview-columns';
import { recordListTitle } from '@/lib/presentation/repository-records';
import { agingThresholdSchema, type BacklogMetric } from '@/models/repository-overview';

export function repositoryTimelineMetricDefinitions(
  ids: readonly RepositoryTimelineMetric[],
): TimelineMetricDefinition[] {
  const activity = activityColumns(),
    backlog = backlogColumns();
  return ids.map((id) => {
    const family = repositoryTimelineMetricScope(id).family;
    const columns = family === 'activity' ? activity : backlog;
    const column = columns.find((column) => column.id === id);
    if (!column) throw Error('Missing repository timeline column definition');
    const snapshotDescription = () =>
      recordListTitle(
        id.startsWith('agedPrs')
          ? {
              scope: 'current',
              metric: 'agedPrs',
              ageDays: agingThresholdSchema.parse(Number(id.slice(7))),
            }
          : { scope: 'current', metric: id as BacklogMetric },
      ) +
      ' at the covered interval cutoff. These are supplied historical values, not current state.';
    return {
      id,
      label: column.label,
      group: column.group,
      selectionGroup: column.group,
      description: family === 'snapshot' ? snapshotDescription() : column.description,
      unit: id === 'medianMergeDays' ? 'days' : 'count',
      defaultVisible: family === 'activity' || defaultBacklogColumns.includes(id),
    };
  });
}
