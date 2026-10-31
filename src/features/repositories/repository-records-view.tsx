'use client';
import { accountTypeLabels } from '@/models/github-account';
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
import { prColumns, issueColumns } from './record-base-columns';
import styles from './repository-records.module.css';
import { mergeElapsedDays } from '@/lib/presentation/repository-insights';
export const actorLabels: Record<LatestActor, string> = {
  agent: accountTypeLabels.agent,
  bot: accountTypeLabels.bot,
  'prebid-reviewer': 'Prebid reviewer',
  contributor: 'Contributor',
  'other-human': 'Other human',
  unknown: accountTypeLabels.unknown,
};

function commonColumns<
  T extends { state: string; labels: string[]; createdAt: string },
>(): DataColumn<T>[] {
  return [
    { id: 'state', selectionGroup: 'Status', label: 'Status', value: (row) => row.state },
    {
      id: 'labels',
      selectionGroup: 'Status',
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
      selectionGroup: 'Dates and age',
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
    selectionGroup: 'Dates and age',
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
  {
    id: 'baseBranch',
    selectionGroup: 'Status',
    label: 'Base branch',
    value: (row) => row.baseBranch,
  },
  {
    id: 'mergedAt',
    selectionGroup: 'Dates and age',
    label: 'Merged',
    value: (row) => row.mergedAt,
    cell: (row) => (row.mergedAt ? formatUtcDate(row.mergedAt) : '—'),
  },
  {
    id: 'agentReviewer',
    selectionGroup: 'Automation',
    label: 'Agent reviewer',
    description:
      'Whether a mapped Prebid agent has provided qualifying reviewer participation on this PR. Approvals are separate.',
    value: (row) => (row.agentReviewer === null ? null : row.agentReviewer ? 'Yes' : 'No'),
  },
  {
    id: 'botReviewer',
    selectionGroup: 'Automation',
    label: 'Bot reviewer',
    description:
      'Whether another bot has provided qualifying reviewer participation on this PR, excluding mapped Prebid agents.',
    value: (row) => (row.botReviewer === null ? null : row.botReviewer ? 'Yes' : 'No'),
  },
  {
    id: 'latestActor',
    selectionGroup: 'Latest activity',
    label: 'Latest actor',
    description:
      'The account category responsible for the latest qualifying activity at the reporting snapshot.',
    value: (row) => actorLabels[row.latestActor],
  },
];
export const recordIssueColumns: DataColumn<RepositoryIssue>[] = [
  ...issueColumns.map((column) => ({
    ...column,
    width: column.id === 'title' ? 360 : column.id === 'author' ? 150 : 120,
  })),
  ...commonColumns<RepositoryIssue>(),
  {
    id: 'closedAt',
    selectionGroup: 'Dates and age',
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
  // Insight record tables keep their reviewed column set and defaults (status and labels shown),
  // which differ from record pages and Timeline supporting records; see repositoryRecordColumnDefaults.
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
  const title = titleOverride ?? recordListTitle(selection, list.author?.account);
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
