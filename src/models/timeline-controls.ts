import { z } from 'zod';
import { timelineGroupings } from './reporting-timeline';
import type { PeriodSelection, DateRange } from './reporting-period';
import type { OverviewRepository } from './repository-overview';
import type { RepositoryPageFilters } from './repository-page';
import type { ContributionSettings } from './contribution-settings';
export const timelineViewSchema = z
  .object({
    grouping: z.enum(timelineGroupings),
    kind: z.enum(['prs', 'issues']),
    family: z.enum(['activity', 'snapshot']),
    metric: z.string().min(1).max(100),
    statistics: z.array(z.string().min(1).max(100)).max(50).optional(),
    chart: z.boolean(),
    sort: z.string().max(150),
    descending: z.boolean(),
    page: z.number().int().min(1).max(1000000),
    window: z.number().int().min(1).max(500),
    columns: z.array(z.string().max(100)).max(100).optional(),
  })
  .strict();
export type TimelineViewState = z.infer<typeof timelineViewSchema>;
export type TimelineArea = 'matrix' | 'repository' | 'contribution';
export const timelineViewKeys = [
  'timeline.state',
  'timeline.group',
  'timeline.kind',
  'timeline.family',
  'timeline.metric',
  'timeline.rank',
  'timeline.chart',
  'timeline.sort',
  'timeline.dir',
  'timeline.page',
  'timeline.window',
  'timeline.columns',
  'timeline.from',
  'timeline.to',
  'timeline.inclusive',
] as const;
export interface TimelineControlContext {
  area: TimelineArea;
  sample: string;
  asOf: string;
  path: string;
  /** URL whose data scope produced the supplied report model. */
  href: string;
  preferenceScope: string;
  period: PeriodSelection;
  exactRange?: DateRange;
  view: TimelineViewState;
  metricIds: readonly string[];
  repositories: readonly OverviewRepository[];
  repositoryIds?: string[];
  filters?: RepositoryPageFilters;
  contribution?: ContributionSettings;
}
