'use client';
import { useMemo, useState } from 'react';
import type { TimelineGrouping } from '@/models/reporting-timeline';
import type { TimelineDisplayRow, TimelineMetricDefinition } from '@/models/timeline-presentation';
import {
  timelineIntervalDescription,
  timelineMeasurement,
  timelinePeriodDates,
  timelinePeriodHeading,
  timelineValueColumns,
} from '@/lib/presentation/timeline-presentation';
import { measurementSortNote } from '@/lib/presentation/measurement-order';
import { DataTable, type DataColumn } from '@/components/tables/data-table';
import { measurementMarks } from '@/components/feedback/data-legend';
import { useLocalTableController } from '@/components/tables/local-data-table';
import styles from './timeline-layout.module.css';
import type { TableController } from '@/lib/presentation/table-controller';
import type { ColumnVisibility } from '@/components/tables/table-columns';
import type { CsvExportAlternative } from '@/components/exports/csv-export-dialog';
import { timelineExportFileName } from '@/lib/presentation/timeline-csv';
import {
  PartialPeriodMarker,
  TimelineCoverageNotice,
  TimelineLinkLimitNotice,
  TimelineValueCell,
  TimelineZeroNotice,
  hasUnlinkedValue,
  isIncompleteValue,
  isRecordedZeroRange,
} from './timeline-value';
import { metricName } from '@/models/column-selection';
export interface TimelineTableControls {
  detailHref?: (metric: string, interval: string) => string | null;
  csvDownload?: CsvExportAlternative['download'];
  exportContextKey?: string;
  disabled?: boolean;
  controller: TableController;
  visibility: ColumnVisibility;
}

export function TimelineTable({
  rows,
  metrics,
  grouping,
  title = 'Values over time',
  controls,
}: {
  rows: TimelineDisplayRow[];
  metrics: TimelineMetricDefinition[];
  grouping: TimelineGrouping;
  title?: string;
  controls?: TimelineTableControls;
}) {
  const localController = useLocalTableController({
    search: '',
    sort: 'period',
    descending: false,
    page: 1,
  });
  const [visible, setVisible] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(metrics.map((metric) => [metric.id, metric.defaultVisible])),
  );
  type Row = TimelineDisplayRow & { id: string };
  const detailHref = controls?.detailHref,
    linkable = !!detailHref && !controls?.disabled;
  const tableRows = useMemo(() => rows.map((row) => ({ ...row, id: row.interval.id })), [rows]);
  const valueColumns = useMemo(
    () => timelineValueColumns<Row>(metrics.map((metric) => metric.id)),
    [metrics],
  );
  const columns = useMemo(
    (): DataColumn<Row>[] => [
      {
        id: 'period',
        label: 'Period',
        pinned: true,
        hideable: false,
        selectionGroup: 'Period',
        description:
          'Calendar interval and actual covered dates in UTC. A partial period can still have complete data for its covered dates.',
        value: valueColumns[0].value,
        cell: (row) => {
          // A full week's dates are its heading, so the range prints once.
          const dates = timelinePeriodDates(row.interval, grouping);
          return (
            <div className={styles.period} title={timelineIntervalDescription(row.interval)}>
              <strong>{timelinePeriodHeading(row.interval, grouping)}</strong>
              {dates && <span className={styles.dates}>{dates}</span>}
              {row.interval.partial && <PartialPeriodMarker />}
            </div>
          );
        },
      },
      ...metrics.map((metric, index): DataColumn<Row> => ({
        ...metric,
        width: metric.unit === 'days' ? 150 : 136,
        align: 'right',
        value: valueColumns[index + 1].value,
        sortGroup: valueColumns[index + 1].sortGroup,
        sortNote: measurementSortNote,
        cell: (row) => {
          const measurement = timelineMeasurement(row.values, metric.id);
          return (
            <TimelineValueCell
              measurement={measurement}
              unit={metric.unit}
              name={`${metricName(metric)}, ${timelinePeriodHeading(row.interval, grouping)}`}
              href={
                linkable && measurement.value !== null
                  ? detailHref(metric.id, row.interval.id)
                  : null
              }
              linkable={linkable}
            />
          );
        },
      })),
    ],
    [metrics, grouping, detailHref, linkable, valueColumns],
  );
  const incomplete = useMemo(
    () =>
      rows.some((row) =>
        metrics.some((metric) => isIncompleteValue(timelineMeasurement(row.values, metric.id))),
      ),
    [rows, metrics],
  );
  const recordedZero = useMemo(
    () =>
      isRecordedZeroRange(
        rows.flatMap((row) => metrics.map((metric) => timelineMeasurement(row.values, metric.id))),
      ),
    [rows, metrics],
  );
  const visibility = controls?.visibility ?? { value: visible, onChange: setVisible };
  const legend = useMemo(
    () =>
      measurementMarks(
        rows.flatMap((row) =>
          metrics
            .filter((metric) => visibility.value[metric.id] !== false)
            .map((metric) => timelineMeasurement(row.values, metric.id)),
        ),
      ),
    [rows, metrics, visibility.value],
  );
  const unlinked = useMemo(() => {
    if (!linkable) return false;
    const byInterval = new Map(rows.map((row) => [row.interval.id, row]));
    return hasUnlinkedValue(
      metrics,
      [...byInterval.keys()],
      (metric, interval) => timelineMeasurement(byInterval.get(interval)!.values, metric.id),
      (metric, interval) => detailHref(metric.id, interval),
    );
  }, [linkable, rows, metrics, detailHref]);
  return (
    <div className={styles.stack}>
      {incomplete && <TimelineCoverageNotice />}
      {recordedZero && <TimelineZeroNotice />}
      {unlinked && <TimelineLinkLimitNotice />}
      <DataTable
        title={title}
        disabled={controls?.disabled}
        rows={tableRows}
        columns={columns}
        controller={controls?.controller ?? localController}
        exportName={controls?.csvDownload ? timelineExportFileName : undefined}
        csvDownload={controls?.csvDownload}
        exportContextKey={controls?.exportContextKey}
        search="none"
        visibility={visibility}
        itemLabel={{ singular: 'interval', plural: 'intervals' }}
        description="One row per calendar interval, with exact covered dates."
        legend={legend}
      />
    </div>
  );
}
