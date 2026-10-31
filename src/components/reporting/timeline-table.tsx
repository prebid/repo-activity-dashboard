'use client';
import { useMemo, useState } from 'react';
import type { TimelineGrouping } from '@/models/reporting-timeline';
import type { TimelineDisplayRow, TimelineMetricDefinition } from '@/models/timeline-presentation';
import {
  timelineIntervalLabel,
  timelineIntervalDescription,
  timelineMeasurement,
  timelineValueColumns,
} from '@/lib/presentation/timeline-presentation';
import { periodRangeLabel } from '@/lib/presentation/overview-periods';
import { measurementSortNote } from '@/lib/presentation/measurement-order';
import { DataTable, type DataColumn } from '@/components/tables/data-table';
import { useLocalTableController } from '@/components/tables/local-data-table';
import styles from './timeline-layout.module.css';
import type { TableController } from '@/lib/presentation/table-controller';
import type { ColumnVisibility } from '@/components/tables/table-columns';
import type { CsvExportAlternative } from '@/components/exports/csv-export-dialog';
import { timelineExportFileName } from './timeline-csv-download';
import {
  TimelineCoverageNotice,
  TimelineLinkLimitNotice,
  TimelineValueCell,
  timelineFooterLegend,
} from './timeline-value';
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
        cell: (row) => (
          <div className={styles.period} title={timelineIntervalDescription(row.interval)}>
            <strong>{timelineIntervalLabel(row.interval, grouping)}</strong>
            {grouping !== 'day' && (
              <span className={styles.dates}>{periodRangeLabel(row.interval.covered)}</span>
            )}
            {row.interval.partial && <span className={styles.partial}>Partial period</span>}
          </div>
        ),
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
              name={`${metric.group ? metric.group + ' — ' : ''}${metric.label}, ${timelineIntervalLabel(row.interval, grouping)}`}
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
  const incomplete = rows.some((row) =>
    metrics.some((metric) =>
      ['partial', 'missing'].includes(timelineMeasurement(row.values, metric.id).status),
    ),
  );
  const unlinked =
    linkable &&
    rows.some((row) =>
      metrics.some(
        (metric) =>
          timelineMeasurement(row.values, metric.id).value !== null &&
          detailHref(metric.id, row.interval.id) === null,
      ),
    );
  return (
    <div className={styles.stack}>
      {incomplete && <TimelineCoverageNotice />}
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
        searchable={false}
        visibility={controls?.visibility ?? { value: visible, onChange: setVisible }}
        itemLabel={{ singular: 'interval', plural: 'intervals' }}
        description="One row per calendar interval, with exact covered dates."
        footerNote={timelineFooterLegend}
      />
    </div>
  );
}
