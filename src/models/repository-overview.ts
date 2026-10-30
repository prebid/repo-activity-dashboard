import { z } from 'zod';
import type { ResolvedPeriod } from './reporting-period';

import { countSchema, durationSchema } from './reporting-measurement';

export const reportingBranchSchema = z.enum(['main', 'master']);

export const agingThresholds = [30, 60, 90, 120, 180, 360] as const;
export type AgingThreshold = (typeof agingThresholds)[number];
export const defaultAgingThreshold: AgingThreshold = 30;
export const agingThresholdSchema = z.union([
  z.literal(30),
  z.literal(60),
  z.literal(90),
  z.literal(120),
  z.literal(180),
  z.literal(360),
]);

export const backlogMetricIds = [
  'totalOpenPrs',
  'draftPrs',
  'nonDraftPrs',
  'openIssues',
  'humanReviewers0',
  'humanReviewers1',
  'humanReviewers2',
  'humanReviewersMoreThan2',
  'humanApprovals0',
  'humanApprovals1',
  'humanApprovals2',
  'humanApprovalsMoreThan2',
  'agentFeedbackPrs',
  'botFeedbackPrs',
  'lastAgent',
  'lastBot',
  'lastPrebidReviewer',
  'lastContributor',
  'lastOtherHuman',
  'lastUnknown',
] as const;
export type BacklogMetric = (typeof backlogMetricIds)[number];
export const activityMetricIds = [
  'prsOpened',
  'prsMerged',
  'issuesOpened',
  'issuesClosed',
  'prAuthors',
  'issueAuthors',
  'agentFeedbackCredits',
  'agentApprovalCredits',
  'botFeedbackCredits',
  'botApprovalCredits',
] as const;
export type ActivityMetric = (typeof activityMetricIds)[number];

export const backlogSchema = z
  .object({
    counts: z.record(z.enum(backlogMetricIds), countSchema),
    agedPrs: z
      .object({
        30: countSchema,
        60: countSchema,
        90: countSchema,
        120: countSchema,
        180: countSchema,
        360: countSchema,
      })
      .strict(),
  })
  .strict();
export type RepositoryBacklog = z.infer<typeof backlogSchema>;

export const activitySchema = z
  .object({
    counts: z.record(z.enum(activityMetricIds), countSchema),
    mergeDuration: z.object({ days: durationSchema, sampleSize: countSchema }).strict(),
  })
  .strict();
export type RepositoryActivity = z.infer<typeof activitySchema>;

export interface OverviewRepository {
  id: string;
  slug: string;
  name: string;
  primaryBranch: 'main' | 'master';
}
export interface RepositoryOverviewRow {
  repository: OverviewRepository;
  backlog: RepositoryBacklog;
  activity: RepositoryActivity;
  comparison: RepositoryActivity;
}
export interface RepositoryOverview {
  source: 'sample';
  scenarioId: string;
  asOf: string;
  period: ResolvedPeriod;
  activitySample: 'prepared' | 'unprepared';
  rows: RepositoryOverviewRow[];
}

export interface RepositoryPeriodRow extends RepositoryOverviewRow {
  kind: 'period';
  id: string;
  period: ResolvedPeriod;
  periodIndex: 0 | 1;
  showPeriodLabel: boolean;
  sortActivity: RepositoryActivity;
}
export interface RepositoryDifferenceRow {
  kind: 'difference';
  id: string;
  repository: OverviewRepository;
  primary: RepositoryActivity;
  secondary: RepositoryActivity;
  sortActivity: RepositoryActivity;
}
export type RepositoryActivityRow = RepositoryPeriodRow | RepositoryDifferenceRow;

/** Small prepared display bundles, with current backlog stored only once. */
export interface RepositoryOverviewSamples {
  source: 'sample';
  scenarioId: string;
  asOf: string;
  repositories: Pick<RepositoryOverviewRow, 'repository' | 'backlog'>[];
  periods: {
    period: ResolvedPeriod;
    rows: Record<string, Pick<RepositoryOverviewRow, 'activity' | 'comparison'>>;
  }[];
}
