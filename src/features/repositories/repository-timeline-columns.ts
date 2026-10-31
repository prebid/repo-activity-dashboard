import type { TimelineMetricDefinition } from '@/models/timeline-presentation';
import {
  repositoryTimelineFamilyLabels,
  repositoryTimelineMetricScope,
  type RepositoryTimelineMetric,
} from '@/models/repository-timeline';
import { repositoryTimelineMetricText } from '@/lib/presentation/timeline-metric-label';
import { defaultBacklogColumns } from './overview-columns';

/** Matrix choices name each metric's measure family, as the Metrics selector and export do. */
export function repositoryTimelineMatrixMetricDefinitions(
  ids: readonly RepositoryTimelineMetric[],
): TimelineMetricDefinition[] {
  return repositoryTimelineMetricDefinitions(ids).map((metric) => ({
    ...metric,
    selectionGroup:
      repositoryTimelineFamilyLabels[
        repositoryTimelineMetricScope(metric.id as RepositoryTimelineMetric).family
      ] +
      ' · ' +
      metric.group,
  }));
}
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
