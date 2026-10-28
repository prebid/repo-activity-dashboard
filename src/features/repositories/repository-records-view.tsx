'use client';
import { useState } from 'react';
import { DataTable, type DataColumn } from '@/components/tables/data-table';
import type { TableController } from '@/lib/presentation/table-controller';
import { formatCount, formatUtcDate } from '@/lib/presentation/format';
import { recordListTitle } from '@/lib/presentation/repository-records';
import type {
  RepositoryRecordList,
  RepositoryPullRequest,
  RepositoryIssue,
  LatestActor,
} from '@/models/repository-records';
import { prColumns, issueColumns } from './repository-view';
import styles from './repository-records.module.css';
import { RepositoryDrilldownFrame } from './repository-drilldown-frame';
import { mergeElapsedDays } from '@/lib/presentation/repository-insights';
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
  {
    id: 'mergeDays',
    label: 'Merge time',
    width: 120,
    align: 'right',
    description: 'Elapsed calendar days from PR creation to merge.',
    value: (row) => mergeElapsedDays(row.createdAt, row.mergedAt),
    cell: (row) => {
      const days = mergeElapsedDays(row.createdAt, row.mergedAt);
      return days === null ? '—' : formatCount(days) + ' d';
    },
  },
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
export function RepositoryRecordTable({
  list,
  controller,
  title: titleOverride,
  showMergeDuration = false,
}: {
  list: RepositoryRecordList;
  controller: TableController;
  title?: string;
  showMergeDuration?: boolean;
}) {
  const selection = list.drilldown.selection;
  const merged = selection.metric === 'prsMerged';
  const [visible, setVisible] = useState<Record<string, boolean>>({
    humanReviewers: selection.metric.startsWith('humanReviewers'),
    approvals: selection.metric.startsWith('humanApprovals'),
    ageDays: selection.metric === 'agedPrs',
    mergeDays: showMergeDuration,
    baseBranch: merged,
    mergedAt: merged,
    closedAt: selection.metric === 'issuesClosed',
    agentReviewer: selection.metric === 'agentFeedbackPrs',
    botReviewer: selection.metric === 'botFeedbackPrs',
    latestActor: selection.metric.startsWith('last'),
  });
  const visibility = { value: visible, onChange: setVisible };
  const title = titleOverride ?? recordListTitle(selection);
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
  const measurement = list.measurement;
  return (
    <RepositoryDrilldownFrame
      context={list}
      title={recordListTitle(list.drilldown.selection)}
      measurement={measurement}
      summary={
        <span>
          {formatCount(measurement.value) +
            (measurement.status === 'partial' ? ' available sample records' : ' matching records')}
        </span>
      }
    >
      <RepositoryRecordTable
        key={JSON.stringify(list.drilldown.selection)}
        list={list}
        controller={controller}
      />
    </RepositoryDrilldownFrame>
  );
}
