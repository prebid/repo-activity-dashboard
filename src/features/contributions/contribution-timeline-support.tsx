'use client';
import { pendingTableQuery } from '@/lib/presentation/table-controller';
import { timelineSupportValueLimit } from '@/lib/presentation/timeline-support-query';
import type { TimelineSupport } from '@/models/timeline-support';
import { DataTable } from '@/components/tables/data-table';
import type { TableController } from '@/lib/presentation/table-controller';
import type { ColumnVisibility } from '@/components/tables/table-columns';
import { contributionDetailColumns } from './contribution-details-view';
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
        { id: 'recordId', label: 'Record ID', value: (row) => row.record.id },
        { id: 'recordUrl', label: 'GitHub record URL', value: (row) => row.record.url },
        { id: 'accountId', label: 'Account ID', value: (row) => row.account.id },
        { id: 'repositoryId', label: 'Repository ID', value: (row) => row.repository.id },
        {
          id: 'rowCoverage',
          label: 'Value coverage',
          exportWith: 'value',
          value: (row) => row.value.status,
        },
        {
          id: 'rowReason',
          label: 'Value coverage detail',
          exportWith: 'value',
          value: (row) => (row.value.status === 'complete' ? '' : row.value.reason),
        },
        ...timelineSupportContextColumns(detail.context, query),
      ]}
      itemLabel={{ singular: 'account / record row', plural: 'account / record rows' }}
      emptyTitle="No supporting contributions in this interval"
    />
  );
}
