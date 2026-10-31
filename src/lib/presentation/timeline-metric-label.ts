import { isReportMetric, reportMetricLabel } from '@/models/contribution-metrics';
import { repositoryTimelineMetricSchema } from '@/models/repository-timeline';
import { recordListTitle } from './repository-records';
import { agingThresholdSchema, type BacklogMetric } from '@/models/repository-overview';
export function timelineMetricLabel(metric: string, contribution = false): string {
  if (contribution) {
    if (!isReportMetric(metric)) throw Error('Unknown contribution metric');
    return reportMetricLabel(metric);
  }
  const id = repositoryTimelineMetricSchema.parse(metric);
  const labels: Partial<Record<typeof id, string>> = {
    prsOpened: 'Pull requests — Opened',
    prsMerged: 'Pull requests — Merged',
    prAuthors: 'Unique authors — PRs',
    issuesOpened: 'Issues — Opened',
    issuesClosed: 'Issues — Closed',
    issueAuthors: 'Unique authors — Issues',
    medianMergeDays: 'Median merge time',
  };
  if (labels[id]) return labels[id];
  return recordListTitle(
    id.startsWith('agedPrs')
      ? {
          scope: 'current',
          metric: 'agedPrs',
          ageDays: agingThresholdSchema.parse(Number(id.slice(7))),
        }
      : { scope: 'current', metric: id as BacklogMetric },
  );
}
