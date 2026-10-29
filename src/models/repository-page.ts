import { z } from 'zod';
import { authorAccountSchema, type ReportingAccountType } from './repository-insights';
import { agingThresholdSchema, type Count } from './repository-overview';
import { dateRangeSchema, type DateRange } from './reporting-period';
import type {
  LatestActor,
  RepositoryRecordList,
  RepositoryPullRequest,
  RepositoryIssue,
} from './repository-records';

export const reviewBuckets = ['0', '1', '2', 'more', 'unknown'] as const;
export type ReviewBucket = (typeof reviewBuckets)[number];
export const ageBandSchema = z.union([z.literal(0), agingThresholdSchema]);
export type AgeBand = z.infer<typeof ageBandSchema>;
export const latestActorCategories = [
  'agent',
  'bot',
  'prebid-reviewer',
  'contributor',
  'other-human',
  'unknown',
] as const satisfies readonly LatestActor[];
const commonFilters = {
  search: z.string().trim().max(200).default(''),
  labels: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  authors: z.array(authorAccountSchema).max(100).default([]),
  authorTypes: z
    .array(z.enum(['human', 'agent', 'bot', 'unknown']))
    .max(4)
    .default([]),
  ageBand: ageBandSchema.optional(),
  eventRange: dateRangeSchema.optional(),
  latestActors: z.array(z.enum(latestActorCategories)).max(6).default([]),
};
export const repositoryPageFiltersSchema = z.discriminatedUnion('kind', [
  z
    .object({
      ...commonFilters,
      kind: z.literal('prs'),
      states: z
        .array(z.enum(['Open', 'Merged', 'Closed']))
        .max(3)
        .default([]),
      draft: z.enum(['all', 'drafts', 'non-drafts']).default('all'),
      branches: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
      reviewers: z.enum(reviewBuckets).optional(),
      approvals: z.enum(reviewBuckets).optional(),
      agentReviewer: z.enum(['yes', 'no', 'unknown']).optional(),
      botReviewer: z.enum(['yes', 'no', 'unknown']).optional(),
    })
    .strict(),
  z
    .object({
      ...commonFilters,
      kind: z.literal('issues'),
      states: z
        .array(z.enum(['Open', 'Closed']))
        .max(2)
        .default([]),
      assignees: z.array(authorAccountSchema).max(100).default([]),
      assignment: z.enum(['any', 'assigned', 'unassigned', 'unknown']).default('any'),
    })
    .strict(),
]);
export type RepositoryPageFilters = z.infer<typeof repositoryPageFiltersSchema>;
export interface LatestRecordActivity {
  at: string;
  account: string | null;
  category: LatestActor;
}
interface RecordMetadata {
  authorType: ReportingAccountType | null;
  latestActivity: LatestRecordActivity | null;
}
export interface RepositoryPagePr extends RepositoryPullRequest, RecordMetadata {}
export interface RepositoryPageIssue extends RepositoryIssue, RecordMetadata {
  // null is unavailable assignment information; [] is known unassigned.
  assignees: string[] | null;
}
export type RepositoryPageSource =
  | (Omit<Extract<RepositoryRecordList, { kind: 'prs' }>, 'rows'> & { rows: RepositoryPagePr[] })
  | (Omit<Extract<RepositoryRecordList, { kind: 'issues' }>, 'rows'> & {
      rows: RepositoryPageIssue[];
    });
export interface DistributionChart<Key> {
  kind: 'age' | 'reviewers' | 'approvals';
  measurement: Count;
  excludedDrafts: number;
  points: { key: Key; label: string; count: Count }[];
}
export interface ActivityChart {
  kind: 'activity';
  dateBasis: 'createdAt' | 'mergedAt' | 'closedAt';
  granularity: 'day' | 'month';
  range: DateRange;
  measurement: Count;
  points: { range: DateRange; count: Count }[];
}
export type RepositoryChart =
  DistributionChart<AgeBand> | DistributionChart<ReviewBucket> | ActivityChart;
export type RepositoryPageModel = RepositoryPageSource & {
  filters: RepositoryPageFilters;
  // Original scope is immutable. Filters only narrow it; charts use all resulting rows.
  cohortMeasurement: Count;
  charts: RepositoryChart[];
  defaultSort: { sort: 'createdAt'; descending: true };
};

export interface RepositoryPageNavigation {
  githubUrl: string;
  openPrs: Count;
  openIssues: Count;
}
