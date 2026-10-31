import type { DateRange } from '@/models/reporting-period';
import type { Count, Measurement } from '@/models/reporting-measurement';
import {
  activityMetricIds,
  type ActivityMetric,
  type RepositoryActivity,
} from '@/models/repository-overview';
import { inDateRange } from '@/lib/presentation/reporting-period';
import { withTimelineAvailability } from '@/lib/presentation/reporting-timeline';
import { mergeElapsedDays } from '@/lib/presentation/repository-insights';
import {
  worldRepository,
  type WorldIssue,
  type WorldPullRequest,
  type WorldRepository,
} from './repository-world';

export type CreditMetric = Extract<ActivityMetric, `${'agent' | 'bot'}${string}Credits`>;
export interface PeriodCredit {
  account: string;
  accountType: 'agent' | 'bot';
  contribution: 'reviewer' | 'approval';
  firstCreditAt: string;
  pr: WorldPullRequest;
}

/** Pull requests an activity metric counts in a range, dated as the repository Timeline dates them. */
export function periodPullRequests(
  repository: WorldRepository,
  metric: 'prsOpened' | 'prsMerged',
  range: DateRange,
): WorldPullRequest[] {
  return repository.pullRequests.filter((row) =>
    metric === 'prsOpened'
      ? inDateRange(row.createdAt, range)
      : row.mergedAt !== null &&
        row.baseBranch === repository.primaryBranch &&
        inDateRange(row.mergedAt, range),
  );
}
export function periodIssues(
  repository: WorldRepository,
  metric: 'issuesOpened' | 'issuesClosed',
  range: DateRange,
): WorldIssue[] {
  return repository.issues.filter((row) => {
    const at = metric === 'issuesOpened' ? row.createdAt : row.closedAt;
    return at !== null && inDateRange(at, range);
  });
}
/** One credit per account, PR and contribution type, dated at its first qualifying review. */
export function periodCredits(
  repository: WorldRepository,
  metric: CreditMetric,
  range: DateRange,
): PeriodCredit[] {
  const accountType = metric.startsWith('agent') ? 'agent' : 'bot';
  const kind = metric.endsWith('ApprovalCredits') ? 'approval' : 'review';
  return repository.pullRequests.flatMap((pr) => {
    const first = new Map<string, string>();
    for (const review of pr.reviews)
      if (review.actorType === accountType && review.kind === kind && !first.has(review.account))
        first.set(review.account, review.at);
    return [...first]
      .filter(([, at]) => inDateRange(at, range))
      .map(([account, firstCreditAt]) => ({
        account,
        accountType,
        contribution: kind === 'approval' ? 'approval' : 'reviewer',
        firstCreditAt,
        pr,
      }));
  });
}
/** A count of records found in a range, qualified by the repository's prepared coverage. */
export function periodCount(repository: WorldRepository, value: number, range: DateRange): Count {
  return withTimelineAvailability({ status: 'complete', value }, range, repository.availability);
}
export function medianMergeDays(
  repository: WorldRepository,
  merged: readonly WorldPullRequest[],
  range: DateRange,
): Measurement {
  const days = merged
    .map((row) => mergeElapsedDays(row.createdAt, row.mergedAt)!)
    .sort((a, b) => a - b);
  const half = Math.floor(days.length / 2);
  return withTimelineAvailability(
    days.length
      ? {
          status: 'complete',
          value: days.length % 2 ? days[half] : (days[half - 1] + days[half]) / 2,
        }
      : { status: 'not-applicable', value: null, reason: 'No merged PRs in the covered range.' },
    range,
    repository.availability,
  );
}

/** Summary activity for one repository and range, counted from its dated sample records. */
export function periodActivity(repositoryId: string, range: DateRange): RepositoryActivity {
  const repository = worldRepository(repositoryId);
  const prs = (metric: 'prsOpened' | 'prsMerged') => periodPullRequests(repository, metric, range);
  const issues = (metric: 'issuesOpened' | 'issuesClosed') =>
    periodIssues(repository, metric, range);
  const authors = (rows: readonly { author: string }[]) =>
    new Set(rows.map((row) => row.author.toLowerCase())).size;
  const merged = prs('prsMerged');
  const values: Record<ActivityMetric, number> = {
    prsOpened: prs('prsOpened').length,
    prsMerged: merged.length,
    issuesOpened: issues('issuesOpened').length,
    issuesClosed: issues('issuesClosed').length,
    prAuthors: authors(prs('prsOpened')),
    issueAuthors: authors(issues('issuesOpened')),
    agentFeedbackCredits: periodCredits(repository, 'agentFeedbackCredits', range).length,
    agentApprovalCredits: periodCredits(repository, 'agentApprovalCredits', range).length,
    botFeedbackCredits: periodCredits(repository, 'botFeedbackCredits', range).length,
    botApprovalCredits: periodCredits(repository, 'botApprovalCredits', range).length,
  };
  return {
    counts: Object.fromEntries(
      activityMetricIds.map((metric) => [metric, periodCount(repository, values[metric], range)]),
    ) as RepositoryActivity['counts'],
    mergeDuration: {
      days: medianMergeDays(repository, merged, range),
      sampleSize: periodCount(repository, merged.length, range),
    },
  };
}
