// Period and instant encodings: a period is a preset or a day range, and an exact interval is a
// period plus the snapshot instant (`at`) it resolves against.
import {
  periodPresets,
  periodSelectionSchema,
  type DateRange,
  type PeriodSelection,
} from '@/models/reporting-period';
import { customPeriodForRange, resolveReportingPeriod } from '../reporting-period';

/** A period's URL value: the preset ID, or `YYYY-MM-DD..YYYY-MM-DD`. */
export function periodValue(selection: PeriodSelection): string {
  return selection.kind === 'preset' ? selection.preset : selection.from + '..' + selection.through;
}
/** The period a URL value names, or null when malformed or reversed. */
export function periodSelection(value: string): PeriodSelection | null {
  const [from, through] = value.split('..');
  const parsed = periodSelectionSchema.safeParse(
    through === undefined ? { kind: 'preset', preset: value } : { kind: 'custom', from, through },
  );
  return parsed.success ? parsed.data : null;
}
/** The shortest UTC spelling of an instant: a date at midnight, minutes, seconds, then milliseconds. */
export function instantValue(iso: string): string {
  const date = new Date(iso).toISOString();
  if (date.endsWith('T00:00:00.000Z')) return date.slice(0, 10);
  if (date.endsWith(':00.000Z')) return date.slice(0, 16) + 'Z';
  if (date.endsWith('.000Z')) return date.slice(0, 19) + 'Z';
  return date;
}
/** The millisecond ISO instant an `at`-style value names, or null when malformed. */
export function instantIso(value: string): string | null {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value + 'T00:00:00.000Z'
    : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/.test(value)
      ? value.slice(0, 16) + ':00.000Z'
      : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)
        ? value.slice(0, 19) + '.000Z'
        : value;
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) && date.toISOString() === iso ? iso : null;
}
const sameRange = (a: DateRange, b: DateRange) =>
  a.start === b.start && a.end === b.end && a.endInclusive === b.endInclusive;
/** The range a period covers when resolved at an instant, or null when it cannot resolve there. */
export function periodRange(selection: PeriodSelection, at: string): DateRange | null {
  try {
    return resolveReportingPeriod(selection, at).range;
  } catch {
    return null;
  }
}
/**
 * The period whose resolution at `at` is exactly `range`: the first matching preset, else the day
 * range covering it. Null when no period resolves to it there.
 */
export function periodAt(range: DateRange, at: string): PeriodSelection | null {
  const candidates: PeriodSelection[] = [
    ...periodPresets.map((preset) => ({ kind: 'preset' as const, preset })),
    customPeriodForRange(range),
  ];
  return (
    candidates.find((candidate) => {
      const resolved = periodRange(candidate, at);
      return resolved !== null && sameRange(resolved, range);
    }) ?? null
  );
}
/**
 * An exact interval as a period plus snapshot: the snapshot is the interval's end, so the period
 * resolves to the interval at it. Null when no period does (the interval needs other encoding).
 */
export function rangeValues(range: DateRange): { period: string; at: string } | null {
  const period = periodAt(range, range.end);
  return period ? { period: periodValue(period), at: instantValue(range.end) } : null;
}
