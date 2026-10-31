import type { TimelineMetricDefinition } from '@/models/timeline-presentation';
import {
  repositoryTimelineMetricScope,
  type RepositoryTimelineMetric,
} from '@/models/repository-timeline';
import { repositoryTimelineMetricText } from '@/lib/presentation/timeline-metric-label';
import { defaultBacklogColumns } from './overview-columns';

export function repositoryTimelineMetricDefinitions(
  ids: readonly RepositoryTimelineMetric[],
): TimelineMetricDefinition[] {
  return ids.map((id) => {
    const { label, group, description } = repositoryTimelineMetricText(id);
    const { family, unit } = repositoryTimelineMetricScope(id);
    return {
      id,
      label,
      group,
      selectionGroup: group,
      description,
      unit,
      defaultVisible: family === 'activity' || defaultBacklogColumns.includes(id),
    };
  });
}
