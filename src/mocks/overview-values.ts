import type { ActivityMetric, Count, RepositoryActivity } from '@/models/repository-overview';

export const complete = (value: number): Count => ({ status: 'complete', value });
export const missing = (reason: string): Count => ({ status: 'missing', value: null, reason });
export const partial = (value: number, reason: string): Count => ({
  status: 'partial',
  value,
  reason,
});

export function activity(
  counts: Record<ActivityMetric, number>,
  medianDays: number | null,
): RepositoryActivity {
  return {
    counts: Object.fromEntries(
      Object.entries(counts).map(([key, value]) => [key, complete(value)]),
    ) as Record<ActivityMetric, Count>,
    mergeDuration: {
      days:
        medianDays === null
          ? {
              status: 'not-applicable',
              value: null,
              reason: 'No merged PRs in this sample period.',
            }
          : complete(medianDays),
      sampleSize: complete(counts.prsMerged),
    },
  };
}

export const emptyActivity = activity(
  {
    prsOpened: 0,
    prsMerged: 0,
    issuesOpened: 0,
    issuesClosed: 0,
    prAuthors: 0,
    issueAuthors: 0,
    agentFeedbackCredits: 0,
    agentApprovalCredits: 0,
    botFeedbackCredits: 0,
    botApprovalCredits: 0,
  },
  null,
);
