import { z } from 'zod';
import { dateRangeSchema, utcInstantSchema } from './reporting-period';
import { reportingCoverageSchema, type Measurement } from './reporting-measurement';
import {
  backlogMetricIds,
  agingThresholds,
  reportingBranchSchema,
  type BacklogMetric,
  type AgingThreshold,
} from './repository-overview';
import { latestActorCategories, type RepositoryPageFilters } from './repository-page';
import {
  timelineCutoffSchema,
  type TimelineCutoff,
  type TimelineInterval,
  type TimelineRequest,
  type TimelineSourceIdentity,
} from './reporting-timeline';

const text = z.string().trim().min(1).max(500);
const metadata = {
  id: text,
  number: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  title: text,
  url: z.url().refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'github.example' &&
      !url.username &&
      !url.password
    );
  }),
  author: text,
  authorType: z.enum(['human', 'agent', 'bot']).nullable(),
  createdAt: utcInstantSchema,
  labels: z.array(text),
  ageDays: z.number().nonnegative(),
  latestActivity: z
    .object({
      at: utcInstantSchema,
      account: text.nullable(),
      category: z.enum(latestActorCategories),
    })
    .strict()
    .nullable(),
};
const pr = z
  .object({
    ...metadata,
    state: z.enum(['Open', 'Merged', 'Closed']),
    draft: z.boolean(),
    mergedAt: utcInstantSchema.nullable(),
    baseBranch: text,
    humanReviewers: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(),
    approvals: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(),
    agentReviewer: z.boolean().nullable(),
    botReviewer: z.boolean().nullable(),
    latestActor: z.enum(latestActorCategories),
  })
  .strict();
const issue = z
  .object({
    ...metadata,
    state: z.enum(['Open', 'Closed']),
    closedAt: utcInstantSchema.nullable(),
    assignees: z.array(text).nullable(),
  })
  .strict();
const context = {
  source: z.literal('sample'),
  scenarioId: text,
  asOf: utcInstantSchema,
  repository: z
    .object({ id: text, slug: text, name: text, primaryBranch: reportingBranchSchema })
    .strict(),
  availableRanges: z.array(dateRangeSchema).max(256),
};
const snapshot = { cutoff: timelineCutoffSchema, coverage: reportingCoverageSchema };
export const repositoryTimelineSourceSchema = z.discriminatedUnion('kind', [
  z
    .object({
      ...context,
      kind: z.literal('prs'),
      rows: z.array(pr),
      snapshots: z.array(z.object({ ...snapshot, rows: z.array(pr) }).strict()),
    })
    .strict(),
  z
    .object({
      ...context,
      kind: z.literal('issues'),
      rows: z.array(issue),
      snapshots: z.array(z.object({ ...snapshot, rows: z.array(issue) }).strict()),
    })
    .strict(),
]);
export type RepositoryTimelineSource = z.infer<typeof repositoryTimelineSourceSchema>;
export const repositoryTimelineActivityMetrics = {
  prs: ['prsOpened', 'prsMerged', 'prAuthors', 'medianMergeDays'],
  issues: ['issuesOpened', 'issuesClosed', 'issueAuthors'],
} as const;
export type RepositoryTimelineActivityMetric =
  (typeof repositoryTimelineActivityMetrics)[keyof typeof repositoryTimelineActivityMetrics][number];
export type RepositoryTimelineSnapshotMetric = BacklogMetric | `agedPrs${AgingThreshold}`;
export const repositoryTimelineSnapshotMetrics = {
  prs: [
    ...backlogMetricIds.filter((id) => id !== 'openIssues'),
    ...agingThresholds.map((age) => `agedPrs${age}` as const),
  ],
  issues: ['openIssues'],
} satisfies Record<'prs' | 'issues', RepositoryTimelineSnapshotMetric[]>;
export type RepositoryTimelineMetric =
  RepositoryTimelineActivityMetric | RepositoryTimelineSnapshotMetric;
export const repositoryTimelineMetricIds: readonly RepositoryTimelineMetric[] = [
  ...repositoryTimelineActivityMetrics.prs,
  ...repositoryTimelineActivityMetrics.issues,
  ...repositoryTimelineSnapshotMetrics.prs,
  ...repositoryTimelineSnapshotMetrics.issues,
];
export const repositoryTimelineMetricSchema = z.enum(repositoryTimelineMetricIds);
/** Derive scope from the existing family registries, not a parallel metric definition. */
export function repositoryTimelineMetricScope(metric: RepositoryTimelineMetric): {
  recordKind: 'prs' | 'issues';
  family: 'activity' | 'snapshot';
  unit: 'count' | 'days';
} {
  for (const recordKind of ['prs', 'issues'] as const) {
    if (repositoryTimelineActivityMetrics[recordKind].some((id) => id === metric))
      return {
        recordKind,
        family: 'activity',
        unit: metric === 'medianMergeDays' ? 'days' : 'count',
      };
    if (repositoryTimelineSnapshotMetrics[recordKind].some((id) => id === metric))
      return { recordKind, family: 'snapshot', unit: 'count' };
  }
  throw Error('Unknown repository timeline metric');
}
export type RepositoryTimelineValues = Partial<Record<RepositoryTimelineMetric, Measurement>>;
export interface RepositoryTimeline {
  kind: 'repository';
  source: TimelineSourceIdentity;
  request: TimelineRequest;
  scope: {
    repository: RepositoryTimelineSource['repository'];
    recordKind: 'prs' | 'issues';
    family: 'activity' | 'snapshot';
    filters: RepositoryPageFilters;
  };
  metrics: RepositoryTimelineMetric[];
  rows: { interval: TimelineInterval; values: RepositoryTimelineValues }[];
  summary: RepositoryTimelineValues;
}
export type RepositoryTimelineDetail = {
  kind: 'repository';
  source: TimelineSourceIdentity;
  repositoryId: string;
  metric: RepositoryTimelineMetric;
  filters: RepositoryPageFilters;
} & (
  | { basis: 'event' | 'distinct-authors' | 'duration'; range: TimelineRequest['range'] }
  | { basis: 'snapshot'; cutoff: TimelineCutoff }
);
