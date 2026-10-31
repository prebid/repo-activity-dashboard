'use client';
import { useState } from 'react';
import type { TimelineGrouping } from '@/models/reporting-timeline';
import type { TimelineDisplayRow, TimelineMetricDefinition } from '@/models/timeline-presentation';
import {
  timelineIntervalLabel,
  timelineIntervalDescription,
  timelineMeasurement,
} from '@/lib/presentation/timeline-presentation';
import { periodRangeLabel } from '@/lib/presentation/overview-periods';
import { measurementSortGroup, measurementSortNote } from '@/lib/presentation/measurement-order';
import { DataTable, type DataColumn } from '@/components/tables/data-table';
import { useLocalTableController } from '@/components/tables/local-data-table';
import { MeasurementValue } from '@/components/metrics/measurement-value';
import styles from './timeline-layout.module.css';
import type { TableController } from '@/lib/presentation/table-controller';
import type { ColumnVisibility } from '@/components/tables/table-columns';
import Link from 'next/link';
import type { CsvExportAlternative } from '@/components/exports/csv-export-dialog';
import { formatCount } from '@/lib/presentation/format';
import { contributionLinkLimitMessage } from '@/lib/presentation/contribution-return';
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
  const columns: DataColumn<Row>[] = [
    {
      id: 'period',
      label: 'Period',
      pinned: true,
      hideable: false,
      width: 210,
      selectionGroup: 'Period',
      description:
        'Calendar interval and actual covered dates in UTC. A partial period can still have complete data for its covered dates.',
      value: (row) => row.interval.covered.start,
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
    ...metrics.map((metric): DataColumn<Row> => ({
      ...metric,
      width: metric.unit === 'days' ? 150 : 136,
      align: 'right',
      value: (row) => timelineMeasurement(row.values, metric.id).value,
      sortGroup: (row) => measurementSortGroup(timelineMeasurement(row.values, metric.id)),
      sortNote: measurementSortNote,
      cell: (row) => {
        const measurement = timelineMeasurement(row.values, metric.id),
          href =
            measurement.value !== null ? controls?.detailHref?.(metric.id, row.interval.id) : null;
        const value = (
          <MeasurementValue
            measurement={timelineMeasurement(row.values, metric.id)}
            unit={metric.unit}
          />
        );
        return href ? (
          <Link
            prefetch={false}
            href={href}
            aria-label={`${metric.group ? metric.group + ' — ' : ''}${metric.label}, ${timelineIntervalLabel(row.interval, grouping)}: ${formatCount(measurement.value)}${metric.unit === 'days' ? ' d' : ''}`}
            className={styles.valueLink}
          >
            {value}
          </Link>
        ) : (
          <span
            title={
              controls?.detailHref && !controls.disabled && measurement.value !== null
                ? contributionLinkLimitMessage
                : undefined
            }
          >
            {value}
          </span>
        );
      },
    })),
  ];
  const incomplete = rows.some((row) =>
    metrics.some((metric) =>
      ['partial', 'missing'].includes(timelineMeasurement(row.values, metric.id).status),
    ),
  );
  return (
    <div className={styles.stack}>
      {incomplete && (
        <aside className={styles.notice} aria-label="Timeline data coverage">
          <strong>Some timeline values are incomplete or unavailable.</strong> Dashes keep missing
          values distinct from zero; an asterisk marks incomplete data. A partial period describes
          the covered dates.
        </aside>
      )}
      <DataTable
        title={title}
        disabled={controls?.disabled}
        rows={rows.map((row) => ({ ...row, id: row.interval.id }))}
        columns={columns}
        controller={controls?.controller ?? localController}
        exportName={controls?.csvDownload ? 'timeline-sample.csv' : undefined}
        csvDownload={controls?.csvDownload}
        exportContextKey={controls?.exportContextKey}
        searchable={false}
        visibility={controls?.visibility ?? { value: visible, onChange: setVisible }}
        itemLabel={{ singular: 'interval', plural: 'intervals' }}
        description="One row per calendar interval, with exact covered dates."
        footerNote="UTC · — unavailable or not applicable · * incomplete value"
      />
    </div>
  );
}
