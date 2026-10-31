import { z } from 'zod';
import { dateRangeSchema, utcInstantSchema, type DateRange } from './reporting-period';
import type { Measurement } from './reporting-measurement';

export const timelineGroupings = [
  'day',
  'week',
  'month',
  'two-months',
  'quarter',
  'half-year',
  'year',
] as const;
export type TimelineGrouping = (typeof timelineGroupings)[number];
export const timelineGroupingLabels: Record<TimelineGrouping, string> = {
  day: 'Daily',
  week: 'Weekly',
  month: 'Monthly',
  'two-months': 'Every 2 months',
  quarter: 'Quarterly',
  'half-year': 'Every 6 months',
  year: 'Yearly',
};
export const timelineIntervalLimit = 500;
export const timelineRequestSchema = z
  .object({
    range: dateRangeSchema,
    grouping: z.enum(timelineGroupings),
  })
  .strict();
export type TimelineRequest = z.infer<typeof timelineRequestSchema>;
export interface TimelineInterval {
  id: string;
  calendar: DateRange;
  covered: DateRange;
  // Calendar clipping is independent of measurement coverage.
  partial: boolean;
}
export const timelineCutoffSchema = z
  .object({ at: utcInstantSchema, inclusive: z.boolean() })
  .strict();
export type TimelineCutoff = z.infer<typeof timelineCutoffSchema>;
export interface TimelineSourceIdentity {
  source: 'sample';
  scenarioId: string;
  asOf: string;
}
export interface TimelineRow<Metric extends string> {
  interval: TimelineInterval;
  values: Record<Metric, Measurement>;
}
export interface TimelineSeries<Metric extends string> {
  source: TimelineSourceIdentity;
  request: TimelineRequest;
  rows: TimelineRow<Metric>[];
  // Supplied/reconciled over the whole range, never a sum of arbitrary interval values.
  summary: Record<Metric, Measurement>;
}
