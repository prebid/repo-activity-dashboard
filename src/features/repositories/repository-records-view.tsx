'use client';
import Link from 'next/link';
import { useState } from 'react';
import { DataTable, type DataColumn } from '@/components/tables/data-table';
import { PageState } from '@/components/feedback/page-state';
import type { TableController } from '@/lib/presentation/table-controller';
import { formatAsOf, formatCount, formatUtcDate } from '@/lib/presentation/format';
import { periodRangeLabel } from '@/lib/presentation/overview-periods';
import { repositoryDrilldownHref } from '@/lib/presentation/repository-drilldown';
import { recordListTitle } from '@/lib/presentation/repository-records';
import type {
  RepositoryRecordList,
  RepositoryPullRequest,
  RepositoryIssue,
  LatestActor,
} from '@/models/repository-records';
import { prColumns, issueColumns } from './repository-view';
import styles from './repository-records.module.css';
const actorLabels: Record<LatestActor, string> = {
  agent: 'Prebid agent',
  bot: 'Other bot',
  'prebid-reviewer': 'Prebid reviewer',
  contributor: 'Contributor',
  'other-human': 'Other human',
  unknown: 'Unknown',
};

function commonColumns<
  T extends { state: string; labels: string[]; createdAt: string },
>(): DataColumn<T>[] {
  return [
    { id: 'state', label: 'Status', value: (row) => row.state },
    {
      id: 'labels',
      label: 'Labels',
      value: (row) => row.labels.join(', '),
      cell: (row) => (
        <div className={styles.labels}>
          {row.labels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      ),
    },
    {
      id: 'createdAt',
      label: 'Created',
      value: (row) => row.createdAt,
      cell: (row) => formatUtcDate(row.createdAt),
    },
  ];
}
export const recordPrColumns: DataColumn<RepositoryPullRequest>[] = [
  ...prColumns.map((column) => ({
    ...column,
    width: column.id === 'title' ? 360 : column.id === 'author' ? 150 : 120,
  })),
  ...commonColumns<RepositoryPullRequest>(),
  { id: 'baseBranch', label: 'Base branch', value: (row) => row.baseBranch },
  {
    id: 'mergedAt',
    label: 'Merged',
    value: (row) => row.mergedAt,
    cell: (row) => (row.mergedAt ? formatUtcDate(row.mergedAt) : '—'),
  },
  {
    id: 'agentReviewer',
    label: 'Agent reviewer',
    value: (row) => (row.agentReviewer === null ? null : row.agentReviewer ? 'Yes' : 'No'),
  },
  {
    id: 'botReviewer',
    label: 'Bot reviewer',
    value: (row) => (row.botReviewer === null ? null : row.botReviewer ? 'Yes' : 'No'),
  },
  { id: 'latestActor', label: 'Latest actor', value: (row) => actorLabels[row.latestActor] },
];
export const recordIssueColumns: DataColumn<RepositoryIssue>[] = [
  ...issueColumns.map((column) => ({
    ...column,
    width: column.id === 'title' ? 360 : column.id === 'author' ? 150 : 120,
  })),
  ...commonColumns<RepositoryIssue>(),
  {
    id: 'closedAt',
    label: 'Closed',
    value: (row) => row.closedAt,
    cell: (row) => (row.closedAt ? formatUtcDate(row.closedAt) : '—'),
  },
];
function RecordTable({
  list,
  controller,
}: {
  list: RepositoryRecordList;
  controller: TableController;
}) {
  const selection = list.drilldown.selection;
  const merged = selection.metric === 'prsMerged';
  const [visible, setVisible] = useState<Record<string, boolean>>({
    humanReviewers: selection.metric.startsWith('humanReviewers'),
    approvals: selection.metric.startsWith('humanApprovals'),
    ageDays: selection.metric === 'agedPrs',
    baseBranch: merged,
    mergedAt: merged,
    closedAt: selection.metric === 'issuesClosed',
    agentReviewer: selection.metric === 'agentFeedbackPrs',
    botReviewer: selection.metric === 'botFeedbackPrs',
    latestActor: selection.metric.startsWith('last'),
  });
  const visibility = { value: visible, onChange: setVisible };
  const title = recordListTitle(selection);
  return list.kind === 'prs' ? (
    <DataTable
      title={title}
      rows={list.rows}
      columns={recordPrColumns}
      controller={controller}
      visibility={visibility}
      footerNote="Sample record links are placeholders. Reviewers and current approvals are separate measures."
    />
  ) : (
    <DataTable
      title={title}
      rows={list.rows}
      columns={recordIssueColumns}
      controller={controller}
      visibility={visibility}
      footerNote="Sample record links are placeholders. Titles, labels, and top-level metadata only."
    />
  );
}
export function RepositoryRecordsView({
  list,
  controller,
}: {
  list: RepositoryRecordList;
  controller: TableController;
}) {
  const { repository, drilldown, measurement } = list,
    selection = drilldown.selection;
  const title = recordListTitle(selection);
  const known = measurement.value !== null;
  const period = selection.scope === 'period';
  return (
    <>
      <Link prefetch={false} href={drilldown.returnTo} className={styles.back}>
        ← All repositories
      </Link>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Repository detail</p>
          <h1>{repository.name}</h1>
          <p>{title}</p>
        </div>
        <p className={styles.snapshot}>
          Reporting snapshot
          <br />
          {formatAsOf(list.asOf)}
        </p>
      </header>
      <div className={styles.scope} aria-label="Selected repository scope" role="region">
        <span>{period ? periodRangeLabel(selection.range) + ' · UTC' : 'Current open items'}</span>
        {period && selection.metric === 'prsMerged' && (
          <span>Primary branch: {selection.branch}</span>
        )}
        {!period &&
          selection.metric !== 'totalOpenPrs' &&
          selection.metric !== 'draftPrs' &&
          selection.metric !== 'openIssues' && <span>Excludes drafts</span>}
        <span>
          {known
            ? formatCount(measurement.value) +
              (measurement.status === 'partial' ? ' available sample records' : ' matching records')
            : 'Sample records unavailable'}
        </span>
      </div>
      <nav aria-label="Current repository lists" className={styles.navigation}>
        <Link
          prefetch={false}
          href={repositoryDrilldownHref(repository, {
            selection: { scope: 'current', metric: 'totalOpenPrs' },
            returnTo: drilldown.returnTo,
          })}
        >
          All open PRs
        </Link>
        <Link
          prefetch={false}
          href={repositoryDrilldownHref(repository, {
            selection: { scope: 'current', metric: 'openIssues' },
            returnTo: drilldown.returnTo,
          })}
        >
          All open issues
        </Link>
      </nav>
      {measurement.status === 'partial' && (
        <p role="status" className={styles.notice}>
          Partial sample coverage: {measurement.reason} This list contains the available records
          only.
        </p>
      )}
      {!known ? (
        <PageState title="Sample records unavailable">{measurement.reason}</PageState>
      ) : (
        <RecordTable key={JSON.stringify(selection)} list={list} controller={controller} />
      )}
    </>
  );
}
