'use client';
import { useEffect, useState } from 'react';
import { ArrowDownUp, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PeriodSelection } from '@/models/reporting-period';
import type { RepositoryOverview } from '@/models/repository-overview';
import { periodRangeLabel, validateActivityPeriods } from '@/lib/presentation/overview-periods';
import { TimeframeControl } from './timeframe-control';
import styles from './overview-controls.module.css';

export function ActivityPeriodControls({
  primary,
  secondary,
  onChange,
}: {
  primary: RepositoryOverview;
  secondary?: RepositoryOverview;
  onChange: (periods: PeriodSelection[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    if (secondary) setAdding(false);
  }, [secondary]);
  const periods = secondary
    ? [primary.period.selection, secondary.period.selection]
    : [primary.period.selection];
  function select(index: number, selection: PeriodSelection): string | undefined {
    const next = [...periods];
    next[index] = selection;
    const error = validateActivityPeriods(next, primary.asOf);
    if (error) return error;
    onChange(next);
  }
  const slots = secondary || adding ? [primary, secondary] : [primary];
  return (
    <div>
      {secondary && (
        <div className={styles.periodActions}>
          <span>Two periods and their difference, grouped by repository.</span>
          <Button variant="ghost" size="sm" onClick={() => onChange([periods[1], periods[0]])}>
            <ArrowDownUp size={14} aria-hidden="true" />
            Swap periods
          </Button>
        </div>
      )}
      <div className={styles.periodGrid}>
        {slots.map((report, index) => (
          <section key={index} className={styles.periodCard} aria-label={'Period ' + (index + 1)}>
            <div className={styles.periodCardHeader}>
              <div className={styles.periodHeading}>
                <strong>Period {index + 1}</strong>
                {report && (
                  <span className={styles.periodDate}>
                    ({periodRangeLabel(report.period.range)} · UTC)
                  </span>
                )}
              </div>
              {(secondary || index === 1) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={styles.removePeriod}
                  aria-label={report ? 'Remove period ' + (index + 1) : 'Cancel adding period'}
                  onClick={() => {
                    if (report) onChange(periods.filter((_value, i) => i !== index));
                    else setAdding(false);
                  }}
                >
                  <X size={14} aria-hidden="true" />
                </Button>
              )}
            </div>
            <TimeframeControl
              label={'Period ' + (index + 1)}
              period={report?.period}
              other={periods[index === 0 ? 1 : 0]}
              asOf={primary.asOf}
              onChange={(selection) => select(index, selection)}
            />
            {!report && <p className={styles.help}>Choose a preset or enter a custom range.</p>}
            {report?.activitySample === 'unprepared' && (
              <p role="status" className={styles.notice}>
                No prepared sample data for Period {index + 1}. Its values are shown as dashes.
              </p>
            )}
          </section>
        ))}
        {!secondary && !adding && (
          <Button variant="outline" className={styles.addPeriod} onClick={() => setAdding(true)}>
            <Plus size={16} aria-hidden="true" />
            Add second period
          </Button>
        )}
      </div>
    </div>
  );
}
