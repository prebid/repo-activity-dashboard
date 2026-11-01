'use client';
import Link from 'next/link';
import type { Measurement } from '@/models/reporting-measurement';
import { MeasurementValue } from '@/components/metrics/measurement-value';
import { Callout } from '@/components/feedback/callout';
import { formatMeasure } from '@/lib/presentation/format';
import styles from './timeline-layout.module.css';

export const timelineLinkLimitMessage =
  'Some values and names are too large to link. Reduce the selected repositories, metrics or filters to open them.';

/** Partial and missing values are what the coverage notice explains. */
export function isIncompleteValue(measurement: Measurement): boolean {
  return measurement.status === 'partial' || measurement.status === 'missing';
}
/**
 * Whether a known value lost its supporting link to the URL budget. For one row, a link grows only
 * with the interval id it carries, so each row is tried once at the longest interval; the cell-by-cell
 * check runs only when one of those links does not fit. Rows are not compared by key length, since a
 * link can carry one part of a row's identity more often than another.
 */
export function hasUnlinkedValue<R>(
  rows: readonly R[],
  intervals: readonly string[],
  value: (row: R, interval: string) => Measurement,
  href: (row: R, interval: string) => string | null,
): boolean {
  if (!rows.length || !intervals.length) return false;
  const size = (id: string) => encodeURIComponent(id).length;
  const interval = intervals.reduce((a, b) => (size(b) > size(a) ? b : a));
  if (rows.every((row) => href(row, interval) !== null)) return false;
  return rows.some((row) =>
    intervals.some(
      (interval) => value(row, interval).value !== null && href(row, interval) === null,
    ),
  );
}
/** The accessible name of a linked value keeps its coverage, which an aria-label would hide. */
export function timelineValueName(
  name: string,
  measurement: Measurement,
  unit: 'count' | 'days',
): string {
  return (
    name +
    ': ' +
    formatMeasure(measurement.value, unit) +
    (measurement.status === 'partial' ? ', partial value. ' + measurement.reason : '')
  );
}
/**
 * One Timeline value, shared by interval tables and the matrix. Known values link to their
 * supporting records; a known value whose link exceeds the URL budget says so to every user.
 */
export function TimelineValueCell({
  measurement,
  unit,
  name,
  href,
  linkable,
}: {
  measurement: Measurement;
  unit: 'count' | 'days';
  name: string;
  href: string | null | undefined;
  linkable: boolean;
}) {
  const value = <MeasurementValue measurement={measurement} unit={unit} />;
  if (href)
    return (
      <Link
        prefetch={false}
        href={href}
        aria-label={timelineValueName(name, measurement, unit)}
        className={styles.valueLink}
      >
        {value}
      </Link>
    );
  if (!linkable || measurement.value === null) return value;
  return (
    <span title={timelineLinkLimitMessage}>
      {value}
      <span className="sr-only"> No supporting-records link: the link would be too large.</span>
    </span>
  );
}
export function TimelineCoverageNotice() {
  return (
    <Callout
      tone="warning"
      as="aside"
      aria-label="Timeline data coverage"
      lead="Some timeline values are incomplete or unavailable."
    >
      Dashes keep missing values distinct from zero; an asterisk marks incomplete data. A partial
      period describes the covered dates.
    </Callout>
  );
}
export function TimelineLinkLimitNotice() {
  return (
    <Callout tone="info" as="p" role="status">
      {timelineLinkLimitMessage}
    </Callout>
  );
}
/**
 * Whether every value in a timeline's range is a recorded zero. Missing, partial and
 * not-applicable values are not, so the zero notice never hides a coverage gap.
 */
export function isRecordedZeroRange(measurements: Iterable<Measurement>): boolean {
  let any = false;
  for (const measurement of measurements) {
    if (measurement.status !== 'complete' || measurement.value !== 0) return false;
    any = true;
  }
  return any;
}
export function TimelineZeroNotice() {
  return (
    <Callout tone="info" as="p">
      Every value in this range is a recorded zero; no data is missing.
    </Callout>
  );
}
