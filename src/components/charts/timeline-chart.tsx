'use client';
import { useId, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChevronDown, ChevronUp, ChartNoAxesCombined } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MeasurementValue } from '@/components/metrics/measurement-value';
import {
  timelineIntervalLabel,
  timelineMeasurement,
} from '@/lib/presentation/timeline-presentation';
import type { TimelineDisplayRow, TimelineMetricDefinition } from '@/models/timeline-presentation';
import type { TimelineGrouping } from '@/models/reporting-timeline';
import { PageState } from '@/components/feedback/page-state';
import { useClientReady } from '@/lib/navigation/use-client-ready';
import { periodRangeLabel } from '@/lib/presentation/overview-periods';
import { formatUtcDate } from '@/lib/presentation/format';
import styles from '@/components/reporting/timeline-layout.module.css';
import { metricName } from '@/models/column-selection';
export interface TimelineChartControls {
  onInterval?: (metric: string, interval: string) => void;
  disabled?: boolean;
  visible: boolean;
  metric: string;
  onVisibility: (visible: boolean) => void;
  onMetric: (metric: string) => void;
}

function TimelinePoint({
  cx,
  cy,
  index,
  partial = false,
  active = false,
  onSelect,
}: {
  cx?: number;
  cy?: number;
  index: number;
  partial?: boolean;
  active?: boolean;
  onSelect?: (index: number) => void;
}) {
  if (
    typeof cx !== 'number' ||
    typeof cy !== 'number' ||
    !Number.isFinite(cx) ||
    !Number.isFinite(cy)
  )
    return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={active ? 5 : partial ? 4 : 3}
      fill={partial ? 'var(--card)' : 'var(--chart-1)'}
      stroke="var(--chart-1)"
      strokeWidth={partial ? 2 : 0}
      style={{ cursor: onSelect ? 'pointer' : undefined }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.(index);
      }}
    />
  );
}
export function TimelineChart({
  rows,
  metrics,
  summary,
  grouping,
  snapshot = false,
  controls,
}: {
  rows: TimelineDisplayRow[];
  metrics: TimelineMetricDefinition[];
  summary: TimelineDisplayRow['values'];
  grouping: TimelineGrouping;
  snapshot?: boolean;
  controls?: TimelineChartControls;
}) {
  const ready = useClientReady();
  const interactive = ready && !controls?.disabled;
  const [localVisible, setVisible] = useState(false),
    [localMetric, setMetric] = useState(metrics[0].id);
  const visible = controls?.visible ?? localVisible,
    metricId = controls?.metric ?? localMetric;
  const id = useId(),
    metric = metrics.find((item) => item.id === metricId)!;
  const points = rows.map((row, index) => {
    const measurement = timelineMeasurement(row.values, metricId);
    return {
      index,
      label: timelineIntervalLabel(row.interval, grouping),
      axisLabel:
        grouping === 'week'
          ? formatUtcDate(row.interval.calendar.start)
          : timelineIntervalLabel(row.interval, grouping),
      covered: periodRangeLabel(row.interval.covered),
      value: measurement.value,
      partialValue: measurement.status === 'partial' ? measurement.value : null,
      measurement,
      partialPeriod: row.interval.partial,
    };
  });
  const isolated = (index: number) =>
    points[index]?.value != null &&
    points[index - 1]?.value == null &&
    points[index + 1]?.value == null;
  function selectInterval(index: number) {
    const row = rows[index];
    if (interactive && row && timelineMeasurement(row.values, metricId).value !== null)
      controls?.onInterval?.(metricId, row.interval.id);
  }
  return (
    <section className={styles.section} aria-label="Timeline chart">
      <div className={styles.heading}>
        <div>
          <h2>Trend</h2>
          <p>All {rows.length} intervals, independent of table sorting and pages.</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={visible}
          aria-controls={id}
          disabled={!interactive}
          onClick={() => (controls ? controls.onVisibility(!visible) : setVisible(!visible))}
        >
          <ChartNoAxesCombined size={15} aria-hidden="true" />
          {visible ? 'Hide chart' : 'Show chart'}
          {visible ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </Button>
      </div>
      {visible && (
        <div id={id} className={styles.chartBody}>
          <div className={styles.chartToolbar}>
            <label className={styles.metricControl}>
              Chart metric
              <select
                disabled={!interactive}
                value={metricId}
                onChange={(event) =>
                  controls ? controls.onMetric(event.target.value) : setMetric(event.target.value)
                }
              >
                {metrics.map((item) => (
                  <option key={item.id} value={item.id}>
                    {metricName(item)}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.summary}>
              <span>
                {snapshot
                  ? 'At range end'
                  : metric.unit === 'days'
                    ? 'Whole-range median'
                    : 'Whole range'}
              </span>
              <strong>
                <MeasurementValue
                  measurement={timelineMeasurement(summary, metricId)}
                  unit={metric.unit}
                />
              </strong>
            </div>
          </div>
          <figure aria-label={metricName(metric) + ' timeline'}>
            {points.some((point) => point.value !== null) ? (
              <div className={styles.chart} aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={points}
                    onClick={(state) => {
                      if (
                        !state.isTooltipActive ||
                        state.activeTooltipIndex === null ||
                        state.activeTooltipIndex === undefined
                      )
                        return;
                      const index = Number(state.activeTooltipIndex);
                      selectInterval(index);
                    }}
                    accessibilityLayer={false}
                    margin={{ top: 12, right: 14, left: 0, bottom: 4 }}
                  >
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="index"
                      tickFormatter={(index: unknown) =>
                        typeof index === 'number' ? (points[index]?.axisLabel ?? '') : ''
                      }
                      interval="preserveStartEnd"
                      minTickGap={28}
                      tick={{ fill: 'var(--muted-foreground)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      width={42}
                      allowDecimals={metric.unit === 'days'}
                      domain={[0, 'auto']}
                      tick={{ fill: 'var(--muted-foreground)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={({ active, label }) => {
                        const point =
                          typeof label === 'number' || typeof label === 'string'
                            ? points[Number(label)]
                            : undefined;
                        return active && point ? (
                          <div className={styles.tooltip}>
                            <strong>{point.label}</strong>
                            <small>{point.covered} · UTC</small>
                            <MeasurementValue measurement={point.measurement} unit={metric.unit} />
                            {point.partialPeriod && <small>Partial calendar period</small>}
                          </div>
                        ) : null;
                      }}
                    />
                    <Line
                      dataKey="value"
                      type="linear"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      dot={(point) =>
                        points.length <= 40 ? (
                          <TimelinePoint
                            cx={point.cx}
                            cy={point.cy}
                            index={point.index}
                            onSelect={
                              interactive && controls?.onInterval ? selectInterval : undefined
                            }
                          />
                        ) : isolated(point.index) ? (
                          // A value between gaps draws no line, so it keeps a plain marker.
                          <TimelinePoint cx={point.cx} cy={point.cy} index={point.index} />
                        ) : null
                      }
                      activeDot={(point) => (
                        <TimelinePoint
                          active
                          cx={point.cx}
                          cy={point.cy}
                          index={point.index}
                          onSelect={
                            interactive && controls?.onInterval ? selectInterval : undefined
                          }
                        />
                      )}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                    <Line
                      dataKey="partialValue"
                      stroke="none"
                      dot={(point) => (
                        <TimelinePoint
                          partial
                          cx={point.cx}
                          cy={point.cy}
                          index={point.index}
                          onSelect={
                            interactive && controls?.onInterval ? selectInterval : undefined
                          }
                        />
                      )}
                      activeDot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <PageState title="No chart values available">
                The interval table retains the coverage for this metric.
              </PageState>
            )}
            <figcaption className={styles.chartNote}>
              Values use the full covered range. Gaps indicate unavailable data; outlined markers
              identify partial values. The table provides the same values and exact dates.
            </figcaption>
          </figure>
        </div>
      )}
    </section>
  );
}
