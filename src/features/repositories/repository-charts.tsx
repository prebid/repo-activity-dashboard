'use client';
import { useId } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SelectableBars } from '@/components/charts/selectable-bars';
import { MeasurementValue } from '@/components/metrics/measurement-value';
import type { RepositoryPageModel, RepositoryChart } from '@/models/repository-page';
import {
  chartPointSelection,
  isChartSelection,
  type RepositoryChartSelection,
} from '@/lib/presentation/repository-chart-selection';
import { periodRangeLabel } from '@/lib/presentation/overview-periods';
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
  const id = useId();
  return (
    <section className={styles.section} aria-label="Repository charts">
      <div className={styles.heading}>
        <div>
          <h2>At a glance</h2>
          <p>
            All matching {page.kind === 'prs' ? 'PRs' : 'issues'}, across every page. Select a bar
            to filter; select it again to clear.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={visible}
          aria-controls={id}
          onClick={() => onVisibilityChange(!visible)}
        >
          {visible ? (
            <ChevronUp size={14} aria-hidden="true" />
          ) : (
            <ChevronDown size={14} aria-hidden="true" />
          )}
          {visible ? 'Hide charts' : 'Show charts'}
        </Button>
      </div>
      <div id={id} hidden={!visible}>
        <div className={styles.grid}>
          {page.charts.map((chart) => {
            const chartTitle = title(chart, page.kind);
            return (
              <figure
                key={chart.kind}
                className={styles.card}
                data-kind={chart.kind}
                aria-label={chartTitle}
              >
                <figcaption>
                  <strong>{chartTitle}</strong>
                  <span>
                    <MeasurementValue measurement={chart.measurement} />{' '}
                    {page.kind === 'prs' ? 'PRs' : 'issues'}
                  </span>
                </figcaption>
                <p className={styles.context}>
                  {chart.kind === 'activity'
                    ? periodRangeLabel(chart.range) +
                      ' · UTC · ' +
                      (chart.granularity === 'day' ? 'Daily' : 'Monthly')
                    : chart.kind === 'age'
                      ? 'Age since creation · Current open'
                      : 'Non-draft PRs' +
                        (chart.excludedDrafts
                          ? ' · ' + chart.excludedDrafts + ' drafts excluded'
                          : '')}
                </p>
                {chart.measurement.value === null ? (
                  <p className={styles.notice}>— {chart.measurement.reason}</p>
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
                        detail: 'range' in point ? periodRangeLabel(point.range) + ' UTC' : label,
                        count: point.count,
                        selected: isChartSelection(page.filters, selection),
                      };
                    })}
                    onSelect={(index) => onSelect(chartPointSelection(chart, index))}
                  />
                )}
                {chart.points.some((point) => point.count.status === 'partial') && (
                  <p className={styles.notice}>
                    * Partial coverage. Counts show available matching records.
                  </p>
                )}
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}
