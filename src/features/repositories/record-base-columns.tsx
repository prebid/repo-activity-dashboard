'use client';
import { accountTypeLabels } from '@/models/github-account';
import { GitHubAccountLink } from '@/components/github/account-link';
import type { DataColumn } from '@/components/tables/data-table';
import { MetricValue } from '@/components/metrics/metric-value';
import { formatDays, formatUtcDate } from '@/lib/presentation/format';
import { mergeElapsedDays } from '@/lib/presentation/repository-insights';
import type { PullRequestRow, IssueRow } from '@/models/reporting';
import type {
  RepositoryPullRequest,
  RepositoryIssue,
  LatestActor,
} from '@/models/repository-records';

// The record columns' values; repository-page-columns.tsx draws the record row's number, title and
// author cells over them.
export const prColumns: DataColumn<PullRequestRow>[] = [
  { id: 'number', selectionGroup: 'Identity', label: 'PR', value: (r) => r.number },
  {
    id: 'title',
    selectionGroup: 'Identity',
    label: 'Title',
    value: (r) => r.title + (r.draft ? ' (Draft)' : ''),
  },
  {
    id: 'author',
    selectionGroup: 'Identity',
    label: 'Author',
    description:
      'The record author. The account link opens its GitHub profile; sample identities use placeholder destinations.',
    value: (r) => r.author,
    cell: (r) => <GitHubAccountLink login={r.author} url={r.authorUrl} />,
  },
  {
    id: 'humanReviewers',
    selectionGroup: 'Human review',
    label: 'Human reviewers',
    description:
      'Distinct non-author humans who commented, inline-commented or requested changes. Repeated participation counts once; approvals remain separate.',
    value: (r) => r.humanReviewers,
  },
  {
    id: 'approvals',
    selectionGroup: 'Human review',
    label: 'Current human approvals',
    description:
      'Distinct human accounts with an effective approval at the reporting snapshot. Reapprovals do not multiply the current count.',
    value: (r) => r.approvals,
    cell: (r) => <MetricValue value={r.approvals} />,
  },
  {
    id: 'ageDays',
    selectionGroup: 'Dates and age',
    label: 'Age in days',
    description: 'Elapsed days since creation at the reporting snapshot.',
    value: (r) => r.ageDays,
  },
];
export const issueColumns: DataColumn<IssueRow>[] = [
  { id: 'number', selectionGroup: 'Identity', label: 'Issue', value: (r) => r.number },
  { id: 'title', selectionGroup: 'Identity', label: 'Title', value: (r) => r.title },
  {
    id: 'author',
    selectionGroup: 'Identity',
    label: 'Author',
    description:
      'The record author. The account link opens its GitHub profile; sample identities use placeholder destinations.',
    value: (r) => r.author,
    cell: (r) => <GitHubAccountLink login={r.author} url={r.authorUrl} />,
  },
  {
    id: 'ageDays',
    selectionGroup: 'Dates and age',
    label: 'Age in days',
    description: 'Elapsed days since creation at the reporting snapshot.',
    value: (r) => r.ageDays,
  },
];
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
    // 200px keeps a typical handle and its 14px external-link icon on one line.
    width: column.id === 'title' ? 360 : column.id === 'author' ? 200 : 120,
    grow: column.id === 'title',
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
    cell: (row) => formatDays(mergeElapsedDays(row.createdAt, row.mergedAt)),
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
    // 200px keeps a typical handle and its 14px external-link icon on one line.
    width: column.id === 'title' ? 360 : column.id === 'author' ? 200 : 120,
    grow: column.id === 'title',
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
