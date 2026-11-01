'use client';
import { useId } from 'react';
import { NativeSelect } from '@/components/ui/native-select';
import type { ReportToolbarGroup } from './report-toolbar';
import { TimeframeControl } from './timeframe-control';
import { timelineGroupings, timelineGroupingLabels } from '@/models/reporting-timeline';
import type { TimelineControlContext, TimelineViewState } from '@/models/timeline-controls';
import type { TimelineMetricDefinition } from '@/models/timeline-presentation';
import type { PeriodSelection } from '@/models/reporting-period';
import { resolveReportingPeriod } from '@/lib/presentation/reporting-period';
import styles from './timeline-controls.module.css';
import { TimelineMetricsSelector } from './timeline-metrics-selector';
import { metricName } from '@/models/column-selection';

export interface TimelineControlsProps {
  context: TimelineControlContext;
  view: TimelineViewState;
  metrics: TimelineMetricDefinition[];
  onView: (patch: Partial<TimelineViewState>) => unknown;
  onPeriod: (period: PeriodSelection) => string | undefined;
  children?: React.ReactNode;
  /** Repository Timelines name their measure families; other areas have none. */
  familyLabels?: Record<TimelineViewState['family'], string>;
}

/** Shown under a repository Timeline's controls, whose Records and Measure own the filters. */
export const timelineRecordFilterNote =
  'Changing Records or Measure clears record filters. Grouping and period changes retain them.';

/** The Timeline's own settings as a toolbar group; its reset restores what the view saves. */
export function timelineSettingsGroup({
  onReset,
  ...props
}: TimelineControlsProps & { onReset: () => void }): ReportToolbarGroup {
  return {
    label: 'Timeline settings',
    controls: <TimelineControls {...props} />,
    reset: { label: 'Reset view', onReset },
  };
}

/** The Timeline's fields, laid out by the report toolbar that frames them. */
export function TimelineControls({
  context,
  view,
  metrics,
  onView,
  onPeriod,
  children,
  familyLabels,
}: TimelineControlsProps) {
  if (context.area === 'repository' && !familyLabels)
    throw Error('Repository Timeline controls need their family labels.');
  // Each select is named by its visible label so speech input can use the text on screen.
  const id = useId();
  return (
    <>
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
          <NativeSelect
            aria-labelledby={id + '-grouping'}
            value={view.grouping}
            onChange={(e) => onView({ grouping: e.target.value as TimelineViewState['grouping'] })}
          >
            {timelineGroupings.map((id) => (
              <option key={id} value={id}>
                {timelineGroupingLabels[id]}
              </option>
            ))}
          </NativeSelect>
        </span>
      </label>
      {context.area === 'repository' && (
        <>
          <label className={styles.field}>
            <span id={id + '-records'}>Records</span>
            <span className={styles.selectWrap}>
              <NativeSelect
                aria-labelledby={id + '-records'}
                value={view.kind}
                onChange={(e) => onView({ kind: e.target.value as TimelineViewState['kind'] })}
              >
                <option value="prs">Pull requests</option>
                <option value="issues">Issues</option>
              </NativeSelect>
            </span>
          </label>
          <label className={styles.field}>
            <span id={id + '-measure'}>Measure</span>
            <span className={styles.selectWrap}>
              <NativeSelect
                aria-labelledby={id + '-measure'}
                value={view.family}
                onChange={(e) => onView({ family: e.target.value as TimelineViewState['family'] })}
              >
                <option value="activity">{familyLabels!.activity}</option>
                <option value="snapshot">{familyLabels!.snapshot}</option>
              </NativeSelect>
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
                <NativeSelect
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
                </NativeSelect>
              </span>
            </label>
          )}
        </>
      )}
      {children}
    </>
  );
}
