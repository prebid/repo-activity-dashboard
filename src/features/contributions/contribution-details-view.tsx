'use client';
import { accountTypeLabels } from '@/models/github-account';
import { measurementSortGroup, measurementSortNote } from '@/lib/presentation/measurement-order';
import { additionalMetricDefinitions } from '@/models/contribution-activity';
import { ArrowUpRight } from 'lucide-react';
import { DataTable, type DataColumn } from '@/components/tables/data-table';
import { MeasurementValue } from '@/components/metrics/measurement-value';
import { GitHubAccountLink } from '@/components/github/account-link';
import type { ColumnVisibility } from '@/components/tables/table-columns';
import type { TableController } from '@/lib/presentation/table-controller';
import { formatAsOf } from '@/lib/presentation/format';
import type { ContributionPage } from '@/models/contribution-page';
import type {
  ContributionMetricDetails,
  ContributionSupportingRow,
} from '@/models/contribution-details';
import {
  isCoreMetric,
  reportMetricLabel,
  reportMetricDescription,
} from '@/models/contribution-metrics';
import { contributionContextColumns } from '@/lib/presentation/contribution-csv';
import { ContributionHeader } from './contribution-header';
import type { ContributionLinks } from './contribution-columns';
import styles from './contributions.module.css';
export const contributionDetailColumnIds = [
  'record',
  'account',
  'actorType',
  'company',
  'repository',
  'state',
  'creditedAt',
  'lastAt',
  'value',
];
export function contributionDetailColumns(
  details: ContributionMetricDetails,
): DataColumn<ContributionSupportingRow>[] {
  return [
    {
      id: 'record',
      selectionGroup: 'Identity',
      label:
        details.metric === 'issuesAuthored' || details.metric === 'issueComments'
          ? 'Issue'
          : 'Pull request',
      pinned: true,
      hideable: false,
      width: 280,
      value: (row) => '#' + row.record.number + ' ' + row.record.title,
      cell: (row) => (
        <a
          className={styles.identityLink + ' ' + styles.recordLink}
          href={row.record.url}
          target="_blank"
          rel="noopener noreferrer"
          title="Sample record placeholder; real records will open on GitHub."
        >
          #{row.record.number} {row.record.title} <ArrowUpRight size={12} aria-hidden="true" />
        </a>
      ),
    },
    {
      id: 'account',
      selectionGroup: 'Identity',
      label: 'Credited account',
      width: 160,
      value: (row) => row.account.name + ' ' + row.account.login,
      cell: (row) => (
        <GitHubAccountLink
          login={row.account.login}
          url={row.account.profileUrl}
          label={'@' + row.account.login}
        />
      ),
    },
    {
      id: 'actorType',
      selectionGroup: 'Identity',
      label: 'Account type',
      width: 110,
      value: (row) => accountTypeLabels[row.account.actorType],
    },
    {
      id: 'company',
      selectionGroup: 'Identity',
      label: 'Current company',
      width: 130,
      value: (row) => row.company?.name ?? 'Unmapped company',
    },
    {
      id: 'repository',
      selectionGroup: 'Identity',
      label: 'Repository',
      width: 150,
      value: (row) => row.repository.name,
    },
    {
      id: 'state',
      selectionGroup: 'Status',
      label: 'Current state',
      width: 90,
      value: (row) =>
        row.record.kind === 'pr' && row.record.draft && row.record.state === 'Open'
          ? 'Draft'
          : row.record.state,
    },
    {
      id: 'creditedAt',
      selectionGroup: 'Activity',
      label:
        details.basis === 'merged-volume'
          ? 'Merged on'
          : details.basis === 'comments'
            ? 'First comment'
            : 'Credited on',
      description: reportMetricDescription(details.metric),
      width: 155,
      value: (row) => row.creditedAt,
      cell: (row) => <time dateTime={row.creditedAt}>{formatAsOf(row.creditedAt)}</time>,
    },
    ...(details.basis === 'comments'
      ? [
          {
            id: 'lastAt',
            selectionGroup: 'Activity',
            label: 'Last comment',
            width: 155,
            value: (row: ContributionSupportingRow) => row.lastAt,
            cell: (row: ContributionSupportingRow) => (
              <time dateTime={row.lastAt}>{formatAsOf(row.lastAt)}</time>
            ),
          },
        ]
      : []),
    {
      id: 'value',
      selectionGroup: 'Activity',
      label:
        details.basis === 'credit'
          ? 'Credits'
          : details.basis === 'comments'
            ? 'Comments'
            : isCoreMetric(details.metric)
              ? reportMetricLabel(details.metric)
              : additionalMetricDefinitions[details.metric].label,
      width: 110,
      align: 'right',
      value: (row) => row.value.value,
      sortGroup: (row) => measurementSortGroup(row.value),
      sortNote: measurementSortNote,
      cell: (row) => <MeasurementValue measurement={row.value} />,
    },
  ];
}
export function ContributionDetailsView({
  page,
  details,
  controller,
  links,
  controls,
  visibility,
}: {
  page: ContributionPage;
  details: ContributionMetricDetails;
  controller: TableController;
  links: ContributionLinks;
  controls?: React.ReactNode;
  visibility?: ColumnVisibility;
}) {
  const columns = contributionDetailColumns(details);
  const query = { ...controller.query, search: controller.draftSearch };
  const exportColumns: DataColumn<ContributionSupportingRow>[] = [
    ...columns,
    { id: 'recordId', label: 'Record ID', value: (row) => row.record.id },
    { id: 'recordURL', label: 'GitHub record URL', value: (row) => row.record.url },
    { id: 'accountId', label: 'Account ID', value: (row) => row.account.id },
    { id: 'login', label: 'GitHub account', value: (row) => row.account.login },
    { id: 'repositoryId', label: 'Repository ID', value: (row) => row.repository.id },
    { id: 'metric', label: 'Metric', value: () => details.metric },
    {
      id: 'valueCoverage',
      exportWith: 'value',
      label: 'Value coverage',
      value: (row) => row.value.status,
    },
    {
      id: 'valueReason',
      exportWith: 'value',
      label: 'Value coverage detail',
      value: (row) => (row.value.status === 'complete' ? '' : row.value.reason),
    },
    { id: 'total', label: 'Full report total', value: () => details.measurement.value },
    { id: 'totalCoverage', label: 'Full report coverage', value: () => details.measurement.status },
    {
      id: 'totalCoverageReason',
      label: 'Full report coverage detail',
      value: () => (details.measurement.status === 'complete' ? '' : details.measurement.reason),
    },
    ...contributionContextColumns<ContributionSupportingRow>(details.context, query),
  ];
  return (
    <>
      <ContributionHeader page={page} links={links} controls={controls} />
      <section
        className={styles.totals + ' ' + styles.detailTotals}
        aria-label="Supporting record totals"
      >
        <dl>
          <div>
            <dt>{reportMetricLabel(details.metric)}</dt>
            <dd>
              <MeasurementValue measurement={details.measurement} />
            </dd>
          </div>
          <div>
            <dt>Account / record rows</dt>
            <dd>{details.rows.length}</dd>
          </div>
          <div>
            <dt>
              Distinct{' '}
              {details.metric === 'issuesAuthored' || details.metric === 'issueComments'
                ? 'issues'
                : 'PRs'}
            </dt>
            <dd>{details.distinctRecords}</dd>
          </div>
        </dl>
      </section>
      {details.measurement.status !== 'complete' && (
        <aside className={styles.notice} aria-label="Detail coverage">
          {details.measurement.reason} Only supplied records and values are shown; missing history
          is not zero.
        </aside>
      )}
      <DataTable
        title={reportMetricLabel(details.metric)}
        description={
          <>
            {reportMetricDescription(details.metric)}{' '}
            {details.basis === 'credit'
              ? 'Each row is one account’s contribution on one record; several accounts can share a PR.'
              : details.basis === 'comments'
                ? 'Comments are grouped by account and record. No comment text is included.'
                : 'Each row carries the final merged volume for one qualifying account and PR. Several accounts can share the same PR volume.'}
          </>
        }
        rows={details.rows}
        columns={columns}
        controller={controller}
        visibility={visibility}
        exportName="contribution-details-sample.csv"
        exportContextKey={JSON.stringify([details.context, details.metric])}
        exportColumns={exportColumns}
        emptyTitle="No supporting records in this scope"
        itemLabel={{ singular: 'account / record row', plural: 'account / record rows' }}
        footerNote="Totals describe the full report scope. Table search narrows displayed and exported supporting rows."
      />
    </>
  );
}
