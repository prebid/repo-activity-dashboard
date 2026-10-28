import { z } from 'zod';

export const periodPresets = [
  'this-week',
  'last-week',
  'this-month',
  'last-month',
  'this-year',
  'last-year-to-date',
  'last-full-year',
] as const;
export type PeriodPreset = (typeof periodPresets)[number];

export const utcInstantSchema = z.string().refine((value) => {
  const date = new Date(value);
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(date.getTime()) &&
    date.toISOString() === value
  );
}, 'Expected a valid UTC instant with millisecond precision');

export const calendarDateSchema = z.string().refine((value) => {
  const date = new Date(value + 'T00:00:00.000Z');
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}, 'Expected a valid calendar date');

export const dateRangeSchema = z
  .object({
    start: utcInstantSchema,
    end: utcInstantSchema,
    endInclusive: z.boolean(),
  })
  .strict()
  .refine(
    (range) => range.start < range.end || (range.start === range.end && range.endInclusive),
    'Range must not be empty or reversed',
  );
export type DateRange = z.infer<typeof dateRangeSchema>;

export const periodSelectionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('preset'), preset: z.enum(periodPresets) }).strict(),
  z
    .object({ kind: z.literal('custom'), from: calendarDateSchema, through: calendarDateSchema })
    .strict()
    .refine((value) => value.from <= value.through, 'Dates are reversed'),
]);
export type PeriodSelection = z.infer<typeof periodSelectionSchema>;
export interface ResolvedPeriod {
  selection: PeriodSelection;
  range: DateRange;
  comparison: DateRange;
  timezone: 'UTC';
}
export const defaultPeriod: PeriodSelection = { kind: 'preset', preset: 'this-month' };
