'use client';
import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TimeframeControl } from './timeframe-control';
import { timelineGroupings, timelineGroupingLabels } from '@/models/reporting-timeline';
import type { TimelineControlContext, TimelineViewState } from '@/models/timeline-controls';
import type { TimelineMetricDefinition } from '@/models/timeline-presentation';
import type { PeriodSelection } from '@/models/reporting-period';
import { repositoryTimelineFamilyLabels } from '@/models/repository-timeline';
import { resolveReportingPeriod } from '@/lib/presentation/reporting-period';
import { useClientReady } from '@/lib/navigation/use-client-ready';
import styles from './timeline-controls.module.css';
import { TimelineMetricsSelector } from './timeline-metrics-selector';
import { metricName } from '@/models/column-selection';
export function TimelineControls({
  context,
  view,
  metrics,
  pending,
  notice,
  storageAvailable,
  onView,
  onPeriod,
  onReset,
  children,
  showPreferenceNote = true,
}: {
  context: TimelineControlContext;
  view: TimelineViewState;
  metrics: TimelineMetricDefinition[];
  pending: boolean;
  notice?: string;
  storageAvailable: boolean;
  onView: (patch: Partial<TimelineViewState>) => unknown;
  onPeriod: (period: PeriodSelection) => string | undefined;
  onReset: () => void;
  children?: React.ReactNode;
  showPreferenceNote?: boolean;
}) {
  const ready = useClientReady();
  // Each select is named by its visible label so speech input can use the text on screen.
  const id = useId();
  return (
    <section className={styles.panel} aria-label="Timeline settings">
      <fieldset disabled={!ready || pending} className={styles.bar}>
        {context.area !== 'contribution' && (
          <div className={styles.field}>
            <span aria-hidden="true">Reporting period</span>
            <TimeframeControl
              label="Reporting period"
              period={resolveReportingPeriod(context.period, context.asOf)}
              asOf={context.asOf}
              onChange={onPeriod}
            />
          </div>
        )}
        <label className={styles.field}>
          <span id={id + '-grouping'}>Group by</span>
          <span className={styles.selectWrap}>
            <select
              aria-labelledby={id + '-grouping'}
              value={view.grouping}
              onChange={(e) =>
                onView({ grouping: e.target.value as TimelineViewState['grouping'] })
              }
            >
              {timelineGroupings.map((id) => (
                <option key={id} value={id}>
                  {timelineGroupingLabels[id]}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" size={14} />
          </span>
        </label>
        {context.area === 'repository' && (
          <>
            <label className={styles.field}>
              <span id={id + '-records'}>Records</span>
              <span className={styles.selectWrap}>
                <select
                  aria-labelledby={id + '-records'}
                  value={view.kind}
                  onChange={(e) => onView({ kind: e.target.value as TimelineViewState['kind'] })}
                >
                  <option value="prs">Pull requests</option>
                  <option value="issues">Issues</option>
                </select>
                <ChevronDown aria-hidden="true" size={14} />
              </span>
            </label>
            <label className={styles.field}>
              <span id={id + '-measure'}>Measure</span>
              <span className={styles.selectWrap}>
                <select
                  aria-labelledby={id + '-measure'}
                  value={view.family}
                  onChange={(e) =>
                    onView({ family: e.target.value as TimelineViewState['family'] })
                  }
                >
                  <option value="activity">{repositoryTimelineFamilyLabels.activity}</option>
                  <option value="snapshot">{repositoryTimelineFamilyLabels.snapshot}</option>
                </select>
                <ChevronDown aria-hidden="true" size={14} />
              </span>
            </label>
          </>
        )}
        {context.area === 'matrix' && (
          <>
            <TimelineMetricsSelector
              metrics={metrics}
              selected={view.selectedMetrics ?? [view.metric]}
              contextKey={JSON.stringify([context.href, view.selectedMetrics])}
              onApply={(selectedMetrics) => onView({ selectedMetrics })}
            />
            {(view.selectedMetrics?.length ?? 0) > 1 && (
              <label className={styles.field}>
                Sort metric
                <span className={styles.selectWrap}>
                  <select
                    aria-label="Sort metric"
                    value={view.metric}
                    onChange={(e) => onView({ metric: e.target.value })}
                  >
                    {metrics
                      .filter((metric) => view.selectedMetrics?.includes(metric.id))
                      .map((metric) => (
                        <option key={metric.id} value={metric.id}>
                          {metricName(metric)}
                        </option>
                      ))}
                  </select>
                  <ChevronDown aria-hidden="true" size={14} />
                </span>
              </label>
            )}
          </>
        )}
        {children}
        <Button variant="ghost" size="sm" onClick={onReset}>
          Reset Timeline preferences
        </Button>
      </fieldset>
      {showPreferenceNote && (
        <p className={styles.note}>
          {pending
            ? 'Updating timeline…'
            : storageAvailable
              ? 'Preferences saved for your account on this browser.'
              : 'Browser storage is unavailable. Changes still work in this URL.'}
        </p>
      )}
      {context.area === 'repository' && (
        <p className={styles.note}>
          Changing Records or Measure clears record filters. Grouping and period changes retain
          them.
        </p>
      )}
      {notice && (
        <p className={styles.notice} role="alert">
          {notice}
        </p>
      )}
    </section>
  );
}
