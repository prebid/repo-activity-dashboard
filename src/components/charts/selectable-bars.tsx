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
/**
 * Native buttons keep the bars, printed values and keyboard interaction on one semantic surface.
 * Vertical bars print each count directly above its bar on one shared baseline, so a known zero is
 * a "0" on the axis with no bar, and an unavailable value is its dash there.
 */
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
  const vertical = orientation === 'vertical';
  return (
    <div
      className={styles.scroll}
      role="group"
      aria-label={label}
      tabIndex={vertical ? 0 : undefined}
    >
      <ul className={vertical ? styles.vertical : styles.horizontal}>
        {points.map((point, index) => {
          const share = ((point.count.value ?? 0) / maximum) * 100 + '%';
          const count = (
            <span className={styles.count} data-chart-count>
              <MeasurementValue measurement={point.count} />
            </span>
          );
          return (
            <li key={point.id}>
              <button
                type="button"
                className={styles.point}
                aria-describedby={id + '-' + index}
                aria-pressed={point.selected}
                disabled={
                  !point.selected && (point.count.value === null || point.count.value === 0)
                }
                onClick={() => onSelect(index)}
                title={point.detail}
              >
                <span className={styles.label}>{point.label}</span>{' '}
                {vertical ? (
                  <span className={styles.plot}>
                    {count}
                    <span className={styles.track} aria-hidden="true" style={{ height: share }}>
                      <span className={styles.bar} />
                    </span>
                  </span>
                ) : (
                  <>
                    <span className={styles.track} aria-hidden="true">
                      <span className={styles.bar} style={{ width: share }} />
                    </span>
                    {count}
                  </>
                )}
              </button>
              <span id={id + '-' + index} hidden>
                {point.detail}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
