'use client';
import { ChartCell, ChartCells, ChartPanel } from '@/components/charts/chart-panel';
import { SelectableBars } from '@/components/charts/selectable-bars';
import { DataLegend, measurementMarks } from '@/components/feedback/data-legend';
import { EmptyState } from '@/components/feedback/empty-state';
import { MeasurementValue } from '@/components/metrics/measurement-value';
import type { RepositoryPageModel, RepositoryChart } from '@/models/repository-page';
import {
  chartPointSelection,
  isChartSelection,
  type RepositoryChartSelection,
} from '@/lib/presentation/repository-chart-selection';
import { zonedRangeLabel } from '@/lib/presentation/overview-periods';
import styles from './repository-charts.module.css';
const titles = {
  age: 'Age distribution',
  reviewers: 'Human reviewers',
  approvals: 'Current human approvals',
};
function title(chart: RepositoryChart, kind: 'prs' | 'issues') {
  if (chart.kind !== 'activity') return titles[chart.kind];
  return chart.dateBasis === 'mergedAt'
    ? 'PRs merged'
    : chart.dateBasis === 'closedAt'
      ? 'Issues closed'
      : kind === 'prs'
        ? 'PRs created'
        : 'Issues created';
}
export function RepositoryCharts({
  page,
  visible,
  onVisibilityChange,
  onSelect,
}: {
  page: RepositoryPageModel;
  visible: boolean;
  onVisibilityChange: (visible: boolean) => void;
  onSelect: (selection: RepositoryChartSelection) => void;
}) {
  return (
    <ChartPanel
      label="Repository charts"
      title="At a glance"
      description={
        'All matching ' +
        (page.kind === 'prs' ? 'PRs' : 'issues') +
        ', across every page. Select a bar to filter; select it again to clear.'
      }
      content="bars"
      showLabel="Show charts"
      hideLabel="Hide charts"
      expanded={visible}
      onExpandedChange={onVisibilityChange}
    >
      <div
        className={
          page.charts.length === 1 && page.charts[0].kind === 'age' ? styles.single : undefined
        }
      >
        <ChartCells>
          {page.charts.map((chart) => {
            const chartTitle = title(chart, page.kind);
            // The value glyphs this chart shows, so its legend explains only those.
            const marks = measurementMarks(chart.points.map((point) => point.count));
            return (
              <ChartCell
                key={chart.kind}
                title={chartTitle}
                total={<MeasurementValue measurement={chart.measurement} />}
                unit={page.kind === 'prs' ? 'PRs' : 'issues'}
                context={
                  chart.kind === 'activity'
                    ? zonedRangeLabel(chart.range) +
                      ' · ' +
                      (chart.granularity === 'day' ? 'Daily' : 'Monthly')
                    : chart.kind === 'age'
                      ? 'Age since creation · Current open'
                      : 'Non-draft PRs' +
                        (chart.excludedDrafts
                          ? ' · ' + chart.excludedDrafts + ' drafts excluded'
                          : '')
                }
                footer={
                  chart.measurement.value !== null && marks.length ? (
                    <DataLegend marks={marks} />
                  ) : undefined
                }
              >
                {chart.measurement.value === null ? (
                  <EmptyState variant="embedded" kind="missing" title="No chart values available">
                    {chart.measurement.reason}
                  </EmptyState>
                ) : (
                  <SelectableBars
                    label={chartTitle + ' values'}
                    orientation={chart.kind === 'activity' ? 'vertical' : 'horizontal'}
                    points={chart.points.map((point, index) => {
                      const selection = chartPointSelection(chart, index);
                      const label =
                        'label' in point
                          ? point.label
                          : new Intl.DateTimeFormat('en-US', {
                              timeZone: 'UTC',
                              ...(chart.kind === 'activity' && chart.granularity === 'month'
                                ? { month: 'short' as const }
                                : { month: 'short' as const, day: 'numeric' as const }),
                            }).format(new Date(point.range.start));
                      return {
                        id: String(index),
                        label:
                          chart.kind === 'age'
                            ? label.replace('Over ', '>').replace(' through ', '–')
                            : label,
                        detail: 'range' in point ? zonedRangeLabel(point.range) : label,
                        count: point.count,
                        selected: isChartSelection(page.filters, selection),
                      };
                    })}
                    onSelect={(index) => onSelect(chartPointSelection(chart, index))}
                  />
                )}
              </ChartCell>
            );
          })}
        </ChartCells>
      </div>
    </ChartPanel>
  );
}
