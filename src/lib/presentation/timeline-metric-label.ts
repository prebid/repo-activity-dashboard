import { isReportMetric, reportMetricLabel } from '@/models/contribution-metrics';
import {
  repositoryTimelineMetricSchema,
  repositoryTimelineMetricScope,
  type RepositoryTimelineMetric,
  type RepositoryTimelineSnapshotMetric,
} from '@/models/repository-timeline';
import {
  repositoryMetricName,
  repositoryMetricText,
  type RepositoryMetricText,
} from './repository-metric-text';
import { recordListTitle } from './repository-records';
import { repositoryTimelineSnapshotSelection } from './repository-timeline';

/** Timeline names come from the Summary metric text; snapshot descriptions name the cutoff state. */
export function repositoryTimelineMetricText(id: RepositoryTimelineMetric): RepositoryMetricText {
  const text = repositoryMetricText(id);
  return repositoryTimelineMetricScope(id).family === 'snapshot'
    ? {
        ...text,
        description:
          recordListTitle(
            repositoryTimelineSnapshotSelection(id as RepositoryTimelineSnapshotMetric),
          ) +
          ' at the covered interval cutoff. These are supplied historical values, not current state.',
      }
    : text;
}
export function timelineMetricLabel(metric: string, contribution = false): string {
  if (contribution) {
    if (!isReportMetric(metric)) throw Error('Unknown contribution metric');
    return reportMetricLabel(metric);
  }
  return repositoryMetricName(repositoryTimelineMetricSchema.parse(metric));
}
export function timelineMetricUnit(metric: string, contribution = false): 'count' | 'days' {
  if (contribution) {
    if (!isReportMetric(metric)) throw Error('Unknown contribution metric');
    return 'count';
  }
  return repositoryTimelineMetricScope(repositoryTimelineMetricSchema.parse(metric)).unit;
}
