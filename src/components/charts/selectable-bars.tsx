'use client';
import { useId } from 'react';
import { MeasurementValue } from '@/components/metrics/measurement-value';
import type { Count } from '@/models/reporting-measurement';
import styles from './selectable-bars.module.css';
export interface SelectableBar {
  id: string;
  label: string;
  detail: string;
  count: Count;
  selected: boolean;
}
/** Native buttons keep the bars, printed values and keyboard interaction on one semantic surface. */
export function SelectableBars({
  label,
  points,
  orientation = 'horizontal',
  onSelect,
}: {
  label: string;
  points: SelectableBar[];
  orientation?: 'horizontal' | 'vertical';
  onSelect: (index: number) => void;
}) {
  const id = useId();
  const maximum = Math.max(1, ...points.map((point) => point.count.value ?? 0));
  return (
    <div
      className={styles.scroll}
      role="group"
      aria-label={label}
      tabIndex={orientation === 'vertical' ? 0 : undefined}
    >
      <ul className={orientation === 'vertical' ? styles.vertical : styles.horizontal}>
        {points.map((point, index) => (
          <li key={point.id}>
            <button
              type="button"
              aria-describedby={id + '-' + index}
              aria-pressed={point.selected}
              disabled={!point.selected && (point.count.value === null || point.count.value === 0)}
              onClick={() => onSelect(index)}
              title={point.detail}
            >
              <span className={styles.label}>{point.label}</span>{' '}
              <span className={styles.track} aria-hidden="true">
                <span
                  className={styles.bar}
                  style={
                    orientation === 'vertical'
                      ? { height: ((point.count.value ?? 0) / maximum) * 100 + '%' }
                      : { width: ((point.count.value ?? 0) / maximum) * 100 + '%' }
                  }
                />
              </span>
              <span className={styles.count} data-chart-count>
                <MeasurementValue measurement={point.count} />
              </span>
            </button>
            <span id={id + '-' + index} hidden>
              {point.detail}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
