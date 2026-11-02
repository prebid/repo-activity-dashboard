'use client';
import { pendingTableQuery } from '@/lib/presentation/table-controller';
import { timelineSupportValueLimit } from '@/lib/presentation/timeline-support-query';
import Link from 'next/link';
import { DataTable, type DataColumn } from '@/components/tables/data-table';
import type { TableController } from '@/lib/presentation/table-controller';
import type { ColumnVisibility } from '@/components/tables/table-columns';
import type { TimelineSupport, TimelineAuthorRow } from '@/models/timeline-support';
import type { RepositoryPagePr, RepositoryPageIssue } from '@/models/repository-page';
import {
  repositoryPagePrColumns,
  repositoryPageIssueColumns,
  repositoryInlineColumnIds,
} from './repository-page-columns';
import { GitHubAccountLink } from '@/components/github/account-link';
import { AccountTypeLabel, Avatar } from '@/components/github/avatar';
import { accountTypeLabels } from '@/models/github-account';
import drillable from '@/components/metrics/drillable-number.module.css';
import pageStyles from './repository-page.module.css';
import { timelineSupportContextColumns } from '@/lib/presentation/timeline-support-csv';
export function timelineAuthorColumns(
  href?: (account: string) => string | null,
  onFollow?: React.MouseEventHandler<HTMLAnchorElement>,
): DataColumn<TimelineAuthorRow>[] {
  return [
    {
      id: 'account',
      label: 'GitHub account',
      pinned: true,
      hideable: false,
      value: (row) => row.account,
      cell: (row) => (
        <div className={pageStyles.account}>
          <Avatar kind="person" name={row.account} accountType={row.accountType} size={32} />
          <GitHubAccountLink login={row.account} url={row.profileUrl} label={'@' + row.account} />
          <AccountTypeLabel accountType={row.accountType} />
        </div>
      ),
    },
    {
      id: 'accountType',
      label: 'Account type',
      value: (row) => accountTypeLabels[row.accountType],
    },
    {
      id: 'recordCount',
      label: 'Records authored',
      align: 'right',
      value: (row) => row.recordCount,
      cell: (row) => {
        const link = href?.(row.account);
        return link ? (
          <Link
            prefetch={false}
            className={drillable.link}
            href={link}
            onClick={onFollow}
            aria-label={`${row.account}: ${row.recordCount} authored records`}
          >
            {row.recordCount}
          </Link>
        ) : (
          row.recordCount
        );
      },
    },
  ];
}
// Every column whose value a backlog snapshot supplies for its cutoff, not today's state.
const snapshotColumnIds = new Set([
  'approvals',
  'ageDays',
  'humanReviewers',
  'latestActivity',
  'latestActor',
  'agentReviewer',
  'botReviewer',
  'assignees',
]);
export function repositoryTimelineSupportColumns(kind: 'prs' | 'issues', snapshot: boolean) {
  const columns: DataColumn<RepositoryPagePr | RepositoryPageIssue>[] = (
    kind === 'prs' ? repositoryPagePrColumns : repositoryPageIssueColumns
  ) as DataColumn<RepositoryPagePr | RepositoryPageIssue>[];
  return columns
    .filter((column) => !repositoryInlineColumnIds.has(column.id))
    .map((column) =>
      snapshot && snapshotColumnIds.has(column.id)
        ? {
            ...column,
            // The review-count names match the Backlog at cutoff filter fields.
            label:
              column.id === 'approvals'
                ? 'Human approvals at cutoff'
                : column.id === 'humanReviewers'
                  ? 'Human reviewers at cutoff'
                  : column.id === 'ageDays'
                    ? 'Age at cutoff (days)'
                    : column.label,
            description: 'Supplied historical value at the exact covered interval cutoff.',
          }
        : column,
    );
}
export function RepositoryTimelineSupportView({
  detail,
  controller,
  visibility,
  disabled,
  authorHref,
  onAuthor,
}: {
  detail: Exclude<TimelineSupport, { kind: 'contribution' }>;
  controller: TableController;
  visibility: ColumnVisibility;
  disabled: boolean;
  authorHref: (account: string) => string | null;
  onAuthor: React.MouseEventHandler<HTMLAnchorElement>;
}) {
  const query = pendingTableQuery(controller);
  if (detail.kind === 'authors') {
    const columns = timelineAuthorColumns(authorHref, onAuthor);
    return (
      <DataTable
        search="local"
        searchMaxLength={timelineSupportValueLimit}
        title="Unique authors"
        rows={detail.rows}
        columns={columns}
        controller={controller}
        visibility={visibility}
        disabled={disabled}
        exportName="timeline-authors-sample.csv"
        exportColumns={[
          ...columns,
          ...timelineSupportContextColumns<TimelineAuthorRow>(detail.context, query),
        ]}
        exportContextKey={JSON.stringify([detail.context, query])}
        itemLabel={{ singular: 'author', plural: 'authors' }}
        description="One row per unique account. Choose a record count to inspect that author's matching PRs or issues."
      />
    );
  }
  const columns = repositoryTimelineSupportColumns(
    detail.recordKind,
    detail.descriptor.basis === 'snapshot',
  );
  const rows = detail.rows;
  return (
    <div className={pageStyles.records}>
      <DataTable
        search="local"
        searchMaxLength={timelineSupportValueLimit}
        title={
          detail.author
            ? 'Records by @' + detail.author
            : detail.descriptor.basis === 'duration'
              ? 'Merged PRs supporting the median'
              : detail.recordKind === 'prs'
                ? 'Supporting pull requests'
                : 'Supporting issues'
        }
        rows={rows}
        columns={columns}
        controller={controller}
        visibility={visibility}
        disabled={disabled}
        exportName="timeline-records-sample.csv"
        exportColumns={[
          ...columns,
          { id: 'recordId', label: 'Record ID', value: (row) => row.id },
          {
            id: 'recordState',
            label: detail.descriptor.basis === 'snapshot' ? 'State at cutoff' : 'Current state',
            value: (row) => row.state,
          },
          { id: 'recordLabels', label: 'Labels', value: (row) => row.labels.join(', ') },
          {
            id: 'authorType',
            label: 'Author type',
            value: (row) => accountTypeLabels[row.authorType ?? 'unknown'],
          },
          { id: 'basis', label: 'Counting basis', value: () => detail.descriptor.basis },
          {
            id: 'cutoffAt',
            label: 'Historical cutoff (UTC)',
            value: () =>
              detail.descriptor.basis === 'snapshot' ? detail.descriptor.cutoff.at : null,
          },
          {
            id: 'cutoffInclusive',
            label: 'Historical cutoff inclusive',
            value: () =>
              detail.descriptor.basis === 'snapshot'
                ? String(detail.descriptor.cutoff.inclusive)
                : null,
          },
          { id: 'recordUrl', label: 'GitHub record URL', value: (row) => row.url },
          ...timelineSupportContextColumns<RepositoryPagePr | RepositoryPageIssue>(
            detail.context,
            query,
            detail.author,
          ),
        ]}
        exportContextKey={JSON.stringify([detail.context, query, detail.author])}
        empty={{
          kind: rows.length ? 'no-match' : 'empty',
          title: 'No supporting records in this interval',
        }}
        itemLabel={{ singular: 'record', plural: 'records' }}
        description={
          detail.descriptor.basis === 'snapshot'
            ? 'These rows use the supplied historical state at the exact interval cutoff.'
            : detail.descriptor.basis === 'duration'
              ? 'The Timeline value is the median of these merged PR durations, not their sum.'
              : 'Only records matching the Timeline metric, dates and filters are included.'
        }
        footerNote="Table search narrows displayed and exported records. The full Timeline interval value stays unchanged."
      />
    </div>
  );
}
