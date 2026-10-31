'use client';
import Link from 'next/link';
import type { Measurement } from '@/models/reporting-measurement';
import { MeasurementValue } from '@/components/metrics/measurement-value';
import { formatCount } from '@/lib/presentation/format';
import styles from './timeline-layout.module.css';

export const timelineFooterLegend = 'UTC · — unavailable or not applicable · * incomplete value';
export const timelineLinkLimitMessage =
  'Some values and names are too large to link. Reduce the selected repositories, metrics or filters to open them.';

/** The accessible name of a linked value keeps its coverage, which an aria-label would hide. */
export function timelineValueName(
  name: string,
  measurement: Measurement,
  unit: 'count' | 'days',
): string {
  return (
    name +
    ': ' +
    formatCount(measurement.value) +
    (unit === 'days' ? ' d' : '') +
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
    <aside className={styles.notice} aria-label="Timeline data coverage">
      <strong>Some timeline values are incomplete or unavailable.</strong> Dashes keep missing
      values distinct from zero; an asterisk marks incomplete data. A partial period describes the
      covered dates.
    </aside>
  );
}
export function TimelineLinkLimitNotice() {
  return (
    <aside className={styles.notice} role="status">
      {timelineLinkLimitMessage}
    </aside>
  );
}
