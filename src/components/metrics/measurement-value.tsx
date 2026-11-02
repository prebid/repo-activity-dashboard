import type { Measurement } from '@/models/reporting-measurement';
import { absoluteChange } from '@/lib/presentation/measurement';
import { formatCount, formatDayNumber, formatMeasure } from '@/lib/presentation/format';
import styles from './measurement-value.module.css';

export function MeasurementDifference({
  first,
  second,
  unit = 'count',
}: {
  first: Measurement;
  second: Measurement;
  unit?: 'count' | 'days';
}) {
  const difference = absoluteChange(first, second);
  return (
    <span className={styles.difference}>
      {difference === null ? (
        <span
          className={styles.quiet}
          title="A difference requires complete values in both periods."
        >
          —<span className="sr-only"> A difference requires complete values in both periods.</span>
        </span>
      ) : (
        <span title="Period 1 minus Period 2">
          {(difference > 0 ? '+' : '') + formatMeasure(difference === 0 ? 0 : difference, unit)}
        </span>
      )}
    </span>
  );
}

export function MeasurementValue({
  measurement,
  unit = 'count',
  detail,
  comparison,
}: {
  measurement: Measurement;
  unit?: 'count' | 'days';
  detail?: string;
  comparison?: Measurement;
}) {
  const reason = measurement.status === 'complete' ? undefined : measurement.reason;
  const value = measurement.value;
  const change = comparison ? absoluteChange(measurement, comparison) : null;
  return (
    <span className={styles.metric}>
      <span
        className={value === null || value === 0 ? styles.quiet : styles.value}
        title={reason ?? detail}
      >
        {formatMeasure(value, unit)}
        {measurement.status === 'partial' && (
          <sup aria-hidden="true" className={styles.marker}>
            *
          </sup>
        )}
        {reason && (
          <span className="sr-only">
            {' '}
            {measurement.status === 'partial' ? 'Partial value. ' : ''}
            {reason}
          </span>
        )}
        {detail && <span className="sr-only"> {detail}</span>}
      </span>
      {comparison && (
        <span
          className={styles.change}
          title={
            comparison.status === 'complete'
              ? 'Previous period: ' + formatMeasure(comparison.value, unit)
              : comparison.reason
          }
        >
          <span className="sr-only">Change from comparison period: </span>
          {change === null ? '—' : (change > 0 ? '+' : '') + formatMeasure(change, unit)}
          <span className="sr-only">
            {comparison.status === 'complete'
              ? ' Previous period value: ' +
                (unit === 'days'
                  ? formatDayNumber(comparison.value) + ' days'
                  : formatCount(comparison.value))
              : ' ' + comparison.reason}
          </span>
        </span>
      )}
    </span>
  );
}
