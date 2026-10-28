import type { Measurement } from '@/models/repository-overview';
import { absoluteChange } from '@/lib/presentation/measurement';
import { formatCount } from '@/lib/presentation/format';
import styles from './measurement-value.module.css';

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
        {value === null ? '—' : unit === 'days' ? formatCount(value) + ' d' : formatCount(value)}
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
        <span className={styles.change}>
          <span className="sr-only">Change from comparison period: </span>
          {change === null
            ? '—'
            : (change > 0 ? '+' : '') + formatCount(change) + (unit === 'days' ? ' d' : '')}
        </span>
      )}
    </span>
  );
}
