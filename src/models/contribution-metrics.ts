import {
  contributionMetricIds,
  contributionMetrics,
  type ContributionMetric,
} from './contributions';
import {
  additionalMetricIds,
  additionalMetricDefinitions,
  type AdditionalMetric,
} from './contribution-activity';
export const metricDescriptions: Record<ContributionMetric, string> = {
  prsAuthored: 'PRs created by the account during the period, including drafts and PRs now closed.',
  authoredPrsMerged:
    'PRs authored by the account and merged into the primary branch during the period.',
  reviewerContributions:
    'One credit per account and PR, dated to the first qualifying comment, inline comment or change request. Author responses are excluded.',
  approvalContributions:
    'One credit per account and PR, dated to its first approval. Reapprovals do not add credits; this is separate from current approval state.',
  mergesPerformed:
    'PRs merged into the primary branch by the recorded merge actor during the period.',
  issuesAuthored:
    'Issues created by the account during the period. Reopening an issue adds no authorship credit.',
};

export type ReportMetric = ContributionMetric | AdditionalMetric;
export const reportMetricIds: readonly ReportMetric[] = [
  ...contributionMetricIds,
  ...additionalMetricIds,
];
export function isReportMetric(value: string): value is ReportMetric {
  return reportMetricIds.some((id) => id === value);
}
export function isCoreMetric(value: ReportMetric): value is ContributionMetric {
  return contributionMetricIds.some((id) => id === value);
}
export function reportMetricLabel(metric: ReportMetric): string {
  return isCoreMetric(metric)
    ? contributionMetrics[metric].label
    : additionalMetricDefinitions[metric].group + ' — ' + additionalMetricDefinitions[metric].label;
}
export function reportMetricDescription(metric: ReportMetric): string {
  return isCoreMetric(metric)
    ? metricDescriptions[metric]
    : additionalMetricDefinitions[metric].description;
}

export const contributionSelectionGroups: Record<ContributionMetric, string> = {
  prsAuthored: 'Pull requests',
  authoredPrsMerged: 'Pull requests',
  mergesPerformed: 'Pull requests',
  reviewerContributions: 'Reviews and approvals',
  approvalContributions: 'Reviews and approvals',
  issuesAuthored: 'Issues',
};
