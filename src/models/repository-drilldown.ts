import { z } from 'zod';
import { dateRangeSchema } from './reporting-period';
import {
  activityMetricIds,
  agingThresholdSchema,
  backlogMetricIds,
  reportingBranchSchema,
} from './repository-overview';

export const drilldownSelectionSchema = z.union([
  z.object({ scope: z.literal('current'), metric: z.enum(backlogMetricIds) }).strict(),
  z
    .object({
      scope: z.literal('current'),
      metric: z.literal('agedPrs'),
      ageDays: agingThresholdSchema,
    })
    .strict(),
  z
    .object({
      scope: z.literal('period'),
      metric: z.enum([...activityMetricIds, 'medianMergeDays']),
      range: dateRangeSchema,
      branch: reportingBranchSchema.optional(),
    })
    .strict()
    .refine(
      (value) =>
        (value.metric === 'prsMerged' || value.metric === 'medianMergeDays') ===
        (value.branch !== undefined),
      'Only merged PRs and merge duration require primary-branch scope',
    ),
]);
export type DrilldownSelection = z.infer<typeof drilldownSelectionSchema>;

export const overviewReturnPathSchema = z.string().refine((value) => {
  if (!value.startsWith('/') || value.startsWith('//') || /[\\\s#]/.test(value)) return false;
  const url = new URL(value, 'https://dashboard.invalid');
  return url.origin === 'https://dashboard.invalid' && url.pathname === '/repos';
}, 'Return context must point to All Repositories');

export const repositoryDrilldownSchema = z
  .object({
    selection: drilldownSelectionSchema,
    returnTo: overviewReturnPathSchema,
  })
  .strict();
export type RepositoryDrilldown = z.infer<typeof repositoryDrilldownSchema>;
