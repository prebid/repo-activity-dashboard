import { z } from 'zod';
import { utcInstantSchema } from './reporting-period';
import {
  repositoryTimelineSourceSchema,
  repositoryTimelineMetricSchema,
  repositoryTimelineMetricIds,
  type RepositoryTimelineMetric,
} from './repository-timeline';
import type { OverviewRepository } from './repository-overview';
import type { Measurement } from './reporting-measurement';
import type {
  TimelineInterval,
  TimelineRequest,
  TimelineSourceIdentity,
} from './reporting-timeline';

const identity = z.string().trim().min(1).max(500);
export const repositoryTimelineMatrixSourceSchema = z
  .object({
    source: z.literal('sample'),
    scenarioId: identity,
    asOf: utcInstantSchema,
    kind: z.enum(['prs', 'issues', 'mixed']),
    repositories: z.array(repositoryTimelineSourceSchema),
  })
  .strict();
export type RepositoryTimelineMatrixSource = z.infer<typeof repositoryTimelineMatrixSourceSchema>;
const selectedRepositories = z.array(identity);
// A single-metric shorthand remains useful for isolated projection/equivalence checks.
export const repositoryTimelineMatrixSelectionSchema = z
  .union([
    z
      .object({
        repositoryIds: selectedRepositories,
        metrics: z.array(repositoryTimelineMetricSchema).max(repositoryTimelineMetricIds.length),
      })
      .strict(),
    z
      .object({ repositoryIds: selectedRepositories, metric: repositoryTimelineMetricSchema })
      .strict(),
  ])
  .transform((input) => ({
    repositoryIds: input.repositoryIds,
    metrics: [...new Set('metrics' in input ? input.metrics : [input.metric])],
  }));
export type RepositoryTimelineMatrixSelection = z.input<
  typeof repositoryTimelineMatrixSelectionSchema
>;
// A separate output-cell guard also bounds future catalog growth. Current catalog: 18 × 500 = 9,000.
export const repositoryTimelineMatrixCellLimit = 10_000;
export const repositoryTimelineMatrixWindowSize = 12;
export interface RepositoryTimelineMatrixRow {
  id: string;
  repository: OverviewRepository;
  metric: RepositoryTimelineMetric;
  // Positions correspond to the single shared intervals array.
  values: Measurement[];
  summary: Measurement;
}
export interface RepositoryTimelineMatrix {
  kind: 'repository-matrix';
  source: TimelineSourceIdentity;
  request: TimelineRequest;
  scope: z.output<typeof repositoryTimelineMatrixSelectionSchema>;
  intervals: readonly TimelineInterval[];
  rows: RepositoryTimelineMatrixRow[];
}
export interface RepositoryTimelineMatrixWindow {
  page: number;
  pageCount: number;
  startIndex: number;
  endIndex: number;
  intervals: readonly TimelineInterval[];
  earlierPage: number | null;
  laterPage: number | null;
}
export const repositoryTimelineMatrixSortSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('repository'), descending: z.boolean() }).strict(),
  z
    .object({
      kind: z.literal('interval'),
      intervalId: identity,
      metric: repositoryTimelineMetricSchema.optional(),
      descending: z.boolean(),
    })
    .strict(),
]);
export type RepositoryTimelineMatrixSort = z.infer<typeof repositoryTimelineMatrixSortSchema>;
export interface RepositoryTimelineMatrixRepositoryIntent {
  kind: 'repository-timeline';
  source: TimelineSourceIdentity;
  repositoryId: string;
  metric: RepositoryTimelineMetric;
  request: TimelineRequest;
  recordKind: 'prs' | 'issues';
  family: 'activity' | 'snapshot';
}
