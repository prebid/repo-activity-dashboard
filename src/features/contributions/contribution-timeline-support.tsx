'use client';
import { pendingTableQuery } from '@/lib/presentation/table-controller';
import { timelineSupportValueLimit } from '@/lib/presentation/timeline-support-query';
import type { TimelineSupport } from '@/models/timeline-support';
import { DataTable } from '@/components/tables/data-table';
import type { TableController } from '@/lib/presentation/table-controller';
import type { ColumnVisibility } from '@/components/tables/table-columns';
import {
  contributionDetailColumns,
  contributionDetailExportColumns,
  supportingEmptyKind,
} from './contribution-details-view';
import { timelineSupportContextColumns } from '@/lib/presentation/timeline-support-csv';
import { reportMetricDescription } from '@/models/contribution-metrics';
import { MeasurementValue } from '@/components/metrics/measurement-value';
export function ContributionTimelineSupportView({
  detail,
  controller,
  visibility,
  disabled,
}: {
  detail: Extract<TimelineSupport, { kind: 'contribution' }>;
  controller: TableController;
  visibility: ColumnVisibility;
  disabled: boolean;
}) {
  const columns = contributionDetailColumns(detail.details),
    query = pendingTableQuery(controller);
  return (
    <DataTable
      search="local"
      searchMaxLength={timelineSupportValueLimit}
      title="Supporting contributions"
      rows={detail.details.rows}
      columns={columns}
      controller={controller}
      visibility={visibility}
      disabled={disabled}
      description={
        <>
          {reportMetricDescription(detail.details.metric)}{' '}
          {detail.details.context.includedAccountCount} included accounts ·{' '}
          {detail.details.distinctRecords} distinct records · Sum of row values:{' '}
          <MeasurementValue measurement={detail.details.measurement} />
        </>
      }
      footerNote="One row per account and record; comments are grouped. Search narrows displayed/exported rows, not the full Timeline value."
      exportName="timeline-contributions-sample.csv"
      exportContextKey={JSON.stringify([detail.context, query])}
      exportColumns={[
        ...columns,
        { id: 'basis', label: 'Counting basis', value: () => detail.details.basis },
        {
          id: 'definition',
          label: 'Metric definition',
          value: () => reportMetricDescription(detail.details.metric),
        },
        ...contributionDetailExportColumns(),
        ...timelineSupportContextColumns(detail.context, query, undefined, true),
      ]}
      itemLabel={{ singular: 'account / record row', plural: 'account / record rows' }}
      empty={{
        kind: supportingEmptyKind(detail.details),
        title: 'No supporting contributions in this interval',
      }}
    />
  );
}
