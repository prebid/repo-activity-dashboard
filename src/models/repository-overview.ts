import { z } from 'zod';
import type { ResolvedPeriod } from './reporting-period';

// Display contracts only: no GitHub events, database records, or table-library types.
function measurementSchema(value: z.ZodNumber) {
  return z.discriminatedUnion('status', [
    z.object({ status: z.literal('complete'), value }).strict(),
    z.object({ status: z.literal('partial'), value, reason: z.string().trim().min(1) }).strict(),
    z
      .object({ status: z.literal('missing'), value: z.null(), reason: z.string().trim().min(1) })
      .strict(),
    z
      .object({
        status: z.literal('not-applicable'),
        value: z.null(),
        reason: z.string().trim().min(1),
      })
      .strict(),
  ]);
}
export const countSchema = measurementSchema(
  z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
);
export const durationSchema = measurementSchema(z.number().nonnegative());
export type Measurement = z.infer<typeof durationSchema>;
export type Count = z.infer<typeof countSchema>;
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
